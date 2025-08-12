import StaticPage from 'app/d2l-ui/StaticPage';
import { t } from 'app/i18next-t';
import { usePageTitle } from 'app/utils/hooks';
import BungieAlerts from './BungieAlerts';

/**
 * What's new in the world of D2L?
 */
export default function WhatsNew() {
  usePageTitle(t('Header.WhatsNew'));
  return (
    <StaticPage>
      <BungieAlerts />
    </StaticPage>
  );
}
