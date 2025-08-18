import { CustomStatDef } from '@destinyitemmanager/dim-api-types';
import { tl } from 'app/i18next-t';
import { DimItem, DimStat } from 'app/inventory/item-types';
import { DimStore } from 'app/inventory/store-types';
import { maxLightItemSet, maxStatLoadout } from 'app/loadout-drawer/auto-loadouts';
import { makeSearchFilterFactory } from 'app/search/search-filter';
import {
  allAtomicStats,
  armorAnyStatHashes,
  armorStatHashes,
  d2lArmorStatHashByName,
  est,
  estStatNames,
  searchableArmorStatNames,
  statHashByName,
  weaponStatNames,
} from 'app/search/search-filter-values';
import { generateGroupedSuggestionsForFilter } from 'app/search/suggestions-generation';
import { matchText } from 'app/search/text-utils';
import { mapValues, maxOf, sumBy } from 'app/utils/collections';
import { getStatValuesByHash, isClassCompatible } from 'app/utils/item-utils';
import { DestinyClass } from 'bungie-api-ts/destiny2';
import { once } from 'es-toolkit';
import { ItemFilterDefinition } from '../item-filter-types';
import { buildItemSearchConfig } from '../item-search-filter';
import { testStringsFromAllSockets } from './freeform';
import {
  displayStatToHashMap,
  getPerkStatHashes,
  getPerkStatNames,
  isValidPerkName,
  perkStatMappings,
} from './perk-stat-mappings';

const validateStat: ItemFilterDefinition['validateStat'] = (filterContext) => {
  const customStatLabels = filterContext?.customStats?.map((c) => c.shortLabel) ?? [];
  const possibleStatNames = [...allAtomicStats, ...customStatLabels];
  return (stat) => {
    // Handle ":best" pattern for custom stats
    if (stat.endsWith(':best')) {
      const customStatName = stat.replace(':best', '');
      return customStatLabels.includes(customStatName);
    }
    return (
      possibleStatNames.includes(stat) ||
      stat.split(/&|\+/).every((s) => s !== 'any' && possibleStatNames.includes(s))
    );
  };
};

