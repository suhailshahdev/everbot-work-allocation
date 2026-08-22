import { type Terminal } from "./interactive-allocation.js";
import { runInteractiveSession } from "./interactive-session.js";

export async function runCli(terminal: Terminal): Promise<0 | 1> {
  terminal.writeLine("EverBot Robot Work Allocation System");
  return runInteractiveSession(terminal);
}
