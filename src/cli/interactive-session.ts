import {
  DEFAULT_ALLOCATION_SETTINGS,
  type AllocationSettings,
} from "../application/allocation-settings.js";
import {
  runInteractiveAllocation,
  type Terminal,
} from "./interactive-allocation.js";

export async function runInteractiveSession(
  terminal: Terminal,
): Promise<0 | 1> {
  let settings = DEFAULT_ALLOCATION_SETTINGS;
  let lastExitCode: 0 | 1 = 0;

  while (true) {
    renderMainMenu(terminal, settings);
    const selection = normalizeSelection(
      await terminal.question("Select an option [1]: "),
      "1",
    );

    if (selection === "1") {
      terminal.writeLine();
      lastExitCode = await runInteractiveAllocation(terminal, settings);
      terminal.writeLine();
      continue;
    }

    if (selection === "2") {
      terminal.writeLine();
      settings = await changeSettings(terminal, settings);
      terminal.writeLine();
      continue;
    }

    if (selection === "3") {
      return lastExitCode;
    }

    terminal.writeLine("Error: Please enter 1, 2, or 3.");
    terminal.writeLine();
  }
}

function renderMainMenu(
  terminal: Terminal,
  settings: AllocationSettings,
): void {
  terminal.writeLine("Current Settings");
  terminal.writeLine(`Allocation Policy: ${allocationPolicyLabel(settings)}`);
  terminal.writeLine(`Standby Activation: ${standbyPolicyLabel(settings)}`);
  terminal.writeLine("1. Run allocation");
  terminal.writeLine("2. Change settings");
  terminal.writeLine("3. Exit");
}

async function changeSettings(
  terminal: Terminal,
  initialSettings: AllocationSettings,
): Promise<AllocationSettings> {
  let settings = initialSettings;

  while (true) {
    terminal.writeLine("Change Settings");
    terminal.writeLine(
      `1. Allocation Policy: ${allocationPolicyLabel(settings)}`,
    );
    terminal.writeLine(
      `2. Standby Activation: ${standbyPolicyLabel(settings)}`,
    );
    terminal.writeLine("3. Back");

    const selection = normalizeSelection(
      await terminal.question("Select an option: "),
    );

    if (selection === "1") {
      settings = {
        ...settings,
        allocationPolicy:
          settings.allocationPolicy === "cost-optimized"
            ? "category-distribution"
            : "cost-optimized",
      };
      terminal.writeLine();
      continue;
    }

    if (selection === "2") {
      settings = {
        ...settings,
        standbyPolicy:
          settings.standbyPolicy === "automatic" ? "disabled" : "automatic",
      };
      terminal.writeLine();
      continue;
    }

    if (selection === "3") {
      return settings;
    }

    terminal.writeLine("Error: Please enter 1, 2, or 3.");
    terminal.writeLine();
  }
}

function allocationPolicyLabel(settings: AllocationSettings): string {
  return settings.allocationPolicy === "cost-optimized"
    ? "Cost optimised"
    : "Category distribution";
}

function standbyPolicyLabel(settings: AllocationSettings): string {
  return settings.standbyPolicy === "automatic" ? "Automatic" : "Disabled";
}

function normalizeSelection(rawValue: string, defaultValue?: string): string {
  const normalized = rawValue.trim();
  return normalized.length === 0 && defaultValue !== undefined
    ? defaultValue
    : normalized;
}
