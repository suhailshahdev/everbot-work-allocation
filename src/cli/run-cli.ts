import {
  runInteractiveAllocation,
  type Terminal,
} from "./interactive-allocation.js";

export async function runCli(terminal: Terminal): Promise<0 | 1> {
  terminal.writeLine("EverBot Robot Work Allocation System");
  return runInteractiveAllocation(terminal);
}
