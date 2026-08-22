import { styleText } from "node:util";

export interface TerminalStyles {
  readonly title: (text: string) => string;
  readonly heading: (text: string) => string;
  readonly accent: (text: string) => string;
  readonly success: (text: string) => string;
  readonly warning: (text: string) => string;
  readonly error: (text: string) => string;
  readonly value: (text: string) => string;
  readonly muted: (text: string) => string;
}

export interface TerminalStyleSupport {
  readonly colorSupported: boolean;
  readonly noColor: string | undefined;
}

export function shouldUseTerminalStyles(
  support: TerminalStyleSupport,
): boolean {
  return support.colorSupported && (support.noColor?.length ?? 0) === 0;
}

export function createTerminalStyles(enabled: boolean): TerminalStyles {
  const apply = (
    format: Parameters<typeof styleText>[0],
    text: string,
  ): string =>
    enabled ? styleText(format, text, { validateStream: false }) : text;

  return Object.freeze({
    title: (text: string) => apply(["yellow", "bold"], text),
    heading: (text: string) => apply(["yellow", "bold"], text),
    accent: (text: string) => apply("cyanBright", text),
    success: (text: string) => apply("greenBright", text),
    warning: (text: string) => apply("yellow", text),
    error: (text: string) => apply("redBright", text),
    value: (text: string) => apply("greenBright", text),
    muted: (text: string) => apply("dim", text),
  });
}

export const PLAIN_TERMINAL_STYLES = createTerminalStyles(false);
