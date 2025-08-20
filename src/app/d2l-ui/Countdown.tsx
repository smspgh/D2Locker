import { i15dDurationFromMs } from 'app/utils/time';
import { useEffect, useState } from 'react';

/**
 * Render a countdown to a specific date.
 */
export default function Countdown({
  endTime,
  compact,
  className,
}: {
  endTime: Date;
  /** Render the time as a compact string instead of spelled out */
  compact?: boolean;
  className?: string;
}) {
  const [diff, setDiff] = useState(endTime.getTime() - Date.now());

  useEffect(() => {
    let interval = 0;
    const update = () => {
      const diff = endTime.getTime() - Date.now();
      // We set the diff just to make it re-render. We could just as easily set this to now(), or an incrementing number
      setDiff(diff);
      if (diff <= 0) {
        clearInterval(interval);
      }
    };

    // Initial update
    const initialDiff = endTime.getTime() - Date.now();
    // eslint-disable-next-line @eslint-react/hooks-extra/no-direct-set-state-in-use-effect
    setDiff(initialDiff);

    interval = window.setInterval(update, 60000);
    return () => clearInterval(interval);
  }, [endTime]);

  return (
    <time dateTime={endTime.toISOString()} className={className} title={endTime.toLocaleString()}>
      {i15dDurationFromMs(diff, compact)}
    </time>
  );
}
