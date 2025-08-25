import { SearchType } from '@destinyitemmanager/dim-api-types';
import { destinyVersionSelector } from 'app/accounts/selectors';
import { compareFilteredItems } from 'app/compare/actions';
import { saveSearch } from 'app/d2l-api/basic-actions';
import { recentSearchesSelector } from 'app/d2l-api/selectors';
import Dropdown, { Option } from 'app/d2l-ui/Dropdown';
import useConfirm from 'app/d2l-ui/useConfirm';
import { t } from 'app/i18next-t';
import { insertPlug } from 'app/inventory/advanced-write-actions';
import { bulkLockItems, bulkTagItems } from 'app/inventory/bulk-actions';
import { DimSocket } from 'app/inventory/item-types';
import { storesSortedByImportanceSelector } from 'app/inventory/selectors';
import { DimStore } from 'app/inventory/store-types';
import { itemMoveLoadout } from 'app/loadout-drawer/auto-loadouts';
import { applyLoadout } from 'app/loadout-drawer/loadout-apply';
import { showNotification } from 'app/notifications/notifications';
import { TagCommandInfo } from 'app/organizer/ItemActions';
import { useRollAppraiserUtils } from 'app/roll-appraiser/useRollAppraiserData';
import { validateQuerySelector } from 'app/search/items/item-search-filter';
import { canonicalizeQuery, parseQuery } from 'app/search/query-parser';
import { toggleSearchResults } from 'app/shell/actions';
import { useIsPhonePortrait } from 'app/shell/selectors';
import { useThunkDispatch } from 'app/store/thunk-dispatch';
import { stripSockets } from 'app/strip-sockets/strip-sockets-actions';
import { compact } from 'app/utils/collections';
import { getSocketsByIndexes, getWeaponSockets } from 'app/utils/socket-utils';
import { memo } from 'react';
import { useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router';
import { TagCommand, itemTagSelectorList } from '../inventory/d2l-item-info';
import { DimItem } from '../inventory/item-types';
import {
  AppIcon,
  clearIcon,
  compareIcon,
  faList,
  faTshirt,
  faWindowClose,
  lockIcon,
  starIcon,
  starOutlineIcon,
  stickyNoteIcon,
  unlockedIcon,
} from '../shell/icons';
import { loadingTracker } from '../shell/loading-tracker';
import styles from './ItemActionsDropdown.m.scss';

/**
 * Various actions that can be performed on an item
 */
export default memo(function ItemActionsDropdown({
  searchActive,
  filteredItems,
  searchQuery,
  fixed,
  bulkNote,
}: {
  searchQuery: string;
  filteredItems: DimItem[];
  searchActive: boolean;
  fixed?: boolean;
  bulkNote: (items: DimItem[]) => Promise<void>;
}) {
  const dispatch = useThunkDispatch();
  const navigate = useNavigate();
  const isPhonePortrait = useIsPhonePortrait();
  const stores = useSelector(storesSortedByImportanceSelector);
  const destinyVersion = useSelector(destinyVersionSelector);
  const [confirmDialog, confirm] = useConfirm();

  let isComparable = false;
  if (filteredItems.length) {
    const type = filteredItems[0].typeName;
    isComparable = filteredItems.every((i) => i.typeName === type);
  }

  const canStrip = filteredItems.some((i) =>
    i.sockets?.allSockets.some(
      (s) => s.emptyPlugItemHash && s.plugged?.plugDef.hash !== s.emptyPlugItemHash,
    ),
  );

  const bulkTag = loadingTracker.trackPromise(async (selectedTag: TagCommand) => {
    // Bulk tagging
    const tagItems = filteredItems.filter((i) => i.taggable);
    const tagLabel =
      selectedTag === 'clear'
        ? t('Tags.ClearTag')
        : itemTagSelectorList.find((t) => t.type === selectedTag)?.label || selectedTag;

    const confirmMessage = t('MovePopup.ConfirmBulkTag', {
      count: tagItems.length,
      tag: tagLabel,
    });

    if (!(await confirm(confirmMessage))) {
      return;
    }

    dispatch(bulkTagItems(tagItems, selectedTag));
  });

  const bulkLock = loadingTracker.trackPromise(async (selectedTag: 'lock' | 'unlock') => {
    // Bulk locking/unlocking
    const state = selectedTag === 'lock';
    const lockables = filteredItems.filter((i) => i.lockable);

    const confirmMessage = state
      ? t('MovePopup.ConfirmBulkLock', { count: lockables.length })
      : t('MovePopup.ConfirmBulkUnlock', { count: lockables.length });

    if (!(await confirm(confirmMessage))) {
      return;
    }

    dispatch(bulkLockItems(lockables, state));
  });

  const { utils } = useRollAppraiserUtils();

  const applyBestPerks = loadingTracker.trackPromise(async () => {
    if (!utils) {
      showNotification({
        type: 'error',
        title: t('BestPerks.Error'),
        body: t('BestPerks.NotApplicable'),
      });
      return;
    }

    const weapons = filteredItems.filter((item) => item.bucket?.inWeapons && item.sockets);
    if (weapons.length === 0) {
      showNotification({
        type: 'warning',
        title: t('BestPerks.NoWeapons'),
        body: t('BestPerks.NoWeaponsFound'),
      });
      return;
    }

    // Show confirmation dialog
    const confirmMessage = t('BestPerks.BulkConfirm', { count: weapons.length });
    if (!(await confirm(confirmMessage))) {
      return;
    }

    let successCount = 0;
    let _failCount = 0;

    for (const item of weapons) {
      try {
        const weaponSockets = getWeaponSockets(item, {
          excludeEmptySockets: false,
          includeFakeMasterwork: Boolean(item.crafted),
        });
        if (!weaponSockets?.perks) {
          _failCount++;
          continue;
        }

        const perkSockets = getSocketsByIndexes(item.sockets!, weaponSockets.perks.socketIndexes);
        const perksToApply: { socket: DimSocket; plugHash: number }[] = [];

        // Handle trait combo optimization
        const column3Perks: number[] = [];
        const column4Perks: number[] = [];
        let column3Socket: DimSocket | null = null;
        let column4Socket: DimSocket | null = null;

        for (const [socketIndex, socket] of perkSockets.entries()) {
          if (socketIndex === 2) {
            column3Socket = socket;
            if (socket.reusablePlugItems) {
              for (const plug of socket.reusablePlugItems) {
                if (plug.enabled) {
                  column3Perks.push(plug.plugItemHash);
                }
              }
            }
            if (socket.plugged && !column3Perks.includes(socket.plugged.plugDef.hash)) {
              column3Perks.push(socket.plugged.plugDef.hash);
            }
          } else if (socketIndex === 3) {
            column4Socket = socket;
            if (socket.reusablePlugItems) {
              for (const plug of socket.reusablePlugItems) {
                if (plug.enabled) {
                  column4Perks.push(plug.plugItemHash);
                }
              }
            }
            if (socket.plugged && !column4Perks.includes(socket.plugged.plugDef.hash)) {
              column4Perks.push(socket.plugged.plugDef.hash);
            }
          }
        }

        if (column3Perks.length > 0 && column4Perks.length > 0 && column3Socket && column4Socket) {
          let bestCombo: { rank: number; perk3Hash: number; perk4Hash: number } | null = null;

          for (const perk3 of column3Perks) {
            for (const perk4 of column4Perks) {
              const combo = utils.getTraitComboRank(
                item.hash.toString(),
                perk3.toString(),
                perk4.toString(),
              );
              if (combo && (!bestCombo || combo.rank < bestCombo.rank)) {
                bestCombo = { rank: combo.rank, perk3Hash: perk3, perk4Hash: perk4 };
              }
            }
          }

          if (bestCombo) {
            // Override individual best perks with combo best perks
            for (const [index, perk] of perksToApply.entries()) {
              if (perk.socket === column3Socket) {
                perksToApply[index] = { socket: column3Socket, plugHash: bestCombo.perk3Hash };
              } else if (perk.socket === column4Socket) {
                perksToApply[index] = { socket: column4Socket, plugHash: bestCombo.perk4Hash };
              }
            }

            if (
              !perksToApply.find((p) => p.socket === column3Socket) &&
              column3Socket.plugged?.plugDef.hash !== bestCombo.perk3Hash
            ) {
              perksToApply.push({ socket: column3Socket, plugHash: bestCombo.perk3Hash });
            }
            if (
              !perksToApply.find((p) => p.socket === column4Socket) &&
              column4Socket.plugged?.plugDef.hash !== bestCombo.perk4Hash
            ) {
              perksToApply.push({ socket: column4Socket, plugHash: bestCombo.perk4Hash });
            }
          }
        }

        // Apply the perks
        if (perksToApply.length > 0) {
          for (const { socket, plugHash } of perksToApply) {
            await dispatch(insertPlug(item, socket, plugHash));
          }
          successCount++;
        }
      } catch (error) {
        console.error('Error applying best perks to item:', item.name, error);
        _failCount++;
      }
    }

    if (successCount > 0) {
      showNotification({
        type: 'success',
        title: t('BestPerks.BulkSuccess'),
        body: t('BestPerks.BulkSuccessBody', { success: successCount, total: weapons.length }),
      });
    } else {
      showNotification({
        type: 'error',
        title: t('BestPerks.BulkFailed'),
        body: t('BestPerks.BulkFailedBody'),
      });
    }
  });

  const compareMatching = async () => {
    const confirmMessage = t('MovePopup.ConfirmBulkCompare', {
      count: filteredItems.length,
    });

    if (!(await confirm(confirmMessage))) {
      return;
    }

    dispatch(compareFilteredItems(searchQuery, filteredItems, undefined));
  };

  const handleStripSockets = async () => {
    const socketsToStrip = filteredItems.filter((i) =>
      i.sockets?.allSockets.some(
        (s) => s.emptyPlugItemHash && s.plugged?.plugDef.hash !== s.emptyPlugItemHash,
      ),
    );

    const confirmMessage = t('MovePopup.ConfirmBulkStripSockets', {
      count: socketsToStrip.length,
    });

    if (!(await confirm(confirmMessage))) {
      return;
    }

    stripSockets(searchQuery);
  };

  const handleBulkNote = async () => {
    const confirmMessage = t('MovePopup.ConfirmBulkNote', {
      count: filteredItems.length,
    });

    if (!(await confirm(confirmMessage))) {
      return;
    }

    bulkNote(filteredItems);
  };

  // Move items matching the current search. Max 9 per type.
  const applySearchLoadout = async (store: DimStore) => {
    const itemCount = filteredItems.length;
    const confirmMessage = store.isVault
      ? t('MovePopup.ConfirmBulkStore', {
          count: itemCount,
          character: 'Vault',
        })
      : t('MovePopup.ConfirmBulkStore', {
          count: itemCount,
          character: store.name,
        });

    if (!(await confirm(confirmMessage))) {
      return;
    }

    const loadout = itemMoveLoadout(filteredItems, store);
    dispatch(applyLoadout(store, loadout, { allowUndo: true }));
  };

  const bulkItemTags: (Omit<TagCommandInfo, 'label'> & { label: string })[] = itemTagSelectorList
    .filter((t) => t.type)
    .map((tag) => ({
      ...tag,
      label: t('Header.TagAs', { tag: t(tag.label) }),
    }));
  bulkItemTags.push({ type: 'clear', label: t('Tags.ClearTag'), icon: clearIcon });

  // Is the current search saved?
  const recentSearches = useSelector(recentSearchesSelector(SearchType.Item));
  const validateQuery = useSelector(validateQuerySelector);
  const { valid, saveable } = validateQuery(searchQuery);
  const canonical = searchQuery ? canonicalizeQuery(parseQuery(searchQuery)) : '';
  const saved = canonical ? recentSearches.find((s) => s.query === canonical)?.saved : false;

  const toggleSaved = () => {
    // TODO: keep track of the last search, if you search for something more narrow immediately after then replace?
    dispatch(saveSearch({ query: searchQuery, saved: !saved, type: SearchType.Item }));
  };

  const location = useLocation();
  const onInventory = location.pathname.endsWith('inventory');
  const showSearchResults = onInventory;

  const dropdownOptions: Option[] = compact([
    isPhonePortrait && {
      key: 'favoriteSearch',
      onSelected: toggleSaved,
      disabled: !searchQuery.length || !saveable,
      content: (
        <>
          <AppIcon icon={saved ? starIcon : starOutlineIcon} /> {t('Header.SaveSearch')}
        </>
      ),
    },
    isPhonePortrait &&
      showSearchResults && {
        key: 'showSearchResults',
        onSelected: () => dispatch(toggleSearchResults()),
        disabled: !searchQuery.length || !valid || filteredItems.length === 0,
        content: (
          <>
            <AppIcon icon={faList} />
            {t('Header.SearchResults')}
          </>
        ),
      },
    isPhonePortrait && { key: 'mobile' },
    ...stores.map((store) => ({
      key: `move-${store.id}`,
      onSelected: () => applySearchLoadout(store),
      disabled: !searchActive,
      content: (
        <>
          <img src={store.icon} width="16" height="16" alt="" className={styles.storeIcon} />{' '}
          {store.isVault
            ? t('MovePopup.SendToVault')
            : t('MovePopup.StoreWithName', { character: store.name })}
        </>
      ),
    })),
    destinyVersion === 2 && {
      key: 'apply-best-perks',
      onSelected: applyBestPerks,
      disabled: !searchActive || !filteredItems.some((i) => i.bucket?.inWeapons),
      content: (
        <>
          <span style={{ fontWeight: 'bold', fontSize: '11px', marginRight: '6px' }}>BP</span>
          {t('BestPerks.BulkAction')}
        </>
      ),
    },
    destinyVersion === 2 && {
      key: 'shader-bulk-apply',
      onSelected: () => navigate('shader-bulk-apply'),
      disabled: false,
      content: (
        <>
          <AppIcon icon={faTshirt} /> {t('ShaderBulkApply.Title')}
        </>
      ),
    },
    { key: 'characters' },
    {
      key: 'compare',
      onSelected: compareMatching,
      disabled: !isComparable || !searchActive,
      content: (
        <>
          <AppIcon icon={compareIcon} /> {t('Header.CompareMatching')}
        </>
      ),
    },
    destinyVersion === 2 && {
      key: 'strip-sockets',
      onSelected: handleStripSockets,
      disabled: !canStrip || !searchActive,
      content: (
        <>
          <AppIcon icon={faWindowClose} /> {t('StripSockets.Action')}
        </>
      ),
    },
    {
      key: 'note',
      onSelected: handleBulkNote,
      disabled: !searchActive,
      content: (
        <>
          <AppIcon icon={stickyNoteIcon} /> {t('Organizer.Note')}
        </>
      ),
    },
    {
      key: 'lock-item',
      onSelected: () => bulkLock('lock'),
      disabled: !searchActive,
      content: (
        <>
          <AppIcon icon={lockIcon} /> {t('Tags.LockAll')}
        </>
      ),
    },
    {
      key: 'unlock-item',
      onSelected: () => bulkLock('unlock'),
      disabled: !searchActive,
      content: (
        <>
          <AppIcon icon={unlockedIcon} /> {t('Tags.UnlockAll')}
        </>
      ),
    },
    { key: 'tags' },
    ...bulkItemTags.map((tag) => ({
      key: tag.type || 'default',
      onSelected: () => tag.type && bulkTag(tag.type),
      disabled: !searchActive,
      content: (
        <>
          {tag.icon && <AppIcon icon={tag.icon} />} {tag.label}
        </>
      ),
    })),
  ]);

  return (
    <>
      {confirmDialog}
      <Dropdown
        options={dropdownOptions}
        kebab={true}
        className={styles.dropdownButton}
        offset={isPhonePortrait ? 6 : 2}
        fixed={fixed}
        label={t('Header.SearchActions')}
      />
    </>
  );
});
