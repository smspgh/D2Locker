import { t } from 'app/i18next-t';
import { bungieAlertsSelector } from 'app/shell/selectors';
import clsx from 'clsx';
import { useSelector } from 'react-redux';
import { NavLink } from 'react-router';
import { useSubscription } from 'use-subscription';
import { d2lNeedsUpdate$, reloadD2L } from '../register-service-worker';
import { AppIcon, updateIcon } from '../shell/icons';
import { GlobalAlertLevelsToToastLevels } from './BungieAlerts';
import styles from './WhatsNewLink.m.scss';

/**
 * A link/button to the "What's New" page that highlights the most important action.
 */
export default function WhatsNewLink({
  className,
}: {
  className: (props: { isActive: boolean }) => string;
}) {
  const alerts = useSelector(bungieAlertsSelector);
  const d2lNeedsUpdate = useSubscription(d2lNeedsUpdate$);

  // TODO: use presstip/tooltip to help?
  // TODO: try dots and bottom-borders

  if (d2lNeedsUpdate) {
    return (
      <a className={className({ isActive: false })} onClick={reloadD2L}>
        <AppIcon className={styles.upgrade} icon={updateIcon} ariaHidden />
        {t('Header.UpgradeD2L')}
      </a>
    );
  }

  if (alerts.length) {
    return (
      <NavLink to="/whats-new" className={className}>
        <span
          className={clsx(
            styles.badgeNew,
            `bungie-alert-${GlobalAlertLevelsToToastLevels[alerts[0].AlertLevel]}`,
          )}
        />{' '}
        {t('Header.BungieNetAlert')}
      </NavLink>
    );
  }

  return (
    <NavLink to="/whats-new" className={className}>
      {t('Header.WhatsNew')}
    </NavLink>
  );
}
