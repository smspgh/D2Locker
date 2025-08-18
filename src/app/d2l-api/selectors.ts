import {
  DestinyVersion,
  SearchType,
  defaultLoadoutParameters,
} from '@destinyitemmanager/dim-api-types';
import { DestinyAccount } from 'app/accounts/destiny-account';
import { currentAccountSelector, destinyVersionSelector } from 'app/accounts/selectors';
import { Settings } from 'app/settings/initial-settings';
import { RootState } from 'app/store/types';
import { createSelector } from 'reselect';

export function makeProfileKeyFromAccount(account: DestinyAccount) {
  return makeProfileKey(account.membershipId, account.destinyVersion);
}
export function makeProfileKey(platformMembershipId: string, destinyVersion: DestinyVersion) {
  return `${platformMembershipId}-d${destinyVersion}`;
}

export const settingsSelector = (state: RootState) => state.d2lApi.settings;

/** A selector for a particular setting by property name */
export const settingSelector =
  <K extends keyof Settings>(key: K) =>
  (state: RootState) =>
    state.d2lApi.settings[key];

/**
 * The last used Loadout Optimizer settings, with defaults filled in
 */
export const savedLoadoutParametersSelector = createSelector(
  (state: RootState) => settingsSelector(state).loParameters,
  (loParams) => ({ ...defaultLoadoutParameters, ...loParams }),
);

export const savedLoStatConstraintsByClassSelector = (state: RootState) =>
  settingsSelector(state).loStatConstraintsByClass;

export const languageSelector = (state: RootState) => settingsSelector(state).language;

export const collapsedSelector =
  (sectionId: string) =>
  (state: RootState): boolean | undefined =>
    settingsSelector(state).collapsedSections[sectionId];

export const customStatsSelector = (state: RootState) => settingsSelector(state).customStats;

export const apiPermissionGrantedSelector = (state: RootState) =>
  state.d2lApi.apiPermissionGranted === true;

export const D2LSyncErrorSelector = (state: RootState) => state.d2lApi.profileLoadedError;

export const updateQueueLengthSelector = (state: RootState) => state.d2lApi.updateQueue.length;

/**
 * Return saved API data for the currently active profile (account).
 */
export const currentProfileSelector = createSelector(
  currentAccountSelector,
  (state: RootState) => state.d2lApi.profiles,
  (currentAccount, profiles) =>
    currentAccount ? profiles[makeProfileKeyFromAccount(currentAccount)] : undefined,
);

const recentSearchesSelectorCached = createSelector(
  (state: RootState) => state.d2lApi.searches[destinyVersionSelector(state)],
  (_state: RootState, searchType: SearchType) => searchType,
  (searches, searchType) => (searches || []).filter((s) => (s.type ?? SearchType.Item) === searchType),
);

/**
 * Returns all recent/saved searches of the given type.
 */
export const recentSearchesSelector = (searchType: SearchType) => (state: RootState) =>
  recentSearchesSelectorCached(state, searchType);

export const trackedTriumphsSelector = createSelector(
  currentProfileSelector,
  (profile) => profile?.triumphs || [],
);

/** Server control over the issue/campaign banner */
export const issueBannerEnabledSelector = (state: RootState) =>
  state.d2lApi.globalSettings.showIssueBanner;
