// Armor 3.0 Data Parser
// Converts raw Armor 3.0 data into processed format for UI consumption

import {
  Armor3Data,
  Armor3Stat,
  ProcessedArmor3Stat,
  ProcessedBenefit,
  ProcessedBreakpoint,
  StatRecommendation,
  StatBenefit
} from '../types/armor3-types';
import {
  generateBenefitValueArray,
  findStatBreakpoints,
  calculateEfficiencyScore
} from './armor3-calculations';

/**
 * Parse Armor 3.0 data into processed format
 */
export function parseArmor3Data(data: Armor3Data): ProcessedArmor3Stat[] {
  const processedStats: ProcessedArmor3Stat[] = [];
  
  // Process each stat
  const statIds = ['health', 'melee', 'grenade', 'super', 'class', 'weapon'] as const;
  
  for (const statId of statIds) {
    const stat = data.stats[statId];
    if (!stat) {continue;}
    
    const processed = processArmor3Stat(statId, stat);
    processedStats.push(processed);
  }
  
  return processedStats;
}

/**
 * Process a single Armor 3.0 stat
 */
function processArmor3Stat(statId: string, stat: Armor3Stat): ProcessedArmor3Stat {
  // Separate benefits by range
  const primaryBenefits = stat.benefits.filter(b => b.range === '0-100');
  const enhancedBenefits = stat.benefits.filter(b => b.range === '101-200');
  
  // Process primary effects
  const processedPrimary = primaryBenefits.map(benefit => 
    processBenefit(benefit)
  );
  
  // Process enhanced effects
  const processedEnhanced = enhancedBenefits.map(benefit => 
    processBenefit(benefit)
  );
  
  // Find all breakpoints
  const breakpoints = processBreakpoints(statId, stat.benefits);
  
  // Generate recommendations for different build types
  const recommendations = generateRecommendations(statId);
  
  return {
    id: statId,
    name: stat.name,
    description: stat.description,
    category: capitalizeFirst(statId),
    primaryEffects: processedPrimary,
    enhancedEffects: processedEnhanced,
    breakpoints,
    recommendations
  };
}

/**
 * Process a single benefit
 */
function processBenefit(benefit: StatBenefit): ProcessedBenefit {
  const values = generateBenefitValueArray(benefit);
  const [rangeMin, rangeMax] = benefit.range === '0-100' ? [0, 100] : [101, 200];
  
  // For PvP values, check if they're different from PvE
  let pvpValues: number[] | undefined;
  if (benefit.name.includes('(PvP)') || benefit.pvp_value !== undefined) {
    // Generate PvP-specific values if needed
    pvpValues = values; // In this case, the benefit is already PvP-specific
  }
  
  return {
    name: benefit.name,
    range: [rangeMin, rangeMax],
    values,
    unit: benefit.unit,
    isPvE: benefit.pve_only || benefit.name.includes('(PvE)'),
    isPvP: !benefit.pve_only || benefit.name.includes('(PvP)'),
    pveValues: benefit.pve_only ? values : undefined,
    pvpValues,
    maxValue: benefit.max_value,
    maxPvPValue: benefit.pvp_value,
    scalingType: benefit.scaling_model,
    description: benefit.note
  };
}

/**
 * Process breakpoints for a stat
 */
function processBreakpoints(statId: string, benefits: StatBenefit[]): ProcessedBreakpoint[] {
  const breakpoints = findStatBreakpoints(statId, benefits);
  
  return breakpoints.map(bp => ({
    statValue: bp.points,
    effectName: extractEffectName(bp.description || ''),
    description: bp.description || '',
    importance: determineBreakpointImportance(bp),
    category: determineBreakpointCategory(bp)
  }));
}

/**
 * Generate recommendations for different build types
 */
