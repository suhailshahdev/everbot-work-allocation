import type { RobotCatalog } from "../../src/domain/robot-catalog.js";

export const TEST_ROBOT_CATALOG = {
  alpha: { label: "Alpha", workingHours: 1, chargingCost: 1 },
  bravo: { label: "Bravo", workingHours: 3, chargingCost: 2 },
  charlie: { label: "Charlie", workingHours: 5, chargingCost: 3 },
  delta: { label: "Delta", workingHours: 8, chargingCost: 4 },
} as const satisfies RobotCatalog;

export const TEST_ROBOT_COUNTS = {
  alpha: 2,
  bravo: 2,
  charlie: 3,
  delta: 2,
} as const;
