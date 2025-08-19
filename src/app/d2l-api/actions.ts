import { DeleteAllResponse, DestinyVersion } from '@destinyitemmanager/dim-api-types';
import { needsDeveloper } from 'app/accounts/actions';
import { DestinyAccount } from 'app/accounts/destiny-account';
import { accountsSelector, currentAccountSelector } from 'app/accounts/selectors';
import { FatalTokenError } from 'app/bungie-api/authenticated-fetch';
import { d2lErrorToaster } from 'app/bungie-api/error-toaster';
import { getToken } from 'app/bungie-api/oauth-tokens';
import { t } from 'app/i18next-t';
import { showNotification } from 'app/notifications/notifications';
import { readyResolve } from 'app/settings/settings';
import { loadingTracker } from 'app/shell/loading-tracker';
import { refresh$ } from 'app/shell/refresh-events';
import { get, set } from 'app/storage/idb-keyval';
import { observe } from 'app/store/observerMiddleware';
import { RootState, ThunkResult } from 'app/store/types';
import { convertToError, errorMessage } from 'app/utils/errors';
import { errorLog, infoLog } from 'app/utils/log';
import { delay } from 'app/utils/promises';
import { debounce, once } from 'es-toolkit';
import { deepEqual } from 'fast-equals';
import { AnyAction, Dispatch } from 'redux';
import { ThunkDispatch } from 'redux-thunk';
import { getPlatforms } from '../accounts/platforms';
import {
  deleteAllData,
  getDimApiProfile,
  getGlobalSettings,
  postUpdates,
} from '../d2l-api/d2l-api';
import { promptForApiPermission } from './api-permission-prompt';
import { ProfileUpdateWithRollback } from './api-types';
import {
  ProfileIndexedDBState,
  allDataDeleted,
  finishedUpdates,
  flushUpdatesFailed,
  globalSettingsLoaded,
  prepareToFlushUpdates,
  profileLoadError,
  profileLoaded,
  profileLoadedFromIDB,
  setApiPermissionGranted,
} from './basic-actions';
import { DimApiState } from './reducer';
import { apiPermissionGrantedSelector, makeProfileKeyFromAccount } from './selectors';

const TAG = 'd2l sync';

// BroadcastChannel for cross-tab/window communication
let syncChannel: BroadcastChannel | null = null;
try {
  syncChannel = new BroadcastChannel('d2l-sync');
} catch {
  // BroadcastChannel not supported in this browser
}

const installApiPermissionObserver = once(<D extends Dispatch>(dispatch: D) => {
  // Observe API permission and reflect it into local storage
  // We could also use a thunk action instead of an observer... either way
  dispatch(
    observe({
      id: 'api-permission-observer',
      runInitially: true,
      getObserved: (state) => state.d2lApi.apiPermissionGranted,
      sideEffect: ({ current }) => {
        if (current !== null) {
          // Save the permission preference to local storage
          localStorage.setItem('d2l-api-enabled', current ? 'true' : 'false');
        }
      },
    }),
  );
});

/**
 * Watch the redux store and write out values to indexedDB, etc.
 */
