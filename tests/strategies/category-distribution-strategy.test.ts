import { describe, expect, it } from "vitest";

import type { DomainError } from "../../src/domain/errors.js";
import {
  FleetInventory,
  type RobotCounts,
} from "../../src/domain/fleet-inventory.js";
import { WorkRequest } from "../../src/domain/work-request.js";
import { CategoryDistributionStrategy } from "../../src/strategies/category-distribution-strategy.js";

const strategy = new CategoryDistributionStrategy();

function allocate(
  hours: number,
  counts: RobotCounts = { bravo: 2, charlie: 3, delta: 2 },
) {
  return strategy.allocate(
    FleetInventory.create(counts),
    WorkRequest.create(hours),
  );
}

describe("CategoryDistributionStrategy", () => {
  it("matches the 16-hour challenge example", () => {
    const allocation = allocate(16);

    expect(allocation.robots.toRecord()).toEqual({
      bravo: 1,
      charlie: 1,
      delta: 1,
    });
    expect(allocation.requestedHours).toBe(16);
    expect(allocation.providedHours).toBe(16);
    expect(allocation.excessHours).toBe(0);
    expect(allocation.chargingCost).toBe(9);
  });

  it.each([
    {
      requestedHours: 17,
      expectedRobots: { bravo: 2, charlie: 1, delta: 1 },
      expectedHours: 19,
      expectedCost: 11,
    },
    {
      requestedHours: 21,
      expectedRobots: { bravo: 1, charlie: 2, delta: 1 },
      expectedHours: 21,
      expectedCost: 12,
    },
    {
      requestedHours: 24,
      expectedRobots: { bravo: 1, charlie: 1, delta: 2 },
      expectedHours: 24,
      expectedCost: 13,
    },
  ])(
    "selects the challenge's extra robot for $requestedHours requested hours",
    ({ requestedHours, expectedRobots, expectedHours, expectedCost }) => {
      const allocation = allocate(requestedHours);

      expect(allocation.robots.toRecord()).toEqual(expectedRobots);
      expect(allocation.providedHours).toBe(expectedHours);
      expect(allocation.excessHours).toBe(expectedHours - requestedHours);
      expect(allocation.chargingCost).toBe(expectedCost);
    },
  );

  it("uses one robot from every category even for a smaller request", () => {
    const allocation = allocate(6);

    expect(allocation.robots.toRecord()).toEqual({
      bravo: 1,
      charlie: 1,
      delta: 1,
    });
    expect(allocation.providedHours).toBe(16);
    expect(allocation.excessHours).toBe(10);
  });

  it("uses fewer robots after excess hours and charging cost tie", () => {
    const allocation = allocate(36, { bravo: 5, charlie: 5, delta: 2 });

    expect(allocation.robots.toRecord()).toEqual({
      bravo: 1,
      charlie: 5,
      delta: 1,
    });
    expect(allocation.providedHours).toBe(36);
    expect(allocation.chargingCost).toBe(21);
    expect(allocation.robots.totalRobots).toBe(7);
  });

  it("reports the category-distribution error when a category is unavailable", () => {
    expect(() => allocate(8, { bravo: 2, charlie: 2, delta: 0 })).toThrowError(
      expect.objectContaining<Partial<DomainError>>({
        code: "CATEGORY_DISTRIBUTION_IMPOSSIBLE",
        message:
          "Unable to allocate at least one robot from each category with the available inventory.",
        details: { available: { bravo: 2, charlie: 2, delta: 0 } },
      }),
    );
  });

  it("reports a missing category before insufficient capacity", () => {
    expect(() => allocate(20, { bravo: 1, charlie: 1, delta: 0 })).toThrowError(
      expect.objectContaining<Partial<DomainError>>({
        code: "CATEGORY_DISTRIBUTION_IMPOSSIBLE",
      }),
    );
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

    strategy.allocate(inventory, WorkRequest.create(16));

    expect(inventory.toRecord()).toEqual({ bravo: 2, charlie: 3, delta: 2 });
  });
});
