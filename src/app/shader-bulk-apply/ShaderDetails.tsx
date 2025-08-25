import BungieImage from 'app/d2l-ui/BungieImage';
import Sheet from 'app/d2l-ui/Sheet';
import useConfirm from 'app/d2l-ui/useConfirm';
import { t } from 'app/i18next-t';
import { insertPlug } from 'app/inventory/advanced-write-actions';
import { DimItem } from 'app/inventory/item-types';
import { DefItemIcon } from 'app/inventory/ItemIcon';
import { allItemsSelector } from 'app/inventory/selectors';
import { useD2Definitions } from 'app/manifest/selectors';
import { showNotification } from 'app/notifications/notifications';
import { AppIcon, faTshirt } from 'app/shell/icons';
import { useThunkDispatch } from 'app/store/thunk-dispatch';
import { DestinyInventoryItemDefinition } from 'bungie-api-ts/destiny2';
import clsx from 'clsx';
import { PlugCategoryHashes } from 'data/d2/generated-enums';
import { useCallback, useState } from 'react';
import { useSelector } from 'react-redux';
import styles from './ShaderDetails.m.scss';

interface ItemTypeOption {
  key: string;
  label: string;
  buckets: number[];
  enabled: boolean;
}

interface ShaderDetailsProps {
  shaderDef: DestinyInventoryItemDefinition;
  selectedStoreId: string;
  onClose: () => void;
}

export default function ShaderDetails({ shaderDef, selectedStoreId, onClose }: ShaderDetailsProps) {
  const dispatch = useThunkDispatch();
  const allItems = useSelector(allItemsSelector);
  const defs = useD2Definitions();
  const [confirmDialog, confirm] = useConfirm();

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

  // Get all equipped items that match selected types and class
  const getEquippedItems = useCallback(() => {
    const enabledBuckets = itemTypes.filter((type) => type.enabled).flatMap((type) => type.buckets);

    return allItems.filter(
      (item) =>
        item.equipped &&
        enabledBuckets.includes(item.bucket.hash) &&
        (selectedStoreId === 'all' || item.owner === selectedStoreId),
    );
  }, [allItems, itemTypes, selectedStoreId]);

  // Find shader socket in an item
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
      shader: shaderDef.displayProperties.name,
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
          await dispatch(insertPlug(item, shaderSocket, shaderDef.hash));
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
          shader: shaderDef.displayProperties.name,
        }),
      });
      onClose();
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
    <>
      {confirmDialog}
      <Sheet
        onClose={onClose}
        header={
          <div className={styles.shaderHeader}>
            <DefItemIcon itemDef={shaderDef} />
            <div className={styles.shaderInfo}>
              <h2>{shaderDef.displayProperties.name}</h2>
              <p>{shaderDef.itemTypeDisplayName}</p>
            </div>
          </div>
        }
      >
        <div className={styles.shaderDetails}>
          {/* Shader Description */}
          {shaderDef.displayProperties.description && (
            <div className={styles.description}>
              <h3>{t('ShaderBulkApply.Description', { defaultValue: 'Description' })}</h3>
              <p>{shaderDef.displayProperties.description}</p>
            </div>
          )}

          {/* Preview Image */}
          {shaderDef.screenshot && (
            <div className={styles.preview}>
              <h3>{t('ShaderBulkApply.Preview')}</h3>
              <BungieImage src={shaderDef.screenshot} alt={shaderDef.displayProperties.name} />
            </div>
          )}

          {/* Item Type Selection */}
          <div className={styles.itemTypeSelection}>
            <h3>{t('ShaderBulkApply.SelectItemTypes')}</h3>
            <div className={styles.itemTypeCheckboxes}>
              {itemTypes.map((type) => (
                <label key={type.key} className={styles.itemTypeOption}>
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
          <div className={styles.currentSelection}>
            <h3>{t('ShaderBulkApply.CurrentSelection', { defaultValue: 'Current Selection' })}</h3>
            <p>
              {t('ShaderBulkApply.WillApply', {
                shader: shaderDef.displayProperties.name,
                count: equippedItems.length,
              })}
            </p>
          </div>

          {/* Apply Button */}
          <div className={styles.applySection}>
            <button
              type="button"
              className={clsx('d2l-button', styles.applyButton)}
              onClick={applyShader}
              disabled={equippedItems.length === 0}
            >
              <AppIcon icon={faTshirt} />
              {t('ShaderBulkApply.Apply')}
            </button>
          </div>
        </div>
      </Sheet>
    </>
  );
}
