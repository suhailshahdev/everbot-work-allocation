export type AllocationPolicy = "cost-optimized" | "category-distribution";
export type StandbyPolicy = "automatic" | "disabled";

export interface AllocationSettings {
  readonly allocationPolicy: AllocationPolicy;
  readonly standbyPolicy: StandbyPolicy;
}

export const DEFAULT_ALLOCATION_SETTINGS: AllocationSettings = Object.freeze({
  allocationPolicy: "cost-optimized",
  standbyPolicy: "automatic",
});
