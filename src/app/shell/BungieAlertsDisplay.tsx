import ExternalLink from 'app/d2l-ui/ExternalLink';
import { AppIcon, faExternalLinkAlt } from 'app/shell/icons';
import { GlobalAlert } from 'bungie-api-ts/core';
import styles from './BungieAlertsDisplay.m.scss';

interface BungieAlertsDisplayProps {
  alerts: GlobalAlert[];
}

export default function BungieAlertsDisplay({ alerts }: BungieAlertsDisplayProps) {
  if (!alerts || alerts.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.noAlerts}>No active alerts</div>
      </div>
    );
  }

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  const getAlertLevelClass = (level: number) => {
    switch (level) {
      case 1:
        return styles.levelInfo;
      case 2:
        return styles.levelWarning;
      case 3:
        return styles.levelError;
      default:
        return '';
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.alertsList}>
        {alerts.map((alert, index) => (
          <div
            key={alert.AlertKey || index}
            className={`${styles.alert} ${getAlertLevelClass(alert.AlertLevel)}`}
          >
            <div className={styles.alertContent}>
              <div
                className={styles.alertMessage}
                // eslint-disable-next-line @eslint-react/dom/no-dangerously-set-innerhtml
                dangerouslySetInnerHTML={{ __html: alert.AlertHtml }} // Trusted HTML from Bungie's official API
              />
              {alert.AlertLink && (
                <div className={styles.alertLink}>
                  <ExternalLink href={alert.AlertLink}>
                    View Details <AppIcon icon={faExternalLinkAlt} />
                  </ExternalLink>
                </div>
              )}
              <div className={styles.alertTimestamp}>{formatTimestamp(alert.AlertTimestamp)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
