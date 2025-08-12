import {
  DestinyVersion,
  ExportResponse,
  ItemAnnotation,
  Loadout,
} from '@destinyitemmanager/dim-api-types';
import { t } from 'app/i18next-t';
import { showNotification } from 'app/notifications/notifications';
import { Settings, initialSettingsState } from 'app/settings/initial-settings';
import { observe, unobserve } from 'app/store/observerMiddleware';
import { ThunkResult } from 'app/store/types';
import { errorMessage } from 'app/utils/errors';
import { errorLog, infoLog } from 'app/utils/log';
import { delay } from 'app/utils/promises';
import { keyBy } from 'es-toolkit';
import { Dispatch } from 'redux';
import { loadDimApiData } from './actions';
import { profileLoadedFromIDB } from './basic-actions';
import { importData } from './d2l-api';
import type { DimApiState } from './reducer';
import { makeProfileKey } from './selectors';

const TAG = 'importData';

/**
 * Import data in the d2l sync export format into d2l sync or local storage.
 * This is from a user clicking "Import" and will always overwrite the data saved locally or on the server.
 */
export function importDataBackup(data: ExportResponse, silent = false): ThunkResult {
  return async (dispatch, getState) => {
    const d2lApiData = getState().d2lApi;

    if (
      d2lApiData.globalSettings.d2lApiEnabled &&
      d2lApiData.apiPermissionGranted &&
      !d2lApiData.profileLoaded
    ) {
      await waitForProfileLoad(dispatch);
    }

    if (d2lApiData.globalSettings.d2lApiEnabled && d2lApiData.apiPermissionGranted) {
      try {
        infoLog(TAG, 'Attempting to import data into D2L API');
        const result = await importData(data);

        // Import immediately into local state
        dispatch(importBackupIntoLocalState(data, true));

        // d2l-api can cache the data for up to 60 seconds. Reload from the
        // server after that so we don't use our faked import data too long. We
        // won't wait for this.
        delay(60_000).then(() => dispatch(loadDimApiData({ forceLoad: true })));
        infoLog(TAG, 'Successfully imported data into D2L API', result);
        showImportSuccessNotification(result, true);
        return;
      } catch (e) {
        if (!silent) {
          errorLog(TAG, 'Error importing data into D2L API', e);
          showImportFailedNotification(errorMessage(e));
        }
        return;
      }
    } else {
      // Import directly into local state, since the user doesn't want to use d2l sync
      dispatch(importBackupIntoLocalState(data, silent));
    }
  };
}

