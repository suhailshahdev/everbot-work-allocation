#!/usr/bin/env node

import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";

import type { Terminal } from "./interactive-allocation.js";
import { runCli } from "./run-cli.js";

const readline = createInterface({ input: stdin, output: stdout });

const terminal: Terminal = {
  writeLine(message = "") {
    stdout.write(`${message}\n`);
  },
  question(prompt) {
    return readline.question(prompt);
  },
};

try {
  process.exitCode = await runCli(terminal);
} finally {
  readline.close();
}
