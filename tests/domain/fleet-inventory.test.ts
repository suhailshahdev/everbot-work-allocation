import { describe, expect, it } from "vitest";

import type { DomainError } from "../../src/domain/errors.js";
import { FleetInventory } from "../../src/domain/fleet-inventory.js";
import {
  TEST_ROBOT_CATALOG,
  TEST_ROBOT_COUNTS,
} from "../support/robot-catalog.js";

describe("FleetInventory", () => {
  it("calculates robot count, working capacity, and charging cost", () => {
    const inventory = FleetInventory.create({
      alpha: 2,
      bravo: 2,
      charlie: 3,
      delta: 2,
    });

    expect(inventory.totalRobots).toBe(9);
    expect(inventory.calculateTotalHours(TEST_ROBOT_CATALOG)).toBe(39);
    expect(inventory.calculateTotalChargingCost(TEST_ROBOT_CATALOG)).toBe(23);
    expect(inventory.toRecord()).toEqual({
      alpha: 2,
      bravo: 2,
      charlie: 3,
      delta: 2,
    });
  });

  it("reports empty and complete-category inventories", () => {
    const empty = FleetInventory.create({
      alpha: 0,
      bravo: 0,
      charlie: 0,
      delta: 0,
    });
    const complete = FleetInventory.create({
      alpha: 1,
      bravo: 1,
      charlie: 1,
      delta: 1,
    });
    const missingCategory = FleetInventory.create({
      alpha: 1,
      bravo: 1,
      charlie: 0,
      delta: 1,
    });

    expect(empty.isEmpty).toBe(true);
    expect(empty.hasEveryCategory(TEST_ROBOT_CATALOG)).toBe(false);
    expect(complete.isEmpty).toBe(false);
    expect(complete.hasEveryCategory(TEST_ROBOT_CATALOG)).toBe(true);
    expect(missingCategory.hasEveryCategory(TEST_ROBOT_CATALOG)).toBe(false);
  });

  it.each([
    {
      caseName: "negative",
      counts: { bravo: -1, charlie: 0, delta: 0 },
      robotType: "bravo",
      value: -1,
    },
    {
      caseName: "fractional",
      counts: { bravo: 0, charlie: 1.5, delta: 0 },
      robotType: "charlie",
      value: 1.5,
    },
    {
      caseName: "positive infinity",
      counts: { bravo: 0, charlie: 0, delta: Number.POSITIVE_INFINITY },
      robotType: "delta",
      value: Number.POSITIVE_INFINITY,
    },
    {
      caseName: "negative infinity",
      counts: { bravo: Number.NEGATIVE_INFINITY, charlie: 0, delta: 0 },
      robotType: "bravo",
      value: Number.NEGATIVE_INFINITY,
    },
    {
      caseName: "NaN",
      counts: { bravo: 0, charlie: Number.NaN, delta: 0 },
      robotType: "charlie",
      value: Number.NaN,
    },
    {
      caseName: "unsafe integer",
      counts: { bravo: 0, charlie: 0, delta: Number.MAX_SAFE_INTEGER + 1 },
      robotType: "delta",
      value: Number.MAX_SAFE_INTEGER + 1,
    },
  ])("rejects $caseName robot counts", ({ counts, robotType, value }) => {
    expect(() => FleetInventory.create(counts)).toThrowError(
      expect.objectContaining<Partial<DomainError>>({
        code: "INVALID_ROBOT_COUNT",
        message: "Robot counts must be non-negative integers.",
        details: { robotType, value },
      }),
    );
  });

  it("does not expose mutable internal state", () => {
    const source = { alpha: 4, bravo: 1, charlie: 2, delta: 3 };
    const inventory = FleetInventory.create(source);

    source.bravo = 99;
    const snapshot = inventory.toRecord();
    snapshot.charlie = 99;

    expect(inventory.toRecord()).toEqual({
      alpha: 4,
      bravo: 1,
      charlie: 2,
      delta: 3,
    });
  });

  it("combines inventories without mutating either source", () => {
    const active = FleetInventory.create({ alpha: 2, bravo: 1, charlie: 1 });
    const standby = FleetInventory.create({ bravo: 1, charlie: 1, delta: 1 });

    const combined = active.add(standby);

    expect(combined.toRecord()).toEqual({
      alpha: 2,
      bravo: 2,
      charlie: 2,
      delta: 1,
    });
    expect(active.toRecord()).toEqual({ alpha: 2, bravo: 1, charlie: 1 });
    expect(standby.toRecord()).toEqual({ bravo: 1, charlie: 1, delta: 1 });
  });

  it("consumes assigned robots without mutating either source", () => {
    const inventory = FleetInventory.create(TEST_ROBOT_COUNTS);
    const assigned = FleetInventory.create({
      alpha: 1,
      bravo: 1,
      charlie: 1,
      delta: 2,
    });

    const remaining = inventory.subtract(assigned);

    expect(remaining.toRecord()).toEqual({
      alpha: 1,
      bravo: 1,
      charlie: 2,
      delta: 0,
    });
    expect(inventory.toRecord()).toEqual(TEST_ROBOT_COUNTS);
    expect(assigned.toRecord()).toEqual({
      alpha: 1,
      bravo: 1,
      charlie: 1,
      delta: 2,
    });
  });

  it("rejects consuming more robots than are available", () => {
    const inventory = FleetInventory.create({ bravo: 1, charlie: 0, delta: 0 });
    const assigned = FleetInventory.create({ bravo: 2, charlie: 0, delta: 0 });

    expect(() => inventory.subtract(assigned)).toThrowError(
      expect.objectContaining<Partial<DomainError>>({
        code: "INSUFFICIENT_INVENTORY",
        message: "Cannot consume more bravo robots than are available",
        details: {
          robotType: "bravo",
          available: 1,
          requested: 2,
        },
      }),
    );
  });

  it("reports zero for a robot type that is not recorded in the inventory", () => {
    expect(FleetInventory.create({ alpha: 2 }).count("delta")).toBe(0);
  });

  it("rejects capacity calculations for an inventory type missing from the catalogue", () => {
    const inventory = FleetInventory.create({ unknown: 1 });

    expect(() =>
      inventory.calculateTotalHours(TEST_ROBOT_CATALOG),
    ).toThrowError("Unknown robot type: unknown");
    expect(() =>
      inventory.calculateTotalChargingCost(TEST_ROBOT_CATALOG),
    ).toThrowError("Unknown robot type: unknown");
  });
});
