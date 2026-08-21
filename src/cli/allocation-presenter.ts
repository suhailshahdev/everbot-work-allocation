import type {
  AllocationOutcome,
  SingleClientAnalysis,
} from "../application/single-client-comparison.js";
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
