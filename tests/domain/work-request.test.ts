import { describe, expect, it } from "vitest";

import type { DomainError } from "../../src/domain/errors.js";
import { WorkRequest } from "../../src/domain/work-request.js";

describe("WorkRequest", () => {
  it("accepts positive integer work hours", () => {
    expect(WorkRequest.create(16).hours).toBe(16);
  });

  it.each([
    0,
    -1,
    1.5,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    Number.MAX_SAFE_INTEGER + 1,
  ])("rejects invalid work hours: %s", (hours) => {
    expect(() => WorkRequest.create(hours)).toThrowError(
      expect.objectContaining<Partial<DomainError>>({
        code: "INVALID_WORK_HOURS",
        message: "Work hours must be a positive integer.",
        details: { value: hours },
      }),
    );
  });
});