const installObservers = once((dispatch: ThunkDispatch<RootState, undefined, AnyAction>) => {
  // Watch the state and write it out to IndexedDB
  dispatch(
    observe({
      id: 'profile-observer',
      getObserved: (state) => state.d2lApi,
      sideEffect: debounce(
        ({ previous, current }: { previous: DimApiState | undefined; current: DimApiState }) => {
          if (
            // Check to make sure one of the fields we care about has changed
            !deepEqual(current.settings, previous?.settings) ||
            !deepEqual(current.profiles, previous?.profiles) ||
            !deepEqual(current.updateQueue, previous?.updateQueue) ||
            !deepEqual(current.itemHashTags, previous?.itemHashTags) ||
            !deepEqual(current.searches, previous?.searches)
          ) {
            const savedState: ProfileIndexedDBState = {
              settings: current.settings, // Save the entire current settings object
              profiles: current.profiles,
              updateQueue: current.updateQueue,
              itemHashTags: current.itemHashTags,
              searches: current.searches,
            };
            infoLog(TAG, 'Saving profile data to IDB');
            set('d2l-api-profile', savedState);
          }
        },
        1000,
      ),
    }),
  );

  // Watch the update queue and flush updates
  dispatch(
    observe({
      id: 'queue-observer',
      getObserved: (state) => state.d2lApi.updateQueue,
      sideEffect: debounce(({ current }: { current: ProfileUpdateWithRollback[] }) => {
        if (current.length) {
          dispatch(flushUpdates());
        }
      }, 500), // Reduced from 1000ms to 500ms for faster sync
    }),
  );

  // Every time data is refreshed, maybe load D2L API data too
  refresh$.subscribe(() => dispatch(loadDimApiData()));

  // Also check for D2L API updates when the page becomes visible
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && navigator.onLine && !loadingTracker.active()) {
      // Delay sync on visibility change to avoid overwhelming mobile connections
      setTimeout(() => {
        if (!document.hidden && navigator.onLine) {
          dispatch(loadDimApiData({ forceLoad: false }));
        }
      }, 1000); // 1 second delay for mobile stability
    }
  });

  // Set up a periodic check for D2L API updates (settings, loadouts, etc.)
  // This runs independently of the game data refresh
  let periodicSyncInterval: number | undefined;
  dispatch(
    observe({
      id: 'periodic-sync-observer',
      getObserved: (state) => state.d2lApi.apiPermissionGranted,
      sideEffect: ({ current: apiPermissionGranted }) => {
        if (periodicSyncInterval) {
          clearInterval(periodicSyncInterval);
          periodicSyncInterval = undefined;
        }

        if (apiPermissionGranted) {
          // Use different sync intervals based on device type to avoid overwhelming mobile connections
          const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
            navigator.userAgent,
          );
          const syncInterval = isMobile ? 120 * 1000 : 60 * 1000; // 2 minutes on mobile, 1 minute on desktop

          periodicSyncInterval = window.setInterval(() => {
            // More robust connectivity check - navigator.onLine can be unreliable on mobile
            if (!document.hidden && navigator.onLine && !loadingTracker.active()) {
              dispatch(loadDimApiData({ forceLoad: false }));
            }
          }, syncInterval);
        }
      },
    }),
  );

  // Listen for sync notifications from other tabs/windows
  if (syncChannel) {
    syncChannel.addEventListener('message', (event: MessageEvent) => {
      if ((event.data as { type?: string })?.type === 'settings-updated') {
        infoLog(TAG, 'Settings updated in another tab, syncing...');
        // Delay slightly to ensure the update has been flushed to the server
        setTimeout(() => {
          dispatch(loadDimApiData({ forceLoad: false }));
        }, 1000);
      }
    });
  }
});

/**
 * Load global API configuration from the server. This doesn't even require the user to be logged in.
 */
function loadGlobalSettings(): ThunkResult {
  return async (dispatch, getState) => {
    // TODO: better to use a state machine (UNLOADED => LOADING => LOADED)
    if (!getState().d2lApi.globalSettingsLoaded) {
      try {
        const globalSettings = await getGlobalSettings();
        infoLog(TAG, 'globalSettings', globalSettings);
        dispatch(globalSettingsLoaded(globalSettings));
      } catch (e) {
        errorLog(TAG, 'Failed to load global settings from D2L API', e);
      }
    }
  };
}

/**
 * Wait, with exponential backoff - we'll try infinitely otherwise, in a tight loop!
 * Double the wait time, starting with 60 seconds, until we reach 10 minutes.
 */
function getBackoffWaitTime(backoff: number) {
  // Don't wait less than 10 seconds or more than 10 minutes
  return Math.max(10_000, Math.min(10 * 60 * 1000, Math.random() * Math.pow(2, backoff) * 30_000));
}

// Backoff multiplier
let getProfileBackoff = 0;
let waitingForApiPermission = false;

/**
 * Load all API data (including global settings). This should be called at start
 * and whenever the account is changed. It's also called whenever stores refresh
 * (via the refresh button or when auto refresh triggers). This action is meant
 * to be called repeatedly and be idempotent.
 *
 * Note that we block loading the manifest on this, because we need the user's
 * settings in order to choose the right language.
 *
 * TODO: If we can replace the manifest after load, maybe we just load using the
 * default language and switch it if the language in settings is different.
 *
 * This action drives a workflow for onboarding to d2l sync, as well. We check
 * for whether the user has opted in to Sync, and if they haven't, we prompt.
 * Usually they already made their choice at login, though.
 */
