import { useThunkDispatch } from 'app/store/thunk-dispatch';
import { useEventBusListener } from 'app/utils/hooks';
import { GlobalAlertLevelsToToastLevels } from 'app/whats-new/BungieAlerts';
import clsx from 'clsx';
import { useCallback, useEffect } from 'react';
import { useSelector } from 'react-redux';
import styles from './MenuBadge.m.scss';
import { pollForBungieAlerts } from './alerts';
import { refresh$ } from './refresh-events';
import { bungieAlertsSelector } from './selectors';

/**
 * A badge for the hamburger menu - must be kept in sync with WhatsNewLink, but may also incorporate other sources.
 *
 * Using inheritance to keep better in sync with WhatsNewLink.
 */
export default function MenuBadge() {
  // TODO: Incorporate settings/storage (e.g. d2l sync disabled/busted)
  const alerts = useSelector(bungieAlertsSelector);
  const dispatch = useThunkDispatch();

  const getAlerts = useCallback(() => dispatch(pollForBungieAlerts()), [dispatch]);
  useEventBusListener(refresh$, getAlerts);
  useEffect(() => {
    getAlerts();
  }, [getAlerts]);

  // Auto-reload updates are handled automatically - no UI indicator needed

  if (alerts.length) {
    return (
      <span
        className={clsx(
          styles.badgeNew,
          `bungie-alert-${GlobalAlertLevelsToToastLevels[alerts[0].AlertLevel]}`,
        )}
      />
    );
  }

  return null;
}
