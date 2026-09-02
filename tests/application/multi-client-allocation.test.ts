import { describe, expect, it } from "vitest";

import {
  MultiClientAllocationService,
  type ClientWorkRequest,
} from "../../src/application/multi-client-allocation.js";
import { StandbyActivationService } from "../../src/application/standby-activation.js";
import { DomainError } from "../../src/domain/errors.js";
import { FleetInventory } from "../../src/domain/fleet-inventory.js";
import { WorkRequest } from "../../src/domain/work-request.js";
import type { AllocationStrategy } from "../../src/strategies/allocation-strategy.js";
import { CategoryDistributionStrategy } from "../../src/strategies/category-distribution-strategy.js";
import { CostOptimizedStrategy } from "../../src/strategies/cost-optimized-strategy.js";
import { TEST_ROBOT_CATALOG } from "../support/robot-catalog.js";

const strategy = new CostOptimizedStrategy();
const service = new MultiClientAllocationService(
  new StandbyActivationService(strategy),
);

function clients(...hours: number[]): ClientWorkRequest[] {
  return hours.map((requestedHours, index) => ({
    clientId: index + 1,
    request: WorkRequest.create(requestedHours),
  }));
}

describe("MultiClientAllocationService", () => {
  it("uses stable highest-hours priority and consumes one shared active inventory", () => {
    const inventory = FleetInventory.create({
      alpha: 4,
      bravo: 4,
      charlie: 4,
      delta: 4,
    });
    const clientRequests = clients(12, 20, 20, 7);

    const result = service.allocate({
      activeInventory: inventory,
      clients: clientRequests,
      strategy,
      catalog: TEST_ROBOT_CATALOG,
    });

    expect(result.policyName).toBe("Cost optimised");
    expect(result.clients.map((client) => client.clientId)).toEqual([
      2, 3, 1, 4,
    ]);
    expect(result.clients.map((client) => client.priority)).toEqual([
      1, 2, 3, 4,
    ]);
    expect(result.clients.map((client) => client.requestedHours)).toEqual([
      20, 20, 12, 7,
    ]);
    expect(
      result.clients.every((client) => client.status === "allocated"),
    ).toBe(true);

    const activeAssignments = result.clients.map((client) => {
      if (client.status === "infeasible") {
        throw new Error("Expected every client to be fulfilled");
      }

      return client.activeRobots.toRecord();
    });

    expect(activeAssignments).toEqual([
      { alpha: 1, bravo: 1, charlie: 0, delta: 2 },
      { alpha: 1, bravo: 1, charlie: 0, delta: 2 },
      { alpha: 1, bravo: 2, charlie: 1, delta: 0 },
      { alpha: 0, bravo: 0, charlie: 2, delta: 0 },
    ]);
    expect(result.remainingActiveInventory.toRecord()).toEqual({
      alpha: 1,
      bravo: 0,
      charlie: 1,
      delta: 0,
    });
    expect(result.summary).toEqual({
      totalClients: 4,
      fulfilledClients: 4,
      totalActiveRobotsUsed: 14,
      totalStandbyRobotsUsed: 0,
      totalRobotsUsed: 14,
      totalChargingCost: 36,
      activeRobotUtilisationPercent: {
        average: 87.5,
        byRobotType: {
          alpha: 75,
          bravo: 100,
          charlie: 75,
          delta: 100,
        },
      },
    });
    expect(inventory.toRecord()).toEqual({
      alpha: 4,
      bravo: 4,
      charlie: 4,
      delta: 4,
    });
    expect(clientRequests.map((client) => client.clientId)).toEqual([
      1, 2, 3, 4,
    ]);
  });

  it("activates standby per client after shared active capacity is consumed", () => {
    const result = service.allocate({
      activeInventory: FleetInventory.create({
        alpha: 1,
        bravo: 1,
        charlie: 1,
        delta: 1,
      }),
      clients: clients(10, 21),
      strategy,
      catalog: TEST_ROBOT_CATALOG,
    });

    expect(result.clients.map((client) => client.clientId)).toEqual([2, 1]);
    expect(result.clients[0]).toMatchObject({
      clientId: 2,
      priority: 1,
      requestedHours: 21,
      status: "standby-activated",
      shortfallHours: 4,
    });
    expect(result.clients[1]).toMatchObject({
      clientId: 1,
      priority: 2,
      requestedHours: 10,
      status: "standby-activated",
      shortfallHours: 10,
    });

    const [first, second] = result.clients;

    if (
      first?.status !== "standby-activated" ||
      second?.status !== "standby-activated"
    ) {
      throw new Error("Expected both clients to use standby robots");
    }

    expect(first.activeRobots.toRecord()).toEqual({
      alpha: 1,
      bravo: 1,
      charlie: 1,
      delta: 1,
    });
    expect(first.standbyRobots.toRecord()).toEqual({
      alpha: 1,
      bravo: 1,
      charlie: 0,
      delta: 0,
    });
    expect(first.allocation.calculateProvidedHours(TEST_ROBOT_CATALOG)).toBe(
      21,
    );
    expect(first.allocation.calculateExcessHours(TEST_ROBOT_CATALOG)).toBe(0);
    expect(first.allocation.calculateChargingCost(TEST_ROBOT_CATALOG)).toBe(13);

    expect(second.activeRobots.toRecord()).toEqual({
      alpha: 0,
      bravo: 0,
      charlie: 0,
      delta: 0,
    });
    expect(second.standbyRobots.toRecord()).toEqual({
      alpha: 0,
      bravo: 0,
      charlie: 2,
      delta: 0,
    });
    expect(second.allocation.calculateProvidedHours(TEST_ROBOT_CATALOG)).toBe(
      10,
    );
    expect(second.allocation.calculateExcessHours(TEST_ROBOT_CATALOG)).toBe(0);
    expect(second.allocation.calculateChargingCost(TEST_ROBOT_CATALOG)).toBe(6);
    expect(result.remainingActiveInventory.isEmpty).toBe(true);
    expect(result.summary).toEqual({
      totalClients: 2,
      fulfilledClients: 2,
      totalActiveRobotsUsed: 4,
      totalStandbyRobotsUsed: 4,
      totalRobotsUsed: 8,
      totalChargingCost: 19,
      activeRobotUtilisationPercent: {
        average: 100,
        byRobotType: {
          alpha: 100,
          bravo: 100,
          charlie: 100,
          delta: 100,
        },
      },
    });
  });

  it("records a failed high-priority client without consuming inventory, then continues", () => {
    const failingStrategy: AllocationStrategy = {
      name: "Deterministic failure",
      allocate(inventory, request, catalog) {
        if (request.hours === 21) {
          throw new DomainError(
            "INSUFFICIENT_CAPACITY",
            "Deterministic client failure.",
          );
        }

        return strategy.allocate(inventory, request, catalog);
      },
    };
    const result = service.allocate({
      activeInventory: FleetInventory.create({
        alpha: 2,
        bravo: 2,
        charlie: 3,
        delta: 2,
      }),
      clients: clients(10, 21),
      strategy: failingStrategy,
      catalog: TEST_ROBOT_CATALOG,
    });

    expect(result.clients[0]).toMatchObject({
      clientId: 2,
      priority: 1,
      status: "infeasible",
      error: { code: "INSUFFICIENT_CAPACITY" },
    });
    expect(result.clients[1]).toMatchObject({
      clientId: 1,
      priority: 2,
      status: "allocated",
    });

    const second = result.clients[1];

    if (second?.status !== "allocated") {
      throw new Error("Expected the second client to be fulfilled");
    }

    expect(second.activeRobots.toRecord()).toEqual({
      alpha: 0,
      bravo: 0,
      charlie: 2,
      delta: 0,
    });
    expect(result.remainingActiveInventory.toRecord()).toEqual({
      alpha: 2,
      bravo: 2,
      charlie: 1,
      delta: 2,
    });
  });

  it("uses the selected category-distribution strategy for the complete batch", () => {
    const result = service.allocate({
      activeInventory: FleetInventory.create({
        alpha: 4,
        bravo: 4,
        charlie: 4,
        delta: 4,
      }),
      clients: clients(12, 7),
      strategy: new CategoryDistributionStrategy(),
      standbyPolicy: "automatic",
      catalog: TEST_ROBOT_CATALOG,
    });

    expect(result.policyName).toBe("Category distribution");
    expect(result.clients.map((client) => client.status)).toEqual([
      "allocated",
      "allocated",
    ]);

    const assignments = result.clients.map((client) => {
      if (client.status === "infeasible") {
        throw new Error("Expected both clients to be fulfilled");
      }

      return client.activeRobots.toRecord();
    });

    expect(assignments).toEqual([
      { alpha: 1, bravo: 1, charlie: 1, delta: 1 },
      { alpha: 1, bravo: 1, charlie: 1, delta: 1 },
    ]);
    expect(result.remainingActiveInventory.toRecord()).toEqual({
      alpha: 2,
      bravo: 2,
      charlie: 2,
      delta: 2,
    });
  });

  it("isolates a high-priority capacity failure when standby is disabled", () => {
    const result = service.allocate({
      activeInventory: FleetInventory.create({
        alpha: 1,
        bravo: 1,
        charlie: 1,
        delta: 1,
      }),
      clients: clients(10, 21),
      strategy,
      standbyPolicy: "disabled",
      catalog: TEST_ROBOT_CATALOG,
    });

    expect(result.clients[0]).toMatchObject({
      clientId: 2,
      priority: 1,
      status: "infeasible",
      error: { code: "INSUFFICIENT_CAPACITY" },
    });
    expect(result.clients[1]).toMatchObject({
      clientId: 1,
      priority: 2,
      status: "allocated",
    });

    const second = result.clients[1];

    if (second?.status !== "allocated") {
      throw new Error("Expected the lower-priority client to be fulfilled");
    }

    expect(second.activeRobots.toRecord()).toEqual({
      alpha: 0,
      bravo: 1,
      charlie: 0,
      delta: 1,
    });
    expect(result.remainingActiveInventory.toRecord()).toEqual({
      alpha: 1,
      bravo: 0,
      charlie: 1,
      delta: 0,
    });
    expect(result.summary).toEqual({
      totalClients: 2,
      fulfilledClients: 1,
      totalActiveRobotsUsed: 2,
      totalStandbyRobotsUsed: 0,
      totalRobotsUsed: 2,
      totalChargingCost: 6,
      activeRobotUtilisationPercent: {
        average: 50,
        byRobotType: {
          alpha: 0,
          bravo: 100,
          charlie: 0,
          delta: 100,
        },
      },
    });
  });

  it("calculates overall utilisation as a weighted active-fleet ratio", () => {
    const result = service.allocate({
      activeInventory: FleetInventory.create({
        alpha: 3,
        bravo: 3,
        charlie: 1,
        delta: 1,
      }),
      clients: clients(3),
      strategy,
      catalog: TEST_ROBOT_CATALOG,
    });

    expect(result.summary.activeRobotUtilisationPercent).toEqual({
      average: 12.5,
      byRobotType: {
        alpha: 0,
        bravo: 33.3,
        charlie: 0,
        delta: 0,
      },
    });
  });

  it("keeps utilisation available when one category has no active robots", () => {
    const result = service.allocate({
      activeInventory: FleetInventory.create({
        alpha: 0,
        bravo: 0,
        charlie: 1,
        delta: 1,
      }),
      clients: clients(5),
      strategy,
      catalog: TEST_ROBOT_CATALOG,
    });

    expect(result.summary.activeRobotUtilisationPercent).toEqual({
      average: 50,
      byRobotType: {
        alpha: null,
        bravo: null,
        charlie: 100,
        delta: 0,
      },
    });
  });

  it("reports unavailable active utilisation for an entirely standby-funded batch", () => {
    const result = service.allocate({
      activeInventory: FleetInventory.create({
        alpha: 0,
        bravo: 0,
        charlie: 0,
        delta: 0,
      }),
      clients: clients(6),
      strategy,
      standbyPolicy: "automatic",
      catalog: TEST_ROBOT_CATALOG,
    });

    expect(result.summary).toEqual({
      totalClients: 1,
      fulfilledClients: 1,
      totalActiveRobotsUsed: 0,
      totalStandbyRobotsUsed: 2,
      totalRobotsUsed: 2,
      totalChargingCost: 4,
      activeRobotUtilisationPercent: {
        average: null,
        byRobotType: {
          alpha: null,
          bravo: null,
          charlie: null,
          delta: null,
        },
      },
    });
  });
});
