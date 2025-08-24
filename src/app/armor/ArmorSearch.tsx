import CollapsibleTitle from 'app/d2l-ui/CollapsibleTitle';
import PageWithMenu from 'app/d2l-ui/PageWithMenu';
import { DimItem } from 'app/inventory/item-types';
import { createItemContextSelector } from 'app/inventory/selectors';
import { makeFakeItem } from 'app/inventory/store/d2-item-factory';
import { useD2Definitions } from 'app/manifest/selectors';
import { searchFilterSelector } from 'app/search/items/item-search-filter';
import { querySelector } from 'app/shell/selectors';
import { DestinyInventoryItemDefinition } from 'bungie-api-ts/destiny2';
import { BucketHashes } from 'data/d2/generated-enums';
import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import ItemGrid from '../armory/ItemGrid';
import styles from './ArmorSearch.m.scss';
import { ArmorSearchProvider } from './ArmorSearchContext';

export default function ArmorSearch() {
  const defs = useD2Definitions()!;
  const itemCreationContext = useSelector(createItemContextSelector);

  // Use the global search query and filter
  const query = useSelector(querySelector);
  const searchFilter = useSelector(searchFilterSelector);

  // Generate all armor from manifest
  const allManifestArmor = useMemo(() => {
    if (!defs || !itemCreationContext) {
      return [];
    }

    const armorDefs = Object.values(defs.InventoryItem.getAll()).filter(
      (def) =>
        def.inventory &&
        isArmorItem(def) &&
        !isDummyItem(def) &&
        def.displayProperties.name &&
        def.displayProperties.name.trim() !== '',
    );

    const armor: DimItem[] = [];
    for (const armorDef of armorDefs) {
      try {
        const fakeItem = makeFakeItem(itemCreationContext, armorDef.hash, {
          allowWishList: true,
        });
        if (fakeItem) {
          armor.push(fakeItem);
        }
      } catch (e) {
        // Skip items that fail to create
        console.warn('Failed to create fake item for hash:', armorDef.hash, e);
      }
    }

    return armor;
  }, [defs, itemCreationContext]);

  // Filter armor using the main search filter
  const filteredArmor = useMemo(() => {
    if (!query.trim()) {
      return allManifestArmor;
    }

    // Use the main search filter on our manifest armor
    return allManifestArmor.filter((armor) => {
      try {
        return searchFilter(armor);
      } catch {
        // If search filter fails, fall back to simple name search
        const searchTerm = query.toLowerCase();
        return (
          armor.name.toLowerCase().includes(searchTerm) ||
          armor.typeName?.toLowerCase().includes(searchTerm) ||
          armor.description?.toLowerCase().includes(searchTerm)
        );
      }
    });
  }, [query, allManifestArmor, searchFilter]);

  const armorByType = useMemo(() => {
    const grouped = new Map<string, DimItem[]>();

    for (const armor of filteredArmor) {
      const typeName = armor.typeName || 'Other';
      if (!grouped.has(typeName)) {
        grouped.set(typeName, []);
      }
      grouped.get(typeName)!.push(armor);
    }

    // Sort each group by name
    for (const armors of grouped.values()) {
      armors.sort((a, b) => a.name.localeCompare(b.name));
    }

    return grouped;
  }, [filteredArmor]);

  return (
    <ArmorSearchProvider filteredArmor={filteredArmor} allArmor={allManifestArmor}>
      <PageWithMenu>
        <PageWithMenu.Menu>
          <div className={styles.armorSearchControls}>
            <h1>Armor Database</h1>
            <p>Search and explore all armor in Destiny 2.</p>

            <div className={styles.resultsCount}>
              Showing {filteredArmor.length} of {allManifestArmor.length} armor pieces
            </div>
          </div>
        </PageWithMenu.Menu>

        <PageWithMenu.Contents>
          <div className={`${styles.armorSearchResults} armor-search-results`}>
            {Array.from(armorByType.entries(), ([typeName, armors]) => (
              <div key={typeName} className={styles.armorTypeSection}>
                <div className="store-cell">
                  <CollapsibleTitle
                    title={`${typeName} (${armors.length})`}
                    defaultCollapsed={false}
                    sectionId={`armor-type-${typeName.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <ItemGrid items={armors} directToArmory />
                  </CollapsibleTitle>
                </div>
              </div>
            ))}

            {filteredArmor.length === 0 && query && (
              <div className={styles.noResults}>
                No armor found matching your search. Try adjusting your search terms.
              </div>
            )}
          </div>
        </PageWithMenu.Contents>
      </PageWithMenu>
    </ArmorSearchProvider>
  );
}

/**
 * Check if an item definition represents armor
 */
function isArmorItem(def: DestinyInventoryItemDefinition): boolean {
  // Check if it's in an armor bucket
  const armorBuckets = [
    BucketHashes.Helmet,
    BucketHashes.Gauntlets,
    BucketHashes.ChestArmor,
    BucketHashes.LegArmor,
    BucketHashes.ClassArmor,
  ];

  return def.inventory && armorBuckets.includes(def.inventory.bucketTypeHash);
}

/**
 * Check if this is a dummy/placeholder item that shouldn't be shown
 */
function isDummyItem(def: DestinyInventoryItemDefinition): boolean {
  // Skip items with no icon or display properties
  if (!def.displayProperties?.icon || !def.displayProperties?.name) {
    return true;
  }

  // Skip items marked as redacted/classified
  if (def.redacted) {
    return true;
  }

  // Skip items with dummy category hashes
  const dummyCategories = [3109687656]; // ItemCategoryHashes.Dummies
  return def.itemCategoryHashes?.some((hash: number) => dummyCategories.includes(hash)) || false;
}
