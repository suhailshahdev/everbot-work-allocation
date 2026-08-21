import { describe, expect, it } from "vitest";

import { SingleClientComparisonService } from "../../src/application/single-client-comparison.js";
import { FleetInventory } from "../../src/domain/fleet-inventory.js";
import { WorkRequest } from "../../src/domain/work-request.js";
import type { AllocationStrategy } from "../../src/strategies/allocation-strategy.js";
import { CategoryDistributionStrategy } from "../../src/strategies/category-distribution-strategy.js";
import { CostOptimizedStrategy } from "../../src/strategies/cost-optimized-strategy.js";

const service = new SingleClientComparisonService(
  new CategoryDistributionStrategy(),
  new CostOptimizedStrategy(),
);

describe("SingleClientComparisonService", () => {
  it("matches the challenge's $1 Level 1 versus Level 2 comparison", () => {
    const analysis = service.analyze(
      FleetInventory.create({ bravo: 2, charlie: 3, delta: 2 }),
      WorkRequest.create(20),
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
      FleetInventory.create({ bravo: 1, charlie: 3, delta: 1 }),
      WorkRequest.create(14),
    );

    expect(analysis.comparison).toEqual({
      categoryDistributionCost: 9,
      costOptimizedCost: 9,
      costDifference: 0,
      insight: "Both strategies have the same charging cost.",
    });
  });

  it("preserves a Level 1 failure while allowing Level 2 to succeed", () => {
    const analysis = service.analyze(
      FleetInventory.create({ bravo: 2, charlie: 2, delta: 0 }),
      WorkRequest.create(8),
    );

    expect(analysis.categoryDistribution).toMatchObject({
      status: "infeasible",
      error: { code: "CATEGORY_DISTRIBUTION_IMPOSSIBLE" },
    });
    expect(analysis.costOptimized.status).toBe("allocated");

    if (analysis.costOptimized.status === "allocated") {
      expect(analysis.costOptimized.allocation.robots.toRecord()).toEqual({
        bravo: 1,
        charlie: 1,
        delta: 0,
      });
    }

    expect(analysis.comparison).toBeUndefined();
  });

  it("returns both failures when active capacity cannot satisfy the request", () => {
    const analysis = service.analyze(
      FleetInventory.create({ bravo: 1, charlie: 1, delta: 1 }),
      WorkRequest.create(17),
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
        FleetInventory.create({ bravo: 1, charlie: 1, delta: 1 }),
        WorkRequest.create(8),
      ),
    ).toThrowError(unexpectedError);
  });
});
