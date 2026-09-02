import type { RobotCatalog, RobotSpecification } from "./robot-catalog.js";
import type { RobotDowntime } from "./robot-downtime.js";

export function isRobotTypeDown(
  robotType: string,
  date: string,
  downtimes: readonly RobotDowntime[],
): boolean {
  return downtimes.some(
    (downtime) =>
      downtime.robotType === robotType &&
      date >= downtime.from &&
      date <= downtime.to,
  );
}

export function getAvailableRobotCatalog(
  catalog: RobotCatalog,
  date: string,
  downtimes: readonly RobotDowntime[],
): RobotCatalog {
  const availableCatalog: Record<string, RobotSpecification> = {};

  for (const robotType of Object.keys(catalog)) {
    if (isRobotTypeDown(robotType, date, downtimes)) {
      continue;
    }

    const specification = catalog[robotType];

    if (!specification) continue;

    availableCatalog[robotType] = specification;
  }

  return availableCatalog;
}
