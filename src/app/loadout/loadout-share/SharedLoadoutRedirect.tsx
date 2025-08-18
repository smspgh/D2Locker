import { currentAccountSelector } from 'app/accounts/selectors';
import { getSharedLoadout } from 'app/d2l-api/d2l-api';
import PageLoading from 'app/d2l-ui/PageLoading';
import { t } from 'app/i18next-t';
import { currentStoreSelector } from 'app/inventory/selectors';
import { editLoadout } from 'app/loadout-drawer/loadout-events';
import { convertDimApiLoadoutToLoadout } from 'app/loadout/loadout-type-converters';
import { showNotification } from 'app/notifications/notifications';
import { errorMessage } from 'app/utils/errors';
import { useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router';

export default function SharedLoadoutRedirect() {
  const { shareId } = useParams<{ shareId: string }>();
  const navigate = useNavigate();
  const account = useSelector(currentAccountSelector);
  const currentStore = useSelector(currentStoreSelector);

  useEffect(() => {
    if (!shareId) {
      navigate('/');
      return;
    }

    // If user is not logged in, redirect to login with the share URL as return path
    if (!account) {
      navigate('/login', { state: { path: `/loadout/${shareId}` } });
      return;
    }

    // Wait for store to be available
    if (!currentStore) {
      return;
    }

    (async () => {
      try {
        console.log('Fetching shared loadout for shareId:', shareId);
        // Directly call the API to get the shared loadout
        const apiLoadout = await getSharedLoadout(shareId);
        console.log('Got shared loadout:', apiLoadout);
        const loadout = convertDimApiLoadoutToLoadout(apiLoadout);
        console.log('Converted loadout:', loadout);

        // Ensure the loadout has a unique ID
        loadout.id = globalThis.crypto.randomUUID();

        // Navigate to the account's inventory page
        navigate(`/${account.membershipId}/d${account.destinyVersion}/inventory`);

        // Open the loadout drawer with the imported loadout
        editLoadout(loadout, currentStore.id, { fromExternal: true });

        showNotification({
          type: 'success',
          title: t('Loadouts.Import.Success'),
        });
      } catch (e) {
        const error = errorMessage(e);
        showNotification({
          type: 'error',
          title: t('Loadouts.Import.Error'),
          body: error.includes('404') ? t('Loadouts.Import.Error404') : error,
        });
        navigate('/'); // Navigate to home on error
      }
    })();
  }, [shareId, account, currentStore, navigate]);

  return <PageLoading message={t('Loadouts.Import.Loading')} />;
}
