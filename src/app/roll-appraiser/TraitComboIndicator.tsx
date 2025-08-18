import { TraitComboRankData } from 'app/utils/rollAppraiserUtils';
import clsx from 'clsx';
import styles from './TraitComboIndicator.m.scss';

interface TraitComboIndicatorProps {
  comboData: TraitComboRankData;
  className?: string;
}

/**
 * Displays trait combo ranking information
 */
export default function TraitComboIndicator({ comboData, className }: TraitComboIndicatorProps) {
  const getRankColor = (rank: number) => {
    switch (rank) {
      case 1:
        return styles.rank1;
      case 2:
        return styles.rank2;
      case 3:
        return styles.rank3;
      case 4:
        return styles.rank4;
      default:
        return styles.rank5;
    }
  };

  const getRankLabel = (rank: number) => `Rank ${rank}`;

  return (
    <div
      className={clsx(styles.comboIndicator, getRankColor(comboData.rank), className)}
      title={`${getRankLabel(comboData.rank)} combo (${comboData.count.toLocaleString()} users)`}
    >
      <div className={styles.rank}>{getRankLabel(comboData.rank)}</div>
      <div className={styles.count}>{comboData.count.toLocaleString()}</div>
    </div>
  );
}
