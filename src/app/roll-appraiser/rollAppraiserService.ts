import { RollAppraiserData, RollAppraiserUtils } from 'app/utils/rollAppraiserUtils';

let rollAppraiserUtils: RollAppraiserUtils | null = null;
let loadingPromise: Promise<RollAppraiserUtils> | null = null;

/**
 * Load roll appraiser data from the processed light file
 */
async function loadRollAppraiserData(): Promise<RollAppraiserUtils> {
  if (rollAppraiserUtils) {
    return rollAppraiserUtils;
  }

  if (loadingPromise) {
    return loadingPromise;
  }

  loadingPromise = (async () => {
    try {
      // Load the processed light data
      const response = await fetch('/backend/light/rollAppraiserData.json');
      if (!response.ok) {
        throw new Error(`Failed to load roll appraiser data: ${response.statusText}`);
      }

      const data = (await response.json()) as RollAppraiserData;
      rollAppraiserUtils = new RollAppraiserUtils(data);

      console.log('Roll appraiser data loaded successfully');
      return rollAppraiserUtils;
    } catch (error) {
      console.warn('Failed to load roll appraiser data:', error);
      // Create empty utils if loading fails
      rollAppraiserUtils = new RollAppraiserUtils({
        PerkStats: {},
        TraitStats: {},
        MWStats: {},
        ReviewSummary: {},
      });
      return rollAppraiserUtils;
    } finally {
      loadingPromise = null;
    }
  })();

  return loadingPromise;
}

/**
 * Get the roll appraiser utils instance (load if not already loaded)
 */
export async function getRollAppraiserUtils(): Promise<RollAppraiserUtils> {
  return loadRollAppraiserData();
}

/**
 * Get the roll appraiser utils instance if already loaded (synchronous)
 */
export function getRollAppraiserUtilsSync(): RollAppraiserUtils | null {
  return rollAppraiserUtils;
}

/**
 * Check if roll appraiser data is loaded
 */
export function isRollAppraiserDataLoaded(): boolean {
  return rollAppraiserUtils !== null;
}

/**
 * Preload roll appraiser data
 */
export function preloadRollAppraiserData(): Promise<RollAppraiserUtils> {
  return loadRollAppraiserData();
}