export function loadDimApiData(
  options: {
    /**
     * forceLoad will load from the server even if the minimum refresh
     * interval has not passed. Keep in mind the server caches full-profile data for
     * up to 60 seconds. This will also skip using a sync token to load incremental changes.
     */
    forceLoad?: boolean;
  } = {},
): ThunkResult {
  return async (dispatch, getState) => {
    const { forceLoad = false } = options;
    installApiPermissionObserver(dispatch);

    // Load from indexedDB if needed
    const profileFromIDB = dispatch(loadProfileFromIndexedDB());

    // Load global settings first. This fails open (we fall back to defaults)
    // but loading it first gives us a chance to find out if the API is disabled
    // and what the current refresh rate is, which gives us important
    // operational controls in case the API is knocked over.
    const globalSettingsLoad = dispatch(loadGlobalSettings());

    // Don't let actions pile up blocked on the approval UI
    if (waitingForApiPermission) {
      return;
    }

    // Show a prompt if the user has not said one way or another whether they want to use the API
    const hasBungieToken = Boolean(getToken());
    if (getState().d2lApi.apiPermissionGranted === null && hasBungieToken) {
      waitingForApiPermission = true;
      try {
        const useApi = await promptForApiPermission();
        dispatch(setApiPermissionGranted(useApi));
      } finally {
        waitingForApiPermission = false;
      }
    }

    // Load accounts info - we can't load the profile-specific D2L API data without it.
    const getPlatformsPromise = dispatch(getPlatforms); // in parallel, we'll wait later

    await profileFromIDB;
    installObservers(dispatch); // idempotent

    await globalSettingsLoad;

    // They don't want to sync from the server, or the API is disabled - stick with local data
    if (
      !getState().d2lApi.apiPermissionGranted ||
      !getState().d2lApi.globalSettings.d2lApiEnabled
    ) {
      readyResolve();
      return;
    }

    // don't load from remote if there is already an update queue from IDB - we'd roll back data otherwise!
    if (getState().d2lApi.updateQueue.length > 0) {
      try {
        await dispatch(flushUpdates()); // flushUpdates will call loadDimApiData again at the end
        return;
      } catch {}
    }

    // get current account
    await getPlatformsPromise;
    if (!accountsSelector(getState()).length) {
      // User isn't logged in or has no accounts, nothing to load!
      return;
    }
    const currentAccount = currentAccountSelector(getState());

    // How long before the API data is considered stale is controlled from the server
    const profileOutOfDateOrMissing =
      profileLastLoaded(getState().d2lApi, currentAccount) >
      getState().d2lApi.globalSettings.d2lProfileMinimumRefreshInterval * 1000;

    if (forceLoad || profileOutOfDateOrMissing) {
      try {
        const syncToken =
          currentAccount && $featureFlags.d2lApiSync && !forceLoad
            ? getState().d2lApi.profiles?.[makeProfileKeyFromAccount(currentAccount)]?.sync
            : undefined;
        const profileResponse = await getDimApiProfile(currentAccount, syncToken);
        dispatch(profileLoaded({ profileResponse, account: currentAccount }));
        infoLog(TAG, 'Loaded profile from D2L API', profileResponse);

        // Quickly heal from being failure backoff
        getProfileBackoff = Math.floor(getProfileBackoff / 2);
      } catch (err) {
        if (err instanceof FatalTokenError) {
          // We're already sent to login, don't keep trying to use d2l sync.
          if ($D2L_FLAVOR === 'dev') {
            dispatch(needsDeveloper());
          }
          return;
        }

        // Only notify error once
        if (!getState().d2lApi.profileLoadedError) {
          showProfileLoadErrorNotification(err);
        }

        const e = convertToError(err);

        dispatch(profileLoadError(e));

        errorLog(TAG, 'Unable to get profile from D2L API', e);

        // Wait, with exponential backoff - use longer backoff on mobile to avoid overwhelming connections
        getProfileBackoff++;
        const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
          navigator.userAgent,
        );
        const baseBackoff = isMobile ? 60_000 : 30_000; // 1 minute base on mobile, 30 seconds on desktop
        const waitTime = Math.max(
          10_000,
          Math.min(10 * 60 * 1000, Math.random() * Math.pow(2, getProfileBackoff) * baseBackoff),
        );
        infoLog(TAG, 'Waiting', waitTime, 'ms before re-attempting profile fetch');

        // Wait, then retry. We don't await this here so we don't stop the finally block from running
        delay(waitTime).then(() => {
          // Only retry if we're still online and the page is visible
          if (navigator.onLine && !document.hidden) {
            dispatch(loadDimApiData(options));
          }
        });
      } finally {
        // Release the app to load with whatever language was saved or the
        // default. Better to have the wrong language (that fixes itself on
        // reload) than to block the app working if the D2L API is down.
        readyResolve();
      }
    } else {
      readyResolve();
    }

    // Make sure any queued updates get sent to the server
    await dispatch(flushUpdates());
  };
}

/**
 * Get either the profile-specific last loaded time, or the global one if we don't have
 * an account selected.
 */
