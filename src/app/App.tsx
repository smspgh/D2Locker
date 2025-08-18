import { settingSelector } from 'app/d2l-api/selectors';
import { preloadRollAppraiserData } from 'app/roll-appraiser/rollAppraiserService';
import { RootState } from 'app/store/types';
import clsx from 'clsx';
import { Suspense, lazy, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { Navigate, Route, Routes, useLocation } from 'react-router';
import styles from './App.m.scss';
import AutoRefresh from './d2l-ui/AutoRefresh';
import ClickOutsideRoot from './d2l-ui/ClickOutsideRoot';
import ErrorBoundary from './d2l-ui/ErrorBoundary';
import PageLoading from './d2l-ui/PageLoading';
import ShowPageLoading from './d2l-ui/ShowPageLoading';
import HotkeysCheatSheet from './hotkeys/HotkeysCheatSheet';
import { t } from './i18next-t';
import Login from './login/Login';
import NotificationsContainer from './notifications/NotificationsContainer';
import DefaultAccount from './shell/DefaultAccount';
import Destiny from './shell/Destiny';
import GATracker from './shell/GATracker';
import Header from './shell/Header';
import ScrollToTop from './shell/ScrollToTop';
import SneakyUpdates from './shell/SneakyUpdates';

const WhatsNew = lazy(
  () => import(/* webpackChunkName: "about-whatsnew-privacy-debug" */ './whats-new/WhatsNew'),
);
const SettingsPage = lazy(
  () => import(/* webpackChunkName: "settings" */ './settings/SettingsPage'),
);
const Debug = lazy(
  () => import(/* webpackChunkName: "about-whatsnew-privacy-debug" */ './debug/Debug'),
);
const Privacy = lazy(
  () => import(/* webpackChunkName: "about-whatsnew-privacy-debug" */ './shell/Privacy'),
);
const About = lazy(
  () => import(/* webpackChunkName: "about-whatsnew-privacy-debug" */ './shell/About'),
);
const SharedLoadoutRedirect = lazy(
  () =>
    import(/* webpackChunkName: "loadout-share" */ './loadout/loadout-share/SharedLoadoutRedirect'),
);

export default function App() {
  const language = useSelector(settingSelector('language'));
  const itemQuality = useSelector(settingSelector('itemQuality'));
  const charColMobile = useSelector(settingSelector('charColMobile'));
  const needsLogin = useSelector((state: RootState) => state.accounts.needsLogin);
  // We no longer need needsDeveloper as we are bypassing the developer setup
  // const needsDeveloper = useSelector((state: RootState) => state.accounts.needsDeveloper);
  const { pathname, search } = useLocation();

  // Preload roll appraiser data when app starts
  useEffect(() => {
    preloadRollAppraiserData();
  }, []);

  return (
    <div
      key={`lang-${language}`}
      className={clsx(styles.app, `lang-${language}`, `char-cols-${charColMobile}`, {
        itemQuality,
      })}
    >
      <ScrollToTop />
      <GATracker />
      <SneakyUpdates />
      <ClickOutsideRoot>
        <Header />
        <PageLoading />
        <ErrorBoundary name="D2L Code">
          <Suspense fallback={<ShowPageLoading message={t('Loading.Code')} />}>
            <Routes>
              <Route
                path="about"
                element={
                  <ErrorBoundary name="about" key="about">
                    <About />
                  </ErrorBoundary>
                }
              />
              <Route
                path="privacy"
                element={
                  <ErrorBoundary name="privacy" key="privacy">
                    <Privacy />
                  </ErrorBoundary>
                }
              />
              <Route
                path="whats-new"
                element={
                  <ErrorBoundary name="whatsNew" key="whatsNew">
                    <WhatsNew />
                  </ErrorBoundary>
                }
              />
              <Route
                path="login"
                element={
                  <ErrorBoundary name="login" key="login">
                    <Login />
                  </ErrorBoundary>
                }
              />
              <Route
                path="settings"
                element={
                  <ErrorBoundary name="settings" key="settings">
                    <SettingsPage />
                  </ErrorBoundary>
                }
              />
              <Route
                path="debug"
                element={
                  <ErrorBoundary name="debug" key="debug">
                    <Debug />
                  </ErrorBoundary>
                }
              />
              {needsLogin ? (
                <Route
                  path="*"
                  element={
                    // Always navigate to login if needsLogin is true, bypassing developer setup
                    <Navigate to="/login" state={{ path: `${pathname}${search}` }} />
                  }
                />
              ) : (
                <>
                  <Route path="armory/*" element={<DefaultAccount />} />
                  <Route path=":membershipId/:destinyVersion/*" element={<Destiny />} />
                  <Route
                    path="loadout/:shareId"
                    element={
                      <ErrorBoundary name="sharedLoadout" key="sharedLoadout">
                        <SharedLoadoutRedirect />
                      </ErrorBoundary>
                    }
                  />
                  <Route path="*" element={<DefaultAccount />} />
                </>
              )}
            </Routes>
          </Suspense>
        </ErrorBoundary>
        <NotificationsContainer />
        <AutoRefresh />
        <HotkeysCheatSheet />
      </ClickOutsideRoot>
    </div>
  );
}
