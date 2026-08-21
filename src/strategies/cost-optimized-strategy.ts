import { Allocation } from "../domain/allocation.js";
import { DomainError } from "../domain/errors.js";
import { FleetInventory, type RobotCounts } from "../domain/fleet-inventory.js";
import type { WorkRequest } from "../domain/work-request.js";
import type { AllocationStrategy } from "./allocation-strategy.js";
import { isLexicographicallyLower } from "./lexicographic-score.js";

interface Candidate {
  readonly allocation: Allocation;
  readonly counts: RobotCounts;
}

export class CostOptimizedStrategy implements AllocationStrategy {
  public readonly name = "Cost optimised";

  public allocate(inventory: FleetInventory, request: WorkRequest): Allocation {
    this.ensureAllocationCanBeAttempted(inventory, request);

    let best: Candidate | undefined;

    for (let bravo = 0; bravo <= inventory.count("bravo"); bravo += 1) {
      for (
        let charlie = 0;
        charlie <= inventory.count("charlie");
        charlie += 1
      ) {
        for (let delta = 0; delta <= inventory.count("delta"); delta += 1) {
          if (bravo === 0 && charlie === 0 && delta === 0) {
            continue;
          }

          const counts = { bravo, charlie, delta };
          const allocation = new Allocation(
            FleetInventory.create(counts),
            request,
          );

          if (allocation.providedHours < request.hours) {
            continue;
          }

          const candidate = { allocation, counts };

          if (best === undefined || this.isBetter(candidate, best)) {
            best = candidate;
          }
        }
      }
    }

    if (best === undefined) {
      throw this.insufficientCapacity(inventory, request);
    }

    return best.allocation;
  }

  private ensureAllocationCanBeAttempted(
    inventory: FleetInventory,
    request: WorkRequest,
  ): void {
    if (inventory.isEmpty) {
      throw new DomainError(
        "NO_ROBOTS_AVAILABLE",
        "No robots available for assignment.",
      );
    }

    if (inventory.totalHours < request.hours) {
      throw this.insufficientCapacity(inventory, request);
    }
  }

  private insufficientCapacity(
    inventory: FleetInventory,
    request: WorkRequest,
  ): DomainError {
    return new DomainError(
      "INSUFFICIENT_CAPACITY",
      "Insufficient robot capacity to complete the requested work.",
      {
        requestedHours: request.hours,
        availableHours: inventory.totalHours,
      },
    );
  }

  private isBetter(candidate: Candidate, incumbent: Candidate): boolean {
    return isLexicographicallyLower(
      this.score(candidate),
      this.score(incumbent),
    );
  }

  private score(candidate: Candidate): readonly number[] {
    return [
      candidate.allocation.chargingCost,
      candidate.allocation.excessHours,
      candidate.allocation.robots.totalRobots,
      candidate.counts.bravo,
      candidate.counts.charlie,
      candidate.counts.delta,
    ];
  }
}
