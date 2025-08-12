export interface StatValue {
  value: number;
  index: number;
}

export interface StatBenefit {
  label: string;
  unit: string;
  source_name: string;
  source_type: string;
  axis_label: string;
  relevant_range: [number, number];
  values: number[];
}

export interface StatCategory {
  [benefitKey: string]: StatBenefit;
}

export interface ArmorData {
  comment: string;
  stat_value_reference: number[];
  health: StatCategory;
  weapons: StatCategory;
  class: StatCategory;
  melee: StatCategory;
  super: StatCategory;
  grenade: StatCategory;
}

export interface ProcessedStatData {
  name: string;
  label: string;
  category: string;
  values: number[];
  isPercentage: boolean;
  differences: number[];
  maxDifference: number;
  maxDifferenceIndex: number;
  plateauIndex: number;
  firstNonZeroIndex: number;
  maxValue: number;
  unit: string;
  sourceName: string;
  sourceType: string;
  axisLabel: string;
  relevantRange: [number, number];
}

export interface ChartOptions {
  showOnlyChangedRange: boolean;
  startValue: number;
  endValue: number;
  showDifferences: boolean;
  showPlateau: boolean;
  compareMode: boolean;
  selectedStats: string[];
}

export interface FilterOptions {
  categories: string[];
  searchQuery: string;
  showPercentagesOnly: boolean;
  showAbsoluteOnly: boolean;
  minValue: number;
  maxValue: number;
}

export interface ArmorAnalysisSettings {
  chartOptions: ChartOptions;
  filterOptions: FilterOptions;
  viewMode: 'compact' | 'expanded';
  savedPresets: FilterPreset[];
}

export interface FilterPreset {
  id: string;
  name: string;
  filterOptions: Partial<FilterOptions>;
  chartOptions: Partial<ChartOptions>;
}
