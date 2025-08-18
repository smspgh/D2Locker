import { settingsSelector } from 'app/d2l-api/selectors';
import { createSelector } from 'reselect';
import { initialSettingsState } from './initial-settings';

export const searchFilterSettingsSelector = createSelector(
  settingsSelector,
  (settings) => settings.searchFilterSettings || initialSettingsState.searchFilterSettings,
);

export const keepWeaponSettingsSelector = createSelector(
  searchFilterSettingsSelector,
  (searchSettings) =>
    searchSettings?.keepWeapon || initialSettingsState.searchFilterSettings?.keepWeapon,
);

export const keepArmorSettingsSelector = createSelector(
  searchFilterSettingsSelector,
  (searchSettings) =>
    searchSettings?.keepArmor || initialSettingsState.searchFilterSettings?.keepArmor,
);
