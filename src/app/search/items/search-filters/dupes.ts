import { CustomStatDef } from '@destinyitemmanager/dim-api-types';
import { stripAdept } from 'app/compare/compare-utils';
import { tl } from 'app/i18next-t';
import { TagValue } from 'app/inventory/dim-item-info';
import { DimItem } from 'app/inventory/item-types';
import { getRollAppraiserUtilsSync } from 'app/roll-appraiser/rollAppraiserService';
import { DEFAULT_SHADER, armorStats } from 'app/search/d2-known-values';
import { chainComparator, compareBy, reverseComparator } from 'app/utils/comparators';
import { isArtifice, isClassCompatible } from 'app/utils/item-utils';
import { getSocketsByType } from 'app/utils/socket-utils';
import { DestinyClass } from 'bungie-api-ts/destiny2';
import { BucketHashes } from 'data/d2/generated-enums';
import { ItemFilterDefinition } from '../item-filter-types';
import { PerksSet } from './perks-set';
import { StatsSet } from './stats-set';

const notableTags = ['keep'];

/** outputs a string combination of the identifying features of an item, or the hash if classified */
export const makeDupeID = (item: DimItem) =>
  (item.classified && `${item.hash}`) ||
  `${
    // Consider adept versions of weapons to be the same as the normal type
    item.bucket.inWeapons ? stripAdept(item.name) : item.name
  }${
    // Some items have the same name across different classes, e.g. "Kairos Function Boots"
    item.classType
  }${
    // Some items have the same name across different tiers, e.g. "Traveler's Chosen"
    item.rarity
  }${
    // The engram that dispenses the Taraxippos scout rifle is also called Taraxippos
    item.bucket.hash
  }`;

export const sortDupes = (
  dupes: {
    [dupeID: string]: DimItem[];
  },
  getTag: (item: DimItem) => TagValue | undefined,
  sortType: 'power' | 'combo' | 'dupebest' = 'power',
) => {
  // The comparator for sorting dupes - the first item will be the "best" and all others are "dupelower".
  const dupeComparator = sortType === 'dupebest' 
    ? chainComparator<DimItem>(
        // 1. Best Combo Rank (for weapons) - lower rank numbers are better
        compareBy((item) => {
          if (item.bucket.inWeapons && item.sockets) {
            const utils = getRollAppraiserUtilsSync();
            if (!utils) return Number.MAX_SAFE_INTEGER; // No data = worst
            
            const traitPerks = getSocketsByType(item, 'trait');
            if (traitPerks.length >= 2) {
              const perk4Hash = traitPerks[0]?.plugged?.plugDef.hash;
              const perk5Hash = traitPerks[1]?.plugged?.plugDef.hash;
              
              if (perk4Hash && perk5Hash) {
                const comboRank = utils.getTraitComboRank(item.hash.toString(), perk4Hash, perk5Hash);
                if (comboRank) {
                  // Return the rank directly - lower numbers are better
                  return comboRank.rank;
                }
              }
            }
          }
          return Number.MAX_SAFE_INTEGER; // Non-weapons or items without combo data go last
        }),
        // 2. Highest Power - higher is better, so negate to sort descending
        compareBy((item) => -item.power),
        // 3. Tag priority - true (has tag) is better, so negate
        compareBy((item) => {
          const tag = getTag(item);
          return !Boolean(tag && notableTags.includes(tag));
        }),
        // 4. Masterwork status - true is better, so negate
        compareBy((item) => !item.masterwork),
        // 5. Lock status - true is better, so negate
        compareBy((item) => !item.locked),
        // 6. Item ID tiebreaker
        compareBy((i) => i.id),
      )
    : reverseComparator(
        chainComparator<DimItem>(
          // primary comparison based on sort type
          sortType === 'combo' 
            ? compareBy((item) => {
                // For weapons, use combo rank (lower rank number = better, so higher rank numbers should be "dupelower")
                if (item.bucket.inWeapons && item.sockets) {
                  const utils = getRollAppraiserUtilsSync();
                  if (!utils) return -item.power; // Fallback to power if no roll appraiser data
                  
                  const traitPerks = getSocketsByType(item, 'traits');
                  if (traitPerks.length >= 2) {
                    const perk4Hash = traitPerks[0]?.plugged?.plugDef.hash;
                    const perk5Hash = traitPerks[1]?.plugged?.plugDef.hash;
                    
                    if (perk4Hash && perk5Hash) {
                      const comboRank = utils.getTraitComboRank(item.hash.toString(), perk4Hash, perk5Hash);
                      if (comboRank) {
                        // Return negative rank so lower rank numbers (better combos) sort first
                        // This means higher rank numbers (worse combos) will be considered "dupelower"
                        return -comboRank.rank;
                      }
                    }
                  }
                }
                // Fallback to power for non-weapons or items without combo data
                return -item.power;
              })
            : compareBy((item) => item.power),
          compareBy((item) => {
            const tag = getTag(item);
            return Boolean(tag && notableTags.includes(tag));
          }),
          compareBy((item) => item.masterwork),
          compareBy((item) => item.locked),
          compareBy((i) => i.id), // tiebreak by ID
        ),
      );

  for (const dupeList of Object.values(dupes)) {
    if (dupeList.length > 1) {
      dupeList.sort(dupeComparator);
    }
  }

  return dupes;
};

