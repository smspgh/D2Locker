import { errorLog, infoLog } from './log';

const TAG = 'VERSION_CACHE';
const VERSION_KEY = 'app-version';
const LAST_CACHE_CLEAR_KEY = 'last-cache-clear';

/**
 * Manages cache clearing when the app version changes.
 * This ensures users get fresh data after updates.
 */
export class VersionCacheManager {
  private currentVersion: string;

  constructor(version: string) {
    this.currentVersion = version;
  }

  /**
   * Check if this is a new version and clear caches if needed
   */
  async checkAndClearIfNeeded(): Promise<boolean> {
    try {
      const storedVersion = localStorage.getItem(VERSION_KEY);

      if (!storedVersion) {
        // First time or no version stored - just save current version
        localStorage.setItem(VERSION_KEY, this.currentVersion);
        infoLog(TAG, 'First app load, storing version:', this.currentVersion);
        return false;
      }

      if (storedVersion !== this.currentVersion) {
        infoLog(
          TAG,
          `Version changed from ${storedVersion} to ${this.currentVersion} - clearing caches`,
        );
        await this.clearAllCaches();
        localStorage.setItem(VERSION_KEY, this.currentVersion);
        localStorage.setItem(LAST_CACHE_CLEAR_KEY, Date.now().toString());
        return true;
      }

      return false;
    } catch (error) {
      errorLog(TAG, 'Error checking version:', error);
      return false;
    }
  }

  /**
   * Force clear all caches and storage
   */
  static async clearAllCaches(): Promise<void> {
    try {
      // 1. Clear browser caches
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames.map((cacheName) => {
            infoLog(TAG, 'Clearing cache:', cacheName);
            return caches.delete(cacheName);
          }),
        );
      }

      // 2. Clear localStorage (except essential items)
      VersionCacheManager.clearLocalStorage();

      // 3. Clear sessionStorage
      try {
        sessionStorage.clear();
        infoLog(TAG, 'Cleared sessionStorage');
      } catch (e) {
        errorLog(TAG, 'Failed to clear sessionStorage:', e);
      }

      // 4. Clear IndexedDB (D2L's offline data)
      await VersionCacheManager.clearIndexedDB();

      infoLog(TAG, 'All caches cleared successfully');
    } catch (error) {
      errorLog(TAG, 'Error clearing caches:', error);
      throw error;
    }
  }

  /**
   * Clear localStorage but preserve essential items
   */
  private static clearLocalStorage(): void {
    try {
      // Items to preserve during cache clear
      const preserveKeys = [
        VERSION_KEY,
        LAST_CACHE_CLEAR_KEY,
        'authorizationState', // OAuth state
        'd2l-api-enabled', // D2LSync setting
        'settings', // User preferences
        'language', // Language preference
      ];

      const keysToRemove: string[] = [];

      // Collect keys to remove
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && !preserveKeys.includes(key)) {
          keysToRemove.push(key);
        }
      }

      // Remove non-essential keys
      for (const key of keysToRemove) {
        localStorage.removeItem(key);
      }

      infoLog(
        TAG,
        `Cleared ${keysToRemove.length} localStorage items, preserved ${preserveKeys.length} essential items`,
      );
    } catch (error) {
      errorLog(TAG, 'Error clearing localStorage:', error);
    }
  }

  /**
   * Clear IndexedDB databases
   */
  private static async clearIndexedDB(): Promise<void> {
    try {
      if ('indexedDB' in window) {
        // D2L typically uses 'keyval-store' and potentially others
        const dbsToDelete = ['keyval-store', 'D2L', 'd2l-data'];

        return await Promise.all(
          dbsToDelete.map(async (dbName) => {
            try {
              // Check if database exists first
              const deleteReq = indexedDB.deleteDatabase(dbName);
              return await new Promise<void>((resolve) => {
                deleteReq.onsuccess = () => {
                  infoLog(TAG, `Cleared IndexedDB: ${dbName}`);
                  resolve();
                };
                deleteReq.onerror = () => resolve(); // Don't fail if DB doesn't exist
                deleteReq.onblocked = () => {
                  errorLog(TAG, `IndexedDB delete blocked for: ${dbName}`);
                  resolve(); // Continue anyway
                };
              });
            } catch {
              // Database might not exist, that's ok
              return Promise.resolve();
            }
          }),
        );
      }
    } catch (error) {
      errorLog(TAG, 'Error clearing IndexedDB:', error);
    }
  }

  /**
   * Get when caches were last cleared
   */
  static getLastCacheClear(): Date | null {
    try {
      const timestamp = localStorage.getItem(LAST_CACHE_CLEAR_KEY);
      return timestamp ? new Date(parseInt(timestamp, 10)) : null;
    } catch {
      return null;
    }
  }
}

// Export singleton instance
export const versionCacheManager = new VersionCacheManager($D2L_VERSION);
