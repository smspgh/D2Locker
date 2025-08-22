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
      additionalSearchTerms?: {
        term: string;
        logic: 'AND' | 'OR';
        group?: number; // Optional group number for precedence control
      }[];
    };
    keepArmor?: {
      enabled: boolean;
      additionalSearchTerms?: {
        term: string;
        logic: 'AND' | 'OR';
        group?: number; // Optional group number for precedence control
      }[];
    };
  };
  // Filter armor in vault by current character class
  vaultArmorFilterByClass?: boolean;
}

export const initialSettingsState: Settings = {
  ...defaultSettings,
  language: defaultLanguage(),
  searchFilterSettings: {
    keepWeapon: {
      enabled: true,
      additionalSearchTerms: [],
    },
    keepArmor: {
      enabled: true,
      additionalSearchTerms: [],
    },
  },
  // Default to filtering armor by current character class in vault
  vaultArmorFilterByClass: true,
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
