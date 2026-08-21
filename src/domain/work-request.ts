import { DomainError } from "./errors.js";

export class WorkRequest {
  private constructor(public readonly hours: number) {}

  public static create(hours: number): WorkRequest {
    if (!Number.isSafeInteger(hours) || hours <= 0) {
      throw new DomainError(
        "INVALID_WORK_HOURS",
        "Work hours must be a positive integer.",
        { value: hours },
      );
    }

    return new WorkRequest(hours);
  }
}
