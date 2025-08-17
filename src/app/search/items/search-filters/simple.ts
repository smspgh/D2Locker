import { tl } from 'app/i18next-t';
import { BucketHashes } from 'data/d2/generated-enums';
import { ItemFilterDefinition } from '../item-filter-types';
import { DimItem } from 'app/inventory/item-types';
import { initialSettingsState } from 'app/settings/initial-settings';
import { computeDupes, sortDupesBest, computeArmorDupesByClassTypeTier, makeArmorClassTypeTierDupeID, makeDupeID } from './dupes';
import { getRollAppraiserUtilsSync } from 'app/roll-appraiser/rollAppraiserService';
import { getSocketsByType } from 'app/utils/socket-utils';
import { makeSearchFilterFactory } from 'app/search/search-filter';
import { buildItemSearchConfig } from '../item-search-filter';

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
    filter: (filterContext) => {
      const { settings, allItems, getTag, customStats, d2Definitions, stores, getNotes, newItems, loadoutsByItem, wishListsByHash, wishListFunction, language, currentStore } = filterContext;
      const searchSettings = settings?.searchFilterSettings?.keepWeapon || initialSettingsState.searchFilterSettings?.keepWeapon;
      
      // If the filter is disabled, return false for all items
      if (!searchSettings?.enabled) {
        return () => false;
      }

      // Baseline filter that returns false (nothing kept by default)
      const baseFilter = (item: DimItem) => {
        // Only apply to weapons
        if (item.bucket?.sort !== 'Weapons') {
          return false;
        }
        // Default baseline: keep nothing
        return false;
      };
      
      // If there are additional search terms, use them to determine what to keep
      if (searchSettings?.additionalSearchTerms && searchSettings.additionalSearchTerms.length > 0) {
        // Build query respecting AND/OR logic between terms
        let searchQuery = '';
        for (let i = 0; i < searchSettings.additionalSearchTerms.length; i++) {
          const termObj = searchSettings.additionalSearchTerms[i];
          if (i === 0) {
            // First term doesn't need a logical operator
            searchQuery = termObj.term;
          } else {
            // Add logical operator before subsequent terms
            const operator = termObj.logic === 'OR' ? ' or ' : ' ';
            searchQuery += `${operator}${termObj.term}`;
          }
        }
        
        try {
          // Build the search config with the same context as the main search
          const suggestionsContext = {
            allItems,
            loadouts: [], // We don't have loadouts in this context
            d2Definitions,
            getTag,
            getNotes,
            allNotesHashtags: [], // We don't need hashtags for this internal search
            customStats,
          };
          const searchConfig = buildItemSearchConfig(2, language || 'en', suggestionsContext);
          
          // Create search filter factory with proper config structure  
          const searchFilterFactory = makeSearchFilterFactory(searchConfig, {
            stores,
            allItems,
            currentStore,
            loadoutsByItem,
            wishListFunction,
            wishListsByHash,
            newItems,
            getTag,
            getNotes,
            language,
            customStats,
            d2Definitions,
            settings,
          });
          const searchFilter = searchFilterFactory(searchQuery);
          
          return (item: DimItem) => {
            // Only apply to weapons
            if (item.bucket?.sort !== 'Weapons') {
              return false;
            }
            // Apply the user-defined search terms
            return searchFilter(item);
          };
        } catch (error) {
          console.warn('Error parsing keepweapon search terms:', error, 'Query was:', searchQuery);
          return baseFilter;
        }
      }
      
      return baseFilter;
    },
  },
  {
    keywords: 'keeparmor',
    description: tl('Filter.KeepArmor'),
    destinyVersion: 2,
    filter: (filterContext) => {
      const { settings, allItems, getTag, customStats, d2Definitions, stores, getNotes, newItems, loadoutsByItem, wishListsByHash, wishListFunction, language, currentStore } = filterContext;
      const searchSettings = settings?.searchFilterSettings?.keepArmor || initialSettingsState.searchFilterSettings?.keepArmor;
      
      // If the filter is disabled, return false for all items
      if (!searchSettings?.enabled) {
        return () => false;
      }

      // Baseline filter that returns false (nothing kept by default)
      const baseFilter = (item: DimItem) => {
        // Only apply to armor
        if (!item.bucket.inArmor) {
          return false;
        }
        // Default baseline: keep nothing
        return false;
      };
      
      // If there are additional search terms, use them to determine what to keep
      if (searchSettings?.additionalSearchTerms && searchSettings.additionalSearchTerms.length > 0) {
        // Build query respecting AND/OR logic between terms
        let searchQuery = '';
        for (let i = 0; i < searchSettings.additionalSearchTerms.length; i++) {
          const termObj = searchSettings.additionalSearchTerms[i];
          if (i === 0) {
            // First term doesn't need a logical operator
            searchQuery = termObj.term;
          } else {
            // Add logical operator before subsequent terms
            const operator = termObj.logic === 'OR' ? ' or ' : ' ';
            searchQuery += `${operator}${termObj.term}`;
          }
        }
        
        try {
          // Build the search config with the same context as the main search
          const suggestionsContext = {
            allItems,
            loadouts: [], // We don't have loadouts in this context
            d2Definitions,
            getTag,
            getNotes,
            allNotesHashtags: [], // We don't need hashtags for this internal search
            customStats,
          };
          const searchConfig = buildItemSearchConfig(2, language || 'en', suggestionsContext);
          
          // Create search filter factory with proper config structure  
          const searchFilterFactory = makeSearchFilterFactory(searchConfig, {
            stores,
            allItems,
            currentStore,
            loadoutsByItem,
            wishListFunction,
            wishListsByHash,
            newItems,
            getTag,
            getNotes,
            language,
            customStats,
            d2Definitions,
            settings,
          });
          const searchFilter = searchFilterFactory(searchQuery);
          
          return (item: DimItem) => {
            // Only apply to armor
            if (!item.bucket.inArmor) {
              return false;
            }
            // Apply the user-defined search terms
            return searchFilter(item);
          };
        } catch (error) {
          console.warn('Error parsing keeparmor search terms:', error, 'Query was:', searchQuery);
          return baseFilter;
        }
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
                  if (enhancedHash) {column3Perks.push(parseInt(enhancedHash));}
                });
                if (traitPerks[0].plugged && !column3Perks.includes(traitPerks[0].plugged.plugDef.hash)) {
                  column3Perks.push(traitPerks[0].plugged.plugDef.hash);
                }
              }
              
              if (traitPerks[1]) {
                traitPerks[1].plugOptions?.forEach(plug => {
                  column4Perks.push(plug.plugDef.hash);
                  const enhancedHash = perkToEnhanced[plug.plugDef.hash.toString()];
                  if (enhancedHash) {column4Perks.push(parseInt(enhancedHash));}
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
        if (item.crafted === 'crafted') {return true;}
        
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
                  if (enhancedHash) {column3Perks.push(parseInt(enhancedHash));}
                });
                if (traitPerks[0].plugged && !column3Perks.includes(traitPerks[0].plugged.plugDef.hash)) {
                  column3Perks.push(traitPerks[0].plugged.plugDef.hash);
                }
              }
              
              if (traitPerks[1]) {
                traitPerks[1].plugOptions?.forEach(plug => {
                  column4Perks.push(plug.plugDef.hash);
                  const enhancedHash = perkToEnhanced[plug.plugDef.hash.toString()];
                  if (enhancedHash) {column4Perks.push(parseInt(enhancedHash));}
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
              if (bestRank <= 3) {return true;}
            }
          }
        }
        
        // 3. (is:weapon is:exotic -is:dupelower)
        if (item.bucket?.sort === 'Weapons' && item.isExotic) {
          const dupeId = makeDupeID(item);
          const dupes = weaponDupesSorted[dupeId];
          if (!dupes || dupes.length <= 1 || item === dupes[0]) {return true;}
        }
        
        // 4. is:bestarmor
        if (item.bucket.inArmor) {
          const dupeId = makeArmorClassTypeTierDupeID(item);
          const dupes = armorDupesSorted[dupeId];
          if (dupes && dupes.length >= 1 && item === dupes[0]) {return true;}
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
        if (item.crafted === 'crafted') {return true;}
        
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
                  if (enhancedHash) {column3Perks.push(parseInt(enhancedHash));}
                });
                if (traitPerks[0].plugged && !column3Perks.includes(traitPerks[0].plugged.plugDef.hash)) {
                  column3Perks.push(traitPerks[0].plugged.plugDef.hash);
                }
              }
              
              if (traitPerks[1]) {
                traitPerks[1].plugOptions?.forEach(plug => {
                  column4Perks.push(plug.plugDef.hash);
                  const enhancedHash = perkToEnhanced[plug.plugDef.hash.toString()];
                  if (enhancedHash) {column4Perks.push(parseInt(enhancedHash));}
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
              if (bestRank <= 3) {return true;}
            }
          }
        }
        
        // 3. (is:weapon is:exotic -is:dupelower)
        if (item.bucket?.sort === 'Weapons' && item.isExotic) {
          const dupeId = makeDupeID(item);
          const dupes = weaponDupesSorted[dupeId];
          if (!dupes || dupes.length <= 1 || item === dupes[0]) {return true;}
        }
        
        // 4. is:bestarmor
        if (item.bucket.inArmor) {
          const dupeId = makeArmorClassTypeTierDupeID(item);
          const dupes = armorDupesSorted[dupeId];
          if (dupes && dupes.length >= 1 && item === dupes[0]) {return true;}
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
