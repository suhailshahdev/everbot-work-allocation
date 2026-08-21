import type { Allocation } from "../domain/allocation.js";
import type { FleetInventory } from "../domain/fleet-inventory.js";
import type { WorkRequest } from "../domain/work-request.js";

export interface AllocationStrategy {
  readonly name: string;

  allocate(inventory: FleetInventory, request: WorkRequest): Allocation;
}
