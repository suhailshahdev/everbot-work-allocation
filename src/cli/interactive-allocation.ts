import {
  MultiClientAllocationService,
  type ClientWorkRequest,
} from "../application/multi-client-allocation.js";
import {
  DEFAULT_ALLOCATION_SETTINGS,
  type AllocationSettings,
} from "../application/allocation-settings.js";
import { SingleClientComparisonService } from "../application/single-client-comparison.js";
import { StandbyActivationService } from "../application/standby-activation.js";
import { DomainError } from "../domain/errors.js";
import { FleetInventory, type RobotCounts } from "../domain/fleet-inventory.js";
import { WorkRequest } from "../domain/work-request.js";
import { CategoryDistributionStrategy } from "../strategies/category-distribution-strategy.js";
import { CostOptimizedStrategy } from "../strategies/cost-optimized-strategy.js";
import {
  renderMultiClientAllocation,
  renderSingleClientAnalysis,
  renderStandbyActivation,
} from "./allocation-presenter.js";
import { parseClientWorkHours } from "./client-hours-parser.js";
import {
  PLAIN_TERMINAL_STYLES,
  type TerminalStyles,
} from "./terminal-styles.js";

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
const multiClientService = new MultiClientAllocationService(standbyService);

export async function runInteractiveAllocation(
  terminal: Terminal,
  settings: AllocationSettings = DEFAULT_ALLOCATION_SETTINGS,
  styles: TerminalStyles = PLAIN_TERMINAL_STYLES,
): Promise<0 | 1> {
  terminal.writeLine(styles.heading("Enter number of robots available:"));

  const counts: RobotCounts = {
    bravo: await askRobotCount(terminal, "Bravo", styles),
    charlie: await askRobotCount(terminal, "Charlie", styles),
    delta: await askRobotCount(terminal, "Delta", styles),
  };

  terminal.writeLine();
  const clientWorkHours = await askClientWorkHours(terminal, styles);
  terminal.writeLine();

  try {
    const inventory = FleetInventory.create(counts);
    const [singleWorkHours] = clientWorkHours;

    if (clientWorkHours.length === 1 && singleWorkHours !== undefined) {
      return runSingleClient(
        terminal,
        inventory,
        singleWorkHours,
        settings,
        styles,
      );
    }

    return runMultipleClients(
      terminal,
      inventory,
      clientWorkHours,
      settings,
      styles,
    );
  } catch (error: unknown) {
    if (error instanceof DomainError) {
      terminal.writeLine(styles.error(`Error: ${error.message}`));
      return 1;
    }

    throw error;
  }
}

function runSingleClient(
  terminal: Terminal,
  inventory: FleetInventory,
  workHours: number,
  settings: AllocationSettings,
  styles: TerminalStyles,
): 0 | 1 {
  const request = WorkRequest.create(workHours);
  const analysis = comparisonService.analyze(inventory, request);
  const operational = standbyService.allocate(
    inventory,
    request,
    costOptimized,
    settings.standbyPolicy,
  );

  for (const line of renderSingleClientAnalysis(analysis, styles)) {
    terminal.writeLine(line);
  }

  if (operational.status === "standby-activated") {
    terminal.writeLine();

    for (const line of renderStandbyActivation(operational, styles)) {
      terminal.writeLine(line);
    }
  }

  return operational.status === "infeasible" ? 1 : 0;
}

function runMultipleClients(
  terminal: Terminal,
  inventory: FleetInventory,
  clientWorkHours: readonly number[],
  settings: AllocationSettings,
  styles: TerminalStyles,
): 0 | 1 {
  const clients: ClientWorkRequest[] = clientWorkHours.map(
    (workHours, index) => ({
      clientId: index + 1,
      request: WorkRequest.create(workHours),
    }),
  );
  const result = multiClientService.allocate({
    activeInventory: inventory,
    clients,
    strategy:
      settings.allocationPolicy === "category-distribution"
        ? categoryDistribution
        : costOptimized,
    standbyPolicy: settings.standbyPolicy,
  });

  for (const line of renderMultiClientAllocation(result, styles)) {
    terminal.writeLine(line);
  }

  return result.clients.some((client) => client.status === "infeasible")
    ? 1
    : 0;
}

async function askRobotCount(
  terminal: Terminal,
  label: string,
  styles: TerminalStyles,
): Promise<number> {
  while (true) {
    const value = parseInteger(
      await terminal.question(`  ${styles.accent(`${label}:`)} `),
    );

    if (value !== undefined && value >= 0) {
      return value;
    }

    terminal.writeLine(
      styles.error("Error: Robot counts must be non-negative integers."),
    );
  }
}

async function askClientWorkHours(
  terminal: Terminal,
  styles: TerminalStyles,
): Promise<number[]> {
  while (true) {
    terminal.writeLine(styles.heading("Enter client work hours:"));
    const value = parseClientWorkHours(await terminal.question(""));

    if (value !== undefined) {
      return value;
    }

    terminal.writeLine(
      styles.error("Error: Work hours must be a positive integer."),
    );
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
