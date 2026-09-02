import { describe, expect, it } from "vitest";

import type { DomainError } from "../../src/domain/errors.js";
import {
  FleetInventory,
  type RobotCounts,
} from "../../src/domain/fleet-inventory.js";
import { WorkRequest } from "../../src/domain/work-request.js";
import { CategoryDistributionStrategy } from "../../src/strategies/category-distribution-strategy.js";
import {
  TEST_ROBOT_CATALOG,
  TEST_ROBOT_COUNTS,
} from "../support/robot-catalog.js";

const strategy = new CategoryDistributionStrategy();

function allocate(hours: number, counts: RobotCounts = TEST_ROBOT_COUNTS) {
  return strategy.allocate(
    FleetInventory.create(counts),
    WorkRequest.create(hours),
    TEST_ROBOT_CATALOG,
  );
}

describe("CategoryDistributionStrategy", () => {
  it("uses one robot from every configured type", () => {
    const allocation = allocate(17);

    expect(allocation.robots.toRecord()).toEqual({
      alpha: 1,
      bravo: 1,
      charlie: 1,
      delta: 1,
    });
    expect(allocation.requestedHours).toBe(17);
    expect(allocation.calculateProvidedHours(TEST_ROBOT_CATALOG)).toBe(17);
    expect(allocation.calculateExcessHours(TEST_ROBOT_CATALOG)).toBe(0);
    expect(allocation.calculateChargingCost(TEST_ROBOT_CATALOG)).toBe(10);
  });

  it.each([
    {
      requestedHours: 18,
      expectedRobots: { alpha: 2, bravo: 1, charlie: 1, delta: 1 },
      expectedHours: 18,
      expectedCost: 11,
    },
    {
      requestedHours: 22,
      expectedRobots: { alpha: 1, bravo: 1, charlie: 2, delta: 1 },
      expectedHours: 22,
      expectedCost: 13,
    },
    {
      requestedHours: 25,
      expectedRobots: { alpha: 1, bravo: 1, charlie: 1, delta: 2 },
      expectedHours: 25,
      expectedCost: 14,
    },
  ])(
    "selects the lowest-scoring extra robot for $requestedHours requested hours",
    ({ requestedHours, expectedRobots, expectedHours, expectedCost }) => {
      const allocation = allocate(requestedHours);

      expect(allocation.robots.toRecord()).toEqual(expectedRobots);
      expect(allocation.calculateProvidedHours(TEST_ROBOT_CATALOG)).toBe(
        expectedHours,
      );
      expect(allocation.calculateExcessHours(TEST_ROBOT_CATALOG)).toBe(
        expectedHours - requestedHours,
      );
      expect(allocation.calculateChargingCost(TEST_ROBOT_CATALOG)).toBe(
        expectedCost,
      );
    },
  );

  it("uses one robot from every category even for a smaller request", () => {
    const allocation = allocate(6);

    expect(allocation.robots.toRecord()).toEqual({
      alpha: 1,
      bravo: 1,
      charlie: 1,
      delta: 1,
    });
    expect(allocation.calculateProvidedHours(TEST_ROBOT_CATALOG)).toBe(17);
    expect(allocation.calculateExcessHours(TEST_ROBOT_CATALOG)).toBe(11);
  });

  it("uses fewer robots after excess hours and charging cost tie", () => {
    const allocation = allocate(37, {
      alpha: 1,
      bravo: 5,
      charlie: 5,
      delta: 2,
    });

    expect(allocation.robots.toRecord()).toEqual({
      alpha: 1,
      bravo: 1,
      charlie: 5,
      delta: 1,
    });
    expect(allocation.calculateProvidedHours(TEST_ROBOT_CATALOG)).toBe(37);
    expect(allocation.calculateChargingCost(TEST_ROBOT_CATALOG)).toBe(22);
    expect(allocation.robots.totalRobots).toBe(8);
  });

  it("reports the category-distribution error when a category is unavailable", () => {
    expect(() =>
      allocate(8, { alpha: 2, bravo: 2, charlie: 2, delta: 0 }),
    ).toThrowError(
      expect.objectContaining<Partial<DomainError>>({
        code: "CATEGORY_DISTRIBUTION_IMPOSSIBLE",
        message:
          "Unable to allocate at least one robot from each category with the available inventory.",
        details: {
          available: { alpha: 2, bravo: 2, charlie: 2, delta: 0 },
        },
      }),
    );
  });

  it("reports a missing category before insufficient capacity", () => {
    expect(() =>
      allocate(20, { alpha: 1, bravo: 1, charlie: 1, delta: 0 }),
    ).toThrowError(
      expect.objectContaining<Partial<DomainError>>({
        code: "CATEGORY_DISTRIBUTION_IMPOSSIBLE",
      }),
    );
  });

  it("reports that no robots are available when the inventory is empty", () => {
    expect(() =>
      allocate(8, { alpha: 0, bravo: 0, charlie: 0, delta: 0 }),
    ).toThrowError(
      expect.objectContaining<Partial<DomainError>>({
        code: "NO_ROBOTS_AVAILABLE",
        message: "No robots available for assignment.",
      }),
    );
  });

  it("reports insufficient capacity when every available robot is not enough", () => {
    expect(() =>
      allocate(18, { alpha: 1, bravo: 1, charlie: 1, delta: 1 }),
    ).toThrowError(
      expect.objectContaining<Partial<DomainError>>({
        code: "INSUFFICIENT_CAPACITY",
        message: "Insufficient robot capacity to complete the requested work.",
        details: { requestedHours: 18, availableHours: 17 },
      }),
    );
  });

  it("does not consume or mutate the supplied inventory", () => {
    const inventory = FleetInventory.create(TEST_ROBOT_COUNTS);

    strategy.allocate(inventory, WorkRequest.create(17), TEST_ROBOT_CATALOG);

    expect(inventory.toRecord()).toEqual(TEST_ROBOT_COUNTS);
  });
});
