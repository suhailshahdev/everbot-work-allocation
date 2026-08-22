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
  it("shows the defaults and runs two allocations in one session", async () => {
    const terminal = new FakeTerminal([
      "",
      "2",
      "3",
      "2",
      "16",
      "",
      "1",
      "1",
      "1",
      "6",
      "3",
    ]);

    const exitCode = await runCli(terminal);

    expect(exitCode).toBe(0);
    expect(terminal.output()).toContain(
      [
        "EverBot Robot Work Allocation System\n",
        "\n",
        "Current Settings\n",
        "  Allocation Policy: Cost optimised\n",
        "  Standby Activation: Automatic\n",
        "\n",
        "  1. Run allocation\n",
        "  2. Change settings\n",
        "  3. Exit\n",
        "Select an option [1]: ",
      ].join(""),
    );
    expect(
      terminal.output().match(/Enter number of robots available:\n/g),
    ).toHaveLength(2);
    expect(terminal.output().match(/Robot Assignment\n/g)).toHaveLength(2);
    expect(terminal.output().match(/Select an option \[1\]: /g)).toHaveLength(
      3,
    );
  });

  it("toggles both settings and applies them to a later allocation", async () => {
    const terminal = new FakeTerminal([
      "2",
      "1",
      "2",
      "3",
      "",
      "1",
      "1",
      "1",
      "21,10",
      "3",
    ]);

    const exitCode = await runCli(terminal);

    expect(exitCode).toBe(1);
    expect(terminal.output()).toContain(
      "Allocation Policy: Category distribution\n",
    );
    expect(terminal.output()).toContain("Standby Activation: Disabled\n");
    expect(terminal.output()).toContain(
      [
        "Multi-Client Allocation\n",
        "  Allocation Policy: Category distribution\n",
      ].join(""),
    );
    expect(terminal.output()).toContain(
      "Client 1\n  Priority: 1\n  Status: Infeasible\n",
    );
    expect(terminal.output()).toContain(
      "Client 2\n  Priority: 2\n  Status: Allocated\n",
    );
    expect(terminal.output()).not.toContain("Status: Standby activated");
  });

  it.each([
    {
      name: "main menu",
      inputs: ["9", "3"],
    },
    {
      name: "settings menu",
      inputs: ["2", "9", "3", "3"],
    },
  ])(
    "explains and re-prompts for an invalid $name choice",
    async ({ inputs }) => {
      const terminal = new FakeTerminal(inputs);

      const exitCode = await runCli(terminal);

      expect(exitCode).toBe(0);
      expect(terminal.output()).toContain("Error: Please enter 1, 2, or 3.\n");
    },
  );
});
