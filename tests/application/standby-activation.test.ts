import { describe, expect, it } from "vitest";

import { StandbyActivationService } from "../../src/application/standby-activation.js";
import { FleetInventory } from "../../src/domain/fleet-inventory.js";
import { WorkRequest } from "../../src/domain/work-request.js";
import { CategoryDistributionStrategy } from "../../src/strategies/category-distribution-strategy.js";
import { CostOptimizedStrategy } from "../../src/strategies/cost-optimized-strategy.js";
import { TEST_ROBOT_CATALOG } from "../support/robot-catalog.js";

const costOptimized = new CostOptimizedStrategy();
const service = new StandbyActivationService(costOptimized);

describe("StandbyActivationService", () => {
  it("activates standby for a shortfall in the dynamic catalogue", () => {
    const activeInventory = FleetInventory.create({
      alpha: 1,
      bravo: 1,
      charlie: 1,
      delta: 1,
    });

    const result = service.allocate(
      activeInventory,
      WorkRequest.create(22),
      costOptimized,
      "automatic",
      TEST_ROBOT_CATALOG,
    );

    expect(result.status).toBe("standby-activated");

    if (result.status !== "standby-activated") {
      throw new Error("Expected standby activation");
    }

    expect(result.activeRobots.toRecord()).toEqual({
      alpha: 1,
      bravo: 1,
      charlie: 1,
      delta: 1,
    });
    expect(result.activeCapacityHours).toBe(17);
    expect(result.shortfallHours).toBe(5);
    expect(result.standbyRobots.toRecord()).toEqual({
      alpha: 0,
      bravo: 0,
      charlie: 1,
      delta: 0,
    });
    expect(result.standbyChargingCost).toBe(3);
    expect(result.allocation.robots.toRecord()).toEqual({
      alpha: 1,
      bravo: 1,
      charlie: 2,
      delta: 1,
    });
    expect(result.allocation.requestedHours).toBe(22);
    expect(result.allocation.calculateProvidedHours(TEST_ROBOT_CATALOG)).toBe(
      22,
    );
    expect(result.allocation.calculateExcessHours(TEST_ROBOT_CATALOG)).toBe(0);
    expect(result.allocation.calculateChargingCost(TEST_ROBOT_CATALOG)).toBe(
      13,
    );
    expect(activeInventory.toRecord()).toEqual({
      alpha: 1,
      bravo: 1,
      charlie: 1,
      delta: 1,
    });
  });

  it("uses the Level 2 tie-break when selecting standby robots", () => {
    const result = service.allocate(
      FleetInventory.create({ alpha: 1, bravo: 1, charlie: 1, delta: 1 }),
      WorkRequest.create(23),
      costOptimized,
      "automatic",
      TEST_ROBOT_CATALOG,
    );

    expect(result.status).toBe("standby-activated");

    if (result.status !== "standby-activated") {
      throw new Error("Expected standby activation");
    }

    expect(result.shortfallHours).toBe(6);
    expect(result.standbyRobots.toRecord()).toEqual({
      alpha: 0,
      bravo: 2,
      charlie: 0,
      delta: 0,
    });
    expect(result.standbyChargingCost).toBe(4);
    expect(result.allocation.calculateProvidedHours(TEST_ROBOT_CATALOG)).toBe(
      23,
    );
    expect(result.allocation.calculateExcessHours(TEST_ROBOT_CATALOG)).toBe(0);
  });

  it("does not activate standby when the request equals active capacity", () => {
    const result = service.allocate(
      FleetInventory.create({ alpha: 1, bravo: 1, charlie: 1, delta: 1 }),
      WorkRequest.create(17),
      costOptimized,
      "automatic",
      TEST_ROBOT_CATALOG,
    );

    expect(result.status).toBe("allocated");

    if (result.status !== "allocated") {
      throw new Error("Expected an active-only allocation");
    }

    expect(result.allocation.robots.toRecord()).toEqual({
      alpha: 1,
      bravo: 1,
      charlie: 1,
      delta: 1,
    });
  });

  it("uses the selected active strategy when active capacity is sufficient", () => {
    const result = service.allocate(
      FleetInventory.create({ alpha: 2, bravo: 2, charlie: 3, delta: 2 }),
      WorkRequest.create(8),
      new CategoryDistributionStrategy(),
      "automatic",
      TEST_ROBOT_CATALOG,
    );

    expect(result.status).toBe("allocated");

    if (result.status !== "allocated") {
      throw new Error("Expected an active-only allocation");
    }

    expect(result.allocation.robots.toRecord()).toEqual({
      alpha: 1,
      bravo: 1,
      charlie: 1,
      delta: 1,
    });
  });

  it("can fulfil a request entirely from standby when no active robots exist", () => {
    const result = service.allocate(
      FleetInventory.create({ alpha: 0, bravo: 0, charlie: 0, delta: 0 }),
      WorkRequest.create(6),
      costOptimized,
      "automatic",
      TEST_ROBOT_CATALOG,
    );

    expect(result.status).toBe("standby-activated");

    if (result.status !== "standby-activated") {
      throw new Error("Expected standby activation");
    }

    expect(result.activeCapacityHours).toBe(0);
    expect(result.shortfallHours).toBe(6);
    expect(result.standbyRobots.toRecord()).toEqual({
      alpha: 0,
      bravo: 2,
      charlie: 0,
      delta: 0,
    });
    expect(result.standbyChargingCost).toBe(4);
    expect(result.allocation.calculateProvidedHours(TEST_ROBOT_CATALOG)).toBe(
      6,
    );
    expect(result.allocation.calculateChargingCost(TEST_ROBOT_CATALOG)).toBe(4);
  });

  it("does not activate standby merely to repair a category-policy failure", () => {
    const result = service.allocate(
      FleetInventory.create({ alpha: 2, bravo: 2, charlie: 2, delta: 0 }),
      WorkRequest.create(8),
      new CategoryDistributionStrategy(),
      "automatic",
      TEST_ROBOT_CATALOG,
    );

    expect(result).toMatchObject({
      status: "infeasible",
      error: { code: "CATEGORY_DISTRIBUTION_IMPOSSIBLE" },
    });
  });

  it("preserves a capacity failure without mutating inventory when standby is disabled", () => {
    const activeInventory = FleetInventory.create({
      alpha: 1,
      bravo: 1,
      charlie: 1,
      delta: 1,
    });

    const result = service.allocate(
      activeInventory,
      WorkRequest.create(22),
      costOptimized,
      "disabled",
      TEST_ROBOT_CATALOG,
    );

    expect(result).toMatchObject({
      status: "infeasible",
      error: {
        code: "INSUFFICIENT_CAPACITY",
        message: "Insufficient robot capacity to complete the requested work.",
      },
    });
    expect(activeInventory.toRecord()).toEqual({
      alpha: 1,
      bravo: 1,
      charlie: 1,
      delta: 1,
    });
  });
});
