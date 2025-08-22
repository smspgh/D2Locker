import { currentAccountSelector } from 'app/accounts/selectors';
import { settingSelector, settingsSelector } from 'app/d2l-api/selectors';
import { PressTipRoot } from 'app/d2l-ui/PressTip';
import Sheet from 'app/d2l-ui/Sheet';
import { showCheatSheet$ } from 'app/hotkeys/HotkeysCheatSheet';
import { Hotkey } from 'app/hotkeys/hotkeys';
import { useHotkeys } from 'app/hotkeys/useHotkey';
import { t } from 'app/i18next-t';
import { accountRoute } from 'app/routes';
import { SearchFilterRef } from 'app/search/SearchBar';
import { useSetSetting } from 'app/settings/hooks';
import DimApiWarningBanner from 'app/storage/DimApiWarningBanner';
import { useThunkDispatch } from 'app/store/thunk-dispatch';
import StreamDeckButton from 'app/stream-deck/StreamDeckButton/StreamDeckButton';
import { streamDeckEnabledSelector } from 'app/stream-deck/selectors';
import { isiOSBrowser } from 'app/utils/browsers';
import { compact } from 'app/utils/collections';
import { useSetCSSVarToHeight } from 'app/utils/hooks';
import { infoLog } from 'app/utils/log';
import clsx from 'clsx';
import { AnimatePresence, Transition, Variants, motion } from 'motion/react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { NavLink, useLocation } from 'react-router';
import { useSubscription } from 'use-subscription';
import ClickOutside from '../d2l-ui/ClickOutside';
import SearchFilter from '../search/SearchFilter';
import styles from './Header.m.scss';
import MenuBadge from './MenuBadge';
import PostmasterWarningBanner from './PostmasterWarningBanner';
import RefreshButton from './RefreshButton';
import { setSearchQuery } from './actions';
import { installPrompt$ } from './app-install';
import { AppIcon, searchIcon } from './icons';
import { useIsPhonePortrait } from './selectors';

const menuAnimateVariants: Variants = {
  open: { x: 0 },
  collapsed: { x: -250 },
};
const menuAnimateTransition: Transition<number> = { type: 'spring', duration: 0.3, bounce: 0 };

// TODO: finally time to hack apart the header styles!

const themeOptions = {
  pyramid: 'D2L Default',
  classic: 'D2L Light',
  d2ldark: 'D2L Dark',
};

