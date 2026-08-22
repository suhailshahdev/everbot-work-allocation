import type {
  AllocationOutcome,
  SingleClientAnalysis,
} from "../application/single-client-comparison.js";
import type { MultiClientAllocationResult } from "../application/multi-client-allocation.js";
import type { StandbyAllocation } from "../application/standby-activation.js";
import type { FleetInventory } from "../domain/fleet-inventory.js";
import { ROBOT_CATALOG, ROBOT_TYPES } from "../domain/robot-catalog.js";
import {
  PLAIN_TERMINAL_STYLES,
  type TerminalStyles,
} from "./terminal-styles.js";

export function renderSingleClientAnalysis(
  analysis: SingleClientAnalysis,
  styles: TerminalStyles = PLAIN_TERMINAL_STYLES,
): readonly string[] {
  return [
    ...renderCategoryDistribution(analysis.categoryDistribution, styles),
    "",
    ...renderCostOptimized(analysis.costOptimized, styles),
    "",
    ...renderComparison(analysis, styles),
  ];
}

export function renderStandbyActivation(
  result: StandbyAllocation,
  styles: TerminalStyles = PLAIN_TERMINAL_STYLES,
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
  const activeRobotLines = renderRobotCosts(result.activeRobots, styles, 4);

  lines.push(
    ...(activeRobotLines.length > 0
      ? activeRobotLines
      : [`    ${styles.muted("None")}`]),
  );
  lines.push(
    metric(
      "Active Charging Cost",
      `$${result.activeRobots.totalChargingCost}`,
      styles,
    ),
    `  ${styles.accent("Additional Standby Robots Required:")}`,
    ...renderRobotCosts(result.standbyRobots, styles, 4),
    metric("Standby Charging Cost", `$${result.standbyChargingCost}`, styles),
    "",
    metric("Total Hours Provided", result.allocation.providedHours, styles),
    metric("Excess Hours", result.allocation.excessHours, styles),
    metric("Total Charging Cost", `$${result.allocation.chargingCost}`, styles),
  );

  return lines;
}

export function renderMultiClientAllocation(
  result: MultiClientAllocationResult,
  styles: TerminalStyles = PLAIN_TERMINAL_STYLES,
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

    const activeRobotLines = renderRobotCounts(client.activeRobots, styles, 4);
    const standbyRobotLines = renderRobotCounts(
      client.standbyRobots,
      styles,
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
        `$${client.activeRobots.totalChargingCost}`,
        styles,
      ),
      `  ${styles.accent("Standby Robots:")}`,
      ...(standbyRobotLines.length > 0
        ? standbyRobotLines
        : [`    ${styles.muted("None")}`]),
      metric(
        "Standby Charging Cost",
        `$${client.standbyRobots.totalChargingCost}`,
        styles,
      ),
      metric("Shortfall Hours", client.shortfallHours, styles),
      metric("Total Hours Provided", client.allocation.providedHours, styles),
      metric("Excess Hours", client.allocation.excessHours, styles),
      metric(
        "Total Charging Cost",
        `$${client.allocation.chargingCost}`,
        styles,
      ),
    );
  }

  const utilisation = result.summary.activeRobotUtilisationPercent;
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
    `  Bravo: ${formatUtilisation(utilisation.bravo, styles)}`,
    `  Charlie: ${formatUtilisation(utilisation.charlie, styles)}`,
    `  Delta: ${formatUtilisation(utilisation.delta, styles)}`,
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
  indentation = 0,
): string[] {
  const lines: string[] = [];
  const prefix = " ".repeat(indentation);

  for (const type of ROBOT_TYPES) {
    const count = inventory.count(type);

    if (count > 0) {
      lines.push(
        `${prefix}${ROBOT_CATALOG[type].label}: ${styles.value(String(count))}`,
      );
    }
  }

  return lines;
}

function renderRobotCosts(
  inventory: FleetInventory,
  styles: TerminalStyles,
  indentation = 0,
): string[] {
  const lines: string[] = [];
  const prefix = " ".repeat(indentation);

  for (const type of ROBOT_TYPES) {
    const count = inventory.count(type);

    if (count > 0) {
      const cost = count * ROBOT_CATALOG[type].chargingCost;
      lines.push(
        `${prefix}${ROBOT_CATALOG[type].label}: ${styles.value(
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
): readonly string[] {
  const lines = [styles.heading("Robot Assignment")];

  if (outcome.status === "infeasible") {
    return [...lines, `  ${styles.error(`Error: ${outcome.error.message}`)}`];
  }

  const counts = outcome.allocation.robots.toRecord();
  lines.push(
    `  Bravo: ${styles.value(String(counts.bravo))}`,
    `  Charlie: ${styles.value(String(counts.charlie))}`,
    `  Delta: ${styles.value(String(counts.delta))}`,
    "",
    metric(
      "Total Work Hours Provided",
      outcome.allocation.providedHours,
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
): readonly string[] {
  const lines = [styles.heading("Cost Optimized Allocation")];

  if (outcome.status === "infeasible") {
    return [...lines, `  ${styles.error(`Error: ${outcome.error.message}`)}`];
  }

  for (const type of ROBOT_TYPES) {
    const count = outcome.allocation.robots.count(type);

    if (count > 0) {
      lines.push(
        `  ${ROBOT_CATALOG[type].label}: ${styles.value(String(count))}`,
      );
    }
  }

  lines.push(
    "",
    metric("Total Hours Provided", outcome.allocation.providedHours, styles),
    metric(
      "Total Charging Cost",
      `$${outcome.allocation.chargingCost}`,
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
