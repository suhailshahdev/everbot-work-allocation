import type { FleetInventory } from "./fleet-inventory.js";
import type { WorkRequest } from "./work-request.js";
import type { RobotCatalog } from "./robot-catalog.js";

export class Allocation {
  public constructor(
    public readonly robots: FleetInventory,
    public readonly request: WorkRequest,
  ) {}

  public get requestedHours(): number {
    return this.request.hours;
  }

  public calculateProvidedHours(catalog: RobotCatalog) {
    return this.robots.calculateTotalHours(catalog);
  }

  public calculateExcessHours(catalog: RobotCatalog) {
    return this.calculateProvidedHours(catalog) - this.requestedHours;
  }

  public calculateChargingCost(catalog: RobotCatalog) {
    return this.robots.calculateTotalChargingCost(catalog);
  }
}