// filters that operate on stats, several of which calculate values from all items beforehand
const statFilters: ItemFilterDefinition[] = [
  {
    keywords: 'stat',
    // t('Filter.StatsExtras')
    description: tl('Filter.Stats'),
    format: 'stat',
    suggestionsGenerator: ({ customStats }) =>
      generateGroupedSuggestionsForFilter(
        {
          keywords: 'stat',
          format: 'stat',
          suggestions: [
            ...allAtomicStats,
            ...(customStats?.map((c) => c.shortLabel) ?? []),
            ...(customStats?.map((c) => `${c.shortLabel}:best`) ?? []),
          ],
        },
        {},
      ),
    validateStat,
    filter: ({ filterValue, compare, customStats, allItems }) =>
      statFilterFromString(filterValue, compare, customStats, allItems, false),
  },
  {
    keywords: 'basestat',
    // t('Filter.StatsExtras')
    description: tl('Filter.StatsBase'),
    format: 'stat',
    // Note: weapons of the same hash also have the same base stats, so this is only useful for
    // armor really, so the suggestions only list armor stats. But `validateStats` does allow
    // other stats too because there's no good reason to forbid it...
    suggestionsGenerator: ({ customStats }) =>
      generateGroupedSuggestionsForFilter(
        {
          keywords: 'basestat',
          format: 'stat',
          suggestions: [
            ...searchableArmorStatNames,
            ...estStatNames,
            ...(customStats?.map((c) => c.shortLabel) ?? []),
            ...(customStats?.map((c) => `${c.shortLabel}:best`) ?? []),
          ],
        },
        {},
      ),
    validateStat,
    filter: ({ filterValue, compare, customStats, allItems }) =>
      statFilterFromString(filterValue, compare, customStats, allItems, true),
  },
  {
    // looks for a loadout (simultaneously equippable) maximized for this stat
    keywords: 'maxstatloadout',
    description: tl('Filter.StatsLoadout'),
    format: 'query',
    suggestions: Object.keys(d2lArmorStatHashByName),
    destinyVersion: 2,
    filter: ({ filterValue, stores, allItems }) => {
      const maxStatLoadout = findMaxStatLoadout(stores, allItems, filterValue);
      return (item) => {
        // filterValue stat must exist, and this must be armor
        if (!item.bucket.inArmor || !statHashByName[filterValue]) {
          return false;
        }
        return maxStatLoadout.includes(item.id);
      };
    },
  },
  {
    keywords: 'maxstatvalue',
    description: tl('Filter.StatsMax'),
    format: 'query',
    suggestions: searchableArmorStatNames,
    destinyVersion: 2,
    filter: ({ filterValue, allItems }) => {
      const highestStatsPerSlotPerTier = gatherHighestStats(allItems);
      return (item: DimItem) =>
        checkIfStatMatchesMaxValue(highestStatsPerSlotPerTier, item, filterValue);
    },
  },
  {
    keywords: 'maxbasestatvalue',
    description: tl('Filter.StatsMax'),
    format: 'query',
    suggestions: searchableArmorStatNames,
    destinyVersion: 2,
    filter: ({ filterValue, allItems }) => {
      const highestStatsPerSlotPerTier = gatherHighestStats(allItems);
      return (item: DimItem) =>
        checkIfStatMatchesMaxValue(highestStatsPerSlotPerTier, item, filterValue, true);
    },
  },
  {
    keywords: 'maxcustomstatvalue',
    description: tl('Filter.StatsMax'),
    format: 'query',
    suggestionsGenerator: ({ customStats }) =>
      generateGroupedSuggestionsForFilter(
        {
          keywords: 'maxcustomstatvalue',
          format: 'query',
          suggestions: customStats?.map((c) => c.shortLabel) ?? [],
        },
        {},
      ),
    validateStat: (filterContext) => {
      const customStatLabels = filterContext?.customStats?.map((c) => c.shortLabel) ?? [];
      return (stat) => customStatLabels.includes(stat);
    },
    destinyVersion: 2,
    filter: ({ filterValue, allItems, customStats }) => {
      const highestCustomStatsPerSlotPerTier = gatherHighestCustomStats(allItems, customStats);
      return (item: DimItem) =>
        checkIfCustomStatMatchesMaxValue(
          highestCustomStatsPerSlotPerTier,
          item,
          filterValue,
          customStats,
          false,
        );
    },
  },
  {
    keywords: 'maxbasecustomstatvalue',
    description: tl('Filter.StatsMax'),
    format: 'query',
    suggestionsGenerator: ({ customStats }) =>
      generateGroupedSuggestionsForFilter(
        {
          keywords: 'maxbasecustomstatvalue',
          format: 'query',
          suggestions: customStats?.map((c) => c.shortLabel) ?? [],
        },
        {},
      ),
    validateStat: (filterContext) => {
      const customStatLabels = filterContext?.customStats?.map((c) => c.shortLabel) ?? [];
      return (stat) => customStatLabels.includes(stat);
    },
    destinyVersion: 2,
    filter: ({ filterValue, allItems, customStats }) => {
      const highestCustomStatsPerSlotPerTier = gatherHighestCustomStats(allItems, customStats);
      return (item: DimItem) =>
        checkIfCustomStatMatchesMaxValue(
          highestCustomStatsPerSlotPerTier,
          item,
          filterValue,
          customStats,
          true,
        );
    },
  },
  {
    keywords: 'maxpowerloadout',
    description: tl('Filter.MaxPowerLoadout'),
    destinyVersion: 2,
    filter: ({ stores, allItems }) => {
      const maxPowerLoadoutItems = calculateMaxPowerLoadoutItems(stores, allItems);
      return (item: DimItem) => maxPowerLoadoutItems.includes(item.id);
    },
  },
  {
    keywords: ['maxpower', 'accountmaxpower'],
    description: tl('Filter.MaxPower'),
    destinyVersion: 2,
    filter: ({ allItems, filterValue }) => {
      const classMatters = filterValue === 'maxpower';
      const maxPowerPerBucket = calculateMaxPowerPerBucket(allItems, classMatters);
      return (item: DimItem) =>
        // items can be 0pl but king of their own little kingdom,
        // like halloween masks, so let's exclude 0pl
        Boolean(item.power) && maxPowerPerBucket[maxPowerKey(item, classMatters)] <= item.power;
    },
  },
  {
    keywords: ['maxpower', 'accountmaxpower'],
    description: tl('Filter.MaxPower'),
    format: 'range',
    destinyVersion: 2,
    filter: ({ allItems, lhs, compare }) => {
      if (!compare) {
        return () => false;
      }

      const classMatters = lhs === 'maxpower';

      // Get all items grouped by bucket
      const allItemsByBucketClass: Record<string, DimItem[]> = {};

      for (const item of allItems) {
        if (item.classType !== DestinyClass.Classified && Boolean(item.power)) {
          const key = maxPowerKey(item, classMatters);
          if (!allItemsByBucketClass[key]) {
            allItemsByBucketClass[key] = [];
          }
          allItemsByBucketClass[key].push(item);
        }
      }

      // Pre-sort all buckets
      const sortedBuckets: Record<string, DimItem[]> = {};
      for (const [key, items] of Object.entries(allItemsByBucketClass)) {
        sortedBuckets[key] = items.sort((a, b) => b.power - a.power);
      }

      return (item: DimItem) => {
        if (!item.power) {
          return false;
        }

        const bucketKey = maxPowerKey(item, classMatters);
        const sortedItems = sortedBuckets[bucketKey];
        if (!sortedItems || sortedItems.length === 0) {
          return false;
        }

        // Find the rank of this item (1-based)
        const rank = sortedItems.findIndex((i) => i.id === item.id) + 1;

        // Return true if this item's rank passes the comparison
        return rank > 0 && compare(rank);
      };
    },
  },
  {
    keywords: 'maxpowertier',
    description: tl('Filter.MaxPowerTier'),
    format: 'query',
    destinyVersion: 2,
    suggestions: [
      // Legendary ✨
      'legendary:1',
      'legendary:2',
      'legendary:3',
      'legendary:4',
      'legendary:5',
      'legendary:6',
      'legendary:7',
      'legendary:8',
      'legendary:9',
      'legendary:10',
      'exotic:1',
      'exotic:2',
      'exotic:3',
      'exotic:4',
      'exotic:5',
      'exotic:6',
      'exotic:7',
      'exotic:8',
      'exotic:9',
      'exotic:10',
      'rare:1',
      'rare:2',
      'rare:3',
      'rare:4',
      'rare:5',
      'rare:6',
      'rare:7',
      'rare:8',
      'rare:9',
      'rare:10',
      'uncommon:1',
      'uncommon:2',
      'uncommon:3',
      'uncommon:4',
      'uncommon:5',
      'uncommon:6',
      'uncommon:7',
      'uncommon:8',
      'uncommon:9',
      'uncommon:10',
      'common:1',
      'common:2',
      'common:3',
      'common:4',
      'common:5',
      'common:6',
      'common:7',
      'common:8',
      'common:9',
      'common:10',
    ],
    filter: (filterContext) => {
      const {
        allItems,
        filterValue,
        settings,
        getTag,
        customStats,
        d2Definitions,
        stores,
        getNotes,
        newItems,
        loadoutsByItem,
        wishListsByHash,
        wishListFunction,
        language,
        currentStore,
      } = filterContext;

      // Parse the filter value like "legendary:3" or "exotic:2"
      const parts = filterValue.split(':');
      if (parts.length !== 2) {
        return () => false;
      }

      const [tierName, countStr] = parts;
      const count = parseInt(countStr, 10);
      if (isNaN(count) || count < 1) {
        return () => false;
      }

      // Map tier names to rarity values
      const tierToRarity: Record<string, string> = {
        common: 'Common',
        uncommon: 'Uncommon',
        rare: 'Rare',
        legendary: 'Legendary',
        exotic: 'Exotic',
      };

      const rarity = tierToRarity[tierName.toLowerCase()];
      if (rarity === undefined) {
        return () => false;
      }

      // Build keep filters to exclude items already marked as keep
      let keepWeaponFilter: (item: DimItem) => boolean = () => false;
      let keepArmorFilter: (item: DimItem) => boolean = () => false;

      try {
        // Build the search config for keep filters
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

        // Build keepweapon filter
        const keepWeaponSettings = settings?.searchFilterSettings?.keepWeapon;
        if (keepWeaponSettings?.enabled && keepWeaponSettings?.additionalSearchTerms?.length > 0) {
          const terms = keepWeaponSettings.additionalSearchTerms;
          let searchQuery = '';

          if (terms.length === 1) {
            searchQuery = terms[0].term;
          } else {
            const groupedTerms = new Map<number, typeof terms>();
            terms.forEach((term) => {
              const groupNum = term.group ?? 0;
              if (!groupedTerms.has(groupNum)) {
                groupedTerms.set(groupNum, []);
              }
              groupedTerms.get(groupNum)!.push(term);
            });

            const groupParts = [];
            for (const [groupNum, groupTerms] of groupedTerms) {
              if (groupTerms.length === 1) {
                groupParts.push(groupTerms[0].term);
              } else {
                const innerTerms = groupTerms.map((term) => term.term).join(' and ');
                groupParts.push(`(${innerTerms})`);
              }
            }

            searchQuery = groupParts.join(' or ');
          }

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
          const weaponFilter = searchFilterFactory(searchQuery);
          keepWeaponFilter = (item: DimItem) =>
            item.bucket?.sort === 'Weapons' && weaponFilter(item);
        }

        // Build keeparmor filter
        const keepArmorSettings = settings?.searchFilterSettings?.keepArmor;
        if (keepArmorSettings?.enabled && keepArmorSettings?.additionalSearchTerms?.length > 0) {
          const terms = keepArmorSettings.additionalSearchTerms;
          let searchQuery = '';

          if (terms.length === 1) {
            searchQuery = terms[0].term;
          } else {
            const groupedTerms = new Map<number, typeof terms>();
            terms.forEach((term) => {
              const groupNum = term.group ?? 0;
              if (!groupedTerms.has(groupNum)) {
                groupedTerms.set(groupNum, []);
              }
              groupedTerms.get(groupNum)!.push(term);
            });

            const groupParts = [];
            for (const [groupNum, groupTerms] of groupedTerms) {
              if (groupTerms.length === 1) {
                groupParts.push(groupTerms[0].term);
              } else {
                const innerTerms = groupTerms.map((term) => term.term).join(' and ');
                groupParts.push(`(${innerTerms})`);
              }
            }

            searchQuery = groupParts.join(' or ');
          }

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
          const armorFilter = searchFilterFactory(searchQuery);
          keepArmorFilter = (item: DimItem) => item.bucket.inArmor && armorFilter(item);
        }
      } catch (error) {}

      // Group items by bucket and class, but only include items of the specified tier
      // that are NOT marked as keep items
      const tierItemsByBucketClass: Record<string, DimItem[]> = {};

      for (const item of allItems) {
        if (
          item.classType !== DestinyClass.Classified &&
          Boolean(item.power) &&
          item.rarity === rarity &&
          !keepWeaponFilter(item) &&
          !keepArmorFilter(item)
        ) {
          const key = maxPowerKey(item, true); // Always consider class for tier-specific
          if (!tierItemsByBucketClass[key]) {
            tierItemsByBucketClass[key] = [];
          }
          tierItemsByBucketClass[key].push(item);
        }
      }

      // Pre-sort all buckets by power
      const sortedBuckets: Record<string, DimItem[]> = {};
      for (const [key, items] of Object.entries(tierItemsByBucketClass)) {
        sortedBuckets[key] = items.sort((a, b) => b.power - a.power);
      }

      return (item: DimItem) => {
        if (!item.power || item.rarity !== rarity) {
          return false;
        }

        // Skip if this item matches keep filters
        if (keepWeaponFilter(item) || keepArmorFilter(item)) {
          return false;
        }

        const bucketKey = maxPowerKey(item, true);
        const sortedItems = sortedBuckets[bucketKey];
        if (!sortedItems || sortedItems.length === 0) {
          return false;
        }

        // Find the rank of this item within its tier (1-based)
        const rank = sortedItems.findIndex((i) => i.id === item.id) + 1;

        // Return true if this item is within the top N for its tier
        return rank > 0 && rank <= count;
      };
    },
  },
  {
    keywords: 'maxnonexotic',
    description: tl('Filter.MaxNonExotic'),
    format: 'query',
    destinyVersion: 2,
    suggestions: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'],
    filter: (filterContext) => {
      const {
        allItems,
        filterValue,
        settings,
        getTag,
        customStats,
        d2Definitions,
        stores,
        getNotes,
        newItems,
        loadoutsByItem,
        wishListsByHash,
        wishListFunction,
        language,
        currentStore,
      } = filterContext;

      // Parse the count from filterValue (e.g., "3" from "maxnonexotic:3")
      const count = parseInt(filterValue, 10);
      if (isNaN(count) || count < 1) {
        return () => false;
      }

      // Build keep filters to exclude items already marked as keep
      let keepWeaponFilter: (item: DimItem) => boolean = () => false;
      let keepArmorFilter: (item: DimItem) => boolean = () => false;

      try {
        // Build the search config for keep filters
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

        // Build keepweapon filter
        const keepWeaponSettings = settings?.searchFilterSettings?.keepWeapon;
        if (keepWeaponSettings?.enabled && keepWeaponSettings?.additionalSearchTerms?.length > 0) {
          const terms = keepWeaponSettings.additionalSearchTerms;
          let searchQuery = '';

          if (terms.length === 1) {
            searchQuery = terms[0].term;
          } else {
            const groupedTerms = new Map<number, typeof terms>();
            terms.forEach((term) => {
              const groupNum = term.group ?? 0;
              if (!groupedTerms.has(groupNum)) {
                groupedTerms.set(groupNum, []);
              }
              groupedTerms.get(groupNum)!.push(term);
            });

            const groupParts = [];
            for (const [groupNum, groupTerms] of groupedTerms) {
              if (groupTerms.length === 1) {
                groupParts.push(groupTerms[0].term);
              } else {
                const innerTerms = groupTerms.map((term) => term.term).join(' and ');
                groupParts.push(`(${innerTerms})`);
              }
            }

            searchQuery = groupParts.join(' or ');
          }

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
          const weaponFilter = searchFilterFactory(searchQuery);
          keepWeaponFilter = (item: DimItem) =>
            item.bucket?.sort === 'Weapons' && weaponFilter(item);
        }

        // Build keeparmor filter
        const keepArmorSettings = settings?.searchFilterSettings?.keepArmor;
        if (keepArmorSettings?.enabled && keepArmorSettings?.additionalSearchTerms?.length > 0) {
          const terms = keepArmorSettings.additionalSearchTerms;
          let searchQuery = '';

          if (terms.length === 1) {
            searchQuery = terms[0].term;
          } else {
            const groupedTerms = new Map<number, typeof terms>();
            terms.forEach((term) => {
              const groupNum = term.group ?? 0;
              if (!groupedTerms.has(groupNum)) {
                groupedTerms.set(groupNum, []);
              }
              groupedTerms.get(groupNum)!.push(term);
            });

            const groupParts = [];
            for (const [groupNum, groupTerms] of groupedTerms) {
              if (groupTerms.length === 1) {
                groupParts.push(groupTerms[0].term);
              } else {
                const innerTerms = groupTerms.map((term) => term.term).join(' and ');
                groupParts.push(`(${innerTerms})`);
              }
            }

            searchQuery = groupParts.join(' or ');
          }

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
          const armorFilter = searchFilterFactory(searchQuery);
          keepArmorFilter = (item: DimItem) => item.bucket.inArmor && armorFilter(item);
        }
      } catch (error) {}

      // Get all non-exotic items grouped by bucket/class, excluding keep items
      const nonExoticItemsByBucketClass: Record<string, DimItem[]> = {};

      for (const item of allItems) {
        if (
          item.classType !== DestinyClass.Classified &&
          Boolean(item.power) &&
          item.rarity !== 'Exotic' &&
          !keepWeaponFilter(item) &&
          !keepArmorFilter(item)
        ) {
          const key = maxPowerKey(item, true); // Always consider class
          if (!nonExoticItemsByBucketClass[key]) {
            nonExoticItemsByBucketClass[key] = [];
          }
          nonExoticItemsByBucketClass[key].push(item);
        }
      }

      // Pre-sort all buckets by power
      const sortedBuckets: Record<string, DimItem[]> = {};
      for (const [key, items] of Object.entries(nonExoticItemsByBucketClass)) {
        sortedBuckets[key] = items.sort((a, b) => b.power - a.power);
      }

      return (item: DimItem) => {
        if (!item.power || item.rarity === 'Exotic') {
          return false;
        }

        // Skip if this item matches keep filters
        if (keepWeaponFilter(item) || keepArmorFilter(item)) {
          return false;
        }

        const bucketKey = maxPowerKey(item, true);
        const sortedItems = sortedBuckets[bucketKey];
        if (!sortedItems || sortedItems.length === 0) {
          return false;
        }

        // Find the power level of this item
        const itemPower = item.power;

        // Get the unique power levels in descending order
        const uniquePowerLevels = Array.from(new Set(sortedItems.map((i) => i.power))).sort(
          (a, b) => b - a,
        );

        // Check if this item's power level is among the top N unique power levels
        const topNPowerLevels = uniquePowerLevels.slice(0, count);
        return topNPowerLevels.includes(itemPower);
      };
    },
  },
  {
    keywords: 'bestperkstat',
    description: tl('Filter.BestPerkStat'),
    format: 'query',
    suggestions: Object.keys(perkStatMappings),
    destinyVersion: 2,
    filter: ({ filterValue, allItems }) => {
      if (!isValidPerkName(filterValue)) {
        return () => false;
      }

      // Get the stat hashes for this perk
      const { primary: primaryStatHash, secondary: secondaryStatHash } =
        getPerkStatHashes(filterValue);

      // Find all armor items that could potentially match
      const armorItems = allItems.filter(
        (item) =>
          item.bucket.inArmor &&
          item.stats &&
          item.stats.some(
            (s) => s.statHash === primaryStatHash || s.statHash === secondaryStatHash,
          ),
      );

      // Group items by slot and class
      const itemsBySlotClass: Record<string, DimItem[]> = {};
      for (const item of armorItems) {
        const key = `${item.bucket.hash}-${item.classType}`;
        if (!itemsBySlotClass[key]) {
          itemsBySlotClass[key] = [];
        }
        itemsBySlotClass[key].push(item);
      }

      // For each slot+class group, find the best item(s) based on primary stat, then secondary stat
      const bestItemIds = new Set<string>();

      for (const [slotClass, items] of Object.entries(itemsBySlotClass)) {
        if (items.length === 0) {
          continue;
        }

        // Sort by primary stat (descending), then by secondary stat (descending)
        const sortedItems = items.sort((a, b) => {
          const aPrimaryStat = a.stats?.find((s) => s.statHash === primaryStatHash)?.base || 0;
          const bPrimaryStat = b.stats?.find((s) => s.statHash === primaryStatHash)?.base || 0;

          if (aPrimaryStat !== bPrimaryStat) {
            return bPrimaryStat - aPrimaryStat; // Higher primary stat wins
          }

          // If primary stats are tied, compare secondary stats
          const aSecondaryStat = a.stats?.find((s) => s.statHash === secondaryStatHash)?.base || 0;
          const bSecondaryStat = b.stats?.find((s) => s.statHash === secondaryStatHash)?.base || 0;

          return bSecondaryStat - aSecondaryStat; // Higher secondary stat wins
        });

        // Add all items that tie for the best stats
        const bestItem = sortedItems[0];
        const bestPrimaryStat =
          bestItem.stats?.find((s) => s.statHash === primaryStatHash)?.base || 0;
        const bestSecondaryStat =
          bestItem.stats?.find((s) => s.statHash === secondaryStatHash)?.base || 0;

        for (const item of sortedItems) {
          const itemPrimaryStat =
            item.stats?.find((s) => s.statHash === primaryStatHash)?.base || 0;
          const itemSecondaryStat =
            item.stats?.find((s) => s.statHash === secondaryStatHash)?.base || 0;

          if (itemPrimaryStat === bestPrimaryStat && itemSecondaryStat === bestSecondaryStat) {
            bestItemIds.add(item.id);
          } else {
            break; // No more ties
          }
        }
      }

      return (item: DimItem) => bestItemIds.has(item.id);
    },
  },
  {
    keywords: 'bestforperk',
    description: tl('Filter.BestPerkStat'),
    format: 'freeform',
    destinyVersion: 2,
    filter: ({ filterValue, allItems, language, d2Definitions }) => {
      // Get the stat hashes for this perk, or use defaults if not in our mapping
      let primaryStatHash: number;
      let secondaryStatHash: number;

      // Normalize the filter value to match our mappings (capitalize first letter)
      const normalizedPerkName =
        filterValue.charAt(0).toUpperCase() + filterValue.slice(1).toLowerCase();

      if (isValidPerkName(normalizedPerkName)) {
        const statHashes = getPerkStatHashes(normalizedPerkName);
        primaryStatHash = statHashes.primary;
        secondaryStatHash = statHashes.secondary;
      } else {
        // For perks not in our mapping, use smart defaults based on perk name
        if (filterValue.toLowerCase().includes('brawler')) {
          primaryStatHash = displayStatToHashMap.Melee;
          secondaryStatHash = displayStatToHashMap.Health;
        } else {
          // Default fallback - optimize for Health and Melee
          primaryStatHash = displayStatToHashMap.Health;
          secondaryStatHash = displayStatToHashMap.Melee;
        }
      }

      // Find all items that have the specified perk
      const perkTest = matchText(filterValue, language, /* exact */ false);
      const itemsWithPerk = allItems.filter(
        (item) =>
          item.bucket.inArmor &&
          item.stats &&
          testStringsFromAllSockets(perkTest, item, d2Definitions, /* includeDescription */ false),
      );

      if (itemsWithPerk.length > 0) {
        // Get the actual stat names based on the normalized perk name
        let primaryStatName = 'Primary';
        let secondaryStatName = 'Secondary';

        if (isValidPerkName(normalizedPerkName)) {
          const statNames = getPerkStatNames(normalizedPerkName);
          primaryStatName = statNames.primary;
          secondaryStatName = statNames.secondary;
        }
      }

      if (itemsWithPerk.length === 0) {
        return () => false;
      }

      // Group items by slot, class, and rarity
      const itemsBySlotClass: Record<string, DimItem[]> = {};
      for (const item of itemsWithPerk) {
        const key = `${item.bucket.hash}-${item.classType}-${item.rarity}`;
        if (!itemsBySlotClass[key]) {
          itemsBySlotClass[key] = [];
        }
        itemsBySlotClass[key].push(item);
      }

      // For each slot+class group, find the best item(s) based on primary stat, then secondary stat
      const bestItemIds = new Set<string>();

      for (const [slotClass, items] of Object.entries(itemsBySlotClass)) {
        if (items.length === 0) {
          continue;
        }

        // Sort by primary stat (descending), then by secondary stat (descending)
        const sortedItems = items.sort((a, b) => {
          const aPrimaryStat = a.stats?.find((s) => s.statHash === primaryStatHash)?.base || 0;
          const bPrimaryStat = b.stats?.find((s) => s.statHash === primaryStatHash)?.base || 0;

          if (aPrimaryStat !== bPrimaryStat) {
            return bPrimaryStat - aPrimaryStat; // Higher primary stat wins
          }

          // If primary stats are tied, compare secondary stats
          const aSecondaryStat = a.stats?.find((s) => s.statHash === secondaryStatHash)?.base || 0;
          const bSecondaryStat = b.stats?.find((s) => s.statHash === secondaryStatHash)?.base || 0;

          return bSecondaryStat - aSecondaryStat; // Higher secondary stat wins
        });

        // Add all items that tie for the best stats
        if (sortedItems.length > 0) {
          const bestItem = sortedItems[0];
          const bestPrimaryStat =
            bestItem.stats?.find((s) => s.statHash === primaryStatHash)?.base || 0;
          const bestSecondaryStat =
            bestItem.stats?.find((s) => s.statHash === secondaryStatHash)?.base || 0;

          for (const item of sortedItems) {
            const itemPrimaryStat =
              item.stats?.find((s) => s.statHash === primaryStatHash)?.base || 0;
            const itemSecondaryStat =
              item.stats?.find((s) => s.statHash === secondaryStatHash)?.base || 0;

            if (itemPrimaryStat === bestPrimaryStat && itemSecondaryStat === bestSecondaryStat) {
              bestItemIds.add(item.id);
            } else {
              break; // No more ties
            }
          }
        }
      }

      return (item: DimItem) => bestItemIds.has(item.id);
    },
  },
  {
    keywords: 'testfilter',
    description: tl('Filter.Stats'),
    format: 'simple',
    destinyVersion: 2,
    filter: () => () => true, // Return all items
  },
];

