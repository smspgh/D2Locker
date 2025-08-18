import CollapsibleTitle from 'app/d2l-ui/CollapsibleTitle';
import PageWithMenu from 'app/d2l-ui/PageWithMenu';
import { DimItem } from 'app/inventory/item-types';
import { createItemContextSelector } from 'app/inventory/selectors';
import { makeFakeItem } from 'app/inventory/store/d2-item-factory';
import { useD2Definitions } from 'app/manifest/selectors';
import { searchFilterSelector } from 'app/search/items/item-search-filter';
import { querySelector } from 'app/shell/selectors';
import { BucketHashes } from 'data/d2/generated-enums';
import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import styles from './ArmorySearch.m.scss';
import { ArmorySearchProvider } from './ArmorySearchContext';
import ItemGrid from './ItemGrid';

export default function ArmorySearch() {
  const defs = useD2Definitions()!;
  const itemCreationContext = useSelector(createItemContextSelector);

  // Use the global search query and filter
  const query = useSelector(querySelector);
  const searchFilter = useSelector(searchFilterSelector);

  // Generate all weapons from manifest
  const allManifestWeapons = useMemo(() => {
    if (!defs || !itemCreationContext) {
      return [];
    }

    const weaponDefs = Object.values(defs.InventoryItem.getAll()).filter(
      (def) =>
        def.inventory &&
        isWeaponItem(def) &&
        !isDummyItem(def) &&
        def.displayProperties.name &&
        def.displayProperties.name.trim() !== '',
    );

    const weapons: DimItem[] = [];
    for (const weaponDef of weaponDefs) {
      try {
        const fakeItem = makeFakeItem(itemCreationContext, weaponDef.hash, {
          allowWishList: true,
        });
        if (fakeItem) {
          weapons.push(fakeItem);
        }
      } catch (e) {
        // Skip items that fail to create
        console.warn('Failed to create fake item for hash:', weaponDef.hash, e);
      }
    }

    return weapons;
  }, [defs, itemCreationContext]);

  // Filter weapons using the main search filter
  const filteredWeapons = useMemo(() => {
    if (!query.trim()) {
      return allManifestWeapons;
    }

    // Use the main search filter on our manifest weapons
    return allManifestWeapons.filter((weapon) => {
      try {
        return searchFilter(weapon);
      } catch (error) {
        // If search filter fails, fall back to simple name search
        const searchTerm = query.toLowerCase();
        return (
          weapon.name.toLowerCase().includes(searchTerm) ||
          weapon.typeName?.toLowerCase().includes(searchTerm) ||
          weapon.description?.toLowerCase().includes(searchTerm)
        );
      }
    });
  }, [query, allManifestWeapons, searchFilter]);

  const weaponsByType = useMemo(() => {
    const grouped = new Map<string, DimItem[]>();

    for (const weapon of filteredWeapons) {
      const typeName = weapon.typeName || 'Other';
      if (!grouped.has(typeName)) {
        grouped.set(typeName, []);
      }
      grouped.get(typeName)!.push(weapon);
    }

    // Sort each group by name
    for (const weapons of grouped.values()) {
      weapons.sort((a, b) => a.name.localeCompare(b.name));
    }

    return grouped;
  }, [filteredWeapons]);

  return (
    <ArmorySearchProvider filteredWeapons={filteredWeapons} allWeapons={allManifestWeapons}>
      <PageWithMenu>
        <PageWithMenu.Menu>
          <div className={styles.armorySearchControls}>
            <h1>Weapon Database</h1>
            <p>Search and explore all weapons in Destiny 2.</p>

            <div className={styles.resultsCount}>
              Showing {filteredWeapons.length} of {allManifestWeapons.length} weapons
            </div>
          </div>
        </PageWithMenu.Menu>

        <PageWithMenu.Contents>
          <div className={`${styles.armorySearchResults} armory-search-results`}>
            {Array.from(weaponsByType.entries(), ([typeName, weapons]) => (
              <div key={typeName} className={styles.weaponTypeSection}>
                <CollapsibleTitle
                  title={`${typeName} (${weapons.length})`}
                  defaultCollapsed={false}
                  sectionId={`weapon-type-${typeName.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  <ItemGrid items={weapons} directToArmory />
                </CollapsibleTitle>
              </div>
            ))}

            {filteredWeapons.length === 0 && query && (
              <div className={styles.noResults}>
                No weapons found matching your search. Try adjusting your search terms.
              </div>
            )}
          </div>
        </PageWithMenu.Contents>
      </PageWithMenu>
    </ArmorySearchProvider>
  );
}

/**
 * Check if an item definition represents a weapon
 */
function isWeaponItem(def: any): boolean {
  // Check if it's in a weapon bucket
  const weaponBuckets = [
    BucketHashes.KineticWeapons,
    BucketHashes.EnergyWeapons,
    BucketHashes.PowerWeapons,
  ];

  return def.inventory && weaponBuckets.includes(def.inventory.bucketTypeHash);
}

/**
 * Check if this is a dummy/placeholder item that shouldn't be shown
 */
function isDummyItem(def: any): boolean {
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
  if (def.itemCategoryHashes?.some((hash: number) => dummyCategories.includes(hash))) {
    return true;
  }

  return false;
}
