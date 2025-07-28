import { t } from 'app/i18next-t';
import { userGuideUrl } from 'app/shell/links';
import { useThunkDispatch } from 'app/store/thunk-dispatch';
import { isAppStoreVersion } from 'app/utils/browsers';
import { useEffect, useMemo } from 'react';
import { useLocation } from 'react-router';
import { loadDimApiData } from '../dim-api/actions';
import { oauthClientId } from '../bungie-api/bungie-api-utils';
import styles from './Login.m.scss';

export const dimApiHelpLink = userGuideUrl('DIM-Sync');

export default function Login() {
  const dispatch = useThunkDispatch();
  const authorizationState = useMemo(
    () => (isAppStoreVersion() ? 'dimauth-' : '') + globalThis.crypto.randomUUID(),
    [],
  );
  const clientId = oauthClientId();
  const location = useLocation();
  const state = location.state as { path?: string } | undefined;
  const previousPath = state?.path;

  useEffect(() => {
    localStorage.setItem('authorizationState', authorizationState);
  }, [authorizationState]);

  // Save the path we were originally on, so we can restore it after login in the DefaultAccount component.
  useEffect(() => {
    if (previousPath) {
      localStorage.setItem('returnPath', $PUBLIC_PATH.replace(/\/$/, '') + previousPath);
    }
  }, [previousPath]);

  useEffect(() => {
    dispatch(loadDimApiData());
  }, [dispatch]);

  const authorizationURL = (reauth?: string) => {
    const queryParams = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      state: authorizationState,
      ...(reauth && { reauth }),
    });
    return `https://www.bungie.net/en/OAuth/Authorize?${queryParams.toString()}`;
  };

  // DIM Sync is always enabled by default
  
  // Always set DIM Sync to enabled
  useEffect(() => {
    localStorage.setItem('dim-api-enabled', 'true');
  }, []);



  return (
    <div className={styles.billboard}>
      <p>
        <a rel="noopener noreferrer" className={styles.auth} href={authorizationURL()}>
          {t('Views.Login.Auth')}
        </a>
      </p>
    </div>
  );
}
