import type { FleetInventory } from "./fleet-inventory.js";
import type { WorkRequest } from "./work-request.js";

export class Allocation {
  public constructor(
    public readonly robots: FleetInventory,
    public readonly request: WorkRequest,
  ) {}

  public get requestedHours(): number {
    return this.request.hours;
  }

  public get providedHours(): number {
    return this.robots.totalHours;
  }

  public get excessHours(): number {
    return this.providedHours - this.requestedHours;
  }

  public get chargingCost(): number {
    return this.robots.totalChargingCost;
  }
}
