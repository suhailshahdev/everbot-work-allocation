import {
  DEFAULT_ALLOCATION_SETTINGS,
  type AllocationSettings,
} from "../application/allocation-settings.js";
import {
  runInteractiveAllocation,
  type Terminal,
} from "./interactive-allocation.js";
import {
  PLAIN_TERMINAL_STYLES,
  type TerminalStyles,
} from "./terminal-styles.js";

export async function runInteractiveSession(
  terminal: Terminal,
  styles: TerminalStyles = PLAIN_TERMINAL_STYLES,
): Promise<0 | 1> {
  let settings = DEFAULT_ALLOCATION_SETTINGS;
  let lastExitCode: 0 | 1 = 0;

  while (true) {
    renderMainMenu(terminal, settings, styles);
    const selection = normalizeSelection(
      await terminal.question("Select an option [1]: "),
      "1",
    );

    if (selection === "1") {
      terminal.writeLine();
      lastExitCode = await runInteractiveAllocation(terminal, settings, styles);
      terminal.writeLine();
      continue;
    }

    if (selection === "2") {
      terminal.writeLine();
      settings = await changeSettings(terminal, settings, styles);
      terminal.writeLine();
      continue;
    }

    if (selection === "3") {
      return lastExitCode;
    }

    terminal.writeLine(styles.error("Error: Please enter 1, 2, or 3."));
    terminal.writeLine();
  }
}

function renderMainMenu(
  terminal: Terminal,
  settings: AllocationSettings,
  styles: TerminalStyles,
): void {
  terminal.writeLine(styles.heading("Current Settings"));
  terminal.writeLine(
    `  ${styles.accent("Allocation Policy:")} ${styles.value(allocationPolicyLabel(settings))}`,
  );
  terminal.writeLine(
    `  ${styles.accent("Standby Activation:")} ${standbyPolicyStyle(settings, styles)}`,
  );
  terminal.writeLine();
  terminal.writeLine("  1. Run allocation");
  terminal.writeLine("  2. Change settings");
  terminal.writeLine("  3. Exit");
}

async function changeSettings(
  terminal: Terminal,
  initialSettings: AllocationSettings,
  styles: TerminalStyles,
): Promise<AllocationSettings> {
  let settings = initialSettings;

  while (true) {
    terminal.writeLine(styles.heading("Change Settings"));
    terminal.writeLine(
      `  1. ${styles.accent("Allocation Policy:")} ${styles.value(allocationPolicyLabel(settings))}`,
    );
    terminal.writeLine(
      `  2. ${styles.accent("Standby Activation:")} ${standbyPolicyStyle(settings, styles)}`,
    );
    terminal.writeLine("  3. Back");

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

    terminal.writeLine(styles.error("Error: Please enter 1, 2, or 3."));
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

function standbyPolicyStyle(
  settings: AllocationSettings,
  styles: TerminalStyles,
): string {
  const label = standbyPolicyLabel(settings);
  return settings.standbyPolicy === "automatic"
    ? styles.success(label)
    : styles.error(label);
}

function normalizeSelection(rawValue: string, defaultValue?: string): string {
  const normalized = rawValue.trim();
  return normalized.length === 0 && defaultValue !== undefined
    ? defaultValue
    : normalized;
}
