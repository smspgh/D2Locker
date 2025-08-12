// Armor 3.0 Stat Calculation Engine
// Handles all scaling calculations for the Edge of Fate stat system

import { StatBenefit, Breakpoint } from '../types/armor3-types';

// Non-linear scaling curves for ability stats
const ABILITY_COOLDOWN_CURVE = {
  // Key points for cooldown reduction scaling
  0: 0,
  10: 8,
  20: 16,
  30: 25,
  40: 34,
  50: 42,
  60: 50,
  70: 56, // Old Tier 10 equivalent
  80: 60,
  90: 63,
  100: 65
};

const ENERGY_SCALAR_CURVE = {
  // Key points for energy scalar scaling
  0: 49,
  10: 65,
  20: 82,
  30: 100, // Baseline for Super
  40: 118,
  50: 136,
  60: 154,
  70: 172,
  80: 190, // Max effectiveness
  90: 190,
  100: 190
};

// Class stat has less severe d2linishing returns
const CLASS_COOLDOWN_CURVE = {
  0: 0,
  10: 7,
  20: 14,
  30: 22,
  40: 30,
  50: 38,
  60: 45,
  70: 52,
  80: 58,
  90: 62,
  100: 65
};

/**
 * Calculate the value of a stat benefit at a given stat level
 */
export function calculateBenefitValue(
  benefit: StatBenefit,
  statValue: number
): number {
  // Check if stat value is in the correct range
  
  if (benefit.range === '0-100' && statValue > 100) {
    statValue = 100; // Cap at 100 for primary effects
  } else if (benefit.range === '101-200' && statValue <= 100) {
    return 0; // Enhanced effects don't apply below 101
  }

  switch (benefit.scaling_model) {
    case 'Linear':
      return calculateLinearScaling(benefit, statValue);
    
    case 'Non-Linear, Diminishing Returns':
      return calculateNonLinearScaling(benefit, statValue);
    
    case 'Non-Linear with Breakpoints':
      return calculateBreakpointScaling(benefit, statValue);
    
    default:
      return 0;
  }
}

/**
 * Linear scaling calculation
 */
function calculateLinearScaling(benefit: StatBenefit, statValue: number): number {
  if (benefit.range === '0-100') {
    // For 0-100 range, scale linearly from 0 to max_value
    return (statValue / 100) * benefit.max_value;
  } else {
    // For 101-200 range, scale linearly from 0 at 100 to max_value at 200
    const adjustedValue = statValue - 100;
    return (adjustedValue / 100) * benefit.max_value;
  }
}

/**
 * Non-linear scaling with d2linishing returns
 */
function calculateNonLinearScaling(benefit: StatBenefit, statValue: number): number {
  // Determine which curve to use based on benefit name
  let curve: { [key: number]: number };
  
  if (benefit.name.includes('Cooldown')) {
    curve = benefit.name.includes('Class') ? CLASS_COOLDOWN_CURVE : ABILITY_COOLDOWN_CURVE;
  } else if (benefit.name.includes('Energy Scalar')) {
    curve = ENERGY_SCALAR_CURVE;
  } else {
    // Fallback to linear if no specific curve
    return calculateLinearScaling(benefit, statValue);
  }

  // Interpolate between curve points
  const keys = Object.keys(curve).map(Number).sort((a, b) => a - b);
  
  // Find the two keys that statValue falls between
  let lowerKey = 0;
  let upperKey = 100;
  
  for (let i = 0; i < keys.length - 1; i++) {
    if (statValue >= keys[i] && statValue <= keys[i + 1]) {
      lowerKey = keys[i];
      upperKey = keys[i + 1];
      break;
    }
  }

  // Linear interpolation between the two points
  const lowerValue = curve[lowerKey];
  const upperValue = curve[upperKey];
  const ratio = (statValue - lowerKey) / (upperKey - lowerKey);
  
  return lowerValue + (upperValue - lowerValue) * ratio;
}

/**
 * Scaling with specific breakpoints (like Super energy scalar)
 */
function calculateBreakpointScaling(benefit: StatBenefit, statValue: number): number {
  if (!benefit.breakpoints || benefit.breakpoints.length === 0) {
    return calculateNonLinearScaling(benefit, statValue);
  }

  // Sort breakpoints by points value
  const sortedBreakpoints = [...benefit.breakpoints].sort((a, b) => a.points - b.points);
  
  // Add implicit breakpoints at 0 and 100 if not present
  if (sortedBreakpoints[0].points !== 0) {
    sortedBreakpoints.unshift({ points: 0, value: 49, unit: '%' });
  }
  if (sortedBreakpoints[sortedBreakpoints.length - 1].points !== 100) {
    sortedBreakpoints.push({ points: 100, value: benefit.max_value, unit: '%' });
  }

  // Find which breakpoints we're between
  for (let i = 0; i < sortedBreakpoints.length - 1; i++) {
    const lower = sortedBreakpoints[i];
    const upper = sortedBreakpoints[i + 1];
    
    if (statValue >= lower.points && statValue <= upper.points) {
      // Interpolate between breakpoints
      const ratio = (statValue - lower.points) / (upper.points - lower.points);
      return lower.value + (upper.value - lower.value) * ratio;
    }
  }

  // If beyond all breakpoints, return max value
  return benefit.max_value;
}

/**
 * Generate a complete value array for a benefit across all stat values
 */
