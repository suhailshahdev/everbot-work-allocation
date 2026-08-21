import { describe, expect, it } from "vitest";

import { isLexicographicallyLower } from "../../src/strategies/lexicographic-score.js";

describe("isLexicographicallyLower", () => {
  it.each([
    {
      objective: "excess hours",
      candidate: [0, 99, 99, 99, 99, 99],
      incumbent: [1, 0, 0, 0, 0, 0],
    },
    {
      objective: "charging cost",
      candidate: [0, 0, 99, 99, 99, 99],
      incumbent: [0, 1, 0, 0, 0, 0],
    },
    {
      objective: "robot count",
      candidate: [0, 0, 0, 99, 99, 99],
      incumbent: [0, 0, 1, 0, 0, 0],
    },
    {
      objective: "Bravo count",
      candidate: [0, 0, 0, 0, 99, 99],
      incumbent: [0, 0, 0, 1, 0, 0],
    },
    {
      objective: "Charlie count",
      candidate: [0, 0, 0, 0, 0, 99],
      incumbent: [0, 0, 0, 0, 1, 0],
    },
    {
      objective: "Delta count",
      candidate: [0, 0, 0, 0, 0, 0],
      incumbent: [0, 0, 0, 0, 0, 1],
    },
  ])(
    "prefers a lower $objective after earlier objectives tie",
    ({ candidate, incumbent }) => {
      expect(isLexicographicallyLower(candidate, incumbent)).toBe(true);
      expect(isLexicographicallyLower(incumbent, candidate)).toBe(false);
    },
  );

  it("keeps the incumbent when every score is equal", () => {
    const score = [0, 9, 3, 1, 1, 1];

    expect(isLexicographicallyLower(score, score)).toBe(false);
  });
});
