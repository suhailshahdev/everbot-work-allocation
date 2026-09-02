import { Allocation } from "../domain/allocation.js";
import { DomainError } from "../domain/errors.js";
import type { RobotCounts } from "../domain/fleet-inventory.js";
import { FleetInventory } from "../domain/fleet-inventory.js";
import type { RobotCatalog } from "../domain/robot-catalog.js";
import { WorkRequest } from "../domain/work-request.js";
import type { AllocationStrategy } from "../strategies/allocation-strategy.js";
import type { StandbyPolicy } from "./allocation-settings.js";

export interface ActiveAllocation {
  readonly status: "allocated";
  readonly allocation: Allocation;
}

export interface StandbyAllocation {
  readonly status: "standby-activated";
  readonly allocation: Allocation;
  readonly activeRobots: FleetInventory;
  readonly activeCapacityHours: number;
  readonly shortfallHours: number;
  readonly standbyRobots: FleetInventory;
  readonly standbyChargingCost: number;
}

export interface OperationalFailure {
  readonly status: "infeasible";
  readonly error: DomainError;
}

export type OperationalAllocation =
  ActiveAllocation | StandbyAllocation | OperationalFailure;

export class StandbyActivationService {
  public constructor(private readonly standbyStrategy: AllocationStrategy) {}

  public allocate(
    activeInventory: FleetInventory,
    request: WorkRequest,
    activeStrategy: AllocationStrategy,
    policy: StandbyPolicy = "automatic",
    catalog: RobotCatalog,
  ): OperationalAllocation {
    const activeCapacityHours = activeInventory.calculateTotalHours(catalog);
    if (activeCapacityHours >= request.hours) {
      return this.allocateFromActive(
        activeInventory,
        request,
        activeStrategy,
        catalog,
      );
    }

    if (policy === "disabled") {
      return {
        status: "infeasible",
        error: new DomainError(
          "INSUFFICIENT_CAPACITY",
          "Insufficient robot capacity to complete the requested work.",
        ),
      };
    }

    const shortfallHours = request.hours - activeCapacityHours;
    const standbyRequest = WorkRequest.create(shortfallHours);
    const standbyAvailability = this.createOnDemandAvailability(
      shortfallHours,
      catalog,
    );
    const standbyAllocation = this.standbyStrategy.allocate(
      standbyAvailability,
      standbyRequest,
      catalog,
    );
    const combinedRobots = activeInventory.add(standbyAllocation.robots);

    return {
      status: "standby-activated",
      allocation: new Allocation(combinedRobots, request),
      activeRobots: activeInventory,
      activeCapacityHours,
      shortfallHours,
      standbyRobots: standbyAllocation.robots,
      standbyChargingCost: standbyAllocation.calculateChargingCost(catalog),
    };
  }

  private allocateFromActive(
    inventory: FleetInventory,
    request: WorkRequest,
    strategy: AllocationStrategy,
    catalog: RobotCatalog,
  ): OperationalAllocation {
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

  private createOnDemandAvailability(
    shortfallHours: number,
    catalog: RobotCatalog,
  ): FleetInventory {
    const counts: RobotCounts = {};

    for (const [robotType, specification] of Object.entries(catalog)) {
      counts[robotType] = Math.ceil(
        shortfallHours / specification.workingHours,
      );
    }

    return FleetInventory.create(counts);
  }
}