/**
 * Sort duplicates for "dupebest" search - best item first.
 * For weapons: Use combo rank (lower rank number = better)
 * For armor: Use custom stat value (higher value = better) when available, otherwise use power
 */
export const sortDupesBest = (
  dupes: {
    [dupeID: string]: DimItem[];
  },
  getTag: (item: DimItem) => TagValue | undefined,
  customStats: CustomStatDef[],
) => {
  const dupeComparator = chainComparator<DimItem>(
    // 1. For armor: prioritize highest custom stat value if custom stats exist
    compareBy((item) => {
      if (item.bucket.inArmor && customStats.length > 0) {
        // Find the highest custom stat value for this item
        let highestCustomStatValue = 0;
        for (const customStat of customStats) {
          if (isClassCompatible(customStat.class, item.classType)) {
            const stat = item.stats?.find(s => s.statHash === customStat.statHash);
            if (stat && stat.value > highestCustomStatValue) {
              highestCustomStatValue = stat.value;
            }
          }
        }
        // Return negative value so higher custom stat values are sorted first
        return -highestCustomStatValue;
      }
      return 0; // No priority for non-armor or when no custom stats exist
    }),
    // 2. Best Combo Rank (for weapons) - lower rank numbers are better
    compareBy((item) => {
      if (item.bucket.inWeapons && item.sockets) {
        const utils = getRollAppraiserUtilsSync();
        if (!utils) return Number.MAX_SAFE_INTEGER;
        
        const traitPerks = getSocketsByType(item, 'traits');
        if (traitPerks.length >= 2) {
          const perk4Hash = traitPerks[0]?.plugged?.plugDef.hash;
          const perk5Hash = traitPerks[1]?.plugged?.plugDef.hash;
          
          if (perk4Hash && perk5Hash) {
            const comboRank = utils.getTraitComboRank(item.hash.toString(), perk4Hash, perk5Hash);
            if (comboRank) {
              return comboRank.rank;
            }
          }
        }
      }
      return Number.MAX_SAFE_INTEGER;
    }),
    // 3. Highest Power
    compareBy((item) => -item.power),
    // 4. Tag priority
    compareBy((item) => {
      const tag = getTag(item);
      return !Boolean(tag && notableTags.includes(tag));
    }),
    // 5. Masterwork status
    compareBy((item) => !item.masterwork),
    // 6. Lock status
    compareBy((item) => !item.locked),
    // 7. Item ID tiebreaker
    compareBy((i) => i.id),
  );

  for (const dupeList of Object.values(dupes)) {
    if (dupeList.length > 1) {
      dupeList.sort(dupeComparator);
    }
  }

  return dupes;
};

const computeDupesByIdFn = (allItems: DimItem[], makeDupeIdFn: (item: DimItem) => string) => {
  // Holds a map from item hash to count of occurrences of that hash
  const duplicates: { [dupeID: string]: DimItem[] } = {};

  for (const i of allItems) {
    if (!i.comparable) {
      continue;
    }
    const dupeID = makeDupeIdFn(i);
    if (!duplicates[dupeID]) {
      duplicates[dupeID] = [];
    }
    duplicates[dupeID].push(i);
  }

  return duplicates;
};

