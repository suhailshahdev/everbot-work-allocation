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
        "\n",
        "Cost Optimized Allocation\n",
        "Delta: 2\n",
        "\n",
        "Total Hours Provided: 16\n",
        "Total Charging Cost: $8\n",
        "\n",
        "Level 1 vs Level 2 Comparison\n",
        "Level 1 Cost: $9\n",
        "Level 2 Cost: $8\n",
        "Cost Difference: $1\n",
        "\n",
        "Insight:\n",
        "Level 1 strategy resulted in $1 additional cost due to mandatory usage of multiple robot categories.\n",
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

  it("preserves the category error while returning the valid cost-optimised result", async () => {
    const terminal = new FakeTerminal(["2", "3", "0", "16"]);

    const exitCode = await runCli(terminal);

    expect(exitCode).toBe(0);
    expect(terminal.output()).toContain(
      "Robot Assignment\n" +
        "Error: Unable to allocate at least one robot from each category with the available inventory.\n",
    );
    expect(terminal.output()).toContain(
      "Cost Optimized Allocation\n" +
        "Bravo: 2\n" +
        "Charlie: 2\n" +
        "\n" +
        "Total Hours Provided: 16\n" +
        "Total Charging Cost: $10\n",
    );
    expect(terminal.output()).toContain(
      "Comparison unavailable because both strategies must produce an allocation.\n",
    );
  });

  it("prints both no-robots failures and returns failure for empty inventory", async () => {
    const terminal = new FakeTerminal(["0", "0", "0", "1"]);

    const exitCode = await runCli(terminal);

    expect(exitCode).toBe(1);
    expect(
      terminal.output().match(/Error: No robots available for assignment\.\n/g),
    ).toHaveLength(2);
    expect(terminal.output()).toContain("Robot Assignment\n");
    expect(terminal.output()).toContain("Cost Optimized Allocation\n");
    expect(terminal.output()).toContain(
      "Comparison unavailable because both strategies must produce an allocation.\n",
    );
  });

  it("prints both capacity failures when neither strategy can fulfil the request", async () => {
    const terminal = new FakeTerminal(["1", "1", "1", "17"]);

    const exitCode = await runCli(terminal);

    expect(exitCode).toBe(1);
    expect(
      terminal
        .output()
        .match(
          /Error: Insufficient robot capacity to complete the requested work\.\n/g,
        ),
    ).toHaveLength(2);
    expect(terminal.output()).toContain("Robot Assignment\n");
    expect(terminal.output()).toContain("Cost Optimized Allocation\n");
    expect(terminal.output()).toContain(
      "Comparison unavailable because both strategies must produce an allocation.\n",
    );
  });
});
