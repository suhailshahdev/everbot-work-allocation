import type { Allocation } from "../domain/allocation.js";
import { DomainError } from "../domain/errors.js";
import { FleetInventory } from "../domain/fleet-inventory.js";
import type { WorkRequest } from "../domain/work-request.js";
import type { AllocationStrategy } from "../strategies/allocation-strategy.js";
import type { StandbyPolicy } from "./allocation-settings.js";
import type { StandbyActivationService } from "./standby-activation.js";

export interface ClientWorkRequest {
  readonly clientId: number;
  readonly request: WorkRequest;
}

interface ClientAllocationBase {
  readonly clientId: number;
  readonly priority: number;
  readonly requestedHours: number;
}

export interface FulfilledClientAllocation extends ClientAllocationBase {
  readonly status: "allocated" | "standby-activated";
  readonly allocation: Allocation;
  readonly activeRobots: FleetInventory;
  readonly standbyRobots: FleetInventory;
  readonly shortfallHours: number;
}

export interface InfeasibleClientAllocation extends ClientAllocationBase {
  readonly status: "infeasible";
  readonly error: DomainError;
}

export type ClientAllocation =
  FulfilledClientAllocation | InfeasibleClientAllocation;

export interface MultiClientAllocationCommand {
  readonly activeInventory: FleetInventory;
  readonly clients: readonly ClientWorkRequest[];
  readonly strategy: AllocationStrategy;
  readonly standbyPolicy?: StandbyPolicy;
}

export interface ActiveRobotUtilisationPercent {
  readonly average: number | null;
  readonly bravo: number | null;
  readonly charlie: number | null;
  readonly delta: number | null;
}

export interface AllocationSummary {
  readonly totalClients: number;
  readonly fulfilledClients: number;
  readonly totalActiveRobotsUsed: number;
  readonly totalStandbyRobotsUsed: number;
  readonly totalRobotsUsed: number;
  readonly totalChargingCost: number;
  readonly activeRobotUtilisationPercent: ActiveRobotUtilisationPercent;
}

export interface MultiClientAllocationResult {
  readonly policyName: string;
  readonly clients: readonly ClientAllocation[];
  readonly remainingActiveInventory: FleetInventory;
  readonly summary: AllocationSummary;
}

export class MultiClientAllocationService {
  public constructor(
    private readonly standbyActivation: StandbyActivationService,
  ) {}

  public allocate(
    command: MultiClientAllocationCommand,
  ): MultiClientAllocationResult {
    // Keep the original position so equal-hour clients retain their input order explicitly.
    const prioritizedClients = command.clients
      .map((client, originalIndex) => ({ client, originalIndex }))
      .sort(
        (left, right) =>
          right.client.request.hours - left.client.request.hours ||
          left.originalIndex - right.originalIndex,
      );
    const allocations: ClientAllocation[] = [];
    const emptyInventory = FleetInventory.create({
      bravo: 0,
      charlie: 0,
      delta: 0,
    });
    let remainingActiveInventory = command.activeInventory;
    let activeRobotsUsed = emptyInventory;
    let standbyRobotsUsed = emptyInventory;

    for (const [index, prioritized] of prioritizedClients.entries()) {
      const { client } = prioritized;
      const base = {
        clientId: client.clientId,
        priority: index + 1,
        requestedHours: client.request.hours,
      };

      try {
        const operational = this.standbyActivation.allocate(
          remainingActiveInventory,
          client.request,
          command.strategy,
          command.standbyPolicy,
        );

        if (operational.status === "infeasible") {
          allocations.push({ ...base, ...operational });
          continue;
        }

        if (operational.status === "allocated") {
          remainingActiveInventory = remainingActiveInventory.subtract(
            operational.allocation.robots,
          );
          activeRobotsUsed = activeRobotsUsed.add(
            operational.allocation.robots,
          );
          allocations.push({
            ...base,
            status: operational.status,
            allocation: operational.allocation,
            activeRobots: operational.allocation.robots,
            standbyRobots: emptyInventory,
            shortfallHours: 0,
          });
          continue;
        }

        remainingActiveInventory = remainingActiveInventory.subtract(
          operational.activeRobots,
        );
        activeRobotsUsed = activeRobotsUsed.add(operational.activeRobots);
        standbyRobotsUsed = standbyRobotsUsed.add(operational.standbyRobots);
        allocations.push({
          ...base,
          status: operational.status,
          allocation: operational.allocation,
          activeRobots: operational.activeRobots,
          standbyRobots: operational.standbyRobots,
          shortfallHours: operational.shortfallHours,
        });
      } catch (error: unknown) {
        if (error instanceof DomainError) {
          allocations.push({ ...base, status: "infeasible", error });
          continue;
        }

        throw error;
      }
    }

    return {
      policyName: command.strategy.name,
      clients: allocations,
      remainingActiveInventory,
      summary: this.summarize(
        command.activeInventory,
        allocations,
        activeRobotsUsed,
        standbyRobotsUsed,
      ),
    };
  }

  private summarize(
    initialActiveInventory: FleetInventory,
    allocations: readonly ClientAllocation[],
    activeRobotsUsed: FleetInventory,
    standbyRobotsUsed: FleetInventory,
  ): AllocationSummary {
    const fulfilled = allocations.filter(
      (allocation): allocation is FulfilledClientAllocation =>
        allocation.status !== "infeasible",
    );
    const totalActiveRobotsUsed = activeRobotsUsed.totalRobots;
    const totalStandbyRobotsUsed = standbyRobotsUsed.totalRobots;

    return {
      totalClients: allocations.length,
      fulfilledClients: fulfilled.length,
      totalActiveRobotsUsed,
      totalStandbyRobotsUsed,
      totalRobotsUsed: totalActiveRobotsUsed + totalStandbyRobotsUsed,
      totalChargingCost: fulfilled.reduce(
        (total, allocation) => total + allocation.allocation.chargingCost,
        0,
      ),
      activeRobotUtilisationPercent: {
        average: this.calculateUtilisation(
          totalActiveRobotsUsed,
          initialActiveInventory.totalRobots,
        ),
        bravo: this.calculateUtilisation(
          activeRobotsUsed.count("bravo"),
          initialActiveInventory.count("bravo"),
        ),
        charlie: this.calculateUtilisation(
          activeRobotsUsed.count("charlie"),
          initialActiveInventory.count("charlie"),
        ),
        delta: this.calculateUtilisation(
          activeRobotsUsed.count("delta"),
          initialActiveInventory.count("delta"),
        ),
      },
    };
  }

  private calculateUtilisation(
    robotsUsed: number,
    robotsAvailable: number,
  ): number | null {
    if (robotsAvailable === 0) {
      return null;
    }

    return Math.round((robotsUsed / robotsAvailable) * 1_000) / 10;
  }
}