export default statFilters;

/**
 * given a stat name, this returns a FilterDefinition for comparing that stat
 */
function statFilterFromString(
  statNames: string,
  compare: ((value: number) => boolean) | undefined,
  customStats: CustomStatDef[],
  allItems: DimItem[],
  byBaseValue = false,
): (item: DimItem) => boolean {
  // Handle special case for ":best" searches like "wsc:best"
  if (statNames.endsWith(':best')) {
    const customStatName = statNames.replace(':best', '');

    // Find the custom stat definition
    const customStat = customStats.find((c) => c.shortLabel === customStatName);
    if (!customStat) {
      return () => false; // No matching custom stat found
    }

    // Gather highest custom stats for comparison
    const highestCustomStatsPerSlotPerTier = gatherHighestCustomStats(allItems, customStats);

    return (item: DimItem) => {
      // this must be armor with stats
      if (!item.bucket.inArmor || !item.stats) {
        return false;
      }

      // Check if this item's class is compatible with the custom stat
      if (!isClassCompatible(customStat.class, item.classType)) {
        return false;
      }

      // Find the stat on this item
      const stat = item.stats.find((s) => s.statHash === customStat.statHash);
      if (!stat) {
        return false;
      }

      const useWhichMaxes = item.isExotic ? 'all' : 'nonexotic';
      const itemSlot = `${item.bucket.hash}|${item.classType}`;
      const maxStatsForSlot = highestCustomStatsPerSlotPerTier[useWhichMaxes][itemSlot];
      const maxStatForCustomStat = maxStatsForSlot?.[customStatName];

      return (
        maxStatForCustomStat &&
        stat[byBaseValue ? 'base' : 'value'] ===
          maxStatForCustomStat[byBaseValue ? 'base' : 'value']
      );
    };
  }

  // this will be used to index into the right property of a DimStat
  const byWhichValue = byBaseValue ? 'base' : 'value';

  // Return empty filter if no compare function for non-:best searches
  if (!compare) {
    return () => false;
  }

  // a special case filter where we check for any single (natural) stat matching the comparator
  if (statNames === 'any') {
    const statMatches = (s: DimStat) =>
      armorAnyStatHashes.includes(s.statHash) && compare(s[byWhichValue]);
    return (item) => Boolean(item.stats?.find(statMatches));
  } else if (statNames in est) {
    return (item) => {
      if (!item.bucket.inArmor || !item.stats) {
        return false;
      }
      const sortedStats = item.stats
        .filter((s) => armorAnyStatHashes.includes(s.statHash))
        .map((s) => s[byWhichValue])
        .sort((a, b) => b - a);
      return compare(sortedStats[est[statNames as keyof typeof est]]);
    };
  } else if (weaponStatNames.includes(statNames)) {
    // return earlier for weapon stats. these shouldn't do addition/averaging.
    const statHash = statHashByName[statNames];
    return (item) => {
      const statValuesByHash = getStatValuesByHash(item, byWhichValue);
      return compare(statValuesByHash[statHash] || 0);
    };
  }
  const statCombiner = createStatCombiner(statNames, byWhichValue, customStats);
  // the filter computes combined values of requested stats and runs the total against comparator
  return (item) => Boolean(item.bucket.inArmor) && compare(statCombiner(item));
}

