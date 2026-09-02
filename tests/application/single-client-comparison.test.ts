import { describe, expect, it } from "vitest";

import { SingleClientComparisonService } from "../../src/application/single-client-comparison.js";
import { FleetInventory } from "../../src/domain/fleet-inventory.js";
import { WorkRequest } from "../../src/domain/work-request.js";
import type { AllocationStrategy } from "../../src/strategies/allocation-strategy.js";
import { CategoryDistributionStrategy } from "../../src/strategies/category-distribution-strategy.js";
import { CostOptimizedStrategy } from "../../src/strategies/cost-optimized-strategy.js";
import {
  TEST_ROBOT_CATALOG,
  TEST_ROBOT_COUNTS,
} from "../support/robot-catalog.js";

const service = new SingleClientComparisonService(
  new CategoryDistributionStrategy(),
  new CostOptimizedStrategy(),
);

describe("SingleClientComparisonService", () => {
  it("compares category distribution with cost optimisation", () => {
    const analysis = service.analyze(
      FleetInventory.create(TEST_ROBOT_COUNTS),
      WorkRequest.create(20),
      TEST_ROBOT_CATALOG,
    );

    expect(analysis.categoryDistribution.status).toBe("allocated");
    expect(analysis.costOptimized.status).toBe("allocated");
    expect(analysis.comparison).toEqual({
      categoryDistributionCost: 12,
      costOptimizedCost: 11,
      costDifference: 1,
      insight:
        "Level 1 strategy resulted in $1 additional cost due to mandatory usage of multiple robot categories.",
    });
  });

  it("explains when both strategies have the same charging cost", () => {
    const analysis = service.analyze(
      FleetInventory.create({ alpha: 1, bravo: 1, charlie: 1, delta: 1 }),
      WorkRequest.create(17),
      TEST_ROBOT_CATALOG,
    );

    expect(analysis.comparison).toEqual({
      categoryDistributionCost: 10,
      costOptimizedCost: 10,
      costDifference: 0,
      insight: "Both strategies have the same charging cost.",
    });
  });

  it("preserves a Level 1 failure while allowing Level 2 to succeed", () => {
    const analysis = service.analyze(
      FleetInventory.create({ alpha: 2, bravo: 2, charlie: 2, delta: 0 }),
      WorkRequest.create(8),
      TEST_ROBOT_CATALOG,
    );

    expect(analysis.categoryDistribution).toMatchObject({
      status: "infeasible",
      error: { code: "CATEGORY_DISTRIBUTION_IMPOSSIBLE" },
    });
    expect(analysis.costOptimized.status).toBe("allocated");

    if (analysis.costOptimized.status === "allocated") {
      expect(analysis.costOptimized.allocation.robots.toRecord()).toEqual({
        alpha: 0,
        bravo: 1,
        charlie: 1,
        delta: 0,
      });
    }

    expect(analysis.comparison).toBeUndefined();
  });

  it("returns both failures when active capacity cannot satisfy the request", () => {
    const analysis = service.analyze(
      FleetInventory.create({ alpha: 1, bravo: 1, charlie: 1, delta: 1 }),
      WorkRequest.create(18),
      TEST_ROBOT_CATALOG,
    );

    expect(analysis.categoryDistribution).toMatchObject({
      status: "infeasible",
      error: { code: "INSUFFICIENT_CAPACITY" },
    });
    expect(analysis.costOptimized).toMatchObject({
      status: "infeasible",
      error: { code: "INSUFFICIENT_CAPACITY" },
    });
    expect(analysis.comparison).toBeUndefined();
  });

  it("rethrows unexpected strategy errors", () => {
    const unexpectedError = new Error("Unexpected strategy failure");
    const brokenStrategy: AllocationStrategy = {
      name: "Broken strategy",
      allocate() {
        throw unexpectedError;
      },
    };
    const brokenService = new SingleClientComparisonService(
      brokenStrategy,
      new CostOptimizedStrategy(),
    );

    expect(() =>
      brokenService.analyze(
        FleetInventory.create({ alpha: 1, bravo: 1, charlie: 1, delta: 1 }),
        WorkRequest.create(8),
        TEST_ROBOT_CATALOG,
      ),
    ).toThrowError(unexpectedError);
  });
});
