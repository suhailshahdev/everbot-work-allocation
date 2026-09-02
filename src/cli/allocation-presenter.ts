import type {
  AllocationOutcome,
  SingleClientAnalysis,
} from "../application/single-client-comparison.js";
import type { MultiClientAllocationResult } from "../application/multi-client-allocation.js";
import type { StandbyAllocation } from "../application/standby-activation.js";
import type { FleetInventory } from "../domain/fleet-inventory.js";
import type { RobotCatalog } from "../domain/robot-catalog.js";
import {
  PLAIN_TERMINAL_STYLES,
  type TerminalStyles,
} from "./terminal-styles.js";

export function renderSingleClientAnalysis(
  analysis: SingleClientAnalysis,
  styles: TerminalStyles = PLAIN_TERMINAL_STYLES,
  catalog: RobotCatalog,
): readonly string[] {
  return [
    ...renderCategoryDistribution(
      analysis.categoryDistribution,
      styles,
      catalog,
    ),
    "",
    ...renderCostOptimized(analysis.costOptimized, styles, catalog),
    "",
    ...renderComparison(analysis, styles),
  ];
}

export function renderStandbyActivation(
  result: StandbyAllocation,
  styles: TerminalStyles = PLAIN_TERMINAL_STYLES,
  catalog: RobotCatalog,
): readonly string[] {
  const lines = [
    styles.heading("Standby Robot Activation"),
    metric(
      "Active Robot Capacity",
      `${result.activeCapacityHours} hours`,
      styles,
    ),
    metric(
      "Client Work Requested",
      `${result.allocation.requestedHours} hours`,
      styles,
    ),
    metric("Shortfall Hours", result.shortfallHours, styles),
    `  ${styles.accent("Active Robots Used:")}`,
  ];
  const activeRobotLines = renderRobotCosts(
    result.activeRobots,
    styles,
    catalog,
    4,
  );

  lines.push(
    ...(activeRobotLines.length > 0
      ? activeRobotLines
      : [`    ${styles.muted("None")}`]),
  );
  lines.push(
    metric(
      "Active Charging Cost",
      `$${result.activeRobots.calculateTotalChargingCost(catalog)}`,
      styles,
    ),
    `  ${styles.accent("Additional Standby Robots Required:")}`,
    ...renderRobotCosts(result.standbyRobots, styles, catalog, 4),
    metric("Standby Charging Cost", `$${result.standbyChargingCost}`, styles),
    "",
    metric(
      "Total Hours Provided",
      result.allocation.calculateProvidedHours(catalog),
      styles,
    ),
    metric(
      "Excess Hours",
      result.allocation.calculateExcessHours(catalog),
      styles,
    ),
    metric(
      "Total Charging Cost",
      `$${result.allocation.calculateChargingCost(catalog)}`,
      styles,
    ),
  );

  return lines;
}

export function renderMultiClientAllocation(
  result: MultiClientAllocationResult,
  styles: TerminalStyles = PLAIN_TERMINAL_STYLES,
  catalog: RobotCatalog,
): readonly string[] {
  const lines = [
    styles.heading("Multi-Client Allocation"),
    `  ${styles.accent("Allocation Policy:")} ${styles.value(result.policyName)}`,
    `  ${styles.accent("Priority Order:")}`,
    ...result.clients.map(
      (client) =>
        `    ${client.priority}. Client ${client.clientId}: ${client.requestedHours} hours`,
    ),
  ];

  for (const client of result.clients) {
    lines.push(
      "",
      styles.accent(`Client ${client.clientId}`),
      metric("Priority", client.priority, styles),
    );

    if (client.status === "infeasible") {
      lines.push(
        `  Status: ${styles.error("Infeasible")}`,
        metric("Requested Hours", client.requestedHours, styles),
        `  ${styles.error(`Error: ${client.error.message}`)}`,
      );
      continue;
    }

    const activeRobotLines = renderRobotCounts(
      client.activeRobots,
      styles,
      catalog,
      4,
    );
    const standbyRobotLines = renderRobotCounts(
      client.standbyRobots,
      styles,
      catalog,
      4,
    );
    const status =
      client.status === "allocated"
        ? styles.success("Allocated")
        : styles.warning("Standby activated");

    lines.push(
      `  Status: ${status}`,
      metric("Requested Hours", client.requestedHours, styles),
      `  ${styles.accent("Active Robots:")}`,
      ...(activeRobotLines.length > 0
        ? activeRobotLines
        : [`    ${styles.muted("None")}`]),
      metric(
        "Active Charging Cost",
        `$${client.activeRobots.calculateTotalChargingCost(catalog)}`,
        styles,
      ),
      `  ${styles.accent("Standby Robots:")}`,
      ...(standbyRobotLines.length > 0
        ? standbyRobotLines
        : [`    ${styles.muted("None")}`]),
      metric(
        "Standby Charging Cost",
        `$${client.standbyRobots.calculateTotalChargingCost(catalog)}`,
        styles,
      ),
      metric("Shortfall Hours", client.shortfallHours, styles),
      metric(
        "Total Hours Provided",
        client.allocation.calculateProvidedHours(catalog),
        styles,
      ),
      metric(
        "Excess Hours",
        client.allocation.calculateExcessHours(catalog),
        styles,
      ),
      metric(
        "Total Charging Cost",
        `$${client.allocation.calculateChargingCost(catalog)}`,
        styles,
      ),
    );
  }

  const utilisation = result.summary.activeRobotUtilisationPercent;
  const utilisationLines = Object.entries(utilisation.byRobotType).map(
    ([robotType, value]) => {
      const specification = catalog[robotType];
      const label = specification?.label ?? robotType;
      return `${label}: ${formatUtilisation(value, styles)}`;
    },
  );
  lines.push(
    "",
    styles.heading("Allocation Summary"),
    "",
    styles.accent("Clients"),
    `  Fulfilled: ${styles.value(`${result.summary.fulfilledClients} of ${result.summary.totalClients}`)}`,
    "",
    styles.accent("Robot Usage"),
    `  Active: ${styles.value(String(result.summary.totalActiveRobotsUsed))}`,
    `  Standby: ${styles.value(String(result.summary.totalStandbyRobotsUsed))}`,
    `  Total Robots Used: ${styles.value(String(result.summary.totalRobotsUsed))}`,
    "",
    styles.accent("Cost"),
    `  Total Charging Cost: ${styles.value(`$${result.summary.totalChargingCost}`)}`,
    "",
    styles.accent("Active Fleet Utilisation"),
    `  Average: ${formatUtilisation(utilisation.average, styles)}`,
    ...utilisationLines,
  );

  return lines;
}

