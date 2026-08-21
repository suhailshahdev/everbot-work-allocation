import { describe, expect, it } from "vitest";

import type { DomainError } from "../../src/domain/errors.js";
import {
  FleetInventory,
  type RobotCounts,
} from "../../src/domain/fleet-inventory.js";
import { WorkRequest } from "../../src/domain/work-request.js";
import { CostOptimizedStrategy } from "../../src/strategies/cost-optimized-strategy.js";

const strategy = new CostOptimizedStrategy();

function allocate(
  hours: number,
  counts: RobotCounts = { bravo: 2, charlie: 3, delta: 2 },
) {
  return strategy.allocate(
    FleetInventory.create(counts),
    WorkRequest.create(hours),
  );
}

describe("CostOptimizedStrategy", () => {
  it("matches the 20-hour challenge example", () => {
    const allocation = allocate(20);

    expect(allocation.robots.toRecord()).toEqual({
      bravo: 0,
      charlie: 1,
      delta: 2,
    });
    expect(allocation.requestedHours).toBe(20);
    expect(allocation.providedHours).toBe(21);
    expect(allocation.excessHours).toBe(1);
    expect(allocation.chargingCost).toBe(11);
  });

  it("uses lower excess hours to break the challenge's six-hour cost tie", () => {
    const allocation = allocate(6, { bravo: 2, charlie: 2, delta: 3 });

    expect(allocation.robots.toRecord()).toEqual({
      bravo: 2,
      charlie: 0,
      delta: 0,
    });
    expect(allocation.providedHours).toBe(6);
    expect(allocation.excessHours).toBe(0);
    expect(allocation.chargingCost).toBe(4);
  });

  it("prioritises lower cost before lower excess hours", () => {
    const allocation = allocate(12, { bravo: 4, charlie: 1, delta: 1 });

    expect(allocation.robots.toRecord()).toEqual({
      bravo: 0,
      charlie: 1,
      delta: 1,
    });
    expect(allocation.providedHours).toBe(13);
    expect(allocation.excessHours).toBe(1);
    expect(allocation.chargingCost).toBe(7);
  });

  it("may select one category because cost optimisation ignores category distribution", () => {
    const allocation = allocate(8, { bravo: 4, charlie: 3, delta: 1 });

    expect(allocation.robots.toRecord()).toEqual({
      bravo: 0,
      charlie: 0,
      delta: 1,
    });
    expect(allocation.providedHours).toBe(8);
    expect(allocation.chargingCost).toBe(4);
  });

  it("uses fewer robots after charging cost and excess hours tie", () => {
    const allocation = allocate(20, { bravo: 4, charlie: 4, delta: 1 });

    expect(allocation.robots.toRecord()).toEqual({
      bravo: 0,
      charlie: 4,
      delta: 0,
    });
    expect(allocation.providedHours).toBe(20);
    expect(allocation.chargingCost).toBe(12);
    expect(allocation.robots.totalRobots).toBe(4);
  });

  it("reports that no robots are available when the inventory is empty", () => {
    expect(() => allocate(8, { bravo: 0, charlie: 0, delta: 0 })).toThrowError(
      expect.objectContaining<Partial<DomainError>>({
        code: "NO_ROBOTS_AVAILABLE",
        message: "No robots available for assignment.",
      }),
    );
  });

  it("reports insufficient capacity when every available robot is not enough", () => {
    expect(() => allocate(17, { bravo: 1, charlie: 1, delta: 1 })).toThrowError(
      expect.objectContaining<Partial<DomainError>>({
        code: "INSUFFICIENT_CAPACITY",
        message: "Insufficient robot capacity to complete the requested work.",
        details: { requestedHours: 17, availableHours: 16 },
      }),
    );
  });

  it("does not consume or mutate the supplied inventory", () => {
    const inventory = FleetInventory.create({ bravo: 2, charlie: 3, delta: 2 });

    strategy.allocate(inventory, WorkRequest.create(20));

    expect(inventory.toRecord()).toEqual({ bravo: 2, charlie: 3, delta: 2 });
  });
});
