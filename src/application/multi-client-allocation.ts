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

export interface MultiClientAllocationResult {
  readonly policyName: string;
  readonly clients: readonly ClientAllocation[];
  readonly remainingActiveInventory: FleetInventory;
}

export class MultiClientAllocationService {
  public constructor(
    private readonly standbyActivation: StandbyActivationService,
  ) {}

  public allocate(
    command: MultiClientAllocationCommand,
  ): MultiClientAllocationResult {
    const prioritizedClients = command.clients
      .map((client, originalIndex) => ({ client, originalIndex }))
      .sort(
        (left, right) =>
          right.client.request.hours - left.client.request.hours ||
          left.originalIndex - right.originalIndex,
      );
    const allocations: ClientAllocation[] = [];
    let remainingActiveInventory = command.activeInventory;

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
          allocations.push({
            ...base,
            status: operational.status,
            allocation: operational.allocation,
            activeRobots: operational.allocation.robots,
            standbyRobots: FleetInventory.create({
              bravo: 0,
              charlie: 0,
              delta: 0,
            }),
            shortfallHours: 0,
          });
          continue;
        }

        remainingActiveInventory = remainingActiveInventory.subtract(
          operational.activeRobots,
        );
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
    };
  }
}
