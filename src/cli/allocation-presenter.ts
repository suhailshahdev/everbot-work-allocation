import type {
  AllocationOutcome,
  SingleClientAnalysis,
} from "../application/single-client-comparison.js";
import type { MultiClientAllocationResult } from "../application/multi-client-allocation.js";
import type { StandbyAllocation } from "../application/standby-activation.js";
import type { FleetInventory } from "../domain/fleet-inventory.js";
import { ROBOT_CATALOG, ROBOT_TYPES } from "../domain/robot-catalog.js";

export function renderSingleClientAnalysis(
  analysis: SingleClientAnalysis,
): readonly string[] {
  return [
    ...renderCategoryDistribution(analysis.categoryDistribution),
    "",
    ...renderCostOptimized(analysis.costOptimized),
    "",
    ...renderComparison(analysis),
  ];
}

export function renderStandbyActivation(
  result: StandbyAllocation,
): readonly string[] {
  const lines = [
    "Standby Robot Activation",
    `Active Robot Capacity: ${result.activeCapacityHours} hours`,
    `Client Work Requested: ${result.allocation.requestedHours} hours`,
    `Shortfall Hours: ${result.shortfallHours}`,
    "Active Robots Used:",
  ];
  const activeRobotLines = renderRobotCosts(result.activeRobots);

  lines.push(...(activeRobotLines.length > 0 ? activeRobotLines : ["None"]));
  lines.push(
    `Active Charging Cost: $${result.activeRobots.totalChargingCost}`,
    "Additional Standby Robots Required:",
    ...renderRobotCosts(result.standbyRobots),
    `Standby Charging Cost: $${result.standbyChargingCost}`,
    "",
    `Total Hours Provided: ${result.allocation.providedHours}`,
    `Excess Hours: ${result.allocation.excessHours}`,
    `Total Charging Cost: $${result.allocation.chargingCost}`,
  );

  return lines;
}

export function renderMultiClientAllocation(
  result: MultiClientAllocationResult,
): readonly string[] {
  const lines = [
    "Multi-Client Allocation",
    `Allocation Policy: ${result.policyName}`,
    "Priority Order:",
    ...result.clients.map(
      (client) =>
        `${client.priority}. Client ${client.clientId}: ${client.requestedHours} hours`,
    ),
  ];

  for (const client of result.clients) {
    lines.push("", `Client ${client.clientId}`, `Priority: ${client.priority}`);

    if (client.status === "infeasible") {
      lines.push(
        "Status: Infeasible",
        `Requested Hours: ${client.requestedHours}`,
        `Error: ${client.error.message}`,
      );
      continue;
    }

    const activeRobotLines = renderRobotCounts(client.activeRobots);
    const standbyRobotLines = renderRobotCounts(client.standbyRobots);

    lines.push(
      `Status: ${client.status === "allocated" ? "Allocated" : "Standby activated"}`,
      `Requested Hours: ${client.requestedHours}`,
      "Active Robots:",
      ...(activeRobotLines.length > 0 ? activeRobotLines : ["None"]),
      `Active Charging Cost: $${client.activeRobots.totalChargingCost}`,
      "Standby Robots:",
      ...(standbyRobotLines.length > 0 ? standbyRobotLines : ["None"]),
      `Standby Charging Cost: $${client.standbyRobots.totalChargingCost}`,
      `Shortfall Hours: ${client.shortfallHours}`,
      `Total Hours Provided: ${client.allocation.providedHours}`,
      `Excess Hours: ${client.allocation.excessHours}`,
      `Total Charging Cost: $${client.allocation.chargingCost}`,
    );
  }

  const utilisation = result.summary.activeRobotUtilisationPercent;
  lines.push(
    "",
    "Allocation Summary",
    "",
    "Clients",
    `  Fulfilled: ${result.summary.fulfilledClients} of ${result.summary.totalClients}`,
    "",
    "Robot Usage",
    `  Active: ${result.summary.totalActiveRobotsUsed}`,
    `  Standby: ${result.summary.totalStandbyRobotsUsed}`,
    `  Total Robots Used: ${result.summary.totalRobotsUsed}`,
    "",
    "Cost",
    `  Total Charging Cost: $${result.summary.totalChargingCost}`,
    "",
    "Active Fleet Utilisation",
    `  Average: ${formatUtilisation(utilisation.average)}`,
    `  Bravo: ${formatUtilisation(utilisation.bravo)}`,
    `  Charlie: ${formatUtilisation(utilisation.charlie)}`,
    `  Delta: ${formatUtilisation(utilisation.delta)}`,
  );

  return lines;
}

function formatUtilisation(value: number | null): string {
  return value === null ? "N/A" : `${value}%`;
}

function renderRobotCounts(inventory: FleetInventory): string[] {
  const lines: string[] = [];

  for (const type of ROBOT_TYPES) {
    const count = inventory.count(type);

    if (count > 0) {
      lines.push(`${ROBOT_CATALOG[type].label}: ${count}`);
    }
  }

  return lines;
}

function renderRobotCosts(inventory: FleetInventory): string[] {
  const lines: string[] = [];

  for (const type of ROBOT_TYPES) {
    const count = inventory.count(type);

    if (count > 0) {
      const cost = count * ROBOT_CATALOG[type].chargingCost;
      lines.push(`${ROBOT_CATALOG[type].label}: ${count} - cost $${cost}`);
    }
  }

  return lines;
}

function renderCategoryDistribution(
  outcome: AllocationOutcome,
): readonly string[] {
  const lines = ["Robot Assignment"];

  if (outcome.status === "infeasible") {
    return [...lines, `Error: ${outcome.error.message}`];
  }

  const counts = outcome.allocation.robots.toRecord();
  lines.push(
    `Bravo: ${counts.bravo}`,
    `Charlie: ${counts.charlie}`,
    `Delta: ${counts.delta}`,
    "",
    `Total Work Hours Provided: ${outcome.allocation.providedHours}`,
    `Client Work Hours Requested: ${outcome.allocation.requestedHours}`,
  );

  return lines;
}

function renderCostOptimized(outcome: AllocationOutcome): readonly string[] {
  const lines = ["Cost Optimized Allocation"];

  if (outcome.status === "infeasible") {
    return [...lines, `Error: ${outcome.error.message}`];
  }

  for (const type of ROBOT_TYPES) {
    const count = outcome.allocation.robots.count(type);

    if (count > 0) {
      lines.push(`${ROBOT_CATALOG[type].label}: ${count}`);
    }
  }

  lines.push(
    "",
    `Total Hours Provided: ${outcome.allocation.providedHours}`,
    `Total Charging Cost: $${outcome.allocation.chargingCost}`,
  );

  return lines;
}

function renderComparison(analysis: SingleClientAnalysis): readonly string[] {
  const lines = ["Level 1 vs Level 2 Comparison"];

  if (analysis.comparison === undefined) {
    return [
      ...lines,
      "Comparison unavailable because both strategies must produce an allocation.",
    ];
  }

  return [
    ...lines,
    `Level 1 Cost: $${analysis.comparison.categoryDistributionCost}`,
    `Level 2 Cost: $${analysis.comparison.costOptimizedCost}`,
    `Cost Difference: $${analysis.comparison.costDifference}`,
    "",
    "Insight:",
    analysis.comparison.insight,
  ];
}
