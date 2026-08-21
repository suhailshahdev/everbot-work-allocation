export type DomainErrorCode = "INVALID_WORK_HOURS";

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