export function generateBenefitValueArray(benefit: StatBenefit): number[] {
  const values: number[] = [];
  
  for (let i = 0; i <= 200; i++) {
    values.push(calculateBenefitValue(benefit, i));
  }
  
  return values;
}

/**
 * Calculate all benefits for a stat at a given value
 */
export function calculateStatBenefits(
  statValue: number,
  benefits: StatBenefit[]
): { [benefitName: string]: { value: number; unit: string; isPvE: boolean } } {
  const results: { [benefitName: string]: { value: number; unit: string; isPvE: boolean } } = {};
  
  for (const benefit of benefits) {
    const value = calculateBenefitValue(benefit, statValue);
    results[benefit.name] = {
      value,
      unit: benefit.unit,
      isPvE: benefit.pve_only
    };
  }
  
  return results;
}

/**
 * Find all breakpoints for a stat
 */
export function findStatBreakpoints(
  statId: string,
  benefits: StatBenefit[]
): Breakpoint[] {
  const breakpoints: Breakpoint[] = [];
  
  // Add explicit breakpoints
  for (const benefit of benefits) {
    if (benefit.breakpoints) {
      breakpoints.push(...benefit.breakpoints.map(bp => ({
        ...bp,
        description: `${benefit.name}: ${bp.description || ''}`
      })));
    }
  }
  
  // Add implicit breakpoints
  // 100 point threshold (primary to enhanced transition)
  breakpoints.push({
    points: 100,
    value: 100,
    unit: 'threshold',
    description: 'Enhanced effects unlock'
  });
  
  // Stat-specific important thresholds
  if (statId === 'melee' || statId === 'grenade') {
    breakpoints.push({
      points: 70,
      value: 70,
      unit: 'soft-cap',
      description: 'Cooldown soft cap (old Tier 10 equivalent)'
    });
    breakpoints.push({
      points: 80,
      value: 80,
      unit: 'soft-cap',
      description: 'Energy scalar max effectiveness'
    });
  }
  
  if (statId === 'super') {
    breakpoints.push({
      points: 30,
      value: 30,
      unit: 'threshold',
      description: 'Baseline energy effectiveness'
    });
  }
  
  // Sort by points value
  return breakpoints.sort((a, b) => a.points - b.points);
}

/**
 * Calculate the incremental benefit (difference) between consecutive stat values
 */
export function calculateIncrementalBenefits(values: number[]): number[] {
  const increments: number[] = [0]; // First value has no increment
  
  for (let i = 1; i < values.length; i++) {
    increments.push(values[i] - values[i - 1]);
  }
  
  return increments;
}

/**
 * Find the point of maximum incremental benefit
 */
export function findMaxIncrementalBenefit(values: number[]): { index: number; value: number } {
  const increments = calculateIncrementalBenefits(values);
  let maxIndex = 0;
  let maxValue = 0;
  
  for (let i = 0; i < increments.length; i++) {
    if (Math.abs(increments[i]) > Math.abs(maxValue)) {
      maxValue = increments[i];
      maxIndex = i;
    }
  }
  
  return { index: maxIndex, value: maxValue };
}

/**
 * Calculate efficiency score for a stat investment
 * Returns a score from 0-100 indicating how efficient the investment is
 */
export function calculateEfficiencyScore(
  statValue: number,
  benefits: StatBenefit[]
): number {
  let totalEfficiency = 0;
  let benefitCount = 0;
  
  for (const benefit of benefits) {
    const value = calculateBenefitValue(benefit, statValue);
    const maxPossible = benefit.max_value;
    
    // Calculate efficiency based on d2linishing returns
    let efficiency = (value / maxPossible) * 100;
    
    // Apply penalties for investing past soft caps
    if (benefit.name.includes('Cooldown') && statValue > 70) {
      efficiency *= 0.5; // Half efficiency past soft cap
    }
    if (benefit.name.includes('Energy Scalar') && statValue > 80) {
      efficiency *= 0.3; // Very low efficiency past soft cap
    }
    
    totalEfficiency += efficiency;
    benefitCount++;
  }
  
  return benefitCount > 0 ? totalEfficiency / benefitCount : 0;
}

/**
 * Generate build recommendations based on stat distribution
 */
export function generateStatRecommendations(
  statId: string,
  currentValue: number,
  buildType: string
): string[] {
  const recommendations: string[] = [];
  
  // General recommendations based on breakpoints
  if (statId === 'melee' || statId === 'grenade') {
    if (currentValue < 70) {
      recommendations.push('Consider investing to 70 for maximum cooldown efficiency');
    }
    if (currentValue > 80 && currentValue < 100) {
      recommendations.push('Limited returns between 80-100, consider other stats');
    }
  }
  
  if (statId === 'super' && currentValue < 30) {
    recommendations.push('Invest to at least 30 for baseline energy generation');
  }
  
  // Build-specific recommendations
  if (buildType === 'pve-dps') {
    if (statId === 'weapon' && currentValue < 100) {
      recommendations.push('Weapon stat provides consistent DPS increase');
    }
    if (statId === 'grenade' && currentValue > 100) {
      recommendations.push('High grenade damage ideal for add-clear');
    }
  }
  
  if (buildType === 'pve-survivability') {
    if (statId === 'health' && currentValue < 100) {
      recommendations.push('Prioritize Health to 100 for orb healing');
    }
    if (statId === 'health' && currentValue > 100) {
      recommendations.push('Enhanced shield capacity provides significant survivability');
    }
  }
  
  return recommendations;
}