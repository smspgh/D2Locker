import clsx from 'clsx';
import styles from './PerkRankIndicator.m.scss';

interface PerkRankIndicatorProps {
  rank: number;
  count?: number;
  className?: string;
  size?: 'small' | 'medium' | 'large';
}

/**
 * Displays a perk rank indicator (1-5 with different colors)
 */
export default function PerkRankIndicator({
  rank,
  count,
  className,
  size = 'small',
}: PerkRankIndicatorProps) {
  if (rank < 1) {
    return null;
  }

  const getRankColor = (rank: number) => {
    switch (rank) {
      case 1:
        return styles.rank1; // Gold/Best
      case 2:
        return styles.rank2; // Silver/Good
      case 3:
        return styles.rank3; // Bronze/OK
      case 4:
        return styles.rank4; // Gray/Poor
      case 5:
        return styles.rank5; // Red/Worst
      case 6:
        return styles.rank6; // Dark Red
      case 7:
        return styles.rank7; // Darker Red
      default:
        return styles.rankDefault;
    }
  };

  return (
    <div
      className={clsx(styles.rankIndicator, getRankColor(rank), className)}
      title={count ? `Rank ${rank} (${count.toLocaleString()} users)` : `Rank ${rank}`}
    >
      {rank}
    </div>
  );
}
