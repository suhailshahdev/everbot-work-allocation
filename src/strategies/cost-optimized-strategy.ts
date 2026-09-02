import { Allocation } from "../domain/allocation.js";
import { DomainError } from "../domain/errors.js";
import { FleetInventory, type RobotCounts } from "../domain/fleet-inventory.js";
import type { WorkRequest } from "../domain/work-request.js";
import type { AllocationStrategy } from "./allocation-strategy.js";
import { isLexicographicallyLower } from "./lexicographic-score.js";
import type { RobotCatalog } from "../domain/robot-catalog.js";

interface Candidate {
  readonly allocation: Allocation;
  readonly counts: RobotCounts;
}

export class CostOptimizedStrategy implements AllocationStrategy {
  public readonly name = "Cost optimised";

  public allocate(
    inventory: FleetInventory,
    request: WorkRequest,
    catalog: RobotCatalog,
  ): Allocation {
    const effectiveCatalog = catalog;
    const robotTypes = Object.keys(effectiveCatalog).sort();
    this.ensureAllocationCanBeAttempted(inventory, request, effectiveCatalog);

    let best: Candidate | undefined;

    const tryCombinations = (index: number, counts: RobotCounts): void => {
      if (index === robotTypes.length) {
        const robots = FleetInventory.create(counts);

        if (robots.totalRobots === 0) {
          return;
        }

        const allocation = new Allocation(robots, request);

        if (
          allocation.calculateProvidedHours(effectiveCatalog) < request.hours
        ) {
          return;
        }

        const candidate: Candidate = {
          allocation,
          counts,
        };

        if (
          best === undefined ||
          this.isBetter(candidate, best, effectiveCatalog)
        ) {
          best = candidate;
        }

        return;
      }

      const robotType = robotTypes[index];

      if (!robotType) {
        return;
      }

      const available = inventory.count(robotType);

      for (let count = 0; count <= available; count += 1) {
        tryCombinations(index + 1, { ...counts, [robotType]: count });
      }
    };

    tryCombinations(0, {});

    if (best === undefined) {
      throw this.insufficientCapacity(inventory, request, effectiveCatalog);
    }

    return best.allocation;
  }

  private ensureAllocationCanBeAttempted(
    inventory: FleetInventory,
    request: WorkRequest,
    catalog: RobotCatalog,
  ): void {
    if (inventory.isEmpty) {
      throw new DomainError(
        "NO_ROBOTS_AVAILABLE",
        "No robots available for assignment.",
      );
    }

    if (inventory.calculateTotalHours(catalog) < request.hours) {
      throw this.insufficientCapacity(inventory, request, catalog);
    }
  }

  private insufficientCapacity(
    inventory: FleetInventory,
    request: WorkRequest,
    catalog: RobotCatalog,
  ): DomainError {
    return new DomainError(
      "INSUFFICIENT_CAPACITY",
      "Insufficient robot capacity to complete the requested work.",
      {
        requestedHours: request.hours,
        availableHours: inventory.calculateTotalHours(catalog),
      },
    );
  }

  private isBetter(
    candidate: Candidate,
    incumbent: Candidate,
    catalog: RobotCatalog,
  ): boolean {
    return isLexicographicallyLower(
      this.score(candidate, catalog),
      this.score(incumbent, catalog),
    );
  }

  private score(
    candidate: Candidate,
    catalog: RobotCatalog,
  ): readonly number[] {
    const robotTypes = Object.keys(catalog).sort();

    // Score order encodes the required objectives from highest priority to the deterministic category tie-break.
    return [
      candidate.allocation.calculateChargingCost(catalog),
      candidate.allocation.calculateExcessHours(catalog),
      candidate.allocation.robots.totalRobots,
      ...robotTypes.map((robotType) => candidate.counts[robotType] ?? 0),
    ];
  }
}
