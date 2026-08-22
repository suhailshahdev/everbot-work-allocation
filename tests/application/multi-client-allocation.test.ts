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
    const inventory = FleetInventory.create({ bravo: 4, charlie: 4, delta: 4 });
    const clientRequests = clients(12, 20, 20, 7);

    const result = service.allocate({
      activeInventory: inventory,
      clients: clientRequests,
      strategy,
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
      { bravo: 0, charlie: 1, delta: 2 },
      { bravo: 0, charlie: 1, delta: 2 },
      { bravo: 4, charlie: 0, delta: 0 },
      { bravo: 0, charlie: 2, delta: 0 },
    ]);
    expect(result.remainingActiveInventory.toRecord()).toEqual({
      bravo: 0,
      charlie: 0,
      delta: 0,
    });
    expect(inventory.toRecord()).toEqual({ bravo: 4, charlie: 4, delta: 4 });
    expect(clientRequests.map((client) => client.clientId)).toEqual([
      1, 2, 3, 4,
    ]);
  });

  it("activates standby per client after shared active capacity is consumed", () => {
    const result = service.allocate({
      activeInventory: FleetInventory.create({
        bravo: 1,
        charlie: 1,
        delta: 1,
      }),
      clients: clients(10, 21),
      strategy,
    });

    expect(result.clients.map((client) => client.clientId)).toEqual([2, 1]);
    expect(result.clients[0]).toMatchObject({
      clientId: 2,
      priority: 1,
      requestedHours: 21,
      status: "standby-activated",
      shortfallHours: 5,
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
      bravo: 1,
      charlie: 1,
      delta: 1,
    });
    expect(first.standbyRobots.toRecord()).toEqual({
      bravo: 0,
      charlie: 1,
      delta: 0,
    });
    expect(first.allocation.providedHours).toBe(21);
    expect(first.allocation.excessHours).toBe(0);
    expect(first.allocation.chargingCost).toBe(12);

    expect(second.activeRobots.toRecord()).toEqual({
      bravo: 0,
      charlie: 0,
      delta: 0,
    });
    expect(second.standbyRobots.toRecord()).toEqual({
      bravo: 0,
      charlie: 2,
      delta: 0,
    });
    expect(second.allocation.providedHours).toBe(10);
    expect(second.allocation.excessHours).toBe(0);
    expect(second.allocation.chargingCost).toBe(6);
    expect(result.remainingActiveInventory.isEmpty).toBe(true);
  });

  it("records a failed high-priority client without consuming inventory, then continues", () => {
    const failingStrategy: AllocationStrategy = {
      name: "Deterministic failure",
      allocate(inventory, request) {
        if (request.hours === 21) {
          throw new DomainError(
            "INSUFFICIENT_CAPACITY",
            "Deterministic client failure.",
          );
        }

        return strategy.allocate(inventory, request);
      },
    };
    const result = service.allocate({
      activeInventory: FleetInventory.create({
        bravo: 2,
        charlie: 3,
        delta: 2,
      }),
      clients: clients(10, 21),
      strategy: failingStrategy,
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
      bravo: 0,
      charlie: 2,
      delta: 0,
    });
    expect(result.remainingActiveInventory.toRecord()).toEqual({
      bravo: 2,
      charlie: 1,
      delta: 2,
    });
  });

  it("uses the selected category-distribution strategy for the complete batch", () => {
    const result = service.allocate({
      activeInventory: FleetInventory.create({
        bravo: 4,
        charlie: 4,
        delta: 4,
      }),
      clients: clients(12, 7),
      strategy: new CategoryDistributionStrategy(),
      standbyPolicy: "automatic",
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
      { bravo: 1, charlie: 1, delta: 1 },
      { bravo: 1, charlie: 1, delta: 1 },
    ]);
    expect(result.remainingActiveInventory.toRecord()).toEqual({
      bravo: 2,
      charlie: 2,
      delta: 2,
    });
  });

  it("isolates a high-priority capacity failure when standby is disabled", () => {
    const result = service.allocate({
      activeInventory: FleetInventory.create({
        bravo: 1,
        charlie: 1,
        delta: 1,
      }),
      clients: clients(10, 21),
      strategy,
      standbyPolicy: "disabled",
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
      bravo: 1,
      charlie: 0,
      delta: 1,
    });
    expect(result.remainingActiveInventory.toRecord()).toEqual({
      bravo: 0,
      charlie: 1,
      delta: 0,
    });
  });
});