export default function Header() {
  const dispatch = useThunkDispatch();
  const isPhonePortrait = useIsPhonePortrait();
  const account = useSelector(currentAccountSelector);
  const settings = useSelector(settingsSelector);
  const vaultArmorFilterByClass = useSelector(settingSelector('vaultArmorFilterByClass'));
  const setSetting = useSetSetting();

  // Hamburger menu
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownToggler = useRef<HTMLButtonElement>(null);

  // Theme dropdown
  const [themeDropdownOpen, setThemeDropdownOpen] = useState(false);
  const toggleDropdown = useCallback((e: React.MouseEvent | KeyboardEvent) => {
    e.preventDefault();
    setDropdownOpen((dropdownOpen) => !dropdownOpen);
  }, []);

  const hideDropdown = useCallback(() => {
    setDropdownOpen(false);
    setThemeDropdownOpen(false);
  }, []);

  // Mobile search bar
  const [showSearch, setShowSearch] = useState(false);
  const toggleSearch = () => setShowSearch((showSearch) => !showSearch);
  const hideSearch = useCallback(() => {
    if (showSearch) {
      setShowSearch(false);
    }
  }, [showSearch]);

  // Install D2L as a PWA
  const [promptIosPwa, setPromptIosPwa] = useState(false);
  const installPromptEvent = useSubscription(installPrompt$);

  const showInstallPrompt = () => {
    setPromptIosPwa(true);
    setDropdownOpen(false);
  };

  const installDim = () => {
    if (installPromptEvent) {
      installPromptEvent.prompt();
      installPromptEvent.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') {
          infoLog('install', 'User installed D2 Locker to desktop/home screen');
        } else {
          infoLog('install', 'User dismissed the install prompt');
        }
        installPrompt$.next(undefined);
      });
    } else {
      showInstallPrompt();
    }
  };

  // Is this running as an installed app?
  const isStandalone =
    window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;

  const iosPwaAvailable = isiOSBrowser() && !isStandalone;

  const installable = installPromptEvent || iosPwaAvailable;

  // the choice to relaunch in a no-tabs, less-UI window

  // Search filter
  const searchFilter = useRef<SearchFilterRef>(null);

  // Clear filter and close dropdown on path change
  const { pathname } = useLocation();

  useEffect(() => {
    // eslint-disable-next-line @eslint-react/hooks-extra/no-direct-set-state-in-use-effect
    setDropdownOpen(false);
    // eslint-disable-next-line @eslint-react/hooks-extra/no-direct-set-state-in-use-effect
    setThemeDropdownOpen(false);
    dispatch(setSearchQuery(''));
  }, [dispatch, pathname]);

  // Focus search when shown
  useEffect(() => {
    if (searchFilter.current && showSearch) {
      searchFilter.current.focusFilterInput();
    }
  }, [showSearch]);

  const dropdownRef = useRef<HTMLDivElement>(null);

  const navLinkClassName = ({ isActive }: { isActive: boolean }) =>
    clsx(styles.menuItem, { [styles.active]: isActive });

  // Generic links about D2L

  let links: {
    to: string;
    text: string;
    badge?: React.ReactNode;
  }[] = [];
  if (account) {
    const path = accountRoute(account);
    links = compact([
      {
        to: `${path}/inventory`,
        text: t('Header.Inventory'),
      },
      {
        to: `${path}/vendors`,
        text: t('Vendors.Vendors'),
      },
      {
        to: `${path}/loadouts`,
        text: t('Loadouts.Loadouts'),
      },
      account.destinyVersion === 2 && {
        to: `${path}/armory-search`,
        text: 'Weapon Database',
      },
    ]);
  }

  const linkNodes = links.map((link) => (
    <NavLink className={navLinkClassName} key={link.to} to={link.to}>
      {link.badge}
      {link.text}
    </NavLink>
  ));

  // Links about the current Destiny version
  const destinyLinks = linkNodes;

  const hotkeys = useMemo(() => {
    const hotkeys: Hotkey[] = [
      {
        combo: 'm',
        description: t('Hotkey.Menu'),
        callback: toggleDropdown,
      },
      {
        combo: 'f',
        description: t('Hotkey.StartSearch'),
        callback: (event) => {
          if (searchFilter.current) {
            searchFilter.current.focusFilterInput();
            if (isPhonePortrait) {
              setShowSearch(true);
            }
          }
          event.preventDefault();
          event.stopPropagation();
        },
      },
      {
        combo: 'shift+f',
        description: t('Hotkey.StartSearchClear'),
        callback: (event) => {
          if (searchFilter.current) {
            searchFilter.current.clearFilter();
            searchFilter.current.focusFilterInput();
            if (isPhonePortrait) {
              setShowSearch(true);
            }
          }
          event.preventDefault();
          event.stopPropagation();
        },
      },
    ];
    return hotkeys;
  }, [isPhonePortrait, toggleDropdown]);
  useHotkeys(hotkeys);

  const showKeyboardHelp = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    showCheatSheet$.next(true);
    setDropdownOpen(false);
  };

  const changeTheme = (theme: string) => {
    setSetting('theme', theme);
    setThemeDropdownOpen(false);
  };

  const toggleThemeDropdown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setThemeDropdownOpen(!themeDropdownOpen);
  };

  const toggleVaultArmorFilter = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setSetting('vaultArmorFilterByClass', !vaultArmorFilterByClass);
  };

  // Calculate the true height of the header, for use in other things
  const headerRef = useRef<HTMLDivElement>(null);
  useSetCSSVarToHeight(headerRef, '--header-height');

  const headerLinksRef = useRef<HTMLDivElement>(null);

  const streamDeckEnabled = $featureFlags.elgatoStreamDeck
    ? // eslint-disable-next-line react-hooks/rules-of-hooks
      useSelector(streamDeckEnabledSelector)
    : false;

  return (
    <PressTipRoot value={headerRef}>
      <header className={styles.container} ref={headerRef}>
        <div className={styles.header}>
          <button
            type="button"
            className={clsx(styles.menuItem, styles.menu)}
            ref={dropdownToggler}
            onClick={toggleDropdown}
            aria-haspopup="menu"
            aria-label={t('Header.Menu')}
            aria-expanded={dropdownOpen}
          >
            <img src="/android-chrome-192x192-6-2018.png" width="24" height="24" alt="Menu" />
            <MenuBadge />
          </button>
          {account && (
            <span style={{ marginLeft: '8px', fontSize: '14px', fontWeight: 'bold' }}>
              Yo {account.displayName}!
            </span>
          )}
          <AnimatePresence>
            {dropdownOpen && (
              <motion.div
                key="dropdown"
                className={styles.dropdown}
                role="menu"
                initial="collapsed"
                animate="open"
                exit="collapsed"
                variants={menuAnimateVariants}
                transition={menuAnimateTransition}
              >
                <ClickOutside
                  ref={dropdownRef}
                  extraRef={dropdownToggler}
                  onClickOutside={hideDropdown}
                >
                  {destinyLinks}
                  <hr />
                  {account && (
                    <NavLink
                      className={navLinkClassName}
                      to={`${accountRoute(account)}/search-history`}
                    >
                      {t('SearchHistory.Title')}
                    </NavLink>
                  )}
                  {account && (
                    <NavLink
                      className={navLinkClassName}
                      to={`${accountRoute(account)}/filter-options`}
                    >
                      Filter Options
                    </NavLink>
                  )}
                  {account && (
                    <button
                      type="button"
                      className={styles.menuItem}
                      onClick={toggleVaultArmorFilter}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        background: 'transparent',
                        border: 'none',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <span>
                        {t('Menu.VaultArmorFilter', { defaultValue: 'Active Class Only' })}
                      </span>
                      <span
                        style={{
                          width: '40px',
                          height: '20px',
                          borderRadius: '10px',
                          background: vaultArmorFilterByClass
                            ? 'var(--theme-accent-primary)'
                            : 'var(--theme-accent-secondary)',
                          position: 'relative',
                          transition: 'background-color 0.2s',
                        }}
                      >
                        <span
                          style={{
                            position: 'absolute',
                            top: '2px',
                            left: vaultArmorFilterByClass ? '22px' : '2px',
                            width: '16px',
                            height: '16px',
                            borderRadius: '8px',
                            background: 'white',
                            transition: 'left 0.2s',
                          }}
                        />
                      </span>
                    </button>
                  )}
                  <button
                    type="button"
                    className={styles.menuItem}
                    onClick={toggleThemeDropdown}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      background: 'transparent',
                      border: 'none',
                    }}
                  >
                    Theme
                  </button>
                  {themeDropdownOpen && (
                    <div style={{ paddingLeft: '16px' }}>
                      {Object.entries(themeOptions).map(([key, label]) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => changeTheme(key)}
                          className={styles.menuItem}
                          style={{
                            width: '100%',
                            textAlign: 'left',
                            padding: '6px 8px',
                            fontSize: '14px',
                            background:
                              settings.theme === key || (!settings.theme && key === 'pyramid')
                                ? 'var(--theme-accent-primary)'
                                : 'transparent',
                            color:
                              settings.theme === key || (!settings.theme && key === 'pyramid')
                                ? 'var(--theme-text-contrast)'
                                : 'var(--theme-text)',
                          }}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  )}
                  <NavLink className={navLinkClassName} to="/settings">
                    {t('Settings.Settings')}
                  </NavLink>
                  {installable && (
                    <a className={styles.menuItem} onClick={installDim}>
                      Install D2Locker as an App
                    </a>
                  )}
                  {!isPhonePortrait && (
                    <a className={styles.menuItem} onClick={showKeyboardHelp}>
                      {t('Header.KeyboardShortcuts')}
                    </a>
                  )}
                </ClickOutside>
              </motion.div>
            )}
          </AnimatePresence>
          <div className={styles.headerLinks} ref={headerLinksRef}>
            {destinyLinks}
          </div>
          <div className={styles.headerRight}>
            {account && !isPhonePortrait && (
              <span className={styles.searchLink}>
                <SearchFilter onClear={hideSearch} ref={searchFilter} />
              </span>
            )}
            {streamDeckEnabled && <StreamDeckButton />}
            <RefreshButton className={styles.menuItem} />
            <button
              type="button"
              className={clsx(styles.menuItem, styles.searchButton)}
              onClick={toggleSearch}
            >
              <AppIcon icon={searchIcon} />
            </button>
          </div>
        </div>
        {account && isPhonePortrait && showSearch && (
          <span className="mobile-search-link">
            <SearchFilter onClear={hideSearch} ref={searchFilter} />
          </span>
        )}
        <PostmasterWarningBanner />
        {$featureFlags.warnNoSync && <DimApiWarningBanner />}
        {promptIosPwa && (
          <Sheet header={<h1>{t('Header.InstallD2L')}</h1>} onClose={() => setPromptIosPwa(false)}>
            <p className={styles.pwaPrompt}>{t('Header.IosPwaPrompt')}</p>
          </Sheet>
        )}
      </header>
    </PressTipRoot>
  );
}
