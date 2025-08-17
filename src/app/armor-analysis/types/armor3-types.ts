// Armor 3.0 Type Definitions - Based on Edge of Fate Technical Analysis

export interface Armor3Stat {
  id: 'health' | 'melee' | 'grenade' | 'super' | 'class' | 'weapon';
  name: string;
  description: string;
  benefits: StatBenefit[];
}

export interface StatBenefit {
  name: string;
  range: '0-100' | '101-200';
  scaling_model: 'Linear' | 'Non-Linear, Diminishing Returns' | 'Non-Linear with Breakpoints';
  breakpoints?: Breakpoint[];
  max_value: number;
  unit: string;
  pve_only: boolean;
  pvp_value?: number; // When different from PvE
  note?: string;
  values?: number[]; // For computed values at each stat point
  formula?: ScalingFormula;
}

export interface Breakpoint {
  points: number;
  value: number;
  unit: string;
  description?: string;
}

export interface ScalingFormula {
  type: 'linear' | 'non-linear' | 'stepped';
  // For linear: y = base + (rate * x)
  base?: number;
  rate?: number;
  // For non-linear: custom function or lookup table
  lookupTable?: { [key: number]: number };
  // For stepped: different rates at different ranges
  steps?: {
    min: number;
    max: number;
    rate: number;
  }[];
}

export interface Armor3Data {
  version: string;
  comment: string;
  stat_value_reference: number[];
  stats: {
    health: Armor3Stat;
    melee: Armor3Stat;
    grenade: Armor3Stat;
    super: Armor3Stat;
    class: Armor3Stat;
    weapon: Armor3Stat;
  };
  scaling_notes: {
    energy_scalars: string;
    cooldown_reduction: string;
    damage_stacking: string;
  };
}

// Processed data for UI consumption
export interface ProcessedArmor3Stat {
  id: string;
  name: string;
  description: string;
  category: string;
  primaryEffects: ProcessedBenefit[];
  enhancedEffects: ProcessedBenefit[];
  breakpoints: ProcessedBreakpoint[];
  recommendations: StatRecommendation[];
}

export interface ProcessedBenefit {
  name: string;
  range: [number, number];
  values: number[];
  unit: string;
  isPvE: boolean;
  isPvP: boolean;
  pveValues?: number[];
  pvpValues?: number[];
  maxValue: number;
  maxPvPValue?: number;
  scalingType: string;
  description?: string;
}

export interface ProcessedBreakpoint {
  statValue: number;
  effectName: string;
  description: string;
  importance: 'critical' | 'major' | 'minor';
  category: 'soft-cap' | 'hard-cap' | 'threshold' | 'optimal';
}

export interface StatRecommendation {
  minValue: number;
  maxValue: number;
  buildType: string;
  reasoning: string;
  priority: 'essential' | 'recommended' | 'optional';
}

// Chart-specific types
export interface Armor3ChartOptions {
  showPrimaryEffects: boolean;
  showEnhancedEffects: boolean;
  showBreakpoints: boolean;
  showRecommendations: boolean;
  showPvEValues: boolean;
  showPvPValues: boolean;
  compareMode: boolean;
  highlightSoftCaps: boolean;
  displayRange: [number, number];
  selectedStats: string[];
}

export interface StatComparisonData {
  statId: string;
  statName: string;
  values: {
    primary: number[];
    enhanced: number[];
    pvp?: number[];
  };
  breakpoints: ProcessedBreakpoint[];
}

// Build optimization types
export interface BuildConstraints {
  totalStatPoints: number; // Usually 550-600 with mods
  requiredBreakpoints: {
    statId: string;
    minValue: number;
  }[];
  priorityOrder: string[];
  buildType: 'pve-dps' | 'pve-survivability' | 'pvp-aggressive' | 'pvp-defensive' | 'hybrid';
}

export interface OptimizedBuildResult {
  statDistribution: { [statId: string]: number };
  achievedBreakpoints: ProcessedBreakpoint[];
  totalValue: number;
  warnings: string[];
  suggestions: string[];
}