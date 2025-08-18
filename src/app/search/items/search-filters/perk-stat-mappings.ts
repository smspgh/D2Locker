import { StatHashes } from 'data/d2/generated-enums';

/**
 * Maps display stat names to actual Destiny 2 stat hashes
 */
export const displayStatToHashMap = {
  'Melee': StatHashes.Melee,
  'Health': StatHashes.Health,
  'Weapons': StatHashes.Weapons,
  'Grenade': StatHashes.Grenade,
  'Super': StatHashes.Super,
  'Class': StatHashes.Class,
} as const;

/**
 * Configuration for perk-based stat optimization
 * Each perk has a primary stat (first priority) and secondary stat (tie-breaker)
 */
export const perkStatMappings = {
  'Brawler': {
    primary: 'Melee',
    secondary: 'Health',
  },
  'Gunner': {
    primary: 'Weapons',
    secondary: 'Grenade',
  },
  'Specialist': {
    primary: 'Class',
    secondary: 'Weapons',
  },
  'Grenadier': {
    primary: 'Grenade',
    secondary: 'Super',
  },
  'Paragon': {
    primary: 'Super',
    secondary: 'Melee',
  },
  'Bulwark': {
    primary: 'Health',
    secondary: 'Class',
  },
} as const;

export type PerkName = keyof typeof perkStatMappings;
export type DisplayStatName = keyof typeof displayStatToHashMap;

/**
 * Gets the stat hashes for a given perk's primary and secondary stats
 */
export function getPerkStatHashes(perkName: PerkName): { primary: number; secondary: number } {
  const mapping = perkStatMappings[perkName];
  return {
    primary: displayStatToHashMap[mapping.primary],
    secondary: displayStatToHashMap[mapping.secondary],
  };
}

/**
 * Gets the display names for a given perk's primary and secondary stats
 */
export function getPerkStatNames(perkName: PerkName): { primary: DisplayStatName; secondary: DisplayStatName } {
  return perkStatMappings[perkName];
}

/**
 * Checks if a given string is a valid perk name
 */
export function isValidPerkName(perkName: string): perkName is PerkName {
  return perkName in perkStatMappings;
}