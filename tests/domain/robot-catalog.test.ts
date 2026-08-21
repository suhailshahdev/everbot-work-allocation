import { describe, expect, it } from "vitest";

import { ROBOT_CATALOG, ROBOT_TYPES } from "../../src/domain/robot-catalog.js";

describe("robot catalogue", () => {
  it("defines the fixed robot specifications in catalogue order", () => {
    expect(ROBOT_TYPES).toEqual(["bravo", "charlie", "delta"]);
    expect(ROBOT_CATALOG).toEqual({
      bravo: { label: "Bravo", workingHours: 3, chargingCost: 2 },
      charlie: { label: "Charlie", workingHours: 5, chargingCost: 3 },
      delta: { label: "Delta", workingHours: 8, chargingCost: 4 },
    });
  });

  it("keeps the catalogue and each specification frozen", () => {
    expect(Object.isFrozen(ROBOT_CATALOG)).toBe(true);

    for (const type of ROBOT_TYPES) {
      expect(Object.isFrozen(ROBOT_CATALOG[type])).toBe(true);
    }
  });
});
