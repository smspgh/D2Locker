import { ArmorData, ProcessedStatData, StatBenefit } from '../types/armor-types';

export function parseArmorData(data: ArmorData): ProcessedStatData[] {
  const processedStats: ProcessedStatData[] = [];

  // Process each category
  const categories = ['health', 'weapons', 'class', 'melee', 'super', 'grenade'] as const;

  for (const category of categories) {
    const categoryData = data[category];
    if (!categoryData) continue;

    for (const [benefitKey, benefit] of Object.entries(categoryData)) {
      const processed = processStatBenefit(benefitKey, category, benefit);
      processedStats.push(processed);
    }
  }

  return processedStats;
}

function processStatBenefit(
  name: string,
  category: string,
  benefit: StatBenefit
): ProcessedStatData {
  const { label, unit, source_name, source_type, axis_label, relevant_range, values } = benefit;
  
  // Detect if it's a percentage based on the unit
  const isPercentage = unit === '%';

  // Calculate differences between consecutive values
  const differences = values.map((val, idx) =>
    idx === 0 ? 0 : val - values[idx - 1]
  );

  // Find max difference and its index
  let maxDifference = 0;
  let maxDifferenceIndex = 0;
  differences.forEach((diff, idx) => {
    if (Math.abs(diff) > Math.abs(maxDifference)) {
      maxDifference = diff;
      maxDifferenceIndex = idx;
    }
  });

  // Find plateau (where value stops changing)
  let plateauIndex = -1;
  const maxValue = Math.max(...values);
  for (let i = 1; i < values.length; i++) {
    if (values[i] === maxValue && values[i] === values[i - 1]) {
      plateauIndex = i;
      break;
    }
  }

  // Find first non-zero value
  const firstNonZeroIndex = values.findIndex(v => v !== 0);

  return {
    name,
    label,
    category: category.charAt(0).toUpperCase() + category.slice(1), // Capitalize first letter
    values,
    isPercentage,
    differences,
    maxDifference,
    maxDifferenceIndex,
    plateauIndex,
    firstNonZeroIndex: firstNonZeroIndex === -1 ? 0 : firstNonZeroIndex,
    maxValue,
    unit,
    sourceName: source_name,
    sourceType: source_type,
    axisLabel: axis_label,
    relevantRange: relevant_range
  };
}


export function filterStatsByRange(
  stats: ProcessedStatData[],
  startValue: number,
  endValue: number
): ProcessedStatData[] {
  return stats.map(stat => ({
    ...stat,
    values: stat.values.slice(startValue, endValue + 1),
    differences: stat.differences.slice(startValue, endValue + 1)
  }));
}

export function getActiveRange(stat: ProcessedStatData): [number, number] {
  const firstActiveIndex = stat.firstNonZeroIndex;
  const lastActiveIndex = stat.plateauIndex !== -1 ? stat.plateauIndex : stat.values.length - 1;
  return [firstActiveIndex, lastActiveIndex];
}
