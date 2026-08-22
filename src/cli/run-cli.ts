import { type Terminal } from "./interactive-allocation.js";
import { runInteractiveSession } from "./interactive-session.js";
import {
  PLAIN_TERMINAL_STYLES,
  type TerminalStyles,
} from "./terminal-styles.js";

export async function runCli(
  terminal: Terminal,
  styles: TerminalStyles = PLAIN_TERMINAL_STYLES,
): Promise<0 | 1 | 130> {
  terminal.writeLine(styles.title("EverBot Robot Work Allocation System"));
  terminal.writeLine();

  try {
    return await runInteractiveSession(terminal, styles);
  } catch (error: unknown) {
    if (!isAbortError(error)) {
      throw error;
    }

    terminal.writeLine();
    return 130;
  }
}

function isAbortError(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.name === "AbortError" &&
    "code" in error &&
    error.code === "ABORT_ERR"
  );
}