/**
 * Find a map of duplicate items using the makeDupeID function.
 */
export const computeDupes = (allItems: DimItem[]) => computeDupesByIdFn(allItems, makeDupeID);

const dupeFilters: ItemFilterDefinition[] = [
  {
    keywords: 'dupe',
    description: tl('Filter.Dupe'),
    filter: ({ allItems }) => {
      const duplicates = computeDupes(allItems);
      return (item) => {
        const dupeId = makeDupeID(item);
        return checkIfIsDupe(duplicates, dupeId, item);
      };
    },
  },
  {
    keywords: 'dupelower',
    description: tl('Filter.DupeLower'),
    format: ['simple', 'query'],
    suggestions: ['power', 'combo'],
    filter: ({ filterValue, allItems, getTag }) => {
      // Default to 'power' if no specific value is provided
      const sortType = filterValue === 'combo' ? 'combo' : 'power';
      const duplicates = sortDupes(computeDupes(allItems), getTag, sortType);
      
      return (item) => {
        if (
          !(
            item.bucket &&
            (item.bucket.sort === 'Weapons' || item.bucket.sort === 'Armor') &&
            !item.notransfer
          )
        ) {
          return false;
        }

        const dupeId = makeDupeID(item);
        const dupes = duplicates[dupeId];
        if (dupes?.length > 1) {
          const bestDupe = dupes[0];
          return item !== bestDupe;
        }

        return false;
      };
    },
  },
  {
    keywords: 'infusionfodder',
    description: tl('Filter.InfusionFodder'),
    destinyVersion: 2,
    filter: ({ allItems }) => {
      const duplicates = computeDupesByIdFn(
        allItems.filter((i) => i.infusionFuel),
        (i) => i.hash.toString(),
      );
      return (item) => {
        if (!item.infusionFuel) {
          return false;
        }

        return duplicates[item.hash.toString()]?.some((i) => i.power < item.power);
      };
    },
  },
  {
    keywords: 'count',
    description: tl('Filter.DupeCount'),
    format: 'range',
    filter: ({ compare, allItems }) => {
      const duplicates = computeDupes(allItems);
      return (item) => {
        const dupeId = makeDupeID(item);
        return compare!(duplicates[dupeId]?.length ?? 0);
      };
    },
  },
  {
    keywords: 'statlower',
    description: tl('Filter.StatLower'),
    filter: ({ allItems }) => {
      const duplicates = computeStatDupeLower(allItems);
      return (item) => item.bucket.inArmor && duplicates.has(item.id);
    },
  },
  {
    keywords: 'customstatlower',
    description: tl('Filter.CustomStatLower'),
    filter: ({ allItems, customStats }) => {
      const duplicateSetsByClass: Partial<Record<DimItem['classType'], Set<string>[]>> = {};

      for (const customStat of customStats) {
        const relevantStatHashes: number[] = [];
        const statWeights = customStat.weights;
        for (const statHash in statWeights) {
          const weight = statWeights[statHash];
          if (weight && weight > 0) {
            relevantStatHashes.push(parseInt(statHash, 10));
          }
        }
        (duplicateSetsByClass[customStat.class] ||= []).push(
          computeStatDupeLower(allItems, relevantStatHashes),
        );
      }

      return (item) =>
        item.bucket.inArmor &&
        // highlight the item if it's statlower for all class-relevant custom stats.
        // this duplicates existing behavior for old style default-named custom stat,
        // but should be extended to also be a stat name-based filter
        // for users with multiple stats per class, a la customstatlower:pve
        duplicateSetsByClass[item.classType]?.every((dupeSet) => dupeSet.has(item.id));
    },
  },
  {
    keywords: ['crafteddupe', 'shapeddupe'],
    description: tl('Filter.CraftedDupe'),
    filter: ({ allItems }) => {
      const duplicates = computeDupes(allItems);
      return (item) => {
        const dupeId = makeDupeID(item);
        if (!checkIfIsDupe(duplicates, dupeId, item)) {
          return false;
        }
        const itemDupes = duplicates?.[dupeId];
        return itemDupes?.some((d) => d.crafted);
      };
    },
  },
  {
    keywords: ['dupeperks'],
    description: tl('Filter.DupePerks'),
    filter: ({ allItems }) => {
      const duplicates = new Map<string, PerksSet>();
      function getDupeId(item: DimItem) {
        // Don't compare across buckets or across types (e.g. Titan armor vs Hunter armor)
        return `${item.bucket.hash}|${item.classType}`;
      }
      for (const i of allItems) {
        if (i.sockets?.allSockets.some((s) => s.isPerk && s.socketDefinition.defaultVisible)) {
          const dupeId = getDupeId(i);
          if (!duplicates.has(dupeId)) {
            duplicates.set(dupeId, new PerksSet());
          }
          duplicates.get(dupeId)!.insert(i);
        }
      }
      return (item) =>
        item.sockets?.allSockets.some((s) => s.isPerk && s.socketDefinition.defaultVisible) &&
        Boolean(duplicates.get(getDupeId(item))?.hasPerkDupes(item));
    },
  },
  {
    keywords: 'dupebest',
    description: tl('Filter.DupeBest'),
    filter: ({ allItems, getTag, customStats }) => {
      const duplicates = sortDupesBest(computeDupes(allItems), getTag, customStats);
      return (item) => {
        const dupeId = makeDupeID(item);
        const dupes = duplicates[dupeId];
        if (dupes?.length > 1) {
          const bestDupe = dupes[0];
          return item === bestDupe;
        }
        return false;
      };
    },
  },
];

