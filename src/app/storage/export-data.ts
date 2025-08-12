import { DestinyVersion, ExportResponse } from '@destinyitemmanager/dim-api-types';
import { parseProfileKey } from 'app/d2l-api/reducer';
import { ThunkResult } from 'app/store/types';
import { download } from 'app/utils/download';

/**
 * Export the local IDB data to a format the D2L API could import.
 */
export function exportLocalData(): ThunkResult<ExportResponse> {
  return async (_dispatch, getState) => {
    const d2lApiState = getState().d2lApi;
    const exportResponse: ExportResponse = {
      settings: d2lApiState.settings,
      loadouts: [],
      tags: [],
      triumphs: [],
      itemHashTags: [],
      searches: [],
    };

    for (const profileKey in d2lApiState.profiles) {
      if (Object.prototype.hasOwnProperty.call(d2lApiState.profiles, profileKey)) {
        const [platformMembershipId, destinyVersion] = parseProfileKey(profileKey);

        for (const loadout of Object.values(d2lApiState.profiles[profileKey].loadouts)) {
          exportResponse.loadouts.push({
            loadout,
            platformMembershipId,
            destinyVersion,
          });
        }
        for (const annotation of Object.values(d2lApiState.profiles[profileKey].tags)) {
          exportResponse.tags.push({
            annotation,
            platformMembershipId,
            destinyVersion,
          });
        }

        exportResponse.triumphs.push({
          platformMembershipId,
          triumphs: d2lApiState.profiles[profileKey].triumphs,
        });
      }
    }

    exportResponse.itemHashTags = Object.values(d2lApiState.itemHashTags);

    for (const destinyVersionStr in d2lApiState.searches) {
      const destinyVersion = parseInt(destinyVersionStr, 10) as DestinyVersion;
      for (const search of d2lApiState.searches[destinyVersion]) {
        exportResponse.searches.push({
          destinyVersion,
          search,
        });
      }
    }

    return exportResponse;
  };
}

/**
 * Export the data backup as a file
 */
export function exportBackupData(data: ExportResponse) {
  download(JSON.stringify(data), 'd2l-data.json', 'application/json');
}
