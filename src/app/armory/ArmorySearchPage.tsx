import { DestinyAccount } from 'app/accounts/destiny-account';
import ShowPageLoading from 'app/dim-ui/ShowPageLoading';
import { t } from 'app/i18next-t';
import { useLoadStores } from 'app/inventory/store/hooks';
import { usePageTitle } from 'app/utils/hooks';
import LazyArmorySearch from './LazyArmorySearch';

export default function ArmorySearchPage({ account }: { account: DestinyAccount }) {
  usePageTitle('Weapon Database');
  const storesLoaded = useLoadStores(account);
  
  if (!storesLoaded) {
    return <ShowPageLoading message={t('Loading.Profile')} />;
  }

  return (
    <div className="dim-page">
      <LazyArmorySearch />
    </div>
  );
}