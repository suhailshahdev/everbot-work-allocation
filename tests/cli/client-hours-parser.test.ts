import { describe, expect, it } from "vitest";

import { parseClientWorkHours } from "../../src/cli/client-hours-parser.js";

describe("parseClientWorkHours", () => {
  it.each([
    ["20", [20]],
    ["12,16,17,10,21", [12, 16, 17, 10, 21]],
    ["12 16 17 10 21", [12, 16, 17, 10, 21]],
    ["12, 16 17,10 21", [12, 16, 17, 10, 21]],
    ["  12 , 16  ", [12, 16]],
  ])("accepts client work-hours input %j", (rawValue, expected) => {
    expect(parseClientWorkHours(rawValue)).toEqual(expected);
  });

  it.each([
    "",
    "   ",
    "0",
    "-1",
    "1.5",
    ",12",
    "12,",
    "12,,16",
    "12, ,16",
    "12 nope",
    "12;16",
    "9007199254740992",
  ])("rejects malformed client work-hours input %j", (rawValue) => {
    expect(parseClientWorkHours(rawValue)).toBeUndefined();
  });

  it("preserves original input order and duplicate requests", () => {
    expect(parseClientWorkHours("12,16,12,21")).toEqual([12, 16, 12, 21]);
  });
});
