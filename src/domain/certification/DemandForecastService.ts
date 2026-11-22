import { InvariantViolationError } from '../shared/DomainError.ts';

export interface DemandModelInput {
  tAct: number;
  pOrg: number; // percentage 0..100
  gSize: number;
  groupsPerSeason: number;
  kSeason: number;
  kTurnover: number;
  registryCount: number;
  groupsPerYear: number;
  cohortSize: number;
  conversionRate: number; // percentage 0..100
}

export interface SensitivityPoint {
  p: number;
  n: number;
}

export interface YearlyProjectionPoint {
  year: number;
  certified: number;
  deficitRemaining: number;
}

export interface DemandForecastResult {
  organizedTourists: number;
  humanGroupsPerYear: number;
  baseDemand: number;
  totalDemand: number;
  deficit: number;
  gapMultiple: number;
  sensitivityPoints: SensitivityPoint[];
  annualTrained: number;
  annualNewCertified: number;
  fiveYearProjection: YearlyProjectionPoint[];
}

export const DemandForecastService = {
  calculate(input: DemandModelInput): DemandForecastResult {
    if (input.gSize <= 0 || input.groupsPerSeason <= 0) {
      throw new InvariantViolationError(
        'Норма нагрузки группы и число групп за сезон должны быть больше нуля.'
      );
    }
    if (input.tAct < 0 || input.registryCount < 0) {
      throw new InvariantViolationError(
        'Численность турпотока и реестра не может быть отрицательной.'
      );
    }
    if (input.kSeason < 1 || input.kTurnover < 1) {
      throw new InvariantViolationError(
        'Коэффициенты сезонности и текучести не могут быть меньше 1.0.'
      );
    }

    const organizedTourists = Math.round(input.tAct * (input.pOrg / 100));
    const humanGroupsPerYear = organizedTourists / input.gSize;
    const baseDemand = humanGroupsPerYear / input.groupsPerSeason;
    const totalDemand = Math.round(baseDemand * input.kSeason * input.kTurnover);
    const deficit = Math.max(totalDemand - input.registryCount, 0);
    const gapMultiple = input.registryCount > 0 ? totalDemand / input.registryCount : 0;

    const sensitivityPoints: SensitivityPoint[] = [10, 15, 20, 25, 30, 35, 40, 45, 50].map((p) => {
      const n = Math.round(
        ((input.tAct * (p / 100)) / input.gSize / input.groupsPerSeason) *
          input.kSeason *
          input.kTurnover
      );
      return { p, n };
    });

    const annualTrained = Math.max(0, input.groupsPerYear) * Math.max(0, input.cohortSize);
    const annualNewCertified = Math.round(annualTrained * (input.conversionRate / 100));
    const attritionRate = Math.max(input.kTurnover - 1, 0);

    const fiveYearProjection: YearlyProjectionPoint[] = [];
    let currentLegal = input.registryCount;
    for (let y = 2026; y <= 2030; y++) {
      if (y > 2026) {
        currentLegal = Math.round(currentLegal * (1 - attritionRate) + annualNewCertified);
      }
      fiveYearProjection.push({
        year: y,
        certified: currentLegal,
        deficitRemaining: Math.max(totalDemand - currentLegal, 0),
      });
    }

    return {
      organizedTourists,
      humanGroupsPerYear: Math.round(humanGroupsPerYear),
      baseDemand: Math.round(baseDemand),
      totalDemand,
      deficit,
      gapMultiple,
      sensitivityPoints,
      annualTrained,
      annualNewCertified,
      fiveYearProjection,
    };
  },
};
