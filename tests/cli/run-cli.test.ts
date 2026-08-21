import { describe, expect, it } from "vitest";

import type { Terminal } from "../../src/cli/interactive-allocation.js";
import { runCli } from "../../src/cli/run-cli.js";

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

describe("runCli", () => {
  it("renders the challenge's 16-hour example through the complete CLI", async () => {
    const terminal = new FakeTerminal(["2", "3", "2", "16"]);

    const exitCode = await runCli(terminal);

    expect(exitCode).toBe(0);
    expect(terminal.output()).toBe(
      [
        "EverBot Robot Work Allocation System\n",
        "Enter number of robots available:\n",
        "Bravo: 2\n",
        "Charlie: 3\n",
        "Delta: 2\n",
        "\n",
        "Enter client work hours:\n",
        "16\n",
        "\n",
        "Robot Assignment\n",
        "Bravo: 1\n",
        "Charlie: 1\n",
        "Delta: 1\n",
        "\n",
        "Total Work Hours Provided: 16\n",
        "Client Work Hours Requested: 16\n",
      ].join(""),
    );
  });

  it.each(["-1", "1.5", "robots", "9007199254740992"])(
    "explains and re-prompts for invalid robot count %s",
    async (invalidCount) => {
      const terminal = new FakeTerminal([invalidCount, "2", "3", "2", "16"]);

      const exitCode = await runCli(terminal);

      expect(exitCode).toBe(0);
      expect(terminal.output()).toContain(
        `Bravo: ${invalidCount}\n` +
          "Error: Robot counts must be non-negative integers.\n" +
          "Bravo: 2\n",
      );
    },
  );

  it.each(["0", "-1", "1.5", "hours", "9007199254740992"])(
    "explains and re-prompts for invalid client work hours %s",
    async (invalidHours) => {
      const terminal = new FakeTerminal(["2", "3", "2", invalidHours, "16"]);

      const exitCode = await runCli(terminal);

      expect(exitCode).toBe(0);
      expect(terminal.output()).toContain(
        "Enter client work hours:\n" +
          `${invalidHours}\n` +
          "Error: Work hours must be a positive integer.\n" +
          "Enter client work hours:\n" +
          "16\n",
      );
    },
  );

  it("prints the category error and returns failure when a category is missing", async () => {
    const terminal = new FakeTerminal(["2", "3", "0", "16"]);

    const exitCode = await runCli(terminal);

    expect(exitCode).toBe(1);
    expect(terminal.output()).toContain(
      "Error: Unable to allocate at least one robot from each category with the available inventory.\n",
    );
    expect(terminal.output()).not.toContain("Robot Assignment");
  });

  it("prints the no-robots error and returns failure for empty inventory", async () => {
    const terminal = new FakeTerminal(["0", "0", "0", "1"]);

    const exitCode = await runCli(terminal);

    expect(exitCode).toBe(1);
    expect(terminal.output()).toContain(
      "Error: No robots available for assignment.\n",
    );
    expect(terminal.output()).not.toContain("Robot Assignment");
  });

  it("prints the capacity error and returns failure when total hours are insufficient", async () => {
    const terminal = new FakeTerminal(["1", "1", "1", "17"]);

    const exitCode = await runCli(terminal);

    expect(exitCode).toBe(1);
    expect(terminal.output()).toContain(
      "Error: Insufficient robot capacity to complete the requested work.\n",
    );
    expect(terminal.output()).not.toContain("Robot Assignment");
  });
});
