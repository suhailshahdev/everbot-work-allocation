import { describe, expect, it } from "vitest";

import { runCli } from "../../src/cli/run-cli.js";

describe("runCli", () => {
  it("writes the application title exactly once", () => {
    const lines: string[] = [];

    runCli((line) => lines.push(line));

    expect(lines).toEqual(["EverBot Robot Work Allocation System"]);
  });
});
