import { describe, expect, it } from "vitest";

import type { AllocationSettings } from "../../src/application/allocation-settings.js";
import {
  runInteractiveAllocation,
  type Terminal,
} from "../../src/cli/interactive-allocation.js";

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

describe("runInteractiveAllocation", () => {
  it("renders the challenge's 16-hour example", async () => {
    const terminal = new FakeTerminal(["2", "3", "2", "16"]);

    const exitCode = await runInteractiveAllocation(terminal);

    expect(exitCode).toBe(0);
    expect(terminal.output()).toBe(
      [
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

      const exitCode = await runInteractiveAllocation(terminal);

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

      const exitCode = await runInteractiveAllocation(terminal);

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

    const exitCode = await runInteractiveAllocation(terminal);

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

  it("fulfils a request entirely from standby when active inventory is empty", async () => {
    const terminal = new FakeTerminal(["0", "0", "0", "6"]);

    const exitCode = await runInteractiveAllocation(terminal);

    expect(exitCode).toBe(0);
    expect(
      terminal.output().match(/Error: No robots available for assignment\.\n/g),
    ).toHaveLength(2);
    expect(terminal.output()).toContain("Robot Assignment\n");
    expect(terminal.output()).toContain("Cost Optimized Allocation\n");
    expect(terminal.output()).toContain(
      "Comparison unavailable because both strategies must produce an allocation.\n",
    );
    expect(terminal.output()).toContain(
      [
        "Standby Robot Activation\n",
        "Active Robot Capacity: 0 hours\n",
        "Client Work Requested: 6 hours\n",
        "Shortfall Hours: 6\n",
        "Active Robots Used:\n",
        "None\n",
        "Active Charging Cost: $0\n",
        "Additional Standby Robots Required:\n",
        "Bravo: 2 - cost $4\n",
        "Standby Charging Cost: $4\n",
        "\n",
        "Total Hours Provided: 6\n",
        "Excess Hours: 0\n",
        "Total Charging Cost: $4\n",
      ].join(""),
    );
  });

  it("recovers the challenge's active-capacity shortfall with standby robots", async () => {
    const terminal = new FakeTerminal(["1", "1", "1", "21"]);

    const exitCode = await runInteractiveAllocation(terminal);

    expect(exitCode).toBe(0);
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
    expect(terminal.output()).toContain(
      [
        "Standby Robot Activation\n",
        "Active Robot Capacity: 16 hours\n",
        "Client Work Requested: 21 hours\n",
        "Shortfall Hours: 5\n",
        "Active Robots Used:\n",
        "Bravo: 1 - cost $2\n",
        "Charlie: 1 - cost $3\n",
        "Delta: 1 - cost $4\n",
        "Active Charging Cost: $9\n",
        "Additional Standby Robots Required:\n",
        "Charlie: 1 - cost $3\n",
        "Standby Charging Cost: $3\n",
        "\n",
        "Total Hours Provided: 21\n",
        "Excess Hours: 0\n",
        "Total Charging Cost: $12\n",
      ].join(""),
    );
  });

  it("allocates multiple clients in stable highest-hours priority order", async () => {
    const terminal = new FakeTerminal(["2", "3", "2", "12,16,17,10,21"]);

    const exitCode = await runInteractiveAllocation(terminal);

    expect(exitCode).toBe(0);
    expect(terminal.output()).toContain(
      [
        "Multi-Client Allocation\n",
        "Allocation Policy: Cost optimised\n",
        "Priority Order:\n",
        "1. Client 5: 21 hours\n",
        "2. Client 3: 17 hours\n",
        "3. Client 2: 16 hours\n",
        "4. Client 1: 12 hours\n",
        "5. Client 4: 10 hours\n",
      ].join(""),
    );
    expect(terminal.output()).toContain(
      [
        "Client 5\n",
        "Priority: 1\n",
        "Status: Allocated\n",
        "Requested Hours: 21\n",
        "Active Robots:\n",
        "Charlie: 1\n",
        "Delta: 2\n",
        "Active Charging Cost: $11\n",
        "Standby Robots:\n",
        "None\n",
        "Standby Charging Cost: $0\n",
        "Shortfall Hours: 0\n",
        "Total Hours Provided: 21\n",
        "Excess Hours: 0\n",
        "Total Charging Cost: $11\n",
      ].join(""),
    );
    expect(terminal.output()).toContain(
      [
        "Client 3\n",
        "Priority: 2\n",
        "Status: Standby activated\n",
        "Requested Hours: 17\n",
        "Active Robots:\n",
        "Bravo: 2\n",
        "Charlie: 2\n",
        "Active Charging Cost: $10\n",
        "Standby Robots:\n",
        "Bravo: 1\n",
        "Standby Charging Cost: $2\n",
        "Shortfall Hours: 1\n",
        "Total Hours Provided: 19\n",
        "Excess Hours: 2\n",
        "Total Charging Cost: $12\n",
      ].join(""),
    );
    expect(terminal.output()).not.toContain("Level 1 vs Level 2 Comparison");
    expect(terminal.output()).not.toContain("Allocation Summary");
  });

  it("uses category distribution for a multi-client batch when selected", async () => {
    const terminal = new FakeTerminal(["4", "4", "4", "12,7"]);
    const settings: AllocationSettings = {
      allocationPolicy: "category-distribution",
      standbyPolicy: "automatic",
    };

    const exitCode = await runInteractiveAllocation(terminal, settings);

    expect(exitCode).toBe(0);
    expect(terminal.output()).toContain(
      "Allocation Policy: Category distribution\n",
    );
  });

  it("leaves a single-client capacity failure visible when standby is disabled", async () => {
    const terminal = new FakeTerminal(["1", "1", "1", "21"]);
    const settings: AllocationSettings = {
      allocationPolicy: "cost-optimized",
      standbyPolicy: "disabled",
    };

    const exitCode = await runInteractiveAllocation(terminal, settings);

    expect(exitCode).toBe(1);
    expect(terminal.output()).not.toContain("Standby Robot Activation");
    expect(terminal.output()).toContain(
      "Error: Insufficient robot capacity to complete the requested work.\n",
    );
  });
});
