import useConfirm from 'app/d2l-ui/useConfirm';
import { t } from 'app/i18next-t';
import { insertPlug } from 'app/inventory/advanced-write-actions';
import { DimItem } from 'app/inventory/item-types';
import { DefItemIcon } from 'app/inventory/ItemIcon';
import {
  allItemsSelector,
  currentStoreSelector,
  storesSelector,
  unlockedPlugSetItemsSelector,
} from 'app/inventory/selectors';
import { useD2Definitions } from 'app/manifest/selectors';
import { showNotification } from 'app/notifications/notifications';
import { collectionsVisibleShadersSelector } from 'app/records/selectors';
import { SearchInput } from 'app/search/SearchInput';
import { AppIcon, faTshirt } from 'app/shell/icons';
import { useThunkDispatch } from 'app/store/thunk-dispatch';
import { DestinyInventoryItemDefinition } from 'bungie-api-ts/destiny2';
import clsx from 'clsx';
import { PlugCategoryHashes } from 'data/d2/generated-enums';
import { useCallback, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import '../inventory-page/StoreBucket.scss';
import './ShaderBulkApply.m.scss';
import ShaderDetails from './ShaderDetails';

interface ItemTypeOption {
  key: string;
  label: string;
  buckets: number[];
  enabled: boolean;
}

export default function ShaderBulkApply() {
  const dispatch = useThunkDispatch();
  const allItems = useSelector(allItemsSelector);
  const defs = useD2Definitions();
  const currentStore = useSelector(currentStoreSelector);
  const stores = useSelector(storesSelector);
  const visibleShaders = useSelector(collectionsVisibleShadersSelector);
  const [confirmDialog, confirm] = useConfirm();
  const [selectedShaderHash, setSelectedShaderHash] = useState<number | null>(null);
  const [selectedShaderDetails, setSelectedShaderDetails] =
    useState<DestinyInventoryItemDefinition | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const [itemTypes, setItemTypes] = useState<ItemTypeOption[]>([
    {
      key: 'weapons',
      label: 'Weapons',
      buckets: [1498876634, 2465295065, 953998645],
      enabled: true,
    }, // KineticWeapons, EnergyWeapons, PowerWeapons
    {
      key: 'armor',
      label: 'Armor',
      buckets: [3448274439, 3551918588, 14239492, 20886954, 1585787867],
      enabled: true,
    }, // Helmet, Gauntlets, ChestArmor, LegArmor, ClassArmor
    { key: 'ghost', label: 'Ghost', buckets: [4023194814], enabled: true }, // Ghost
    { key: 'ship', label: 'Ship', buckets: [284967655], enabled: true }, // Ships
    { key: 'vehicle', label: 'Vehicle/Sparrow', buckets: [2025709351], enabled: true }, // Vehicle
  ]);

  // Set default store to current/most recent active class
  useEffect(() => {
    if (currentStore && !selectedStoreId) {
      // Store the value in a variable instead of calling setState directly
      const storeId = currentStore.id;
      // Use setTimeout to avoid direct setState in useEffect
      const timeoutId = setTimeout(() => setSelectedStoreId(storeId), 0);
      return () => clearTimeout(timeoutId);
    }
  }, [currentStore, selectedStoreId]);

  // Get the store ID for shader unlocks - use selected store or current store
  const effectiveStoreId = selectedStoreId || currentStore?.id;
  const unlockedPlugs = useSelector(
    effectiveStoreId ? unlockedPlugSetItemsSelector(effectiveStoreId) : () => new Set<number>(),
  );

  // Get all available shaders from both unlocked plugs and visible collections
  const allShaderHashes = new Set<number>();

  // Add unlocked shader plugs - only if we have the data
  if (unlockedPlugs && defs) {
    for (const plugHash of unlockedPlugs) {
      const plugDef = defs.InventoryItem.get(Number(plugHash));
      if (plugDef?.plug?.plugCategoryHash === PlugCategoryHashes.Shader) {
        allShaderHashes.add(Number(plugHash));
      }
    }
  }

  // Add visible shaders from collections
  if (visibleShaders) {
    for (const shaderHash of visibleShaders) {
      allShaderHashes.add(shaderHash);
    }
  }

  const shaderDefs = Array.from(allShaderHashes, (hash) => defs?.InventoryItem.get(hash))
    .filter(Boolean)
    .filter((shader) => {
      if (!searchQuery.trim()) {
        return true;
      }
      const query = searchQuery.toLowerCase();
      return (
        shader.displayProperties.name.toLowerCase().includes(query) ||
        shader.displayProperties.description?.toLowerCase().includes(query) ||
        false
      );
    })
    .sort((a, b) => a.displayProperties.name.localeCompare(b.displayProperties.name));

  // Get all equipped items that match selected types and class
  const getEquippedItems = useCallback(() => {
    const enabledBuckets = itemTypes.filter((type) => type.enabled).flatMap((type) => type.buckets);

    // If no store is selected yet, default to current store or show all
    const targetStoreId = selectedStoreId || currentStore?.id || 'all';

    return allItems.filter(
      (item) =>
        item.equipped &&
        enabledBuckets.includes(item.bucket.hash) &&
        (targetStoreId === 'all' || item.owner === targetStoreId),
    );
  }, [allItems, itemTypes, selectedStoreId, currentStore]);

  // Find shader socket in an item (based on FashionDrawer approach)
  const findShaderSocket = (item: DimItem) => {
    if (!item.sockets || !defs) {
      return null;
    }

    // Look for sockets that accept shaders by checking plugWhitelist
    return item.sockets.allSockets.find((socket) => {
      const socketTypeDef = defs.SocketType.get(socket.socketDefinition.socketTypeHash);
      return socketTypeDef?.plugWhitelist.some(
        (pw) => pw.categoryHash === PlugCategoryHashes.Shader,
      );
    });
  };

  const toggleItemType = (key: string) => {
    setItemTypes((prev) =>
      prev.map((type) => (type.key === key ? { ...type, enabled: !type.enabled } : type)),
    );
  };

  const applyShader = async () => {
    if (!selectedShaderHash || !defs) {
      showNotification({
        type: 'warning',
        title: t('ShaderBulkApply.NoShaderSelected'),
        body: t('ShaderBulkApply.SelectShaderFirst'),
      });
      return;
    }

    const selectedShaderDef = defs.InventoryItem.get(selectedShaderHash);
    if (!selectedShaderDef) {
      return;
    }

    const equippedItems = getEquippedItems();
    if (equippedItems.length === 0) {
      showNotification({
        type: 'warning',
        title: t('ShaderBulkApply.NoItems'),
        body: t('ShaderBulkApply.NoEquippedItems'),
      });
      return;
    }

    // Show confirmation dialog
    const confirmMessage = t('ShaderBulkApply.ConfirmApply', {
      shader: selectedShaderDef.displayProperties.name,
      count: equippedItems.length,
    });

    if (!(await confirm(confirmMessage))) {
      return;
    }

    let successCount = 0;
    let failCount = 0;

    for (const item of equippedItems) {
      try {
        const shaderSocket = findShaderSocket(item);
        if (shaderSocket) {
          await dispatch(insertPlug(item, shaderSocket, selectedShaderHash));
          successCount++;
        } else {
          failCount++;
        }
      } catch (error) {
        failCount++;
        console.error(`Failed to apply shader to ${item.name}:`, error);
      }
    }

    if (successCount > 0) {
      showNotification({
        type: 'success',
        title: t('ShaderBulkApply.Success'),
        body: t('ShaderBulkApply.SuccessBody', {
          success: successCount,
          total: equippedItems.length,
          shader: selectedShaderDef.displayProperties.name,
        }),
      });
    }

    if (failCount > 0) {
      showNotification({
        type: 'warning',
        title: t('ShaderBulkApply.PartialSuccess'),
        body: t('ShaderBulkApply.PartialSuccessBody', {
          success: successCount,
          failed: failCount,
        }),
      });
    }
  };

  const equippedItems = getEquippedItems();

  return (
    <div className="d2l-page">
      {confirmDialog}
      <div className="shader-bulk-apply-page">
        <div className="page-header">
          <h1>{t('ShaderBulkApply.Title')}</h1>
        </div>
        <div className="shader-bulk-apply">
          {/* Search Bar */}
          <div className="shader-search">
            <SearchInput
              query={searchQuery}
              onQueryChanged={setSearchQuery}
              placeholder={t('ShaderBulkApply.SearchShaders')}
            />
          </div>

          {/* Class Selection */}
          <div className="class-selection">
            <h3>{t('ShaderBulkApply.SelectClass')}</h3>
            <div className="class-options">
              <label className="class-option">
                <input
                  type="radio"
                  name="selectedClass"
                  value="all"
                  checked={selectedStoreId === 'all' || (!selectedStoreId && !currentStore)}
                  onChange={(e) => setSelectedStoreId(e.target.value)}
                />
                <span>{t('ShaderBulkApply.AllClasses')}</span>
              </label>
              {stores
                .filter((store) => !store.isVault)
                .map((store) => (
                  <label key={store.id} className="class-option">
                    <input
                      type="radio"
                      name="selectedClass"
                      value={store.id}
                      checked={
                        selectedStoreId === store.id ||
                        (!selectedStoreId && currentStore?.id === store.id)
                      }
                      onChange={(e) => setSelectedStoreId(e.target.value)}
                    />
                    <span>{store.name}</span>
                  </label>
                ))}
            </div>
          </div>

          {/* Shader Selection */}
          <div className="shader-selection">
            <h3>{t('ShaderBulkApply.SelectShader')}</h3>
            <div className={clsx('sub-bucket', 'shader-grid')}>
              {shaderDefs.map((shaderDef) => (
                <div
                  key={shaderDef.hash}
                  role="button"
                  tabIndex={0}
                  className={clsx('item', 'shader-option', {
                    selected: selectedShaderHash === shaderDef.hash,
                  })}
                  title={`${shaderDef.displayProperties.name}\n${shaderDef.itemTypeDisplayName}`}
                  onClick={() => {
                    setSelectedShaderHash(shaderDef.hash);
                    setSelectedShaderDetails(shaderDef);
                  }}
                >
                  <DefItemIcon itemDef={shaderDef} />
                </div>
              ))}
            </div>
            {shaderDefs.length === 0 && (
              <div className="no-shaders">{t('ShaderBulkApply.NoShaders')}</div>
            )}
          </div>

          {/* Item Type Selection */}
          <div className="item-type-selection">
            <h3>{t('ShaderBulkApply.SelectItemTypes')}</h3>
            <div className="item-type-checkboxes">
              {itemTypes.map((type) => (
                <label key={type.key} className="item-type-option">
                  <input
                    type="checkbox"
                    checked={type.enabled}
                    onChange={() => toggleItemType(type.key)}
                  />
                  <span>{type.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Current Selection Preview */}
          <div className="current-selection">
            <h3>{t('ShaderBulkApply.Preview')}</h3>
            {selectedShaderHash ? (
              <p>
                {t('ShaderBulkApply.WillApply', {
                  shader:
                    defs?.InventoryItem.get(selectedShaderHash)?.displayProperties.name ||
                    'Unknown',
                  count: equippedItems.length,
                })}
              </p>
            ) : (
              <p>{t('ShaderBulkApply.SelectShaderToPreview')}</p>
            )}
          </div>

          {/* Apply Button */}
          <div className="apply-section">
            <button
              type="button"
              className={clsx('d2l-button', 'apply-button')}
              onClick={applyShader}
              disabled={!selectedShaderHash || equippedItems.length === 0}
            >
              <AppIcon icon={faTshirt} />
              {t('ShaderBulkApply.Apply')}
            </button>
          </div>
        </div>
      </div>

      {/* Shader Details Popup */}
      {selectedShaderDetails && (
        <ShaderDetails
          shaderDef={selectedShaderDetails}
          selectedStoreId={selectedStoreId}
          onClose={() => setSelectedShaderDetails(null)}
        />
      )}
    </div>
  );
}