// converts the string "mobility+strength&discipline" into a function which
// returns an item's MOB + average( STR, DIS )
// this should only be run on armor stats
function createStatCombiner(
  statString: string,
  byWhichValue: 'base' | 'value',
  customStats: CustomStatDef[],
) {
  // an array of arrays of stat retrieval functions.
  // inner arrays are averaged, then outer array is totaled
  const nestedAddends = statString.split('+').map((addendString) => {
    const averagedHashes = addendString.split('&').map((statName) => {
      // Support "highest&secondhighest"
      if (statName in est) {
        return (
          statValuesByHash: NodeJS.Dict<number>,
          sortStats: () => number[][],
          item: DimItem,
        ) => {
          if (!item.bucket.inArmor || !item.stats) {
            return 0;
          }
          const sortedStats = sortStats();
          const statHash = sortedStats[est[statName as keyof typeof est]][0];
          if (!statHash) {
            throw new Error(`invalid stat name: "${statName}"`);
          }
          return statValuesByHash[statHash] || 0;
        };
      }

      const statHash = statHashByName[statName];
      // if we found a statHash here, this is a normal real stat, like discipline
      if (statHash) {
        // would ideally be "?? 0" but polyfills are big and || works fine
        return (statValuesByHash: NodeJS.Dict<number>) => statValuesByHash[statHash] || 0;
      }

      // custom stats this string represents
      const namedCustomStats = customStats.filter((c) => c.shortLabel === statName);

      if (namedCustomStats.length) {
        return (
          statValuesByHash: NodeJS.Dict<number>,
          _sortStats: () => number[][],
          item: DimItem,
        ) => {
          const thisClassCustomStat = namedCustomStats.find((c) =>
            isClassCompatible(c.class, item.classType),
          );
          // if this item's guardian class doesn't have a custom stat named statName
          // return false to not match
          if (!thisClassCustomStat) {
            return 0;
          }

          // otherwise, check the stat value against this custom stat's value
          return statValuesByHash[thisClassCustomStat.statHash] || 0;
        };
      }

      throw new Error(`invalid stat name: "${statName}"`);
    });
    return averagedHashes;
  });

  return (item: DimItem) => {
    const statValuesByHash = getStatValuesByHash(item, byWhichValue);
    // Computed lazily
    const sortStats = once(() =>
      (item.stats ?? [])
        .filter((s) => armorAnyStatHashes.includes(s.statHash))
        .map((s) => [s.statHash, s[byWhichValue]])
        .sort((a, b) => b[1] - a[1]),
    );

    return sumBy(nestedAddends, (averageGroup) => {
      const averaged =
        sumBy(averageGroup, (statFn) => statFn(statValuesByHash, sortStats, item)) /
        averageGroup.length;

      return averaged;
    });
  };
}

