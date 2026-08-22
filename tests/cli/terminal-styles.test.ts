import { stripVTControlCharacters } from "node:util";

import { describe, expect, it } from "vitest";

import { DEFAULT_ALLOCATION_SETTINGS } from "../../src/application/allocation-settings.js";
import {
  runInteractiveAllocation,
  type Terminal,
} from "../../src/cli/interactive-allocation.js";
import { runCli } from "../../src/cli/run-cli.js";
import {
  createTerminalStyles,
  shouldUseTerminalStyles,
} from "../../src/cli/terminal-styles.js";

class FakeTerminal implements Terminal {
  readonly #inputs: string[];
  readonly #transcript: string[] = [];

  public constructor(inputs: string[]) {
    this.#inputs = [...inputs];
  }

  public writeLine(message = ""): void {
    this.#transcript.push(`${message}\n`);
  }

  public async question(prompt: string): Promise<string> {
    this.#transcript.push(prompt);
    const input = this.#inputs.shift();

    if (input === undefined) {
      throw new Error(`No fake input available for prompt: ${prompt}`);
    }

    this.#transcript.push(`${input}\n`);
    return input;
  }

  public output(): string {
    return this.#transcript.join("");
  }
}

describe("terminal styles", () => {
  it.each([
    { role: "title" as const, ansiCodes: ["\u001B[33m", "\u001B[1m"] },
    { role: "heading" as const, ansiCodes: ["\u001B[33m", "\u001B[1m"] },
    { role: "accent" as const, ansiCodes: ["\u001B[96m"] },
    { role: "success" as const, ansiCodes: ["\u001B[92m"] },
    { role: "warning" as const, ansiCodes: ["\u001B[33m"] },
    { role: "error" as const, ansiCodes: ["\u001B[91m"] },
    { role: "value" as const, ansiCodes: ["\u001B[92m"] },
    { role: "muted" as const, ansiCodes: ["\u001B[2m"] },
  ])(
    "maps the $role role to its readable ANSI style",
    ({ role, ansiCodes }) => {
      const styles = createTerminalStyles(true);
      const styled = styles[role]("EverBot");

      for (const ansiCode of ansiCodes) {
        expect(styled).toContain(ansiCode);
      }

      expect(stripVTControlCharacters(styled)).toBe("EverBot");
    },
  );

  it("keeps unbolded ordinary accents visually distinct from errors", () => {
    const styles = createTerminalStyles(true);
    const accent = styles.accent("Allocation Policy:");
    const error = styles.error("Error: Invalid input.");

    expect(error).not.toContain("\u001B[1m");
    expect(accent).toContain("\u001B[96m");
    expect(accent).not.toContain("\u001B[1m");
    expect(accent).not.toContain("\u001B[91m");
    expect(error).toContain("\u001B[91m");
    expect(error).not.toContain("\u001B[96m");
  });

  it.each([
    {
      name: "supported interactive terminal",
      colorSupported: true,
      noColor: undefined,
      expected: true,
    },
    {
      name: "redirected or unsupported output",
      colorSupported: false,
      noColor: undefined,
      expected: false,
    },
    {
      name: "non-empty NO_COLOR preference",
      colorSupported: true,
      noColor: "1",
      expected: false,
    },
    {
      name: "empty NO_COLOR value",
      colorSupported: true,
      noColor: "",
      expected: true,
    },
  ])("selects styling for a $name", ({ colorSupported, noColor, expected }) => {
    expect(shouldUseTerminalStyles({ colorSupported, noColor })).toBe(expected);
  });

  it("returns unchanged text for every semantic role when styling is disabled", () => {
    const styles = createTerminalStyles(false);

    expect(
      [
        styles.title("Title"),
        styles.heading("Heading"),
        styles.accent("Accent"),
        styles.success("Success"),
        styles.warning("Warning"),
        styles.error("Error"),
        styles.value("Value"),
        styles.muted("Muted"),
      ].join(" "),
    ).toBe("Title Heading Accent Success Warning Error Value Muted");
  });

  it("keeps a coloured session textually identical to the plain session", async () => {
    const inputs = ["9", "3"];
    const plainTerminal = new FakeTerminal(inputs);
    const colouredTerminal = new FakeTerminal(inputs);
    const plainStyles = createTerminalStyles(false);
    const colouredStyles = createTerminalStyles(true);

    await runCli(plainTerminal, plainStyles);
    await runCli(colouredTerminal, colouredStyles);

    expect(stripVTControlCharacters(colouredTerminal.output())).toBe(
      plainTerminal.output(),
    );
    expect(colouredTerminal.output()).toContain(
      colouredStyles.title("EverBot Robot Work Allocation System"),
    );
    expect(colouredTerminal.output()).toContain(
      colouredStyles.heading("Current Settings"),
    );
    expect(colouredTerminal.output()).toContain(
      colouredStyles.error("Error: Please enter 1, 2, or 3."),
    );
  });

  it("distinguishes allocated and standby statuses without changing their words", async () => {
    const styles = createTerminalStyles(true);
    const terminal = new FakeTerminal(["2", "3", "2", "21,17"]);

    const exitCode = await runInteractiveAllocation(
      terminal,
      DEFAULT_ALLOCATION_SETTINGS,
      styles,
    );

    expect(exitCode).toBe(0);
    expect(terminal.output()).toContain(styles.success("Allocated"));
    expect(terminal.output()).toContain(styles.warning("Standby activated"));
    expect(stripVTControlCharacters(terminal.output())).toContain(
      "Status: Allocated\n",
    );
    expect(stripVTControlCharacters(terminal.output())).toContain(
      "Status: Standby activated\n",
    );
  });
});
