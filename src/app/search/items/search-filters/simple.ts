import { tl } from 'app/i18next-t';
import { BucketHashes } from 'data/d2/generated-enums';
import { ItemFilterDefinition } from '../item-filter-types';
import { DimItem } from 'app/inventory/item-types';
import { initialSettingsState } from 'app/settings/initial-settings';
import { computeDupes, sortDupesBest, computeArmorDupesByClassTypeTier, makeArmorClassTypeTierDupeID, makeDupeID } from './dupes';
import { gatherHighestStats, checkIfStatMatchesMaxValue } from './stats';
import { getRollAppraiserUtilsSync } from 'app/roll-appraiser/rollAppraiserService';
import { getSocketsByType } from 'app/utils/socket-utils';
import { parseQuery } from 'app/search/query-parser';
import { makeSearchFilterFactory } from 'app/search/search-filter';
import { buildItemSearchConfig } from '../item-search-filter';
import { TOTAL_STAT_HASH } from 'app/search/d2-known-values';

// simple checks against check an attribute found on DimItem
const simpleFilters: ItemFilterDefinition[] = [
  {
    keywords: 'armor2.0',
    description: tl('Filter.Energy'),
    destinyVersion: 2,
    filter: () => (item) => Boolean(item.energy) && item.bucket.inArmor,
  },
  {
    keywords: 'weapon',
    description: tl('Filter.Weapon'),
    filter: () => (item) =>
      item.bucket?.sort === 'Weapons' &&
      item.bucket.hash !== BucketHashes.SeasonalArtifact &&
      item.bucket.hash !== BucketHashes.Subclass,
  },
  {
    keywords: 'armor',
    description: tl('Filter.Armor'),
    filter: () => (item) => item.bucket?.sort === 'Armor',
  },
  {
    keywords: ['equipment', 'equippable'],
    description: tl('Filter.Equipment'),
    filter: () => (item) => item.equipment,
  },
  {
    keywords: ['postmaster', 'inpostmaster'],
    description: tl('Filter.Postmaster'),
    filter: () => (item) => item.location?.inPostmaster,
  },
  {
    keywords: 'equipped',
    description: tl('Filter.Equipped'),
    filter: () => (item) => item.equipped,
  },
  {
    keywords: ['transferable', 'movable'],
    description: tl('Filter.Transferable'),
    filter: () => (item) => !item.notransfer,
  },
  {
    keywords: 'stackable',
    description: tl('Filter.Stackable'),
    filter: () => (item) => item.maxStackSize > 1,
  },
  {
    keywords: 'stackfull',
    description: tl('Filter.StackFull'),
    filter: () => (item) => item.maxStackSize > 1 && item.amount === item.maxStackSize,
  },
  {
    keywords: ['infusable', 'infuse'],
    description: tl('Filter.Infusable'),
    filter: () => (item) => item.infusable,
  },
  {
    keywords: 'locked',
    description: tl('Filter.Locked'),
    filter: () => (item) => item.locked,
  },
  {
    keywords: 'unlocked',
    description: tl('Filter.Locked'),
    filter: () => (item) => !item.locked,
  },
  {
    keywords: 'new',
    description: tl('Filter.NewItems'),
    filter:
      ({ newItems }) =>
      (item) =>
        newItems.has(item.id),
  },
  {
    keywords: 'sunset',
    destinyVersion: 2,
    description: tl('Filter.Deprecated'),
    deprecated: true,
    filter: () => () => false,
  },
  {
    keywords: ['crafted', 'shaped'],
    destinyVersion: 2,
    description: tl('Filter.IsCrafted'),
    filter: () => (item) => item.crafted === 'crafted',
  },
  {
    keywords: ['vendor'],
    destinyVersion: 2,
    description: tl('Filter.VendorItem'),
    filter: () => (item) => Boolean(item.vendor),
  },
  {
    keywords: 'ininventory',
    description: tl('Filter.InInventory'),
    filter: ({ allItems }) => {
      const ownedHashes = new Set(allItems.map((item) => item.hash));
      return (item) => ownedHashes.has(item.hash);
    },
  },
  {
    keywords: 'featured',
    description: tl('Filter.Featured'),
    destinyVersion: 2,
    filter: () => (item) => item.featured,
  },
  {
    keywords: 'keepweapon',
    description: tl('Filter.KeepWeapon'),
    destinyVersion: 2,
    filter: ({ allItems, getTag, customStats, settings }) => {
      const searchSettings = settings?.searchFilterSettings?.keepWeapon || initialSettingsState.searchFilterSettings?.keepWeapon;
      
      // If the filter is disabled, return false for all items
      if (!searchSettings?.enabled) {
        return () => false;
      }
      // Pre-compute dupebest for weapons
      const weaponItems = allItems.filter(item => item.bucket?.sort === 'Weapons');
      const weaponDupes = computeDupes(weaponItems);
      const weaponDupesSorted = sortDupesBest(weaponDupes, getTag, customStats);

      // Pre-compute maxpowertier:legendary:4 for weapons by equipping slot (Kinetic/Energy/Power)
      const legendaryWeaponsBySlot: Record<string, DimItem[]> = {};
      for (const item of weaponItems) {
        if (item.rarity === 'Legendary' && Boolean(item.power)) {
          // Only consider Kinetic, Energy, and Power weapons
          if (item.bucket.hash === BucketHashes.KineticWeapons || 
              item.bucket.hash === BucketHashes.EnergyWeapons || 
              item.bucket.hash === BucketHashes.PowerWeapons) {
            const key = `${item.bucket.hash}`;
            if (!legendaryWeaponsBySlot[key]) {
              legendaryWeaponsBySlot[key] = [];
            }
            legendaryWeaponsBySlot[key].push(item);
          }
        }
      }

      // Sort each slot by power
      const sortedLegendaryWeaponSlots: Record<string, DimItem[]> = {};
      for (const [key, items] of Object.entries(legendaryWeaponsBySlot)) {
        sortedLegendaryWeaponSlots[key] = items.sort((a, b) => b.power - a.power);
      }

      const baseFilter = (item: DimItem) => {
        // Only apply to weapons
        if (item.bucket?.sort !== 'Weapons') {
          return false;
        }

        // is:crafted is:weapon
        if (searchSettings?.includeCrafted && item.crafted === 'crafted') {
          return true;
        }

        // is:dupebest is:weapon (includes best exotic)
        if (searchSettings?.includeDupeBest) {
          const dupeId = makeDupeID(item);
          const dupes = weaponDupesSorted[dupeId];
          if (dupes?.length > 1) {
            const bestDupe = dupes[0];
            if (item === bestDupe) {
              return true;
            }
          }
        }
        
        // Keep exotics - if no dupes, keep it; if dupes exist, the dupebest logic above handles it
        if (searchSettings?.includeExotics && item.isExotic) {
          const dupeId = makeDupeID(item);
          const dupes = weaponDupesSorted[dupeId];
          if (dupes?.length === 1) {
            return true;
          }
        }

        // comborank:<=threshold
        if (searchSettings?.comboRankEnabled && item.sockets) {
          const utils = getRollAppraiserUtilsSync();
          if (utils) {
            const traitPerks = getSocketsByType(item, 'traits');
            if (traitPerks.length >= 2) {
              // Check all available perk combinations, not just currently equipped
              const perkToEnhanced = require('data/d2/trait-to-enhanced-trait.json');
              const column3Perks: number[] = [];
              const column4Perks: number[] = [];
              
              // Get all available perks for trait column 1
              if (traitPerks[0]) {
                traitPerks[0].plugOptions?.forEach(plug => {
                  column3Perks.push(plug.plugDef.hash);
                  const enhancedHash = perkToEnhanced[plug.plugDef.hash.toString()];
                  if (enhancedHash) {
                    column3Perks.push(parseInt(enhancedHash));
                  }
                });
                if (traitPerks[0].plugged && !column3Perks.includes(traitPerks[0].plugged.plugDef.hash)) {
                  column3Perks.push(traitPerks[0].plugged.plugDef.hash);
                }
              }
              
              // Get all available perks for trait column 2
              if (traitPerks[1]) {
                traitPerks[1].plugOptions?.forEach(plug => {
                  column4Perks.push(plug.plugDef.hash);
                  const enhancedHash = perkToEnhanced[plug.plugDef.hash.toString()];
                  if (enhancedHash) {
                    column4Perks.push(parseInt(enhancedHash));
                  }
                });
                if (traitPerks[1].plugged && !column4Perks.includes(traitPerks[1].plugged.plugDef.hash)) {
                  column4Perks.push(traitPerks[1].plugged.plugDef.hash);
                }
              }
              
              // Check all combinations to find the best (lowest) combo rank
              let bestRank = Infinity;
              for (const perk3 of column3Perks) {
                for (const perk4 of column4Perks) {
                  const comboRank = utils.getTraitComboRank(item.hash.toString(), perk3.toString(), perk4.toString());
                  if (comboRank && comboRank.rank < bestRank) {
                    bestRank = comboRank.rank;
                  }
                }
              }
              
              if (bestRank <= (searchSettings.comboRankThreshold || 3)) {
                return true;
              }
            }
          }
        }

        // maxpowertier:legendary:N
        if (searchSettings?.maxPowerEnabled && item.rarity === 'Legendary' && Boolean(item.power)) {
          const bucketKey = `${item.bucket.hash}`;
          const sortedItems = sortedLegendaryWeaponSlots[bucketKey];
          if (sortedItems && sortedItems.length > 0) {
            const rank = sortedItems.findIndex((i) => i.id === item.id) + 1;
            if (rank > 0 && rank <= (searchSettings.maxPowerCount || 4)) {
              return true;
            }
          }
        }

        return false;
      };
      
      // If there are additional search terms, create a wrapper filter
      if (searchSettings?.additionalSearchTerms && searchSettings.additionalSearchTerms.length > 0) {
        return (item: DimItem) => {
          const baseResult = baseFilter(item);
          
          // For additional search terms, we need to implement actual search logic
          // For now, implement basic matching for "is:power" and other common terms
          const additionalResults = searchSettings.additionalSearchTerms.map(termObj => {
            const searchTerm = termObj.term.toLowerCase().trim();
            let termMatch = false;
            
            // Handle specific search terms
            if (searchTerm === 'is:power') {
              // Match items with power > 0 (items that contribute to power level)
              termMatch = item.power > 0;
            } else if (searchTerm.startsWith('is:')) {
              // Handle other "is:" filters by checking item properties
              const filterType = searchTerm.substring(3);
              switch (filterType) {
                case 'weapon':
                  termMatch = item.bucket?.sort === 'Weapons';
                  break;
                case 'armor':
                  termMatch = item.bucket?.sort === 'Armor';
                  break;
                case 'kinetic':
                  termMatch = item.bucket.hash === BucketHashes.KineticWeapons;
                  break;
                case 'energy':
                  termMatch = item.bucket.hash === BucketHashes.EnergyWeapons;
                  break;
                case 'heavy':
                  termMatch = item.bucket.hash === BucketHashes.PowerWeapons;
                  break;
                case 'exotic':
                  termMatch = item.isExotic;
                  break;
                case 'legendary':
                  termMatch = item.rarity === 'Legendary';
                  break;
                case 'masterwork':
                  termMatch = item.masterwork;
                  break;
                case 'crafted':
                  termMatch = item.crafted === 'crafted';
                  break;
                default:
                  // Fallback to name/type matching
                  termMatch = item.name.toLowerCase().includes(filterType) ||
                             item.typeName.toLowerCase().includes(filterType);
                  break;
              }
            } else if (searchTerm.startsWith('tag:')) {
              // Handle tag filters (would need getTag function for full implementation)
              const tagName = searchTerm.substring(4);
              termMatch = item.name.toLowerCase().includes(tagName); // Basic fallback
            } else {
              // Default name/type matching
              termMatch = item.name.toLowerCase().includes(searchTerm) ||
                         item.typeName.toLowerCase().includes(searchTerm);
            }
            
            return { match: termMatch, logic: termObj.logic };
          });
          
          // Combine base result with additional terms
          let finalResult = baseResult;
          
          for (const { match, logic } of additionalResults) {
            if (logic === 'AND') {
              finalResult = finalResult && match;
            } else { // OR
              finalResult = finalResult || match;
            }
          }
          
          return finalResult;
        };
      }
      
      return baseFilter;
    },
  },
  {
    keywords: 'keeparmor',
    description: tl('Filter.KeepArmor'),
    destinyVersion: 2,
    filter: ({ allItems, getTag, customStats, settings }) => {
      const searchSettings = settings?.searchFilterSettings?.keepArmor || initialSettingsState.searchFilterSettings?.keepArmor;
      
      // If the filter is disabled, return false for all items
      if (!searchSettings?.enabled) {
        return () => false;
      }
      // Pre-compute bestarmor for all classes
      const armorItems = allItems.filter(item => item.bucket.inArmor);
      const armorDupes = computeArmorDupesByClassTypeTier(armorItems);
      const armorDupesSorted = sortDupesBest(armorDupes, getTag, customStats);

      // Pre-compute maxbasestatvalue:total for each class
      const highestStatsPerSlotPerTier = gatherHighestStats(allItems);

      // Pre-compute maxpowertier:legendary:4 for armor
      const legendaryArmorBySlotClass: Record<string, DimItem[]> = {};
      for (const item of armorItems) {
        if (item.rarity === 'Legendary' && Boolean(item.power)) {
          const key = `${item.bucket.hash}-${item.classType}`;
          if (!legendaryArmorBySlotClass[key]) {
            legendaryArmorBySlotClass[key] = [];
          }
          legendaryArmorBySlotClass[key].push(item);
        }
      }

      // Sort each slot/class combo by power
      const sortedLegendaryArmorSlots: Record<string, DimItem[]> = {};
      for (const [key, items] of Object.entries(legendaryArmorBySlotClass)) {
        sortedLegendaryArmorSlots[key] = items.sort((a, b) => b.power - a.power);
      }

      const baseFilter = (item: DimItem) => {
        // Only apply to armor
        if (!item.bucket.inArmor) {
          return false;
        }

        // For each class, check both maxbasestatvalue:total and is:bestarmor
        const classTypes = [0, 1, 2]; // Titan, Hunter, Warlock

        for (const classType of classTypes) {
          if (item.classType === classType) {
            // maxbasestatvalue:total for this class
            if (searchSettings?.includeMaxStatTotal && checkIfStatMatchesMaxValue(highestStatsPerSlotPerTier, item, 'total', true)) {
              return true;
            }

            // is:bestarmor for this class
            if (searchSettings?.includeBestArmor) {
              const dupeId = makeArmorClassTypeTierDupeID(item);
              const dupes = armorDupesSorted[dupeId];
              if (dupes && dupes.length >= 1) {
                const bestDupe = dupes[0];
                if (item === bestDupe) {
                  return true;
                }
              }
            }
          }
        }

        // maxpowertier:legendary:N for armor
        if (searchSettings?.maxPowerEnabled && item.rarity === 'Legendary' && Boolean(item.power)) {
          const bucketKey = `${item.bucket.hash}-${item.classType}`;
          const sortedItems = sortedLegendaryArmorSlots[bucketKey];
          if (sortedItems && sortedItems.length > 0) {
            const rank = sortedItems.findIndex((i) => i.id === item.id) + 1;
            if (rank > 0 && rank <= (searchSettings.maxPowerCount || 4)) {
              return true;
            }
          }
        }

        return false;
      };
      
      // If there are additional search terms, create a wrapper filter
      if (searchSettings?.additionalSearchTerms && searchSettings.additionalSearchTerms.length > 0) {
        return (item: DimItem) => {
          const baseResult = baseFilter(item);
          
          // For additional search terms, we need to implement actual search logic
          // For now, implement basic matching for "is:power" and other common terms
          const additionalResults = searchSettings.additionalSearchTerms.map(termObj => {
            const searchTerm = termObj.term.toLowerCase().trim();
            let termMatch = false;
            
            // Handle specific search terms
            if (searchTerm === 'is:power') {
              // Match items with power > 0 (items that contribute to power level)
              termMatch = item.power > 0;
            } else if (searchTerm.startsWith('is:')) {
              // Handle other "is:" filters by checking item properties
              const filterType = searchTerm.substring(3);
              switch (filterType) {
                case 'weapon':
                  termMatch = item.bucket?.sort === 'Weapons';
                  break;
                case 'armor':
                  termMatch = item.bucket?.sort === 'Armor';
                  break;
                case 'kinetic':
                  termMatch = item.bucket.hash === BucketHashes.KineticWeapons;
                  break;
                case 'energy':
                  termMatch = item.bucket.hash === BucketHashes.EnergyWeapons;
                  break;
                case 'heavy':
                  termMatch = item.bucket.hash === BucketHashes.PowerWeapons;
                  break;
                case 'exotic':
                  termMatch = item.isExotic;
                  break;
                case 'legendary':
                  termMatch = item.rarity === 'Legendary';
                  break;
                case 'masterwork':
                  termMatch = item.masterwork;
                  break;
                case 'crafted':
                  termMatch = item.crafted === 'crafted';
                  break;
                default:
                  // Fallback to name/type matching
                  termMatch = item.name.toLowerCase().includes(filterType) ||
                             item.typeName.toLowerCase().includes(filterType);
                  break;
              }
            } else if (searchTerm.startsWith('tag:')) {
              // Handle tag filters (would need getTag function for full implementation)
              const tagName = searchTerm.substring(4);
              termMatch = item.name.toLowerCase().includes(tagName); // Basic fallback
            } else {
              // Default name/type matching
              termMatch = item.name.toLowerCase().includes(searchTerm) ||
                         item.typeName.toLowerCase().includes(searchTerm);
            }
            
            return { match: termMatch, logic: termObj.logic };
          });
          
          // Combine base result with additional terms
          let finalResult = baseResult;
          
          for (const { match, logic } of additionalResults) {
            if (logic === 'AND') {
              finalResult = finalResult && match;
            } else { // OR
              finalResult = finalResult || match;
            }
          }
          
          return finalResult;
        };
      }
      
      return baseFilter;
    },
  },
  {
    keywords: 'junk',
    description: tl('Filter.Junk'),
    destinyVersion: 2,
    filter: ({ allItems, getTag, customStats, settings }) => {
      // Shared function to get all keep reasons for an item
      const getKeepReasons = (
        item: DimItem,
        weaponDupesSorted: Record<string, DimItem[]>,
        armorDupesSorted: Record<string, DimItem[]>,
        sortedLegendaryWeaponSlots: Record<string, DimItem[]>,
        sortedRareWeaponSlots: Record<string, DimItem[]>,
        sortedLegendaryArmorSlots: Record<string, DimItem[]>,
        sortedRareArmorSlots: Record<string, DimItem[]>
      ): string[] => {
        const reasons: string[] = [];
        
        // 1. is:crafted
        if (item.crafted === 'crafted') {
          reasons.push('crafted');
        }

        // 2. (is:weapon is:legendary comborank:<=3)
        if (item.bucket?.sort === 'Weapons' && item.rarity === 'Legendary' && item.sockets) {
          const utils = getRollAppraiserUtilsSync();
          if (utils) {
            const traitPerks = getSocketsByType(item, 'traits');
            if (traitPerks.length >= 2) {
              const perkToEnhanced = require('data/d2/trait-to-enhanced-trait.json');
              const column3Perks: number[] = [];
              const column4Perks: number[] = [];
              
              if (traitPerks[0]) {
                traitPerks[0].plugOptions?.forEach(plug => {
                  column3Perks.push(plug.plugDef.hash);
                  const enhancedHash = perkToEnhanced[plug.plugDef.hash.toString()];
                  if (enhancedHash) column3Perks.push(parseInt(enhancedHash));
                });
                if (traitPerks[0].plugged && !column3Perks.includes(traitPerks[0].plugged.plugDef.hash)) {
                  column3Perks.push(traitPerks[0].plugged.plugDef.hash);
                }
              }
              
              if (traitPerks[1]) {
                traitPerks[1].plugOptions?.forEach(plug => {
                  column4Perks.push(plug.plugDef.hash);
                  const enhancedHash = perkToEnhanced[plug.plugDef.hash.toString()];
                  if (enhancedHash) column4Perks.push(parseInt(enhancedHash));
                });
                if (traitPerks[1].plugged && !column4Perks.includes(traitPerks[1].plugged.plugDef.hash)) {
                  column4Perks.push(traitPerks[1].plugged.plugDef.hash);
                }
              }
              
              let bestRank = Infinity;
              for (const perk3 of column3Perks) {
                for (const perk4 of column4Perks) {
                  const comboRank = utils.getTraitComboRank(item.hash.toString(), perk3.toString(), perk4.toString());
                  if (comboRank && comboRank.rank < bestRank) {
                    bestRank = comboRank.rank;
                  }
                }
              }
              if (bestRank <= 3) {
                reasons.push(`combo rank ${bestRank}`);
              }
            }
          }
        }
        
        // 3. (is:weapon is:exotic -is:dupelower)
        if (item.bucket?.sort === 'Weapons' && item.isExotic) {
          const dupeId = makeDupeID(item);
          const dupes = weaponDupesSorted[dupeId];
          if (!dupes || dupes.length <= 1 || item === dupes[0]) {
            reasons.push('exotic (best duplicate)');
          }
        }
        
        // 4. is:bestarmor
        if (item.bucket.inArmor) {
          const dupeId = makeArmorClassTypeTierDupeID(item);
          const dupes = armorDupesSorted[dupeId];
          if (dupes && dupes.length >= 1 && item === dupes[0]) {
            reasons.push('best armor');
          }
        }

        // 5. maxpowertier:legendary:3 for weapons
        if (item.bucket?.sort === 'Weapons' && item.rarity === 'Legendary' && Boolean(item.power)) {
          const bucketKey = `${item.bucket.hash}`;
          const sortedItems = sortedLegendaryWeaponSlots[bucketKey];
          if (sortedItems && sortedItems.length > 0) {
            const rank = sortedItems.findIndex((i) => i.id === item.id) + 1;
            if (rank > 0 && rank <= 3) {
              reasons.push(`legendary weapon power tier ${rank}`);
            }
          }
        }

        // 6. maxpowertier:legendary:3 for armor (each class)
        if (item.bucket.inArmor && item.rarity === 'Legendary' && Boolean(item.power)) {
          const bucketKey = `${item.bucket.hash}-${item.classType}`;
          const sortedItems = sortedLegendaryArmorSlots[bucketKey];
          if (sortedItems && sortedItems.length > 0) {
            const rank = sortedItems.findIndex((i) => i.id === item.id) + 1;
            if (rank > 0 && rank <= 3) {
              reasons.push(`legendary armor power tier ${rank}`);
            }
          }
        }

        // 7. maxpowertier:rare:3 for weapons
        if (item.bucket?.sort === 'Weapons' && item.rarity === 'Rare' && Boolean(item.power)) {
          const bucketKey = `${item.bucket.hash}`;
          const sortedItems = sortedRareWeaponSlots[bucketKey];
          if (sortedItems && sortedItems.length > 0) {
            const rank = sortedItems.findIndex((i) => i.id === item.id) + 1;
            if (rank > 0 && rank <= 3) {
              reasons.push(`rare weapon power tier ${rank}`);
            }
          }
        }

        // 8. maxpowertier:rare:3 for armor (each class)
        if (item.bucket.inArmor && item.rarity === 'Rare' && Boolean(item.power)) {
          const bucketKey = `${item.bucket.hash}-${item.classType}`;
          const sortedItems = sortedRareArmorSlots[bucketKey];
          if (sortedItems && sortedItems.length > 0) {
            const rank = sortedItems.findIndex((i) => i.id === item.id) + 1;
            if (rank > 0 && rank <= 3) {
              reasons.push(`rare armor power tier ${rank}`);
            }
          }
        }

        return reasons;
      };
      
      // Pre-compute dupebest for weapons
      const weaponItems = allItems.filter(item => item.bucket?.sort === 'Weapons');
      const weaponDupes = computeDupes(weaponItems);
      const weaponDupesSorted = sortDupesBest(weaponDupes, getTag, customStats);

      // Pre-compute bestarmor for all classes
      const armorItems = allItems.filter(item => item.bucket.inArmor);
      const armorDupes = computeArmorDupesByClassTypeTier(armorItems);
      const armorDupesSorted = sortDupesBest(armorDupes, getTag, customStats);

      // Pre-compute maxpowertier for weapons and armor by class
      const legendaryWeaponsBySlot: Record<string, DimItem[]> = {};
      const rareWeaponsBySlot: Record<string, DimItem[]> = {};
      const legendaryArmorBySlotClass: Record<string, DimItem[]> = {};
      const rareArmorBySlotClass: Record<string, DimItem[]> = {};

      // Helper function to check if an item would be kept for non-power reasons
      const wouldBeKeptForOtherReasons = (item: DimItem): boolean => {
        // 1. is:crafted
        if (item.crafted === 'crafted') return true;
        
        // 2. (is:weapon is:legendary comborank:<=3)
        if (item.bucket?.sort === 'Weapons' && item.rarity === 'Legendary' && item.sockets) {
          const utils = getRollAppraiserUtilsSync();
          if (utils) {
            const traitPerks = getSocketsByType(item, 'traits');
            if (traitPerks.length >= 2) {
              const perkToEnhanced = require('data/d2/trait-to-enhanced-trait.json');
              const column3Perks: number[] = [];
              const column4Perks: number[] = [];
              
              if (traitPerks[0]) {
                traitPerks[0].plugOptions?.forEach(plug => {
                  column3Perks.push(plug.plugDef.hash);
                  const enhancedHash = perkToEnhanced[plug.plugDef.hash.toString()];
                  if (enhancedHash) column3Perks.push(parseInt(enhancedHash));
                });
                if (traitPerks[0].plugged && !column3Perks.includes(traitPerks[0].plugged.plugDef.hash)) {
                  column3Perks.push(traitPerks[0].plugged.plugDef.hash);
                }
              }
              
              if (traitPerks[1]) {
                traitPerks[1].plugOptions?.forEach(plug => {
                  column4Perks.push(plug.plugDef.hash);
                  const enhancedHash = perkToEnhanced[plug.plugDef.hash.toString()];
                  if (enhancedHash) column4Perks.push(parseInt(enhancedHash));
                });
                if (traitPerks[1].plugged && !column4Perks.includes(traitPerks[1].plugged.plugDef.hash)) {
                  column4Perks.push(traitPerks[1].plugged.plugDef.hash);
                }
              }
              
              let bestRank = Infinity;
              for (const perk3 of column3Perks) {
                for (const perk4 of column4Perks) {
                  const comboRank = utils.getTraitComboRank(item.hash.toString(), perk3.toString(), perk4.toString());
                  if (comboRank && comboRank.rank < bestRank) {
                    bestRank = comboRank.rank;
                  }
                }
              }
              if (bestRank <= 3) return true;
            }
          }
        }
        
        // 3. (is:weapon is:exotic -is:dupelower)
        if (item.bucket?.sort === 'Weapons' && item.isExotic) {
          const dupeId = makeDupeID(item);
          const dupes = weaponDupesSorted[dupeId];
          if (!dupes || dupes.length <= 1 || item === dupes[0]) return true;
        }
        
        // 4. is:bestarmor
        if (item.bucket.inArmor) {
          const dupeId = makeArmorClassTypeTierDupeID(item);
          const dupes = armorDupesSorted[dupeId];
          if (dupes && dupes.length >= 1 && item === dupes[0]) return true;
        }
        
        return false;
      };

      // Group weapons by equipping slot (excluding items kept for other reasons)
      for (const item of weaponItems) {
        if (Boolean(item.power) && !wouldBeKeptForOtherReasons(item)) {
          if (item.bucket.hash === BucketHashes.KineticWeapons || 
              item.bucket.hash === BucketHashes.EnergyWeapons || 
              item.bucket.hash === BucketHashes.PowerWeapons) {
            const key = `${item.bucket.hash}`;
            
            if (item.rarity === 'Legendary') {
              if (!legendaryWeaponsBySlot[key]) {
                legendaryWeaponsBySlot[key] = [];
              }
              legendaryWeaponsBySlot[key].push(item);
            } else if (item.rarity === 'Rare') {
              if (!rareWeaponsBySlot[key]) {
                rareWeaponsBySlot[key] = [];
              }
              rareWeaponsBySlot[key].push(item);
            }
          }
        }
      }

      // Group armor by slot and class (excluding items kept for other reasons)
      for (const item of armorItems) {
        if (Boolean(item.power) && !wouldBeKeptForOtherReasons(item)) {
          const key = `${item.bucket.hash}-${item.classType}`;
          
          if (item.rarity === 'Legendary') {
            if (!legendaryArmorBySlotClass[key]) {
              legendaryArmorBySlotClass[key] = [];
            }
            legendaryArmorBySlotClass[key].push(item);
          }
          
          if (item.rarity === 'Rare') {
            if (!rareArmorBySlotClass[key]) {
              rareArmorBySlotClass[key] = [];
            }
            rareArmorBySlotClass[key].push(item);
          }
        }
      }

      // Sort by power level
      const sortedLegendaryWeaponSlots: Record<string, DimItem[]> = {};
      for (const [key, items] of Object.entries(legendaryWeaponsBySlot)) {
        sortedLegendaryWeaponSlots[key] = items.sort((a, b) => b.power - a.power);
      }

      const sortedRareWeaponSlots: Record<string, DimItem[]> = {};
      for (const [key, items] of Object.entries(rareWeaponsBySlot)) {
        sortedRareWeaponSlots[key] = items.sort((a, b) => b.power - a.power);
      }

      const sortedLegendaryArmorSlots: Record<string, DimItem[]> = {};
      for (const [key, items] of Object.entries(legendaryArmorBySlotClass)) {
        sortedLegendaryArmorSlots[key] = items.sort((a, b) => b.power - a.power);
      }

      const sortedRareArmorSlots: Record<string, DimItem[]> = {};
      for (const [key, items] of Object.entries(rareArmorBySlotClass)) {
        sortedRareArmorSlots[key] = items.sort((a, b) => b.power - a.power);
      }

      return (item: DimItem) => {
        // Only apply to weapons and armor
        if (item.bucket?.sort !== 'Weapons' && !item.bucket.inArmor) {
          return false;
        }

        // Check if item should be kept (if any of these are true, it's NOT junk)
        let shouldKeep = false;
        const keepReasons: string[] = [];

        // 1. is:crafted
        if (item.crafted === 'crafted') {
          shouldKeep = true;
          keepReasons.push('crafted');
        }

        // 2. (is:weapon is:legendary comborank:<=3)
        if (item.bucket?.sort === 'Weapons' && item.rarity === 'Legendary' && item.sockets) {
          const utils = getRollAppraiserUtilsSync();
          if (utils) {
            const traitPerks = getSocketsByType(item, 'traits');
            if (traitPerks.length >= 2) {
              // Check all available perk combinations, not just currently equipped
              const perkToEnhanced = require('data/d2/trait-to-enhanced-trait.json');
              const column3Perks: number[] = [];
              const column4Perks: number[] = [];
              
              // Get all available perks for trait column 1
              if (traitPerks[0]) {
                traitPerks[0].plugOptions?.forEach(plug => {
                  column3Perks.push(plug.plugDef.hash);
                  const enhancedHash = perkToEnhanced[plug.plugDef.hash.toString()];
                  if (enhancedHash) {
                    column3Perks.push(parseInt(enhancedHash));
                  }
                });
                if (traitPerks[0].plugged && !column3Perks.includes(traitPerks[0].plugged.plugDef.hash)) {
                  column3Perks.push(traitPerks[0].plugged.plugDef.hash);
                }
              }
              
              // Get all available perks for trait column 2
              if (traitPerks[1]) {
                traitPerks[1].plugOptions?.forEach(plug => {
                  column4Perks.push(plug.plugDef.hash);
                  const enhancedHash = perkToEnhanced[plug.plugDef.hash.toString()];
                  if (enhancedHash) {
                    column4Perks.push(parseInt(enhancedHash));
                  }
                });
                if (traitPerks[1].plugged && !column4Perks.includes(traitPerks[1].plugged.plugDef.hash)) {
                  column4Perks.push(traitPerks[1].plugged.plugDef.hash);
                }
              }
              
              // Check all combinations to find the best (lowest) combo rank
              let bestRank = Infinity;
              for (const perk3 of column3Perks) {
                for (const perk4 of column4Perks) {
                  const comboRank = utils.getTraitComboRank(item.hash.toString(), perk3.toString(), perk4.toString());
                  if (comboRank && comboRank.rank < bestRank) {
                    bestRank = comboRank.rank;
                  }
                }
              }
              
              if (bestRank <= 3) {
                shouldKeep = true;
                keepReasons.push(`combo rank ${bestRank}`);
              }
            }
          }
        }

        // 3. (is:weapon is:exotic -is:dupelower)
        if (item.bucket?.sort === 'Weapons' && item.isExotic) {
          const dupeId = makeDupeID(item);
          const dupes = weaponDupesSorted[dupeId];
          if (!dupes || dupes.length <= 1 || item === dupes[0]) {
            // Not a lower duplicate (either no dupes, or is the best duplicate)
            shouldKeep = true;
            keepReasons.push('exotic (best duplicate)');
          }
        }

        // 4. is:bestarmor
        if (item.bucket.inArmor) {
          const dupeId = makeArmorClassTypeTierDupeID(item);
          const dupes = armorDupesSorted[dupeId];
          if (dupes && dupes.length >= 1 && item === dupes[0]) {
            shouldKeep = true;
            keepReasons.push('best armor');
          }
        }

        // 5. maxpowertier:legendary:3 for weapons
        if (item.bucket?.sort === 'Weapons' && item.rarity === 'Legendary' && Boolean(item.power)) {
          const bucketKey = `${item.bucket.hash}`;
          const sortedItems = sortedLegendaryWeaponSlots[bucketKey];
          if (sortedItems && sortedItems.length > 0) {
            const rank = sortedItems.findIndex((i) => i.id === item.id) + 1;
            if (rank > 0 && rank <= 3) {
              shouldKeep = true;
              keepReasons.push(`legendary weapon power tier ${rank}`);
            }
          }
        }

        // 6. maxpowertier:legendary:3 for armor (each class)
        if (item.bucket.inArmor && item.rarity === 'Legendary' && Boolean(item.power)) {
          const bucketKey = `${item.bucket.hash}-${item.classType}`;
          const sortedItems = sortedLegendaryArmorSlots[bucketKey];
          if (sortedItems && sortedItems.length > 0) {
            const rank = sortedItems.findIndex((i) => i.id === item.id) + 1;
            if (rank > 0 && rank <= 3) {
              shouldKeep = true;
              keepReasons.push(`legendary armor power tier ${rank}`);
            }
          }
        }

        // 7. maxpowertier:rare:3 for weapons
        if (item.bucket?.sort === 'Weapons' && item.rarity === 'Rare' && Boolean(item.power)) {
          const bucketKey = `${item.bucket.hash}`;
          const sortedItems = sortedRareWeaponSlots[bucketKey];
          if (sortedItems && sortedItems.length > 0) {
            const rank = sortedItems.findIndex((i) => i.id === item.id) + 1;
            if (rank > 0 && rank <= 3) {
              shouldKeep = true;
              keepReasons.push(`rare weapon power tier ${rank}`);
            }
          }
        }

        // 8. maxpowertier:rare:3 for armor (each class)
        if (item.bucket.inArmor && item.rarity === 'Rare' && Boolean(item.power)) {
          const bucketKey = `${item.bucket.hash}-${item.classType}`;
          const sortedItems = sortedRareArmorSlots[bucketKey];
          if (sortedItems && sortedItems.length > 0) {
            const rank = sortedItems.findIndex((i) => i.id === item.id) + 1;
            if (rank > 0 && rank <= 3) {
              shouldKeep = true;
              keepReasons.push(`rare armor power tier ${rank}`);
            }
          }
        }

        // Log keep reasons for debugging
        // if (shouldKeep && keepReasons.length > 0) {
        //   console.log(`KEEP: ${item.name} (${keepReasons.join(', ')})`);
        // }

        // Return the inverse - if we should keep it, it's not junk
        return !shouldKeep;
      };
    },
  },
  {
    keywords: 'keep',
    description: tl('Filter.Keep'),
    destinyVersion: 2,
    filter: ({ allItems, getTag, customStats }) => {
      // Pre-compute dupebest for weapons
      const weaponItems = allItems.filter(item => item.bucket?.sort === 'Weapons');
      const weaponDupes = computeDupes(weaponItems);
      const weaponDupesSorted = sortDupesBest(weaponDupes, getTag, customStats);

      // Pre-compute bestarmor for all classes
      const armorItems = allItems.filter(item => item.bucket.inArmor);
      const armorDupes = computeArmorDupesByClassTypeTier(armorItems);
      const armorDupesSorted = sortDupesBest(armorDupes, getTag, customStats);

      // Pre-compute maxpowertier for weapons and armor by class
      const legendaryWeaponsBySlot: Record<string, DimItem[]> = {};
      const rareWeaponsBySlot: Record<string, DimItem[]> = {};
      const legendaryArmorBySlotClass: Record<string, DimItem[]> = {};
      const rareArmorBySlotClass: Record<string, DimItem[]> = {};

      // Helper function to check if an item would be kept for non-power reasons
      const wouldBeKeptForOtherReasons = (item: DimItem): boolean => {
        // 1. is:crafted
        if (item.crafted === 'crafted') return true;
        
        // 2. (is:weapon is:legendary comborank:<=3)
        if (item.bucket?.sort === 'Weapons' && item.rarity === 'Legendary' && item.sockets) {
          const utils = getRollAppraiserUtilsSync();
          if (utils) {
            const traitPerks = getSocketsByType(item, 'traits');
            if (traitPerks.length >= 2) {
              const perkToEnhanced = require('data/d2/trait-to-enhanced-trait.json');
              const column3Perks: number[] = [];
              const column4Perks: number[] = [];
              
              if (traitPerks[0]) {
                traitPerks[0].plugOptions?.forEach(plug => {
                  column3Perks.push(plug.plugDef.hash);
                  const enhancedHash = perkToEnhanced[plug.plugDef.hash.toString()];
                  if (enhancedHash) column3Perks.push(parseInt(enhancedHash));
                });
                if (traitPerks[0].plugged && !column3Perks.includes(traitPerks[0].plugged.plugDef.hash)) {
                  column3Perks.push(traitPerks[0].plugged.plugDef.hash);
                }
              }
              
              if (traitPerks[1]) {
                traitPerks[1].plugOptions?.forEach(plug => {
                  column4Perks.push(plug.plugDef.hash);
                  const enhancedHash = perkToEnhanced[plug.plugDef.hash.toString()];
                  if (enhancedHash) column4Perks.push(parseInt(enhancedHash));
                });
                if (traitPerks[1].plugged && !column4Perks.includes(traitPerks[1].plugged.plugDef.hash)) {
                  column4Perks.push(traitPerks[1].plugged.plugDef.hash);
                }
              }
              
              let bestRank = Infinity;
              for (const perk3 of column3Perks) {
                for (const perk4 of column4Perks) {
                  const comboRank = utils.getTraitComboRank(item.hash.toString(), perk3.toString(), perk4.toString());
                  if (comboRank && comboRank.rank < bestRank) {
                    bestRank = comboRank.rank;
                  }
                }
              }
              if (bestRank <= 3) return true;
            }
          }
        }
        
        // 3. (is:weapon is:exotic -is:dupelower)
        if (item.bucket?.sort === 'Weapons' && item.isExotic) {
          const dupeId = makeDupeID(item);
          const dupes = weaponDupesSorted[dupeId];
          if (!dupes || dupes.length <= 1 || item === dupes[0]) return true;
        }
        
        // 4. is:bestarmor
        if (item.bucket.inArmor) {
          const dupeId = makeArmorClassTypeTierDupeID(item);
          const dupes = armorDupesSorted[dupeId];
          if (dupes && dupes.length >= 1 && item === dupes[0]) return true;
        }
        
        return false;
      };

      // Group weapons by equipping slot (excluding items kept for other reasons)
      for (const item of weaponItems) {
        if (Boolean(item.power) && !wouldBeKeptForOtherReasons(item)) {
          if (item.bucket.hash === BucketHashes.KineticWeapons || 
              item.bucket.hash === BucketHashes.EnergyWeapons || 
              item.bucket.hash === BucketHashes.PowerWeapons) {
            const key = `${item.bucket.hash}`;
            
            if (item.rarity === 'Legendary') {
              if (!legendaryWeaponsBySlot[key]) {
                legendaryWeaponsBySlot[key] = [];
              }
              legendaryWeaponsBySlot[key].push(item);
            } else if (item.rarity === 'Rare') {
              if (!rareWeaponsBySlot[key]) {
                rareWeaponsBySlot[key] = [];
              }
              rareWeaponsBySlot[key].push(item);
            }
          }
        }
      }

      // Group armor by slot and class (excluding items kept for other reasons)
      for (const item of armorItems) {
        if (Boolean(item.power) && !wouldBeKeptForOtherReasons(item)) {
          const key = `${item.bucket.hash}-${item.classType}`;
          
          if (item.rarity === 'Legendary') {
            if (!legendaryArmorBySlotClass[key]) {
              legendaryArmorBySlotClass[key] = [];
            }
            legendaryArmorBySlotClass[key].push(item);
          }
          
          if (item.rarity === 'Rare') {
            if (!rareArmorBySlotClass[key]) {
              rareArmorBySlotClass[key] = [];
            }
            rareArmorBySlotClass[key].push(item);
          }
        }
      }

      // Sort by power level
      const sortedLegendaryWeaponSlots: Record<string, DimItem[]> = {};
      for (const [key, items] of Object.entries(legendaryWeaponsBySlot)) {
        sortedLegendaryWeaponSlots[key] = items.sort((a, b) => b.power - a.power);
      }

      const sortedRareWeaponSlots: Record<string, DimItem[]> = {};
      for (const [key, items] of Object.entries(rareWeaponsBySlot)) {
        sortedRareWeaponSlots[key] = items.sort((a, b) => b.power - a.power);
      }

      const sortedLegendaryArmorSlots: Record<string, DimItem[]> = {};
      for (const [key, items] of Object.entries(legendaryArmorBySlotClass)) {
        sortedLegendaryArmorSlots[key] = items.sort((a, b) => b.power - a.power);
      }

      const sortedRareArmorSlots: Record<string, DimItem[]> = {};
      for (const [key, items] of Object.entries(rareArmorBySlotClass)) {
        sortedRareArmorSlots[key] = items.sort((a, b) => b.power - a.power);
      }

      return (item: DimItem) => {
        // Only apply to weapons and armor
        if (item.bucket?.sort !== 'Weapons' && !item.bucket.inArmor) {
          return false;
        }

        // Check if item should be kept (this is the SAME logic as junk but returns shouldKeep instead of !shouldKeep)
        let shouldKeep = false;
        const keepReasons: string[] = [];

        // 1. is:crafted
        if (item.crafted === 'crafted') {
          shouldKeep = true;
          keepReasons.push('crafted');
        }

        // 2. (is:weapon is:legendary comborank:<=3)
        if (item.bucket?.sort === 'Weapons' && item.rarity === 'Legendary' && item.sockets) {
          const utils = getRollAppraiserUtilsSync();
          if (utils) {
            const traitPerks = getSocketsByType(item, 'traits');
            if (traitPerks.length >= 2) {
              // Check all available perk combinations, not just currently equipped
              const perkToEnhanced = require('data/d2/trait-to-enhanced-trait.json');
              const column3Perks: number[] = [];
              const column4Perks: number[] = [];
              
              // Get all available perks for trait column 1
              if (traitPerks[0]) {
                traitPerks[0].plugOptions?.forEach(plug => {
                  column3Perks.push(plug.plugDef.hash);
                  const enhancedHash = perkToEnhanced[plug.plugDef.hash.toString()];
                  if (enhancedHash) {
                    column3Perks.push(parseInt(enhancedHash));
                  }
                });
                if (traitPerks[0].plugged && !column3Perks.includes(traitPerks[0].plugged.plugDef.hash)) {
                  column3Perks.push(traitPerks[0].plugged.plugDef.hash);
                }
              }
              
              // Get all available perks for trait column 2
              if (traitPerks[1]) {
                traitPerks[1].plugOptions?.forEach(plug => {
                  column4Perks.push(plug.plugDef.hash);
                  const enhancedHash = perkToEnhanced[plug.plugDef.hash.toString()];
                  if (enhancedHash) {
                    column4Perks.push(parseInt(enhancedHash));
                  }
                });
                if (traitPerks[1].plugged && !column4Perks.includes(traitPerks[1].plugged.plugDef.hash)) {
                  column4Perks.push(traitPerks[1].plugged.plugDef.hash);
                }
              }
              
              // Check all combinations to find the best (lowest) combo rank
              let bestRank = Infinity;
              for (const perk3 of column3Perks) {
                for (const perk4 of column4Perks) {
                  const comboRank = utils.getTraitComboRank(item.hash.toString(), perk3.toString(), perk4.toString());
                  if (comboRank && comboRank.rank < bestRank) {
                    bestRank = comboRank.rank;
                  }
                }
              }
              
              if (bestRank <= 3) {
                shouldKeep = true;
                keepReasons.push(`combo rank ${bestRank}`);
              }
            }
          }
        }

        // 3. (is:weapon is:exotic -is:dupelower)
        if (item.bucket?.sort === 'Weapons' && item.isExotic) {
          const dupeId = makeDupeID(item);
          const dupes = weaponDupesSorted[dupeId];
          if (!dupes || dupes.length <= 1 || item === dupes[0]) {
            // Not a lower duplicate (either no dupes, or is the best duplicate)
            shouldKeep = true;
            keepReasons.push('exotic (best duplicate)');
          }
        }

        // 4. is:bestarmor
        if (item.bucket.inArmor) {
          const dupeId = makeArmorClassTypeTierDupeID(item);
          const dupes = armorDupesSorted[dupeId];
          if (dupes && dupes.length >= 1 && item === dupes[0]) {
            shouldKeep = true;
            keepReasons.push('best armor');
          }
        }

        // 5. maxpowertier:legendary:3 for weapons
        if (item.bucket?.sort === 'Weapons' && item.rarity === 'Legendary' && Boolean(item.power)) {
          const bucketKey = `${item.bucket.hash}`;
          const sortedItems = sortedLegendaryWeaponSlots[bucketKey];
          if (sortedItems && sortedItems.length > 0) {
            const rank = sortedItems.findIndex((i) => i.id === item.id) + 1;
            if (rank > 0 && rank <= 3) {
              shouldKeep = true;
              keepReasons.push(`legendary weapon power tier ${rank}`);
            }
          }
        }

        // 6. maxpowertier:legendary:3 for armor (each class)
        if (item.bucket.inArmor && item.rarity === 'Legendary' && Boolean(item.power)) {
          const bucketKey = `${item.bucket.hash}-${item.classType}`;
          const sortedItems = sortedLegendaryArmorSlots[bucketKey];
          if (sortedItems && sortedItems.length > 0) {
            const rank = sortedItems.findIndex((i) => i.id === item.id) + 1;
            if (rank > 0 && rank <= 3) {
              shouldKeep = true;
              keepReasons.push(`legendary armor power tier ${rank}`);
            }
          }
        }

        // 7. maxpowertier:rare:3 for weapons
        if (item.bucket?.sort === 'Weapons' && item.rarity === 'Rare' && Boolean(item.power)) {
          const bucketKey = `${item.bucket.hash}`;
          const sortedItems = sortedRareWeaponSlots[bucketKey];
          if (sortedItems && sortedItems.length > 0) {
            const rank = sortedItems.findIndex((i) => i.id === item.id) + 1;
            if (rank > 0 && rank <= 3) {
              shouldKeep = true;
              keepReasons.push(`rare weapon power tier ${rank}`);
            }
          }
        }

        // 8. maxpowertier:rare:3 for armor (each class)
        if (item.bucket.inArmor && item.rarity === 'Rare' && Boolean(item.power)) {
          const bucketKey = `${item.bucket.hash}-${item.classType}`;
          const sortedItems = sortedRareArmorSlots[bucketKey];
          if (sortedItems && sortedItems.length > 0) {
            const rank = sortedItems.findIndex((i) => i.id === item.id) + 1;
            if (rank > 0 && rank <= 3) {
              shouldKeep = true;
              keepReasons.push(`rare armor power tier ${rank}`);
            }
          }
        }

        // Log keep reasons for debugging
        // if (shouldKeep && keepReasons.length > 0) {
        //   console.log(`KEEP: ${item.name} (${keepReasons.join(', ')})`);
        // }

        // Return shouldKeep (opposite of junk filter)
        return shouldKeep;
      };
    },
  },
];

export default simpleFilters;