function findMaxStatLoadout(stores: DimStore[], allItems: DimItem[], statName: string) {
  const maxStatHash = statHashByName[statName];
  return stores.flatMap((store) =>
    // Accessing id is safe: maxStatLoadout only includes items with a power level,
    // i.e. only weapons and armor and those are instanced.
    maxStatLoadout(maxStatHash, allItems, store).items.map((i) => i.id),
  );
}

type MaxValuesDict = Record<
  'all' | 'nonexotic',
  { [slotName: string]: { [statHash: string]: { value: number; base: number } } }
>;

/** given our known max stat dict, see if this item and stat are among the max stat havers */
export function checkIfStatMatchesMaxValue(
  maxStatValues: MaxValuesDict,
  item: DimItem,
  statName: string,
  byBaseValue = false,
) {
  // this must be armor with stats
  if (!item.bucket.inArmor || !item.stats) {
    return false;
  }
  const statHashes: number[] = statName === 'any' ? armorStatHashes : [statHashByName[statName]];
  const byWhichValue = byBaseValue ? 'base' : 'value';
  const useWhichMaxes = item.isExotic ? 'all' : 'nonexotic';
  const itemSlot = `${item.bucket.hash}|${item.classType}`;
  const maxStatsForSlot = maxStatValues[useWhichMaxes][itemSlot];
  const matchingStats = item.stats?.filter(
    (s) =>
      statHashes.includes(s.statHash) &&
      s[byWhichValue] === maxStatsForSlot?.[s.statHash][byWhichValue],
  );
  return matchingStats && Boolean(matchingStats.length);
}

