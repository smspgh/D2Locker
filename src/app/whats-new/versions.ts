/** Information about the user's relationship with D2L versions */
class Versions {
  readonly currentVersion = cleanVersion($D2L_VERSION)!;
  previousVersion = cleanVersion(localStorage.getItem('d2l-changelog-viewed-version'));

  versionIsNew(version: string) {
    if (version === 'Next') {
      return false;
    }
    if (this.previousVersion) {
      return compareVersions(version, this.previousVersion) > 0;
    } else {
      return false;
    }
  }

  // TODO: It'd be nice to also check whether the changelog has any entries between versions...
  // TODO: it'd be good to store this in settings, so you sync the last version you've seen
}

// Clean out Beta versions to ignore their build number.
function cleanVersion(version: string | null) {
  if (version) {
    return version.split('.').slice(0, 3).join('.');
  }
  return version;
}

function splitVersion(version: string): number[] {
  return version.split('.').map((s) => parseInt(s, 10));
}

function compareVersions(version1: string, version2: string) {
  const v1 = splitVersion(version1);
  const v2 = splitVersion(version2);

  for (let i = 0; i < 3; i++) {
    if ((v1[i] || 0) > (v2[i] || 0)) {
      return 1;
    } else if ((v1[i] || 0) < (v2[i] || 0)) {
      return -1;
    }
  }

  return 0;
}

export const DimVersions = new Versions();
