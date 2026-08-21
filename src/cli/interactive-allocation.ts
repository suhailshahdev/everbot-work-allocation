import { SingleClientComparisonService } from "../application/single-client-comparison.js";
import { DomainError } from "../domain/errors.js";
import { FleetInventory, type RobotCounts } from "../domain/fleet-inventory.js";
import { WorkRequest } from "../domain/work-request.js";
import { CategoryDistributionStrategy } from "../strategies/category-distribution-strategy.js";
import { CostOptimizedStrategy } from "../strategies/cost-optimized-strategy.js";
import { renderSingleClientAnalysis } from "./allocation-presenter.js";

export interface Terminal {
  writeLine(message?: string): void;
  question(prompt: string): Promise<string>;
}

const comparisonService = new SingleClientComparisonService(
  new CategoryDistributionStrategy(),
  new CostOptimizedStrategy(),
);

export async function runInteractiveAllocation(
  terminal: Terminal,
): Promise<0 | 1> {
  terminal.writeLine("Enter number of robots available:");

  const counts: RobotCounts = {
    bravo: await askRobotCount(terminal, "Bravo"),
    charlie: await askRobotCount(terminal, "Charlie"),
    delta: await askRobotCount(terminal, "Delta"),
  };

  terminal.writeLine();
  const workHours = await askWorkHours(terminal);
  terminal.writeLine();

  try {
    const analysis = comparisonService.analyze(
      FleetInventory.create(counts),
      WorkRequest.create(workHours),
    );

    for (const line of renderSingleClientAnalysis(analysis)) {
      terminal.writeLine(line);
    }

    return analysis.categoryDistribution.status === "allocated" ||
      analysis.costOptimized.status === "allocated"
      ? 0
      : 1;
  } catch (error: unknown) {
    if (error instanceof DomainError) {
      terminal.writeLine(`Error: ${error.message}`);
      return 1;
    }

    throw error;
  }
}

async function askRobotCount(
  terminal: Terminal,
  label: string,
): Promise<number> {
  while (true) {
    const value = parseInteger(await terminal.question(`${label}: `));

    if (value !== undefined && value >= 0) {
      return value;
    }

    terminal.writeLine("Error: Robot counts must be non-negative integers.");
  }
}

async function askWorkHours(terminal: Terminal): Promise<number> {
  while (true) {
    terminal.writeLine("Enter client work hours:");
    const value = parseInteger(await terminal.question(""));

    if (value !== undefined && value > 0) {
      return value;
    }

    terminal.writeLine("Error: Work hours must be a positive integer.");
  }
}

function parseInteger(rawValue: string): number | undefined {
  const normalized = rawValue.trim();

  if (!/^(0|[1-9]\d*)$/.test(normalized)) {
    return undefined;
  }

  const value = Number(normalized);
  return Number.isSafeInteger(value) ? value : undefined;
}
