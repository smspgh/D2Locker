import { t } from 'app/i18next-t';
import { userGuideUrl } from 'app/shell/links';
import { useThunkDispatch } from 'app/store/thunk-dispatch';
import { isAppStoreVersion } from 'app/utils/browsers';
import { useEffect, useMemo } from 'react';
import { useLocation } from 'react-router';
import { loadDimApiData } from '../d2l-api/actions';
import { oauthClientId } from '../bungie-api/bungie-api-utils';
import styles from './Login.m.scss';

export const d2lApiHelpLink = userGuideUrl('D2L-Sync');

export default function Login() {
  const dispatch = useThunkDispatch();
  const authorizationState = useMemo(
    () => (isAppStoreVersion() ? 'd2lauth-' : '') + globalThis.crypto.randomUUID(),
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
    const redirectUri = `${window.location.origin}/return.html`;
    const queryParams = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      redirect_uri: redirectUri,
      state: authorizationState,
      ...(reauth && { reauth }),
    });
    const url = `https://www.bungie.net/en/OAuth/Authorize?${queryParams.toString()}`;
    console.log('🔗 Generated OAuth URL:', url);
    console.log('🔑 OAuth Parameters:', {
      client_id: clientId,
      response_type: 'code',
      redirect_uri: redirectUri,
      state: authorizationState,
      reauth: reauth
    });
    return url;
  };

  // d2l sync is always enabled by default

  // Always set d2l sync to enabled
  useEffect(() => {
    localStorage.setItem('d2l-api-enabled', 'true');
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
