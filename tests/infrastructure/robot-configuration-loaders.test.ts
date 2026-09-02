import { describe, expect, it } from "vitest";

import { loadRobotCatalog } from "../../src/infrastructure/robot-catalog-loader.js";
import { loadRobotDowntimes } from "../../src/infrastructure/robot-downtime-loader.js";

describe("robot configuration loaders", () => {
  it("loads every configured robot type and its specification", () => {
    expect(loadRobotCatalog()).toEqual({
      alpha: { label: "Alpha", workingHours: 1, chargingCost: 1 },
      bravo: { label: "Bravo", workingHours: 3, chargingCost: 2 },
      charlie: { label: "Charlie", workingHours: 5, chargingCost: 3 },
      delta: { label: "Delta", workingHours: 8, chargingCost: 4 },
    });
  });

  it("loads the configured inclusive downtime window", () => {
    expect(loadRobotDowntimes()).toEqual([
      { robotType: "bravo", from: "2026-09-01", to: "2026-09-03" },
    ]);
  });
});
