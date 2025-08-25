import { DestinyAccount } from 'app/accounts/destiny-account';
import ShowPageLoading from 'app/d2l-ui/ShowPageLoading';
import { useLoadStores } from 'app/inventory/store/hooks';
import { useD2Definitions } from 'app/manifest/selectors';
import { useSelector } from 'react-redux';
import ShaderBulkApply from './ShaderBulkApply';

export default function ShaderBulkApplyPage({ account }: { account: DestinyAccount }) {
  useLoadStores(account);
  const defs = useSelector(useD2Definitions);

  if (!defs) {
    return <ShowPageLoading message="Loading Destiny info..." />;
  }

  return <ShaderBulkApply />;
}