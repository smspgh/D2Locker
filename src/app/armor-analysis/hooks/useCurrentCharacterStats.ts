import { useSelector } from 'react-redux';
import { currentStoreSelector, storesSelector } from 'app/inventory/selectors';
import { StatHashes } from 'data/d2/generated-enums';
import { DimStore } from 'app/inventory/store-types';

/**
 * Hook to get the current character's armor stat values
 * Maps D2L's stat system to Armor 3.0 stat names
 */
export function useCurrentCharacterStats(): { [statId: string]: number } {
  const currentStore = useSelector(currentStoreSelector);
  
  // If no character is loaded, return minimal values (not 50 defaults)
  if (!currentStore?.stats) {
    return {
      health: 0,
      melee: 0,
      grenade: 0,
      super: 0,
      class: 0,
      weapon: 0
    };
  }

  // Map D2L StatHashes to our Armor 3.0 stat names
  const statMapping = {
    health: StatHashes.Health,
    melee: StatHashes.Melee,
    grenade: StatHashes.Grenade,
    super: StatHashes.Super,
    class: StatHashes.Class,
    weapon: StatHashes.Weapons
  };

  const currentStats: { [statId: string]: number } = {};

  // Extract the actual stat values from the character
  for (const [statId, statHash] of Object.entries(statMapping)) {
    const d2lStat = currentStore.stats[statHash];
    // Use the actual stat value, or fallback to 0 if not found
    currentStats[statId] = d2lStat?.value || 0;
  }

  return currentStats;
}

/**
 * Hook to get all available characters (excluding vault)
 */
export function useAvailableCharacters(): DimStore[] {
  const stores = useSelector(storesSelector);
  return stores.filter(store => !store.isVault);
}

/**
 * Hook to get stats for a specific character by ID
 */
export function useCharacterStats(characterId?: string): { [statId: string]: number } {
  const stores = useSelector(storesSelector);
  const currentStore = useSelector(currentStoreSelector);
  
  // If no specific character ID provided, use current character
  const targetStore = characterId 
    ? stores.find(store => store.id === characterId && !store.isVault)
    : currentStore;
  
  // If no character is available, return zeros
  if (!targetStore?.stats) {
    return {
      health: 0,
      melee: 0,
      grenade: 0,
      super: 0,
      class: 0,
      weapon: 0
    };
  }

  // Map D2L StatHashes to our Armor 3.0 stat names
  const statMapping = {
    health: StatHashes.Health,
    melee: StatHashes.Melee,
    grenade: StatHashes.Grenade,
    super: StatHashes.Super,
    class: StatHashes.Class,
    weapon: StatHashes.Weapons
  };

  const stats: { [statId: string]: number } = {};

  // Extract the actual stat values from the character
  for (const [statId, statHash] of Object.entries(statMapping)) {
    const d2lStat = targetStore.stats[statHash];
    stats[statId] = d2lStat?.value || 0;
  }

  return stats;
}

/**
 * Hook to get character information for display
 */
export function useCurrentCharacterInfo() {
  const currentStore = useSelector(currentStoreSelector);
  const stores = useSelector(storesSelector);
  
  // If we don't have a current store but have stores loaded, show the first character
  const displayStore = currentStore || stores.find(store => !store.isVault);
  
  // Better fallback logic - if we don't have any character loaded, show loading state
  if (!displayStore) {
    return {
      characterName: 'Loading...',
      className: '',
      backgroundImage: undefined,
      emblemPath: undefined,
      lightLevel: 0,
      characterId: undefined
    };
  }
  
  return {
    characterName: displayStore.name || `${displayStore.className || 'Guardian'}`,
    className: displayStore.className || 'Guardian',
    backgroundImage: displayStore.background,
    emblemPath: displayStore.icon,
    lightLevel: displayStore.powerLevel || 0,
    characterId: displayStore.id
  };
}

/**
 * Hook to get character info by ID
 */
export function useCharacterInfo(characterId?: string) {
  const stores = useSelector(storesSelector);
  const currentStore = useSelector(currentStoreSelector);
  
  const targetStore = characterId 
    ? stores.find(store => store.id === characterId && !store.isVault)
    : currentStore;
    
  if (!targetStore) {
    return {
      characterName: 'Unknown',
      className: '',
      backgroundImage: undefined,
      emblemPath: undefined,
      lightLevel: 0,
      characterId: undefined
    };
  }
  
  return {
    characterName: targetStore.name || `${targetStore.className || 'Guardian'}`,
    className: targetStore.className || 'Guardian',
    backgroundImage: targetStore.background,
    emblemPath: targetStore.icon,
    lightLevel: targetStore.powerLevel || 0,
    characterId: targetStore.id
  };
}