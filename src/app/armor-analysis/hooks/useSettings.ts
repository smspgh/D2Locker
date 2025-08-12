import { DestinyAccount } from 'app/accounts/destiny-account';
import { useCallback, useEffect, useState } from 'react';
import { ArmorAnalysisSettings } from '../types/armor-types';

const DEFAULT_SETTINGS: ArmorAnalysisSettings = {
  chartOptions: {
    showOnlyChangedRange: false,
    startValue: 0,
    endValue: 200,
    showDifferences: false,
    showPlateau: true,
    compareMode: false,
    selectedStats: []
  },
  filterOptions: {
    categories: [],
    searchQuery: '',
    showPercentagesOnly: false,
    showAbsoluteOnly: false,
    minValue: 0,
    maxValue: 200
  },
  viewMode: 'expanded',
  savedPresets: []
};

const STORAGE_KEY = 'armor-analysis-settings';

export default function useSettings(_account?: DestinyAccount) {
  const [settings, setSettings] = useState<ArmorAnalysisSettings>(DEFAULT_SETTINGS);

  // Load settings from localStorage on mount
  useEffect(() => {
    const storedSettings = localStorage.getItem(STORAGE_KEY);
    if (storedSettings) {
      try {
        const parsed = JSON.parse(storedSettings);
        setSettings({ ...DEFAULT_SETTINGS, ...parsed });
      } catch (e) {
        console.error('Error parsing armor analysis settings:', e);
        setSettings(DEFAULT_SETTINGS);
      }
    }
  }, []);

  // Save settings to localStorage
  const updateSettings = useCallback((newSettings: ArmorAnalysisSettings) => {
    setSettings(newSettings);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings));
    } catch (e) {
      console.error('Error saving armor analysis settings:', e);
    }
  }, []);

  return { settings, updateSettings };
}
