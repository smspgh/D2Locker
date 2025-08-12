import { defaultSettings, Settings as DimApiSettings } from '@destinyitemmanager/dim-api-types';
import { defaultLanguage, DimLanguage } from 'app/i18n';

/**
 * We extend the settings interface so we can try out new settings before committing them to d2l-api-types
 */
export interface Settings extends DimApiSettings {
  language: DimLanguage;
  // Search filter settings
  searchFilterSettings?: {
    keepWeapon?: {
      enabled: boolean;
      includeCrafted: boolean;
      includeDupeBest: boolean;
      includeExotics: boolean;
      comboRankEnabled: boolean;
      comboRankThreshold: number;
      maxPowerEnabled: boolean;
      maxPowerCount: number;
      additionalSearchTerms?: Array<{
        term: string;
        logic: 'AND' | 'OR';
      }>;
    };
    keepArmor?: {
      enabled: boolean;
      includeMaxStatTotal: boolean;
      includeBestArmor: boolean;
      maxPowerEnabled: boolean;
      maxPowerCount: number;
      additionalSearchTerms?: Array<{
        term: string;
        logic: 'AND' | 'OR';
      }>;
    };
  };
}

export const initialSettingsState: Settings = {
  ...defaultSettings,
  language: defaultLanguage(),
  searchFilterSettings: {
    keepWeapon: {
      enabled: true,
      includeCrafted: true,
      includeDupeBest: true,
      includeExotics: true,
      comboRankEnabled: true,
      comboRankThreshold: 3,
      maxPowerEnabled: true,
      maxPowerCount: 4,
      additionalSearchTerms: [],
    },
    keepArmor: {
      enabled: true,
      includeMaxStatTotal: true,
      includeBestArmor: true,
      maxPowerEnabled: true,
      maxPowerCount: 4,
      additionalSearchTerms: [],
    },
  },
  organizerColumnsWeapons: [
    'icon',
    'name',
    'dmg',
    'power',
    'tag',
    'wishList',
    'archetype',
    'perks',
    'traits',
    'originTrait',
    'notes',
  ],
  organizerColumnsArmor: [
    'icon',
    'name',
    'power',
    'energy',
    'tag',
    'modslot',
    'intrinsics',
    'perks',
    'baseStats',
    'customstat',
    'notes',
  ],
  organizerColumnsGhost: ['icon', 'name', 'tag', 'perks', 'notes'],
};
