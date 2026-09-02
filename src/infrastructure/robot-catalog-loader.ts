import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { RobotCatalog } from "../domain/robot-catalog.js";

export function loadRobotCatalog(): RobotCatalog {
  const path = resolve(process.cwd(), "config", "robot-catalog.json");

  const json = readFileSync(path, "utf8");

  return JSON.parse(json) as RobotCatalog;
}