function importBackupIntoLocalState(data: ExportResponse, silent = false): ThunkResult {
  return async (dispatch) => {
    const settings = data.settings;
    const loadouts = extractLoadouts(data);
    const tags = extractItemAnnotations(data);
    const triumphs: ExportResponse['triumphs'] = data.triumphs || [];
    const itemHashTags: ExportResponse['itemHashTags'] = data.itemHashTags || [];
    const importedSearches: ExportResponse['searches'] = data.searches || [];

    if (!loadouts.length && !tags.length) {
      if (!silent) {
        errorLog(
          'importData',
          'Error importing data into D2L - no data found in import file. (no settings upgrade/API upload attempted. d2l sync is turned off)',
          data,
        );
        showImportFailedNotification(t('Storage.ImportNotification.NoData'));
      }
      return;
    }

    const profiles: DimApiState['profiles'] = {};

    for (const platformLoadout of loadouts) {
      const { platformMembershipId, destinyVersion, ...loadout } = platformLoadout;
      if (platformMembershipId && destinyVersion) {
        const key = makeProfileKey(platformMembershipId, destinyVersion);
        if (!profiles[key]) {
          profiles[key] = {
            profileLastLoaded: 0,
            loadouts: {},
            tags: {},
            triumphs: [],
          };
        }
        profiles[key].loadouts[loadout.id] = loadout;
      }
    }
    for (const platformTag of tags) {
      const { platformMembershipId, destinyVersion, ...tag } = platformTag;
      if (platformMembershipId && destinyVersion) {
        const key = makeProfileKey(platformMembershipId, destinyVersion);
        if (!profiles[key]) {
          profiles[key] = {
            profileLastLoaded: 0,
            loadouts: {},
            tags: {},
            triumphs: [],
          };
        }
        profiles[key].tags[tag.id] = tag;
      }
    }

    for (const triumphData of triumphs) {
      const { platformMembershipId, triumphs } = triumphData;
      if (platformMembershipId) {
        const key = makeProfileKey(platformMembershipId, 2);
        if (!profiles[key]) {
          profiles[key] = {
            profileLastLoaded: 0,
            loadouts: {},
            tags: {},
            triumphs: [],
          };
        }
        profiles[key].triumphs = triumphs;
      }
    }

    const searches: DimApiState['searches'] = {
      1: [],
      2: [],
    };
    for (const search of importedSearches) {
      searches[search.destinyVersion].push(search.search);
    }

    dispatch(
      profileLoadedFromIDB({
        settings: { ...initialSettingsState, ...settings } as Settings,
        profiles,
        itemHashTags: keyBy(itemHashTags, (t) => t.hash),
        searches,
        updateQueue: [],
      }),
    );

    if (!silent) {
      showImportSuccessNotification(
        {
          loadouts: loadouts.length,
          tags: tags.length,
        },
        false,
      );
    }
  };
}

// Each observer that is used to observe the change in d2lApi profileLoaded state
// should be unique, so use a module reference counter.
let profileLoadObserverCount = 0;
/** Returns a promise that resolves when the profile is fully loaded. */
function waitForProfileLoad<D extends Dispatch>(dispatch: D) {
  const observerId = `profile-load-observer-${profileLoadObserverCount++}`;
  return new Promise((resolve) => {
    dispatch(
      observe({
        id: observerId,
        runInitially: true,
        getObserved: (rootState) => rootState.d2lApi.profileLoaded,
        sideEffect: ({ current }) => {
          if (current) {
            dispatch(unobserve(observerId));
            resolve(undefined);
          }
        },
      }),
    );
  });
}

function showImportSuccessNotification(
  result: { loadouts: number; tags: number },
  D2LSync: boolean,
) {
  showNotification({
    type: 'success',
    title: t('Storage.ImportNotification.SuccessTitle'),
    body: D2LSync
      ? t('Storage.ImportNotification.SuccessBodyForced', result)
      : t('Storage.ImportNotification.SuccessBodyLocal', result),
    duration: 15000,
  });
}

function showImportFailedNotification(message: string) {
  showNotification({
    type: 'error',
    title: t('Storage.ImportNotification.FailedTitle'),
    body: t('Storage.ImportNotification.FailedBody', { error: message }),
    duration: 15000,
  });
}

type PlatformLoadout = Loadout & {
  platformMembershipId: string;
  destinyVersion: DestinyVersion;
};

/**
 * Extract loadouts in D2L API format from an export.
 */
function extractLoadouts(importData: ExportResponse): PlatformLoadout[] {
  if (importData.loadouts) {
    return importData.loadouts.map((l) => ({
      ...l.loadout,
      platformMembershipId: l.platformMembershipId,
      destinyVersion: l.destinyVersion,
    }));
  }
  return [];
}

type PlatformItemAnnotation = ItemAnnotation & {
  platformMembershipId: string;
  destinyVersion: DestinyVersion;
};

/**
 * Extract tags/notes in D2L API format from an export.
 */
function extractItemAnnotations(importData: ExportResponse): PlatformItemAnnotation[] {
  if (importData.tags) {
    return importData.tags.map((t) => ({
      ...t.annotation,
      platformMembershipId: t.platformMembershipId,
      destinyVersion: t.destinyVersion,
    }));
  }
  return [];
}
