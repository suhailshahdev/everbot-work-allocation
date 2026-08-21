export type DomainErrorCode =
  | "INVALID_WORK_HOURS"
  | "INVALID_ROBOT_COUNT"
  | "INSUFFICIENT_INVENTORY"
  | "NO_ROBOTS_AVAILABLE"
  | "CATEGORY_DISTRIBUTION_IMPOSSIBLE"
  | "INSUFFICIENT_CAPACITY";

export class DomainError extends Error {
  public override readonly name = "DomainError";

  public constructor(
    public readonly code: DomainErrorCode,
    message: string,
    public readonly details: Readonly<Record<string, unknown>> = {},
  ) {
    super(message);
  }
}
