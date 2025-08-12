import { CustomStatDef } from '@destinyitemmanager/dim-api-types';
import { languageSelector } from 'app/d2l-api/selectors';
import { useTableColumnSorts } from 'app/d2l-ui/table-columns';
import { t } from 'app/i18next-t';
import { locateItem } from 'app/inventory/locate-item';
import { createItemContextSelector } from 'app/inventory/selectors';
import { ItemCreationContext } from 'app/inventory/store/d2-item-factory';
import {
  applySocketOverrides,
  useSocketOverridesForItems,
} from 'app/inventory/store/override-sockets';
import { useD2Definitions } from 'app/manifest/selectors';
import { showNotification } from 'app/notifications/notifications';
import { buildStatInfo } from 'app/organizer/Columns';
import { buildRows, sortRows } from 'app/organizer/ItemTable';
import { ColumnDefinition, Row, TableContext } from 'app/organizer/table-types';
import { weaponMasterworkY2SocketTypeHash } from 'app/search/d2-known-values';
import Checkbox from 'app/settings/Checkbox';
import { useSetting } from 'app/settings/hooks';
// import { AppIcon, faList } from 'app/shell/icons';
import { acquisitionRecencyComparator } from 'app/shell/item-comparators';
import { useThunkDispatch } from 'app/store/thunk-dispatch';
import { compact } from 'app/utils/collections';
import { emptyArray } from 'app/utils/empty';
import { maxBy } from 'es-toolkit';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
// import { Link } from 'react-router';
import Sheet from '../d2l-ui/Sheet';
import { DimItem, DimSocket } from '../inventory/item-types';
import { chainComparator, compareBy } from '../utils/comparators';
import { getRollAppraiserUtilsSync } from 'app/roll-appraiser/rollAppraiserService';
import { getSocketsByType, getWeaponSockets } from 'app/utils/socket-utils';
import styles from './Compare.m.scss';
import { getColumns } from './CompareColumns';
import CompareItem, { CompareHeaders } from './CompareItem';
// import CompareSuggestions from './CompareSuggestions';
import { endCompareSession, removeCompareItem } from './actions';
// import { sortDupes } from '../search/items/search-filters/dupes';
import { CompareSession } from './reducer';
import { compareItemsSelector } from './selectors';

