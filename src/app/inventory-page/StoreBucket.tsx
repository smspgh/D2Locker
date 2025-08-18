import { DestinyVersion, VaultWeaponGroupingStyle } from '@destinyitemmanager/dim-api-types';
import WeaponGroupingIcon from 'app/d2l-ui/WeaponGroupingIcon';
import { InventoryBucket } from 'app/inventory/inventory-buckets';
import { DimItem } from 'app/inventory/item-types';
import { currentStoreSelector, storesSelector } from 'app/inventory/selectors';
import { DimStore } from 'app/inventory/store-types';
import { findItemsByBucket } from 'app/inventory/stores-helpers';
import { itemSorterSelector } from 'app/settings/item-sort';
import {
  vaultWeaponGroupingEnabledSelector,
  vaultWeaponGroupingSelector,
  vaultWeaponGroupingStyleSelector,
} from 'app/settings/vault-grouping';
import { vaultGroupingValueWithType } from 'app/shell/item-comparators';
import { DestinyClass } from 'bungie-api-ts/destiny2';
import clsx from 'clsx';
import { BucketHashes } from 'data/d2/generated-enums';
import emptyEngram from 'destiny-icons/general/empty-engram.svg';
import { shallowEqual } from 'fast-equals';
import { memo, useRef } from 'react';
import { useSelector } from 'react-redux';
import styles from './StoreBucket.m.scss';
import './StoreBucket.scss';
import StoreBucketDropTarget from './StoreBucketDropTarget';
import StoreInventoryItem from './StoreInventoryItem';

/**
 * Given an array of objects, return the same version of the array
 * (reference-equal with previous versions) as long as the contents of the
 * passed in array is the same as other arrays. This prevents re-renders when we
 * have to generate new arrays but the contents are the same.
 *
 * This is conceptually similar to useMemo except instead of memoizing on the
 * inputs, it memoizes on the outputs.
 */
function useStableArray<T>(arr: T[]) {
  const lastItems = useRef<T[]>([]);
  if (!shallowEqual(lastItems.current, arr)) {
    lastItems.current = arr;
  }
  return lastItems.current;
}

/**
 * A single bucket of items (for a single store). The arguments for this
 * component are the bare minimum needed, so that we can memoize it to avoid
 * unnecessary re-renders of unaffected buckets when moving items around. The
 * StoreBucket component does the heavy lifting of picking apart these input
 * props for StoreBucketInner.
 */
const StoreBucketInner = memo(function StoreBucketInner({
  items,
  bucket,
  storeId,
  destinyVersion,
  storeClassType,
  isVault,
}: {
  bucket: InventoryBucket;
  destinyVersion: DestinyVersion;
  storeId: string;
  storeClassType: DestinyClass;
  isVault: boolean;
  items: DimItem[];
}) {
  const sortItems = useSelector(itemSorterSelector);
  const groupWeapons = useSelector(vaultWeaponGroupingSelector);
  const vaultWeaponGroupingEnabled = useSelector(vaultWeaponGroupingEnabledSelector);
  const weaponGroupingStyle = useSelector(vaultWeaponGroupingStyleSelector);

  const equippedItem = isVault ? undefined : items.find((i) => i.equipped);
  const unequippedItems =
    isVault && bucket.inWeapons
      ? groupWeapons(sortItems(items))
      : sortItems(isVault ? items : items.filter((i) => !i.equipped));

  // represents whether there's *supposed* to be an equipped item here, aka armor/weapon/artifact, etc
  const isEquippable = Boolean(equippedItem || bucket.equippable);
  // Engrams. D1 uses this same bucket hash for "Missions"
  const isEngrams = destinyVersion === 2 && bucket.hash === BucketHashes.Engrams;
  // Only D2 has special subclass display
  const isSubclass = destinyVersion === 2 && bucket.hash === BucketHashes.Subclass;

  return (
    <>
      {(equippedItem || isEquippable) && !isVault && (
        <StoreBucketDropTarget
          grouped={false}
          equip={true}
          bucket={bucket}
          storeId={storeId}
          storeClassType={storeClassType}
          className={clsx({ [styles.subClass]: isSubclass })}
        >
          {equippedItem && (
            <div className="equipped-item">
              <StoreInventoryItem key={equippedItem.index} item={equippedItem} />
            </div>
          )}
        </StoreBucketDropTarget>
      )}
      <StoreBucketDropTarget
        grouped={isVault && vaultWeaponGroupingEnabled}
        equip={false}
        bucket={bucket}
        storeId={storeId}
        storeClassType={storeClassType}
        // class representing a *character* bucket area that's not equippable
        className={clsx({
          [styles.notEquippable]: !isVault && !isEquippable && !isEngrams,
          [styles.inlineGroups]: weaponGroupingStyle === VaultWeaponGroupingStyle.Inline,
          [styles.engrams]: isEngrams,
          [styles.subClass]: isSubclass,
        })}
      >
        {unequippedItems.map((groupOrItem) =>
          'id' in groupOrItem ? (
            <StoreInventoryItem key={groupOrItem.index} item={groupOrItem} />
          ) : (
            <div
              className={styles.vaultGroup}
              key={vaultGroupingValueWithType(groupOrItem.groupingValue)}
            >
              <WeaponGroupingIcon
                icon={groupOrItem.icon}
                className={styles.weaponGroupingIconWrapper}
              />
              {groupOrItem.items.map((item) => (
                <StoreInventoryItem key={item.index} item={item} />
              ))}
            </div>
          ),
        )}
        {isEngrams &&
          !isVault &&
          Array.from(
            // lower bound of 0, in case this bucket becomes overfilled
            { length: Math.max(0, bucket.capacity - unequippedItems.length) },
            (_, index) => (
              <img
                src={emptyEngram}
                className={styles.emptyEngram}
                aria-hidden="true"
                key={index}
              />
            ),
          )}
      </StoreBucketDropTarget>
    </>
  );
});

/**
 * The items for a single bucket on a single store.
 */
export default function StoreBucket({
  store,
  bucket,
  singleCharacter,
}: {
  store: DimStore;
  bucket: InventoryBucket;
  singleCharacter: boolean;
}) {
  const currentStore = useSelector(currentStoreSelector);
  const stores = useSelector(storesSelector);

  let items = findItemsByBucket(store, bucket.hash);

  // Single character mode collapses all items from other characters into "the
  // vault" (but only those items that could be used by the current character)
  if (singleCharacter && store.isVault && (bucket.vaultBucket || bucket.inPostmaster)) {
    for (const otherStore of stores) {
      if (!otherStore.current && !otherStore.isVault) {
        items = [...items, ...findItemsByBucket(otherStore, bucket.hash)];
      }
    }
    // TODO: When we switch accounts this suffers from the "zombie child" problem where the redux store has already
    // updated (so currentStore is cleared) but the store from props is still around because its redux subscription
    // hasn't fired yet.
    items = items.filter(
      (i) =>
        i.classType === DestinyClass.Unknown ||
        (currentStore && i.classType === currentStore.classType),
    );
  }

  const stableItems = useStableArray(items);

  // TODO: move grouping here?

  return (
    <StoreBucketInner
      bucket={bucket}
      destinyVersion={store.destinyVersion}
      storeId={store.id}
      // @ts-expect-error storeName is not part of the props anymore
      storeName={store.name}
      storeClassType={store.classType}
      isVault={store.isVault}
      items={stableItems}
    />
  );
}
