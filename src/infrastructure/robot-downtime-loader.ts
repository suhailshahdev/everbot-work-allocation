import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { RobotDowntime } from "../domain/robot-downtime.js";

export function loadRobotDowntimes(): readonly RobotDowntime[] {
  const path = resolve(process.cwd(), "config", "robot-downtime.json");

  const json = readFileSync(path, "utf8");

  return JSON.parse(json) as RobotDowntime[];
}