function profileLastLoaded(d2lApi: DimApiState, account: DestinyAccount | undefined) {
  return (
    Date.now() -
    (account
      ? (d2lApi.profiles[makeProfileKeyFromAccount(account)]?.profileLastLoaded ?? 0)
      : d2lApi.profileLastLoaded)
  );
}

// Backoff multiplier
let flushUpdatesBackoff = 0;

/**
 * Process the queue of updates by sending them to the server
 */
function flushUpdates(): ThunkResult {
  return async (dispatch, getState) => {
    let d2lApiState = getState().d2lApi;

    // Skip flushing state if the API is disabled
    if (!d2lApiState.globalSettings.d2lApiEnabled) {
      return;
    }

    // Skip if there's already an update going on, or the queue is empty
    if (d2lApiState.updateInProgressWatermark !== 0 || d2lApiState.updateQueue.length === 0) {
      return;
    }

    // Prepare the queue
    dispatch(prepareToFlushUpdates());
    d2lApiState = getState().d2lApi;

    if (d2lApiState.updateInProgressWatermark === 0) {
      return;
    }

    infoLog(TAG, 'Flushing queue of', d2lApiState.updateInProgressWatermark, 'updates');

    // Only select the items that were frozen for update. They're guaranteed
    // to not change while we're updating and they'll be for a single profile.
    const updates = d2lApiState.updateQueue.slice(0, d2lApiState.updateInProgressWatermark);

    try {
      const firstWithAccount = updates.find((u) => u.platformMembershipId) || updates[0];

      const results = await postUpdates(
        firstWithAccount.platformMembershipId,
        firstWithAccount.destinyVersion ||
          (parseInt($DEFAULT_DESTINY_VERSION, 10) as DestinyVersion),
        updates,
      );

      // Quickly heal from being failure backoff
      flushUpdatesBackoff = Math.floor(flushUpdatesBackoff / 2);

      dispatch(finishedUpdates(results));

      // Notify other tabs/windows that settings have been updated
      if (
        syncChannel &&
        updates.some((update: ProfileUpdateWithRollback) => update.action === 'setting')
      ) {
        syncChannel.postMessage({ type: 'settings-updated' });
      }

      d2lApiState = getState().d2lApi;
      if (d2lApiState.updateQueue.length > 0) {
        // Flush more updates!
        dispatch(flushUpdates());
      } else if (!d2lApiState.profileLoaded) {
        // Load API data in case we didn't do it before
        dispatch(loadDimApiData());
      }
    } catch (e) {
      if (flushUpdatesBackoff === 0) {
        showUpdateErrorNotification(e);
      }
      errorLog(TAG, 'Unable to save updates to D2L API', e);

      // Wait, with exponential backoff
      flushUpdatesBackoff++;
      const waitTime = getBackoffWaitTime(flushUpdatesBackoff);
      // Don't wait for the retry, so we don't block profile loading
      (async () => {
        infoLog(TAG, 'Waiting', waitTime, 'ms before re-attempting updates');
        await delay(waitTime);

        // Now mark the queue failed so it can be retried. Until
        // updateInProgressWatermark gets reset no other flushUpdates call will
        // do anything.
        dispatch(flushUpdatesFailed());

        // Try again
        dispatch(flushUpdates());
      })();

      throw e;
    }
  };
}

function loadProfileFromIndexedDB(): ThunkResult {
  return async (dispatch, getState) => {
    if (getState().d2lApi.profileLoadedFromIndexedDb) {
      return;
    }

    const profile = await get<ProfileIndexedDBState | undefined>('d2l-api-profile');
    dispatch(profileLoadedFromIDB(profile));
  };
}

/**
 * Wipe out all data in the d2l sync cloud storage. Not recoverable!
 */
export function deleteAllApiData(): ThunkResult<DeleteAllResponse['deleted']> {
  return async (dispatch, getState) => {
    const result = await deleteAllData();

    // If they have the API enabled, also clear out everything locally. Otherwise we'll just clear out the remote data.
    if (apiPermissionGrantedSelector(getState())) {
      dispatch(allDataDeleted());
    }

    return result;
  };
}

function showProfileLoadErrorNotification(e: unknown) {
  showNotification(
    d2lErrorToaster(t('Storage.ProfileErrorTitle'), t('Storage.ProfileErrorBody'), errorMessage(e)),
  );
}

function showUpdateErrorNotification(e: unknown) {
  showNotification(
    d2lErrorToaster(t('Storage.UpdateErrorTitle'), t('Storage.UpdateErrorBody'), errorMessage(e)),
  );
}
