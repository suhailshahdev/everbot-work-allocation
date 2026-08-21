import { DomainError } from "./errors.js";
import { ROBOT_CATALOG, ROBOT_TYPES, type RobotType } from "./robot-catalog.js";

export interface RobotCounts {
  bravo: number;
  charlie: number;
  delta: number;
}

export class FleetInventory {
  readonly #counts: Readonly<RobotCounts>;

  private constructor(counts: RobotCounts) {
    this.#counts = Object.freeze({ ...counts });
  }

  public static create(counts: RobotCounts): FleetInventory {
    for (const type of ROBOT_TYPES) {
      const count = counts[type];

      if (!Number.isSafeInteger(count) || count < 0) {
        throw new DomainError(
          "INVALID_ROBOT_COUNT",
          "Robot counts must be non-negative integers.",
          { robotType: type, value: count },
        );
      }
    }

    return new FleetInventory(counts);
  }

  public count(type: RobotType): number {
    return this.#counts[type];
  }

  public get totalRobots(): number {
    return ROBOT_TYPES.reduce((total, type) => total + this.count(type), 0);
  }

  public get totalHours(): number {
    return ROBOT_TYPES.reduce(
      (total, type) =>
        total + this.count(type) * ROBOT_CATALOG[type].workingHours,
      0,
    );
  }

  public get totalChargingCost(): number {
    return ROBOT_TYPES.reduce(
      (total, type) =>
        total + this.count(type) * ROBOT_CATALOG[type].chargingCost,
      0,
    );
  }

  public get isEmpty(): boolean {
    return this.totalRobots === 0;
  }

  public get hasEveryCategory(): boolean {
    return ROBOT_TYPES.every((type) => this.count(type) > 0);
  }

  public add(other: FleetInventory): FleetInventory {
    return FleetInventory.create({
      bravo: this.count("bravo") + other.count("bravo"),
      charlie: this.count("charlie") + other.count("charlie"),
      delta: this.count("delta") + other.count("delta"),
    });
  }

  public subtract(assigned: FleetInventory): FleetInventory {
    const remaining: RobotCounts = {
      bravo: this.count("bravo") - assigned.count("bravo"),
      charlie: this.count("charlie") - assigned.count("charlie"),
      delta: this.count("delta") - assigned.count("delta"),
    };

    for (const type of ROBOT_TYPES) {
      if (remaining[type] < 0) {
        throw new DomainError(
          "INSUFFICIENT_INVENTORY",
          `Cannot consume more ${ROBOT_CATALOG[type].label} robots than are available.`,
          {
            robotType: type,
            available: this.count(type),
            requested: assigned.count(type),
          },
        );
      }
    }

    return FleetInventory.create(remaining);
  }

  public toRecord(): RobotCounts {
    return { ...this.#counts };
  }
}
