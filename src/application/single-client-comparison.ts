import type { Allocation } from "../domain/allocation.js";
import { DomainError } from "../domain/errors.js";
import type { FleetInventory } from "../domain/fleet-inventory.js";
import type { WorkRequest } from "../domain/work-request.js";
import type { AllocationStrategy } from "../strategies/allocation-strategy.js";
import type { RobotCatalog } from "../domain/robot-catalog.js";

export interface AllocatedOutcome {
  readonly status: "allocated";
  readonly allocation: Allocation;
}

export interface InfeasibleOutcome {
  readonly status: "infeasible";
  readonly error: DomainError;
}

export type AllocationOutcome = AllocatedOutcome | InfeasibleOutcome;

export interface StrategyCostComparison {
  readonly categoryDistributionCost: number;
  readonly costOptimizedCost: number;
  readonly costDifference: number;
  readonly insight: string;
}

export interface SingleClientAnalysis {
  readonly categoryDistribution: AllocationOutcome;
  readonly costOptimized: AllocationOutcome;
  readonly comparison: StrategyCostComparison | undefined;
}

export class SingleClientComparisonService {
  public constructor(
    private readonly categoryDistribution: AllocationStrategy,
    private readonly costOptimized: AllocationStrategy,
  ) {}

  public analyze(
    inventory: FleetInventory,
    request: WorkRequest,
    catalog: RobotCatalog,
  ): SingleClientAnalysis {
    const categoryDistribution = this.evaluate(
      this.categoryDistribution,
      inventory,
      request,
      catalog,
    );
    const costOptimized = this.evaluate(
      this.costOptimized,
      inventory,
      request,
      catalog,
    );

    return {
      categoryDistribution,
      costOptimized,
      comparison: this.compare(categoryDistribution, costOptimized, catalog),
    };
  }

  private evaluate(
    strategy: AllocationStrategy,
    inventory: FleetInventory,
    request: WorkRequest,
    catalog: RobotCatalog,
  ): AllocationOutcome {
    try {
      return {
        status: "allocated",
        allocation: strategy.allocate(inventory, request, catalog),
      };
    } catch (error: unknown) {
      if (error instanceof DomainError) {
        return { status: "infeasible", error };
      }

      throw error;
    }
  }

  private compare(
    categoryDistribution: AllocationOutcome,
    costOptimized: AllocationOutcome,
    catalog: RobotCatalog,
  ): StrategyCostComparison | undefined {
    if (
      categoryDistribution.status !== "allocated" ||
      costOptimized.status !== "allocated"
    ) {
      return undefined;
    }

    const categoryDistributionCost =
      categoryDistribution.allocation.calculateChargingCost(catalog);
    const costOptimizedCost =
      costOptimized.allocation.calculateChargingCost(catalog);
    const costDifference = categoryDistributionCost - costOptimizedCost;

    return {
      categoryDistributionCost,
      costOptimizedCost,
      costDifference,
      insight: this.createInsight(costDifference),
    };
  }

  private createInsight(costDifference: number): string {
    if (costDifference === 0) {
      return "Both strategies have the same charging cost.";
    }

    if (costDifference > 0) {
      return `Level 1 strategy resulted in $${costDifference} additional cost due to mandatory usage of multiple robot categories.`;
    }

    return `Level 1 strategy cost $${Math.abs(costDifference)} less than the cost-optimised result.`;
  }
}
