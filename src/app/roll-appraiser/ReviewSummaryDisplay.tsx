import { ReviewSummaryData } from 'app/utils/rollAppraiserUtils';
import styles from './ReviewSummaryDisplay.m.scss';

interface ReviewSummaryDisplayProps {
  reviewData: ReviewSummaryData;
  className?: string;
}

/**
 * Displays weapon review summary with PVE/PVP/Overall averages
 */
export default function ReviewSummaryDisplay({ reviewData, className }: ReviewSummaryDisplayProps) {
  const formatRating = (rating: number) => rating.toFixed(1);

  const getRatingColor = (rating: number) => {
    if (rating >= 4.5) {
      return styles.excellent;
    }
    if (rating >= 4.0) {
      return styles.good;
    }
    if (rating >= 3.0) {
      return styles.average;
    }
    if (rating >= 2.0) {
      return styles.poor;
    }
    return styles.terrible;
  };

  return (
    <div className={`${styles.reviewSummary} ${className || ''}`}>
      <div className={styles.header}>
        <span className={styles.title}>Community Reviews</span>
        <span className={styles.count}>({reviewData.reviewCount})</span>
      </div>

      <div className={styles.ratings}>
        <div className={styles.rating}>
          <span className={styles.label}>PVE:</span>
          <span className={`${styles.value} ${getRatingColor(reviewData.pveAverage)}`}>
            {formatRating(reviewData.pveAverage)}
          </span>
        </div>

        <div className={styles.rating}>
          <span className={styles.label}>PVP:</span>
          <span className={`${styles.value} ${getRatingColor(reviewData.pvpAverage)}`}>
            {formatRating(reviewData.pvpAverage)}
          </span>
        </div>

        <div className={styles.rating}>
          <span className={styles.label}>Overall:</span>
          <span className={`${styles.value} ${getRatingColor(reviewData.overallAverage)}`}>
            {formatRating(reviewData.overallAverage)}
          </span>
        </div>
      </div>
    </div>
  );
}