export default dupeFilters;

export function checkIfIsDupe(
  duplicates: {
    [dupeID: string]: DimItem[];
  },
  dupeId: string,
  item: DimItem,
) {
  return (
    duplicates[dupeId]?.length > 1 &&
    item.hash !== DEFAULT_SHADER &&
    item.bucket.hash !== BucketHashes.SeasonalArtifact
  );
}

/**
 * Compute a set of items that are "stat lower" dupes. These are items for which
 * there exists another item with strictly better stats (i.e. better in at least
 * one stat and not worse in any stat).
 */
function computeStatDupeLower(allItems: DimItem[], relevantStatHashes: number[] = armorStats) {
  // disregard no-class armor
  const armor = allItems.filter((i) => i.bucket.inArmor && i.classType !== DestinyClass.Classified);

  // Group by class and armor type. Also, compare exotics with each other, not the general pool.
  const grouped = Object.values(
    Object.groupBy(armor, (i) => `${i.bucket.hash}-${i.classType}-${i.isExotic ? i.hash : ''}`),
  );

  const dupes = new Set<string>();

  // A mapping from an item to a list of all of its stat configurations
  // (Artifice armor can have multiple). This is just a cache to prevent
  // recalculating it.
  const statsCache = new Map<DimItem, number[][]>();
  for (const item of armor) {
    if (item.stats && item.power) {
      const statValues = item.stats
        .filter((s) => relevantStatHashes.includes(s.statHash))
        .sort((a, b) => a.statHash - b.statHash)
        .map((s) => s.base);
      if (isArtifice(item)) {
        statsCache.set(
          item,
          // Artifice armor can be +3 in any one stat, so we compute a separate
          // version of the stats for each stat considered
          relevantStatHashes.map((_s, i) => {
            const modifiedStats = [...statValues];
            // One stat gets +3
            modifiedStats[i] += 3;
            return modifiedStats;
          }),
        );
      } else {
        statsCache.set(item, [statValues]);
      }
    }
  }

  // For each group of items that should be compared against each other
  for (const group of grouped) {
    if (!group) { // Add check for undefined group
      continue;
    }
    const statSet = new StatsSet<DimItem>();
    // Add a mapping from stats => item to the statsSet for each item in the group
    for (const item of group) {
      const stats = statsCache.get(item);
      if (stats) {
        for (const statValues of stats) {
          statSet.insert(statValues, item);
        }
      }
    }

    // Now run through the items in the group again, checking against the fully
    // populated stats set to see if there's something better
    for (const item of group) {
      const stats = statsCache.get(item);
      // All configurations must have a better version somewhere for this to count as statlower
      if (stats?.every((statValues) => statSet.doBetterStatsExist(statValues))) {
        dupes.add(item.id);
      }
    }
  }

  return dupes;
}
