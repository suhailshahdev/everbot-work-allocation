import { SingleClientComparisonService } from "../application/single-client-comparison.js";
import { StandbyActivationService } from "../application/standby-activation.js";
import { DomainError } from "../domain/errors.js";
import { FleetInventory, type RobotCounts } from "../domain/fleet-inventory.js";
import { WorkRequest } from "../domain/work-request.js";
import { CategoryDistributionStrategy } from "../strategies/category-distribution-strategy.js";
import { CostOptimizedStrategy } from "../strategies/cost-optimized-strategy.js";
import {
  renderSingleClientAnalysis,
  renderStandbyActivation,
} from "./allocation-presenter.js";

export interface Terminal {
  writeLine(message?: string): void;
  question(prompt: string): Promise<string>;
}

const categoryDistribution = new CategoryDistributionStrategy();
const costOptimized = new CostOptimizedStrategy();
const comparisonService = new SingleClientComparisonService(
  categoryDistribution,
  costOptimized,
);
const standbyService = new StandbyActivationService(costOptimized);

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
    const inventory = FleetInventory.create(counts);
    const request = WorkRequest.create(workHours);
    const analysis = comparisonService.analyze(inventory, request);
    const operational = standbyService.allocate(
      inventory,
      request,
      costOptimized,
    );

    for (const line of renderSingleClientAnalysis(analysis)) {
      terminal.writeLine(line);
    }

    if (operational.status === "standby-activated") {
      terminal.writeLine();

      for (const line of renderStandbyActivation(operational)) {
        terminal.writeLine(line);
      }
    }

    return operational.status === "infeasible" ? 1 : 0;
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
