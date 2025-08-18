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
        // Build query respecting AND/OR logic between terms with proper grouping
        let searchQuery = '';
        const terms = searchSettings.additionalSearchTerms;
        
        if (terms.length === 1) {
          // Single term, no grouping needed
          searchQuery = terms[0].term;
        } else {
          // Group terms by their group number (default to group 0 if not specified)
          const groupedTerms = new Map<number, typeof terms>();
          terms.forEach(term => {
            const groupNum = term.group ?? 0;
            if (!groupedTerms.has(groupNum)) {
              groupedTerms.set(groupNum, []);
            }
            groupedTerms.get(groupNum)!.push(term);
          });
          
          // Build query with proper grouping
          const groupParts = [];
          for (const [groupNum, groupTerms] of groupedTerms) {
            if (groupTerms.length === 1) {
              // Single term in group, no inner parentheses needed
              groupParts.push(groupTerms[0].term);
            } else {
              // Multiple terms in group, combine with AND within the group
              const innerTerms = groupTerms.map(term => term.term).join(' and ');
              groupParts.push(`(${innerTerms})`);
            }
          }
          
          // Join groups with OR (assuming groups represent alternative conditions)
          searchQuery = groupParts.join(' or ');
        }
        
        console.log('KeepWeapon formed query:', searchQuery);
        
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
        // Build query respecting AND/OR logic between terms with proper grouping
        let searchQuery = '';
        const terms = searchSettings.additionalSearchTerms;
        
        if (terms.length === 1) {
          // Single term, no grouping needed
          searchQuery = terms[0].term;
        } else {
          // Group terms by their group number (default to group 0 if not specified)
          const groupedTerms = new Map<number, typeof terms>();
          terms.forEach(term => {
            const groupNum = term.group ?? 0;
            if (!groupedTerms.has(groupNum)) {
              groupedTerms.set(groupNum, []);
            }
            groupedTerms.get(groupNum)!.push(term);
          });
          
          // Build query with proper grouping
          const groupParts = [];
          for (const [groupNum, groupTerms] of groupedTerms) {
            if (groupTerms.length === 1) {
              // Single term in group, no inner parentheses needed
              groupParts.push(groupTerms[0].term);
            } else {
              // Multiple terms in group, combine with AND within the group
              const innerTerms = groupTerms.map(term => term.term).join(' and ');
              groupParts.push(`(${innerTerms})`);
            }
          }
          
          // Join groups with OR (assuming groups represent alternative conditions)
          searchQuery = groupParts.join(' or ');
        }
        
        console.log('KeepArmor formed query:', searchQuery);
        
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
    filter: (filterContext) => {
      const { allItems, settings, getTag, customStats, d2Definitions, stores, getNotes, newItems, loadoutsByItem, wishListsByHash, wishListFunction, language, currentStore } = filterContext;
      
      // Build the search filter for the junk query: (is:weapon or is:armor) and -(is:keepweapon or is:keeparmor or maxnonexotic:3)
      try {
        // Build the search config
        const suggestionsContext = {
          allItems,
          loadouts: [],
          d2Definitions,
          getTag,
          getNotes,
          allNotesHashtags: [],
          customStats,
        };
        
        const searchConfig = buildItemSearchConfig(2, language || 'en', suggestionsContext);
        
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
        
        // Create the junk query filter
        const junkQuery = '(is:weapon or is:armor) and -(is:keepweapon or is:keeparmor or maxnonexotic:3)';
        const junkFilter = searchFilterFactory(junkQuery);
        
        return junkFilter;
        
      } catch (error) {
        console.warn('Error building junk filter:', error);
        // Fallback: return items that are weapons or armor
        return (item: DimItem) => item.bucket?.sort === 'Weapons' || item.bucket.inArmor;
      }
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

      return (item: DimItem) => 
        // This is just a placeholder implementation
        // You can add actual keep logic here if needed
         false
      ;
    },
  },
];

export default simpleFilters;