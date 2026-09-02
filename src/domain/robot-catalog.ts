// bravo is not available around 1st sept to 15 sept it can by any days should be configurable

export interface RobotSpecification {
  readonly label: string;
  readonly workingHours: number;
  readonly chargingCost: number;
}

export type RobotCatalog = Readonly<Record<string, RobotSpecification>>;