function generateRecommendations(statId: string): StatRecommendation[] {
  const recommendations: StatRecommendation[] = [];
  
  // PvE DPS builds
  if (statId === 'weapon') {
    recommendations.push({
      minValue: 100,
      maxValue: 200,
      buildType: 'pve-dps',
      reasoning: 'Consistent damage increase against all enemy types',
      priority: 'essential'
    });
  } else if (statId === 'grenade') {
    recommendations.push({
      minValue: 70,
      maxValue: 200,
      buildType: 'pve-dps',
      reasoning: 'Maximum grenade damage for add-clear, 70+ for efficient cooldowns',
      priority: 'recommended'
    });
  } else if (statId === 'super') {
    recommendations.push({
      minValue: 30,
      maxValue: 100,
      buildType: 'pve-dps',
      reasoning: 'Baseline energy generation, invest beyond 100 for burst DPS phases',
      priority: 'recommended'
    });
  }
  
  // PvE Survivability builds
  if (statId === 'health') {
    recommendations.push({
      minValue: 100,
      maxValue: 200,
      buildType: 'pve-survivability',
      reasoning: 'Maximum orb healing at 100, enhanced shield capacity beyond',
      priority: 'essential'
    });
  } else if (statId === 'class') {
    recommendations.push({
      minValue: 100,
      maxValue: 150,
      buildType: 'pve-survivability',
      reasoning: 'Frequent overshield generation for constant protection',
      priority: 'recommended'
    });
  }
  
  // PvP builds
  if (statId === 'health') {
    recommendations.push({
      minValue: 60,
      maxValue: 100,
      buildType: 'pvp-defensive',
      reasoning: 'Flinch resistance crucial for dueling',
      priority: 'essential'
    });
  } else if (statId === 'weapon') {
    recommendations.push({
      minValue: 0,
      maxValue: 120,
      buildType: 'pvp-aggressive',
      reasoning: 'Handling/reload more valuable than damage in PvP',
      priority: 'optional'
    });
  }
  
  // Ability-focused builds
  if (statId === 'melee' || statId === 'grenade') {
    recommendations.push({
      minValue: 70,
      maxValue: 80,
      buildType: 'hybrid',
      reasoning: 'Optimal efficiency range - maximum returns before soft caps',
      priority: 'recommended'
    });
  }
  
  return recommendations;
}

// Export the calculateEfficiencyScore function for use in other components
export { calculateEfficiencyScore };

/**
 * Helper functions
 */
function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function extractEffectName(description: string): string {
  const colonIndex = description.indexOf(':');
  return colonIndex > -1 ? description.substring(0, colonIndex).trim() : description;
}

function determineBreakpointImportance(breakpoint: any): 'critical' | 'major' | 'minor' {
  if (breakpoint.points === 100) {return 'critical';}
  if (breakpoint.points === 70 || breakpoint.points === 80) {return 'major';}
  if (breakpoint.points === 30) {return 'major';}
  return 'minor';
}

function determineBreakpointCategory(breakpoint: any): 'soft-cap' | 'hard-cap' | 'threshold' | 'optimal' {
  if (breakpoint.unit === 'soft-cap') {return 'soft-cap';}
  if (breakpoint.unit === 'threshold') {return 'threshold';}
  if (breakpoint.points === 70 || breakpoint.points === 80) {return 'soft-cap';}
  if (breakpoint.points === 100) {return 'threshold';}
  return 'optimal';
}

/**
 * Calculate comprehensive stat analysis
 */
export function analyzeStatDistribution(distribution: { [statId: string]: number }): {
  totalPoints: number;
  efficiency: number;
  warnings: string[];
  suggestions: string[];
} {
  let totalPoints = 0;
  const totalEfficiency = 0;
  const warnings: string[] = [];
  const suggestions: string[] = [];
  
  // Calculate totals and check for inefficiencies
  for (const [statId, value] of Object.entries(distribution)) {
    totalPoints += value;
    
    // Check for values past soft caps
    if ((statId === 'melee' || statId === 'grenade') && value > 80 && value < 100) {
      warnings.push(`${capitalizeFirst(statId)} at ${value} - consider 80 or 100 for better efficiency`);
    }
    
    if (value > 200) {
      warnings.push(`${capitalizeFirst(statId)} exceeds maximum of 200`);
    }
  }
  
  // Check total point allocation
  if (totalPoints > 600) {
    warnings.push('Total stat points exceed typical maximum with mods');
  }
  
  // Generate optimization suggestions
  if (!distribution.health || distribution.health < 30) {
    suggestions.push('Consider investing in Health for basic survivability');
  }
  
  if (distribution.weapon && distribution.weapon > 100 && distribution.weapon < 150) {
    suggestions.push('Weapon stat benefits significantly from reaching 150+ for ammo economy');
  }
  
  return {
    totalPoints,
    efficiency: totalEfficiency,
    warnings,
    suggestions
  };
}