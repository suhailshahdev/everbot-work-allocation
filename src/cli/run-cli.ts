import { type Terminal } from "./interactive-allocation.js";
import { runInteractiveSession } from "./interactive-session.js";
import {
  PLAIN_TERMINAL_STYLES,
  type TerminalStyles,
} from "./terminal-styles.js";

export async function runCli(
  terminal: Terminal,
  styles: TerminalStyles = PLAIN_TERMINAL_STYLES,
): Promise<0 | 1> {
  terminal.writeLine(styles.title("EverBot Robot Work Allocation System"));
  terminal.writeLine();
  return runInteractiveSession(terminal, styles);
}
