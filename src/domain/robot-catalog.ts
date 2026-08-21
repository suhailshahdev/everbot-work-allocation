export const ROBOT_TYPES = ["bravo", "charlie", "delta"] as const;

export type RobotType = (typeof ROBOT_TYPES)[number];

export interface RobotSpecification {
  readonly label: string;
  readonly workingHours: number;
  readonly chargingCost: number;
}

export const ROBOT_CATALOG: Readonly<Record<RobotType, RobotSpecification>> =
  Object.freeze({
    bravo: Object.freeze({
      label: "Bravo",
      workingHours: 3,
      chargingCost: 2,
    }),
    charlie: Object.freeze({
      label: "Charlie",
      workingHours: 5,
      chargingCost: 3,
    }),
    delta: Object.freeze({
      label: "Delta",
      workingHours: 8,
      chargingCost: 4,
    }),
  });
