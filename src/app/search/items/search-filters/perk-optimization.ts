import { tl } from 'app/i18next-t';
import { DimItem } from 'app/inventory/item-types';
import { testStringsFromAllSockets } from 'app/search/items/search-filters/freeform';
import { matchText } from 'app/search/text-utils';
import { ItemFilterDefinition } from '../item-filter-types';
import {
  displayStatToHashMap,
  getPerkStatHashes,
  isValidPerkName,
  perkStatMappings,
} from './perk-stat-mappings';

/**
 * Filter that finds the best armor piece for a given perk based on optimized primary/secondary stats
 */
const perkOptimizationFilter: ItemFilterDefinition = {
  keywords: 'bestforperk',
  description: tl('Filter.BestForPerk'),
  format: 'query',
  suggestions: Object.keys(perkStatMappings),
  destinyVersion: 2,
  filter: ({ filterValue, allItems, language, d2Definitions }) => {
    console.log('🔥 bestforperk filter called with:', filterValue);
    console.log('🔥 allItems count:', allItems.length);
    console.log('🔥 d2Definitions:', Boolean(d2Definitions));

    // Get the stat hashes for this perk, or use defaults if not in our mapping
    let primaryStatHash: number;
    let secondaryStatHash: number;

    if (isValidPerkName(filterValue)) {
      const statHashes = getPerkStatHashes(filterValue);
      primaryStatHash = statHashes.primary;
      secondaryStatHash = statHashes.secondary;
    } else if (filterValue.toLowerCase().includes('brawler')) {
      // Brawler perks should optimize for Melee (primary) and Health (secondary)
      primaryStatHash = displayStatToHashMap.Melee;
      secondaryStatHash = displayStatToHashMap.Health;
    } else {
      // Default fallback - optimize for Health and Melee
      primaryStatHash = displayStatToHashMap.Health;
      secondaryStatHash = displayStatToHashMap.Melee;
    }

    // Find all items that have the specified perk
    const perkTest = matchText(filterValue, language, /* exact */ false);
    const itemsWithPerk = allItems.filter(
      (item) =>
        item.bucket.inArmor &&
        item.stats &&
        testStringsFromAllSockets(perkTest, item, d2Definitions, /* includeDescription */ false),
    );

    // Debug logging
    if ($D2L_FLAVOR === 'dev') {
      console.log(`Looking for perk: "${filterValue}"`);
      console.log(`Found ${itemsWithPerk.length} items with this perk`);
      if (itemsWithPerk.length > 0) {
        console.log(
          'Sample items:',
          itemsWithPerk.slice(0, 3).map((i) => i.name),
        );
      }
    }

    if (itemsWithPerk.length === 0) {
      return () => false;
    }

    // Group items by slot and class
    const itemsBySlotClass: Record<string, DimItem[]> = {};
    for (const item of itemsWithPerk) {
      const key = `${item.bucket.hash}-${item.classType}`;
      if (!itemsBySlotClass[key]) {
        itemsBySlotClass[key] = [];
      }
      itemsBySlotClass[key].push(item);
    }

    // For each slot+class group, find the best item(s) based on primary stat, then secondary stat
    const bestItemIds = new Set<string>();

    for (const [_slotClass, items] of Object.entries(itemsBySlotClass)) {
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
        const itemPrimaryStat = item.stats?.find((s) => s.statHash === primaryStatHash)?.base || 0;
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
};

export default [perkOptimizationFilter];
