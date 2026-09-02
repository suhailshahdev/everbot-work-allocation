import { DomainError } from "./errors.js";
import type { RobotCatalog } from "./robot-catalog.js";

export type RobotCounts = Record<string, number>;

export class FleetInventory {
  readonly #counts: Readonly<RobotCounts>;

  private constructor(counts: RobotCounts) {
    this.#counts = Object.freeze({ ...counts });
  }

  public static create(counts: RobotCounts): FleetInventory {
    for (const [robotType, count] of Object.entries(counts)) {
      if (!Number.isSafeInteger(count) || count < 0) {
        throw new DomainError(
          "INVALID_ROBOT_COUNT",
          "Robot counts must be non-negative integers.",
          { robotType, value: count },
        );
      }
    }

    return new FleetInventory(counts);
  }

  public count(type: string): number {
    return this.#counts[type] ?? 0;
  }

  public get totalRobots(): number {
    return Object.values(this.#counts).reduce(
      (total, count) => total + count,
      0,
    );
  }

  public calculateTotalHours(catalog: RobotCatalog): number {
    return Object.entries(this.#counts).reduce((total, [robotType, count]) => {
      const specification = catalog[robotType];

      if (!specification) {
        throw new Error(`Unknown robot type: ${robotType}`);
      }

      return total + count * specification.workingHours;
    }, 0);
  }

  public calculateTotalChargingCost(catalog: RobotCatalog): number {
    return Object.entries(this.#counts).reduce((total, [robotType, count]) => {
      const specification = catalog[robotType];

      if (!specification) {
        throw new Error(`Unknown robot type: ${robotType}`);
      }

      return total + count * specification.chargingCost;
    }, 0);
  }

  public get isEmpty(): boolean {
    return this.totalRobots === 0;
  }

  public hasEveryCategory(catalog: RobotCatalog): boolean {
    return Object.keys(catalog).every((robotType) => this.count(robotType) > 0);
  }

  public add(other: FleetInventory): FleetInventory {
    const robotTypes = new Set([
      ...Object.keys(this.#counts),
      ...Object.keys(other.#counts),
    ]);

    const combined: RobotCounts = {};

    for (const robotType of robotTypes) {
      combined[robotType] = this.count(robotType) + other.count(robotType);
    }

    return FleetInventory.create(combined);
  }

  public subtract(assigned: FleetInventory): FleetInventory {
    const robotTypes = new Set([
      ...Object.keys(this.#counts),
      ...Object.keys(assigned.#counts),
    ]);

    const remaining: RobotCounts = {};

    for (const robotType of robotTypes) {
      const available = this.count(robotType);

      const requested = assigned.count(robotType);

      if (requested > available) {
        throw new DomainError(
          "INSUFFICIENT_INVENTORY",
          `Cannot consume more ${robotType} robots than are available`,
          {
            robotType,
            available,
            requested,
          },
        );
      }

      remaining[robotType] = available - requested;
    }

    return FleetInventory.create(remaining);
  }

  public toRecord(): RobotCounts {
    return { ...this.#counts };
  }
}
