import { describe, expect, it } from "vitest";

import {
  getAvailableRobotCatalog,
  isRobotTypeDown,
} from "../../src/domain/robot-availability.js";
import type { RobotDowntime } from "../../src/domain/robot-downtime.js";
import { TEST_ROBOT_CATALOG } from "../support/robot-catalog.js";

const downtimes: readonly RobotDowntime[] = [
  { robotType: "bravo", from: "2026-09-01", to: "2026-09-03" },
];

describe("robot availability", () => {
  it.each([
    ["2026-08-31", false],
    ["2026-09-01", true],
    ["2026-09-02", true],
    ["2026-09-03", true],
    ["2026-09-04", false],
  ])("reports Bravo downtime status on %s", (date, expectedToBeDown) => {
    expect(isRobotTypeDown("bravo", date, downtimes)).toBe(expectedToBeDown);
  });

  it("does not apply one robot type's downtime to another type", () => {
    expect(isRobotTypeDown("alpha", "2026-09-02", downtimes)).toBe(false);
  });

  it("removes unavailable robot types without mutating the full catalogue", () => {
    const availableCatalog = getAvailableRobotCatalog(
      TEST_ROBOT_CATALOG,
      "2026-09-02",
      downtimes,
    );

    expect(availableCatalog).toEqual({
      alpha: TEST_ROBOT_CATALOG.alpha,
      charlie: TEST_ROBOT_CATALOG.charlie,
      delta: TEST_ROBOT_CATALOG.delta,
    });
    expect(TEST_ROBOT_CATALOG).toHaveProperty("bravo");
  });

  it("keeps the complete catalogue when no downtime matches the date", () => {
    expect(
      getAvailableRobotCatalog(TEST_ROBOT_CATALOG, "2026-09-04", downtimes),
    ).toEqual(TEST_ROBOT_CATALOG);
  });
});
