export function parseClientWorkHours(rawValue: string): number[] | undefined {
  const normalized = rawValue.trim();

  if (
    normalized.length === 0 ||
    normalized.startsWith(",") ||
    normalized.endsWith(",") ||
    /,\s*,/.test(normalized) ||
    !/^[\d,\s]+$/.test(normalized)
  ) {
    return undefined;
  }

  const values = normalized.split(/[,\s]+/).map(Number);

  if (
    values.length === 0 ||
    values.some((value) => !Number.isSafeInteger(value) || value <= 0)
  ) {
    return undefined;
  }

  return values;
}
