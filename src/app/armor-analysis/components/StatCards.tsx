import { t } from 'app/i18next-t';
import { ProcessedStatData } from '../types/armor-types';
import styles from './StatCards.m.scss';

interface Props {
  stats: ProcessedStatData[];
  viewMode: 'compact' | 'expanded';
}

export default function StatCards({ stats, viewMode }: Props) {
  if (stats.length === 0) return null;

  const formatValue = (value: number, stat: ProcessedStatData) => {
    if (stat.isPercentage) {
      return value.toFixed(2) + '%';
    } else if (stat.unit) {
      return value.toFixed(1) + ' ' + stat.unit;
    }
    return value.toFixed(1);
  };

  const getStatCards = (stat: ProcessedStatData) => {
    const totalIncrease = stat.maxValue - stat.values[0];
    const avgIncrease = stat.differences.reduce((sum, d) => sum + Math.abs(d), 0) / (stat.differences.length || 1);

    const cards = [
      {
        label: (t as any)('ArmorAnalysis.MaxBenefitTier', 'Max Benefit Change Tier'),
        value: String(stat.maxDifferenceIndex),
        highlight: true,
      },
      {
        label: (t as any)('ArmorAnalysis.MaxBenefitValue', 'Max Tier Change'),
        value: '+' + formatValue(stat.maxDifference, stat),
        highlight: true,
      },
      {
        label: (t as any)('ArmorAnalysis.TotalIncrease', 'Total Possible Increase'),
        value: formatValue(totalIncrease, stat),
      },
      {
        label: (t as any)('ArmorAnalysis.AveragePerTier', 'Average per Tier'),
        value: '+' + formatValue(avgIncrease, stat),
      },
    ];

    if (stat.firstNonZeroIndex > 0) {
      cards.push({
        label: (t as any)('ArmorAnalysis.FirstActiveTier', 'First Active Tier'),
        value: String(stat.firstNonZeroIndex),
      });
    }

    if (stat.plateauIndex !== -1) {
      cards.push({
        label: (t as any)('ArmorAnalysis.PlateauReached', 'Max Value Reached'),
        value: String(stat.plateauIndex),
        highlight: true,
      });
    }

    return cards;
  };

  if (viewMode === 'compact' && stats.length === 1) {
    const stat = stats[0];
    const cards = getStatCards(stat);

    return (
      <div className={styles.compactCards}>
        {cards.slice(0, 4).map((card, idx) => (
          <div key={idx} className={`${styles.compactCard} ${card.highlight ? styles.highlight : ''}`}>
            <div className={styles.cardValue}>{card.value}</div>
            <div className={styles.cardLabel}>{card.label}</div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={styles.statsContainer}>
      {stats.map((stat) => (
        <div key={stat.name} className={styles.statSection}>
          {stats.length > 1 && (
            <div className={styles.statHeader}>
              <h3 className={styles.statTitle}>{stat.label}</h3>
              <div className={styles.statSource}>
                {stat.sourceName} ({stat.sourceType})
              </div>
            </div>
          )}
          <div className={styles.statsGrid}>
            {getStatCards(stat).map((card, idx) => (
              <div
                key={idx}
                className={`${styles.statCard} ${card.highlight ? styles.highlight : ''}`}
              >
                <div className={styles.cardLabel}>{card.label}</div>
                <div className={styles.cardValue}>{card.value}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