// TODO: CSS grid-with-sticky layout
// TODO: dropdowns for query buttons
// TODO: freeform query
// TODO: Allow minimizing the sheet (to make selection easier)
export default function Compare({ session }: { session: CompareSession }) {
  const dispatch = useThunkDispatch();
  const defs = useD2Definitions()!;
  const [compareBaseStats, setCompareBaseStats] = useSetting('compareBaseStats');
  const [assumeWeaponMasterwork] = useSetting('compareWeaponMasterwork');
  const [showAllArmorType, setShowAllArmorType] = useState(true); // Toggle for showing all armor of same class/type vs same itemHash
  const itemCreationContext = useSelector(createItemContextSelector);
  const rawCompareItems = useSelector(compareItemsSelector(session.vendorCharacterId));
  // const organizerLink = useSelector(compareOrganizerLinkSelector);

  /** The stat row to highlight */
  const [highlight, setHighlight] = useState<string | number>();
  const [socketOverrides, onPlugClicked] = useSocketOverridesForItems();
  const [columnSorts, toggleColumnSort] = useTableColumnSorts([]);

  const comparingArmor = rawCompareItems[0]?.bucket.inArmor;
  const comparingWeapons = rawCompareItems[0]?.bucket.inWeapons;
  const doCompareBaseStats = Boolean(compareBaseStats && comparingArmor);
  const doAssumeWeaponMasterworks = Boolean(defs && assumeWeaponMasterwork && comparingWeapons);

  // Filter items based on the toggle for armor
  const filteredCompareItems = useMemo(() => {
    if (comparingArmor && !showAllArmorType && session.initialItemId) {
      // When toggle is OFF for armor, show only items with same itemHash as the initial item
      // For exotic armor, also consider perks since they determine uniqueness
      const initialItem = rawCompareItems.find(item => item.id === session.initialItemId);
      if (initialItem) {
        if (initialItem.isExotic && initialItem.sockets?.allSockets) {
          // For exotic armor, match by both hash and perk combination
          const initialPerkHashes = initialItem.sockets.allSockets
            .filter(socket => socket.isPerk && socket.plugged?.plugDef.hash)
            .map(socket => socket.plugged!.plugDef.hash)
            .sort((a, b) => a - b);

          return rawCompareItems.filter(item => {
            if (item.hash !== initialItem.hash) return false;

            if (item.isExotic && item.sockets?.allSockets) {
              const itemPerkHashes = item.sockets.allSockets
                .filter(socket => socket.isPerk && socket.plugged?.plugDef.hash)
                .map(socket => socket.plugged!.plugDef.hash)
                .sort((a, b) => a - b);

              // Check if perk arrays are equal
              return initialPerkHashes.length === itemPerkHashes.length &&
                     initialPerkHashes.every((hash, index) => hash === itemPerkHashes[index]);
            }

            return true; // Non-exotic armor just needs same hash
          });
        } else {
          // Non-exotic armor: just match by hash
          return rawCompareItems.filter(item => item.hash === initialItem.hash);
        }
      }
    }
    // Default behavior: show all items (current behavior)
    return rawCompareItems;
  }, [rawCompareItems, comparingArmor, showAllArmorType, session.initialItemId]);

  // Produce new items which have had their sockets changed
  const compareItems = useMemo(() => {
    let items = filteredCompareItems;
    if (doAssumeWeaponMasterworks && comparingWeapons) {
      // Fully masterwork weapons
      items = items.map((i) => masterworkItem(i, itemCreationContext));
    }
    // Apply any socket override selections (perk choices)
    return items.map((i) => applySocketOverrides(itemCreationContext, i, socketOverrides[i.id]));
  }, [
    itemCreationContext,
    doAssumeWeaponMasterworks,
    filteredCompareItems,
    socketOverrides,
    comparingWeapons,
  ]);

  const cancel = useCallback(() => {
    dispatch(endCompareSession());
  }, [dispatch]);

  // Reset if there ever are no items
  const hasItems = compareItems.length > 0;
  useEffect(() => {
    if (!hasItems) {
      showNotification({
        type: 'warning',
        title: t('Compare.Error.Invalid'),
        body: session.query,
      });
      cancel();
    }
  }, [cancel, hasItems, session.query]);

  // Memoize computing the list of stats
  const allStats = useMemo(() => buildStatInfo(compareItems), [compareItems]);

  // const updateQuery = useCallback(
  //   (newQuery: string) => {
  //     dispatch(updateCompareQuery(newQuery));
  //   },
  //   [dispatch],
  // );

  const remove = useCallback(
    (item: DimItem) => {
      if (compareItems.length <= 1) {
        cancel();
      } else {
        dispatch(removeCompareItem(item));
      }
    },
    [cancel, compareItems.length, dispatch],
  );

  // If the session was started with a specific item, this is it
  const initialItem = session.initialItemId
    ? compareItems.find((i) => i.id === session.initialItemId)
    : undefined;

  /* ItemTable incursion */

  const destinyVersion = compareItems[0]?.destinyVersion ?? 2;
  const type = comparingArmor ? 'armor' : comparingWeapons ? 'weapon' : 'general';
  const hasEnergy = compareItems.some((i) => i.energy);
  const primaryStatDescription =
    (!comparingArmor &&
      !comparingWeapons &&
      compareItems.find((i) => i.primaryStat)?.primaryStatDisplayProperties) ||
    undefined;

  const customStats = comparingArmor
    ? itemCreationContext.customStats
    : emptyArray<CustomStatDef>();

  const columns: ColumnDefinition[] = useMemo(
    () =>
      getColumns(
        type,
        hasEnergy,
        allStats,
        customStats,
        destinyVersion,
        doCompareBaseStats,
        primaryStatDescription,
        initialItem?.id,
        onPlugClicked,
      ),
    [
      type,
      hasEnergy,
      allStats,
      doCompareBaseStats,
      destinyVersion,
      customStats,
      primaryStatDescription,
      initialItem?.id,
      onPlugClicked,
    ],
  );

  const classIfAny = comparingArmor ? compareItems[0]?.classType : undefined;
  const filteredColumns = useMemo(
    () =>
      // TODO: filter to enabled columns once you can select columns
      compact(
        columns.filter(
          (column) => column.limitToClass === undefined || column.limitToClass === classIfAny,
        ),
      ),
    [columns, classIfAny],
  );

  // process items into Rows
  const [unsortedRows, tableCtx] = useMemo(
    () => buildRows(compareItems, filteredColumns),
    [filteredColumns, compareItems],
  );
  const language = useSelector(languageSelector);
  const rows = useMemo(
    () =>
      sortRows(unsortedRows, columnSorts, filteredColumns, language, (a, b) =>
        chainComparator(
          compareBy((item) => item.id !== session.initialItemId),
          acquisitionRecencyComparator,
        )(a.item, b.item),
      ),
    [unsortedRows, columnSorts, filteredColumns, language, session.initialItemId],
  );

  /* End ItemTable incursion */

  // Identify the best item based on dupebest criteria
  const bestItem = useMemo(() => {
    if (rows.length <= 1) return undefined;

    // Sort a copy of the items using dupebest criteria
    const itemsCopy = [...rows.map(r => r.item)];

    // Sort directly using the dupebest comparator
    const getTag = (item: DimItem) => {
      // Use the tag selector to get the item's tag
      return (item.taggable && typeof item.taggable === 'object' && 'tag' in item.taggable)
        ? (item.taggable as any).tag
        : undefined;
    };

    // Create the comparator for dupebest
    const dupebestComparator = chainComparator<DimItem>(
      // 1. For armor: prioritize highest custom stat total if custom stats exist
      compareBy((item) => {
        if (comparingArmor && customStats.length > 0) {
          // Find the highest custom stat value for this item
          let highestCustomStatValue = 0;
          for (const customStat of customStats) {
            const stat = item.stats?.find(s => s.statHash === customStat.statHash);
            if (stat && stat.value > highestCustomStatValue) {
              highestCustomStatValue = stat.value;
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
      // 3. Weighted average of perk ranks in first two columns (tie-breaker for combo rank)
      compareBy((item) => {
        if (item.bucket.inWeapons && item.sockets) {
          const utils = getRollAppraiserUtilsSync();
          if (!utils) return Number.MAX_SAFE_INTEGER;

          // Get weapon sockets properly categorized
          const weaponSockets = getWeaponSockets(item, { excludeEmptySockets: false });
          if (!weaponSockets) return 0;

          // Get the first two perk sockets with multiple options (like dupes.ts does)
          const allPerkSockets = item.sockets.allSockets
            .filter((s) => {
              // Must be a perk socket with multiple options
              if (!s.isPerk || s.plugOptions.length <= 1) return false;

              // Exclude intrinsic socket
              if (weaponSockets.intrinsicSocket && s.socketIndex === weaponSockets.intrinsicSocket.socketIndex) {
                return false;
              }

              return true;
            })
            .sort((a, b) => a.socketIndex - b.socketIndex);

          // Use the first two perk sockets (which should be columns 1 & 2)
          if (allPerkSockets.length >= 2) {
            // Find the best rank among all available perks in each column
            let bestRank1 = Number.MAX_SAFE_INTEGER;
            let bestRank2 = Number.MAX_SAFE_INTEGER;

            // Check all plug options in first column
            for (const plug of allPerkSockets[0].plugOptions) {
              const perkRank = utils.getPerkRank(item.hash.toString(), plug.plugDef.hash);
              if (perkRank && perkRank.rank < bestRank1) {
                bestRank1 = perkRank.rank;
              }
            }

            // Check all plug options in second column
            for (const plug of allPerkSockets[1].plugOptions) {
              const perkRank = utils.getPerkRank(item.hash.toString(), plug.plugDef.hash);
              if (perkRank && perkRank.rank < bestRank2) {
                bestRank2 = perkRank.rank;
              }
            }

            if (bestRank1 !== Number.MAX_SAFE_INTEGER && bestRank2 !== Number.MAX_SAFE_INTEGER) {
              // Weight calculation: 1=2.5, 2=2.0, 3=1.5, 4+=1.0
              const getWeight = (rank: number) => {
                switch (rank) {
                  case 1: return 2.5;
                  case 2: return 2.0;
                  case 3: return 1.5;
                  default: return 1.0;
                }
              };

              const weight1 = getWeight(bestRank1);
              const weight2 = getWeight(bestRank2);
              const weightedAverage = (weight1 + weight2) / 2;

              // Return negative so higher averages (better) sort first
              return -weightedAverage;
            }
          }
        }
        return 0; // No penalty for non-weapons or items without perk data
      }),
      // 4. Highest Power
      compareBy((item) => -item.power),
      // 5. Tag priority
      compareBy((item) => {
        const tag = getTag(item);
        return !Boolean(tag && ['favorite', 'keep'].includes(tag));
      }),
      // 6. Masterwork status
      compareBy((item) => !item.masterwork),
      // 7. Lock status
      compareBy((item) => !item.locked),
      // 8. Item ID tiebreaker
      compareBy((i) => i.id),
    );

    itemsCopy.sort(dupebestComparator);

    // The first item after sorting is the best
    return itemsCopy[0];
  }, [rows, filteredCompareItems, comparingArmor, customStats]);

  const firstCompareItem = rows[0]?.item;
  // The example item is the one we'll use for generating suggestion buttons
  // const exampleItem = initialItem || firstCompareItem;

  const items = useMemo(
    () => (
      <CompareItems
        rows={rows}
        tableCtx={tableCtx}
        filteredColumns={filteredColumns}
        remove={remove}
        setHighlight={setHighlight}
        onPlugClicked={onPlugClicked}
        bestItem={bestItem}
      />
    ),
    [rows, tableCtx, filteredColumns, remove, onPlugClicked, bestItem],
  );

  const header = (
    <div className={styles.options}>
      {comparingArmor && (
        <Checkbox
          label={showAllArmorType
            ? `Show All ${firstCompareItem?.classType === 0 ? 'Titan' : firstCompareItem?.classType === 1 ? 'Hunter' : 'Warlock'} ${firstCompareItem?.typeName}s (${rawCompareItems.length})`
            : `Show Same ItemHash Only (${filteredCompareItems.length})`
          }
          name="showAllArmorType"
          value={showAllArmorType}
          onChange={setShowAllArmorType}
        />
      )}
      {comparingArmor && (
        <Checkbox
          label={t('Compare.CompareBaseStats')}
          name="compareBaseStats"
          value={compareBaseStats}
          onChange={setCompareBaseStats}
        />
      )}
      {/* Hiding Assume Masterworked toggle, CompareSuggestions (type buttons), and organizer link per user request */}
    </div>
  );

  const gridSpec = `min-content ${filteredColumns
    .map((c) => c.gridWidth ?? 'min-content')
    .join(' ')}`;
  return (
    <Sheet onClose={cancel} header={header} allowClickThrough>
      <div className={styles.scroller}>
        <div
          className={styles.bucket}
          style={{ gridTemplateRows: gridSpec }}
          onPointerLeave={() => setHighlight(undefined)}
        >
          <CompareHeaders
            columnSorts={columnSorts}
            highlight={highlight}
            setHighlight={setHighlight}
            toggleColumnSort={toggleColumnSort}
            filteredColumns={filteredColumns}
          />
          {items}
        </div>
      </div>
    </Sheet>
  );
}

function CompareItems({
  rows,
  tableCtx,
  filteredColumns,
  remove,
  setHighlight,
  onPlugClicked,
  bestItem,
}: {
  rows: Row[];
  tableCtx: TableContext;
  filteredColumns: ColumnDefinition[];
  remove: (item: DimItem) => void;
  setHighlight: React.Dispatch<React.SetStateAction<string | number | undefined>>;
  onPlugClicked: (value: { item: DimItem; socket: DimSocket; plugHash: number }) => void;
  bestItem?: DimItem;
}) {
  return rows.map((row) => (
    <CompareItem
      item={row.item}
      row={row}
      tableCtx={tableCtx}
      filteredColumns={filteredColumns}
      key={row.item.id}
      itemClick={locateItem}
      remove={remove}
      setHighlight={setHighlight}
      onPlugClicked={onPlugClicked}
      isBest={bestItem?.id === row.item.id}
    />
  ));
}

/**
 * Produce a copy of the item with the masterwork socket filled in with the best
 * masterwork option.
 */
function masterworkItem(i: DimItem, itemCreationContext: ItemCreationContext): DimItem {
  if (i.destinyVersion !== 2 || !i.sockets) {
    return i;
  }
  const y2MasterworkSocket = i.sockets?.allSockets.find(
    (socket) => socket.socketDefinition.socketTypeHash === weaponMasterworkY2SocketTypeHash,
  );
  const plugSet = y2MasterworkSocket?.plugSet;
  const plugged = y2MasterworkSocket?.plugged;
  if (plugSet && plugged) {
    const fullMasterworkPlug = maxBy(
      plugSet.plugs.filter(
        (p) => p.plugDef.plug.plugCategoryHash === plugged.plugDef.plug.plugCategoryHash,
      ),
      (plugOption) => plugOption.plugDef.investmentStats[0]?.value,
    );
    if (fullMasterworkPlug) {
      return applySocketOverrides(itemCreationContext, i, {
        [y2MasterworkSocket.socketIndex]: fullMasterworkPlug.plugDef.hash,
      });
    }
  }
  return i;
}
