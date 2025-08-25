import { defaultSettings, Settings as DimApiSettings } from '@destinyitemmanager/dim-api-types';
import { defaultLanguage, DimLanguage } from 'app/i18n';
import { TierType } from 'bungie-api-ts/destiny2';

export type IconQuality = 'standard' | 'highres' | 'screenshot';
export type IconQualityApplyTo = 'all' | 'weapons' | 'armor';

/**
 * We extend the settings interface so we can try out new settings before committing them to d2l-api-types
 */
export interface Settings extends DimApiSettings {
  language: DimLanguage;
  // Icon display settings
  iconQuality?: IconQuality;
  iconQualityApplyTo?: IconQualityApplyTo;
  iconQualityTiers?: TierType[];
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
  iconQuality: 'highres',
  iconQualityApplyTo: 'all',
  iconQualityTiers: [
    TierType.Basic,
    TierType.Common,
    TierType.Rare,
    TierType.Superior,
    TierType.Exotic,
  ],
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
