import { describe, expect, it } from "vitest";

import type { DomainError } from "../../src/domain/errors.js";
import { FleetInventory } from "../../src/domain/fleet-inventory.js";

describe("FleetInventory", () => {
  it("calculates robot count, working capacity, and charging cost", () => {
    const inventory = FleetInventory.create({
      bravo: 2,
      charlie: 3,
      delta: 2,
    });

    expect(inventory.totalRobots).toBe(7);
    expect(inventory.totalHours).toBe(37);
    expect(inventory.totalChargingCost).toBe(21);
    expect(inventory.toRecord()).toEqual({
      bravo: 2,
      charlie: 3,
      delta: 2,
    });
  });

  it("reports empty and complete-category inventories", () => {
    const empty = FleetInventory.create({ bravo: 0, charlie: 0, delta: 0 });
    const complete = FleetInventory.create({ bravo: 1, charlie: 1, delta: 1 });
    const missingCategory = FleetInventory.create({
      bravo: 1,
      charlie: 0,
      delta: 1,
    });

    expect(empty.isEmpty).toBe(true);
    expect(empty.hasEveryCategory).toBe(false);
    expect(complete.isEmpty).toBe(false);
    expect(complete.hasEveryCategory).toBe(true);
    expect(missingCategory.hasEveryCategory).toBe(false);
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
    const source = { bravo: 1, charlie: 2, delta: 3 };
    const inventory = FleetInventory.create(source);

    source.bravo = 99;
    const snapshot = inventory.toRecord();
    snapshot.charlie = 99;

    expect(inventory.toRecord()).toEqual({ bravo: 1, charlie: 2, delta: 3 });
  });

  it("combines inventories without mutating either source", () => {
    const active = FleetInventory.create({ bravo: 1, charlie: 1, delta: 1 });
    const standby = FleetInventory.create({ bravo: 0, charlie: 1, delta: 0 });

    const combined = active.add(standby);

    expect(combined.toRecord()).toEqual({ bravo: 1, charlie: 2, delta: 1 });
    expect(active.toRecord()).toEqual({ bravo: 1, charlie: 1, delta: 1 });
    expect(standby.toRecord()).toEqual({ bravo: 0, charlie: 1, delta: 0 });
  });

  it("consumes assigned robots without mutating either source", () => {
    const inventory = FleetInventory.create({ bravo: 2, charlie: 3, delta: 2 });
    const assigned = FleetInventory.create({ bravo: 1, charlie: 1, delta: 2 });

    const remaining = inventory.subtract(assigned);

    expect(remaining.toRecord()).toEqual({ bravo: 1, charlie: 2, delta: 0 });
    expect(inventory.toRecord()).toEqual({ bravo: 2, charlie: 3, delta: 2 });
    expect(assigned.toRecord()).toEqual({ bravo: 1, charlie: 1, delta: 2 });
  });

  it("rejects consuming more robots than are available", () => {
    const inventory = FleetInventory.create({ bravo: 1, charlie: 0, delta: 0 });
    const assigned = FleetInventory.create({ bravo: 2, charlie: 0, delta: 0 });

    expect(() => inventory.subtract(assigned)).toThrowError(
      expect.objectContaining<Partial<DomainError>>({
        code: "INSUFFICIENT_INVENTORY",
        message: "Cannot consume more Bravo robots than are available.",
        details: {
          robotType: "bravo",
          available: 1,
          requested: 2,
        },
      }),
    );
  });
});