export function gatherHighestStats(allItems: DimItem[]) {
  const maxStatValues: MaxValuesDict = { all: {}, nonexotic: {} };

  for (const i of allItems) {
    // we only want armor with stats
    if (!i.bucket.inArmor || !i.stats) {
      continue;
    }

    const itemSlot = `${i.bucket.hash}|${i.classType}`;
    // if this is an exotic item, update overall maxes, but don't ruin the curve for the nonexotic maxes
    const itemTiers: ('all' | 'nonexotic')[] = i.isExotic ? ['all'] : ['all', 'nonexotic'];
    const thisSlotMaxGroups = itemTiers.map((t) => (maxStatValues[t][itemSlot] ??= {}));

    for (const stat of i.stats) {
      for (const thisSlotMaxes of thisSlotMaxGroups) {
        const thisSlotThisStatMaxes = (thisSlotMaxes[stat.statHash] ??= {
          value: 0,
          base: 0,
        });
        thisSlotThisStatMaxes.value = Math.max(thisSlotThisStatMaxes.value, stat.value);
        thisSlotThisStatMaxes.base = Math.max(thisSlotThisStatMaxes.base, stat.base);
      }
    }
  }
  return maxStatValues;
}

function calculateMaxPowerLoadoutItems(stores: DimStore[], allItems: DimItem[]) {
  return stores.flatMap((store) => maxLightItemSet(allItems, store).equippable.map((i) => i.id));
}

