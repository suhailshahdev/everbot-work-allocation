import { Allocation } from "../domain/allocation.js";
import { DomainError } from "../domain/errors.js";
import { FleetInventory } from "../domain/fleet-inventory.js";
import { ROBOT_CATALOG } from "../domain/robot-catalog.js";
import { WorkRequest } from "../domain/work-request.js";
import type { AllocationStrategy } from "../strategies/allocation-strategy.js";

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
  ): OperationalAllocation {
    if (activeInventory.totalHours >= request.hours) {
      return this.allocateFromActive(activeInventory, request, activeStrategy);
    }

    const shortfallHours = request.hours - activeInventory.totalHours;
    const standbyRequest = WorkRequest.create(shortfallHours);
    const standbyAvailability = this.createOnDemandAvailability(shortfallHours);
    const standbyAllocation = this.standbyStrategy.allocate(
      standbyAvailability,
      standbyRequest,
    );
    const combinedRobots = activeInventory.add(standbyAllocation.robots);

    return {
      status: "standby-activated",
      allocation: new Allocation(combinedRobots, request),
      activeRobots: activeInventory,
      activeCapacityHours: activeInventory.totalHours,
      shortfallHours,
      standbyRobots: standbyAllocation.robots,
      standbyChargingCost: standbyAllocation.chargingCost,
    };
  }

  private allocateFromActive(
    inventory: FleetInventory,
    request: WorkRequest,
    strategy: AllocationStrategy,
  ): OperationalAllocation {
    try {
      return {
        status: "allocated",
        allocation: strategy.allocate(inventory, request),
      };
    } catch (error: unknown) {
      if (error instanceof DomainError) {
        return { status: "infeasible", error };
      }

      throw error;
    }
  }

  private createOnDemandAvailability(shortfallHours: number): FleetInventory {
    return FleetInventory.create({
      bravo: Math.ceil(shortfallHours / ROBOT_CATALOG.bravo.workingHours),
      charlie: Math.ceil(shortfallHours / ROBOT_CATALOG.charlie.workingHours),
      delta: Math.ceil(shortfallHours / ROBOT_CATALOG.delta.workingHours),
    });
  }
}