function formatUtilisation(
  value: number | null,
  styles: TerminalStyles,
): string {
  return value === null ? styles.muted("N/A") : styles.value(`${value}%`);
}

function renderRobotCounts(
  inventory: FleetInventory,
  styles: TerminalStyles,
  catalog: RobotCatalog,
  indentation = 0,
): string[] {
  const lines: string[] = [];
  const prefix = " ".repeat(indentation);

  for (const robotType of Object.keys(catalog)) {
    const specification = catalog[robotType];

    if (!specification) continue;

    const count = inventory.count(robotType);

    if (count > 0) {
      lines.push(
        `${prefix}${specification.label}: ${styles.value(String(count))}`,
      );
    }
  }

  return lines;
}

function renderRobotCosts(
  inventory: FleetInventory,
  styles: TerminalStyles,
  catalog: RobotCatalog,
  indentation = 0,
): string[] {
  const lines: string[] = [];
  const prefix = " ".repeat(indentation);

  for (const robotType of Object.keys(catalog)) {
    const specification = catalog[robotType];

    if (!specification) {
      continue;
    }

    const count = inventory.count(robotType);

    if (count > 0) {
      const cost = count * specification.chargingCost;

      lines.push(
        `${prefix}${specification.label}: ${styles.value(
          `${count} - cost $${cost}`,
        )}`,
      );
    }
  }

  return lines;
}

function renderCategoryDistribution(
  outcome: AllocationOutcome,
  styles: TerminalStyles,
  catalog: RobotCatalog,
): readonly string[] {
  const lines = [styles.heading("Robot Assignment")];

  if (outcome.status === "infeasible") {
    return [...lines, `  ${styles.error(`Error: ${outcome.error.message}`)}`];
  }

  const robotLines = renderRobotCounts(
    outcome.allocation.robots,
    styles,
    catalog,
    2,
  );
  lines.push(
    ...robotLines,
    "",
    metric(
      "Total Work Hours Provided",
      outcome.allocation.calculateProvidedHours(catalog),
      styles,
    ),
    metric(
      "Client Work Hours Requested",
      outcome.allocation.requestedHours,
      styles,
    ),
  );

  return lines;
}

function renderCostOptimized(
  outcome: AllocationOutcome,
  styles: TerminalStyles,
  catalog: RobotCatalog,
): readonly string[] {
  const lines = [styles.heading("Cost Optimized Allocation")];

  if (outcome.status === "infeasible") {
    return [...lines, `  ${styles.error(`Error: ${outcome.error.message}`)}`];
  }

  lines.push(
    ...renderRobotCounts(outcome.allocation.robots, styles, catalog, 2),
  );

  lines.push(
    "",
    metric(
      "Total Hours Provided",
      outcome.allocation.calculateProvidedHours(catalog),
      styles,
    ),
    metric(
      "Total Charging Cost",
      `$${outcome.allocation.calculateChargingCost(catalog)}`,
      styles,
    ),
  );

  return lines;
}

function renderComparison(
  analysis: SingleClientAnalysis,
  styles: TerminalStyles,
): readonly string[] {
  const lines = [styles.heading("Level 1 vs Level 2 Comparison")];

  if (analysis.comparison === undefined) {
    return [
      ...lines,
      `  ${styles.muted(
        "Comparison unavailable because both strategies must produce an allocation.",
      )}`,
    ];
  }

  return [
    ...lines,
    metric(
      "Level 1 Cost",
      `$${analysis.comparison.categoryDistributionCost}`,
      styles,
    ),
    metric("Level 2 Cost", `$${analysis.comparison.costOptimizedCost}`, styles),
    metric("Cost Difference", `$${analysis.comparison.costDifference}`, styles),
    "",
    `  ${styles.accent("Insight:")}`,
    `    ${analysis.comparison.insight}`,
  ];
}

function metric(
  label: string,
  value: string | number,
  styles: TerminalStyles,
): string {
  return `  ${label}: ${styles.value(String(value))}`;
}