function maxPowerKey(item: DimItem, classMatters: boolean) {
  return `${item.bucket.hash}-${classMatters && item.bucket.inArmor ? item.classType : ''}`;
}

function calculateMaxPowerPerBucket(allItems: DimItem[], classMatters: boolean) {
  // disregard no-class armor
  const validItems = allItems.filter((i) => i.classType !== DestinyClass.Classified);
  const allItemsByBucketClass: Record<string, DimItem[]> = {};

  for (const item of validItems) {
    const key = maxPowerKey(item, classMatters);
    if (!allItemsByBucketClass[key]) {
      allItemsByBucketClass[key] = [];
    }
    allItemsByBucketClass[key].push(item);
  }

  return mapValues(allItemsByBucketClass, (items) =>
    items && items.length ? maxOf(items, (i) => i.power) : 0,
  );
}

type MaxCustomStatValuesDict = Record<
  'all' | 'nonexotic',
  { [slotName: string]: { [customStatLabel: string]: { value: number; base: number } } }
>;

export function gatherHighestCustomStats(allItems: DimItem[], customStats: CustomStatDef[]) {
  const maxStatValues: MaxCustomStatValuesDict = { all: {}, nonexotic: {} };

  for (const i of allItems) {
    // we only want armor with stats
    if (!i.bucket.inArmor || !i.stats) {
      continue;
    }

    const itemSlot = `${i.bucket.hash}|${i.classType}`;
    // if this is an exotic item, update overall maxes, but don't ruin the curve for the nonexotic maxes
    const itemTiers: ('all' | 'nonexotic')[] = i.isExotic ? ['all'] : ['all', 'nonexotic'];
    const thisSlotMaxGroups = itemTiers.map((t) => (maxStatValues[t][itemSlot] ??= {}));

    // Check each custom stat for this item
    for (const customStat of customStats) {
      if (isClassCompatible(customStat.class, i.classType)) {
        const stat = i.stats.find((s) => s.statHash === customStat.statHash);
        if (stat) {
          for (const thisSlotMaxes of thisSlotMaxGroups) {
            const thisSlotThisStatMaxes = (thisSlotMaxes[customStat.shortLabel] ??= {
              value: 0,
              base: 0,
            });
            thisSlotThisStatMaxes.value = Math.max(thisSlotThisStatMaxes.value, stat.value);
            thisSlotThisStatMaxes.base = Math.max(thisSlotThisStatMaxes.base, stat.base);
          }
        }
      }
    }
  }
  return maxStatValues;
}

function checkIfCustomStatMatchesMaxValue(
  maxStatValues: MaxCustomStatValuesDict,
  item: DimItem,
  customStatLabel: string,
  customStats: CustomStatDef[],
  byBaseValue = false,
) {
  // this must be armor with stats
  if (!item.bucket.inArmor || !item.stats) {
    return false;
  }

  // Find the custom stat definition
  const customStat = customStats.find(
    (c) => c.shortLabel === customStatLabel && isClassCompatible(c.class, item.classType),
  );
  if (!customStat) {
    return false;
  }

  // Find the stat on this item
  const stat = item.stats.find((s) => s.statHash === customStat.statHash);
  if (!stat) {
    return false;
  }

  const byWhichValue = byBaseValue ? 'base' : 'value';
  const useWhichMaxes = item.isExotic ? 'all' : 'nonexotic';
  const itemSlot = `${item.bucket.hash}|${item.classType}`;
  const maxStatsForSlot = maxStatValues[useWhichMaxes][itemSlot];
  const maxStatForCustomStat = maxStatsForSlot?.[customStatLabel];

  return maxStatForCustomStat && stat[byWhichValue] === maxStatForCustomStat[byWhichValue];
}
