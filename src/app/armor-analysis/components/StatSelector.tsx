import { t } from 'app/i18next-t';
import clsx from 'clsx';
import { useMemo } from 'react';
import { ProcessedStatData } from '../types/armor-types';
import styles from './StatSelector.m.scss';

interface Props {
  stats: ProcessedStatData[];
  selectedStat: ProcessedStatData | null;
  compareStats: ProcessedStatData[];
  onSelect: (stat: ProcessedStatData | null) => void;
  compareMode: boolean;
}

export default function StatSelector({
  stats,
  selectedStat,
  compareStats,
  onSelect,
  compareMode
}: Props) {
  const groupedStats = useMemo(() => {
    const groups: Record<string, ProcessedStatData[]> = {};
    stats.forEach(stat => {
      if (!groups[stat.category]) {
        groups[stat.category] = [];
      }
      groups[stat.category].push(stat);
    });
    return groups;
  }, [stats]);

  const handleSelect = (stat: ProcessedStatData) => {
    if (compareMode) {
      onSelect(stat);
    } else {
      onSelect(stat.name === selectedStat?.name ? null : stat);
    }
  };

  const isSelected = (stat: ProcessedStatData) => {
    if (compareMode) {
      return compareStats.some(s => s.name === stat.name);
    }
    return selectedStat?.name === stat.name;
  };

  return (
    <div className={styles.statSelector}>
      <div className={styles.selectorHeader}>
        <label>{(t as any)('ArmorAnalysis.SelectStat', 'Select Stat')}</label>
        {compareMode && (
          <span className={styles.compareIndicator}>
            {(t as any)('ArmorAnalysis.CompareMode', 'Compare Mode')} ({compareStats.length})
          </span>
        )}
      </div>

      <div className={styles.statsGrid}>
        {Object.entries(groupedStats).map(([category, categoryStats]) => (
          <div key={category} className={styles.categoryGroup}>
            <div className={styles.categoryHeader}>{category}</div>
            <div className={styles.statButtons}>
              {categoryStats.map(stat => (
                <button
                  key={stat.name}
                  className={clsx(styles.statButton, {
                    [styles.selected]: isSelected(stat),
                    [styles.percentage]: stat.isPercentage,
                    [styles.absolute]: !stat.isPercentage
                  })}
                  onClick={() => handleSelect(stat)}
                  title={stat.name}
                >
                  <div className={styles.statInfo}>
                    <span className={styles.statName}>{stat.label}</span>
                    <span className={styles.statSource}>
                      {stat.sourceName} ({stat.sourceType})
                    </span>
                  </div>
                  <div className={styles.statMeta}>
                    {stat.unit && (
                      <span className={styles.statUnit}>{stat.unit}</span>
                    )}
                    {stat.plateauIndex !== -1 && (
                      <span className={styles.plateauBadge} title={(t as any)('ArmorAnalysis.HasPlateau', 'Has plateau')}>
                        P
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
