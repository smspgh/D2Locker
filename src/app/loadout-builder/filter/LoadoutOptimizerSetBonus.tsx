import { SetBonusCounts } from '@destinyitemmanager/dim-api-types';
import { D2ManifestDefinitions } from 'app/destiny2/d2-definitions';
import CollapsibleTitle from 'app/d2l-ui/CollapsibleTitle';
import { t } from 'app/i18next-t';
import { allItemsSelector } from 'app/inventory/selectors';
import { DimItem } from 'app/inventory/item-types';
import { DimStore } from 'app/inventory/store-types';
import { isLoadoutBuilderItem } from 'app/loadout/loadout-item-utils';
import { useD2Definitions } from 'app/manifest/selectors';
import { AppIcon, plusIcon, refreshIcon } from 'app/shell/icons';
import { DestinyClass } from 'bungie-api-ts/destiny2';
import clsx from 'clsx';
import { Dispatch, memo, useState } from 'react';
import { useSelector } from 'react-redux';
import { LoadoutBuilderAction } from '../loadout-builder-reducer';
import styles from './LoadoutOptimizerSetBonus.m.scss';

const LoadoutOptimizerSetBonus = memo(function LoadoutOptimizerSetBonus({
  storeId,
  setBonuses,
  lbDispatch,
  className,
  classType,
  vendorItems,
}: {
  storeId: string;
  setBonuses: SetBonusCounts;
  lbDispatch: Dispatch<LoadoutBuilderAction>;
  className?: string;
  classType: DestinyClass;
  vendorItems: DimItem[];
}) {
  const defs = useD2Definitions()!;
  const allItems = useSelector(allItemsSelector);
  const [open, setOpen] = useState(false);

  const handleClear = () => {
    lbDispatch({ type: 'removeSetBonuses' });
  };

  const handleUpdateSetBonuses = (setBonuses: SetBonusCounts) =>
    lbDispatch({ type: 'setSetBonuses', setBonuses });

  const handleSyncFromEquipped = () => {
    const equippedSetBonuses = allItems.filter(
      (i) => i.equipped && isLoadoutBuilderItem(i) && i.owner === storeId && (i as any).setBonus,
    );

    const newSetBonuses: SetBonusCounts = {};
    for (const item of equippedSetBonuses) {
      const setBonus = (item as any).setBonus;
      if (setBonus?.hash) {
        newSetBonuses[setBonus.hash] = (newSetBonuses[setBonus.hash] || 0) + 1;
      }
    }

    handleUpdateSetBonuses(newSetBonuses);
  };

  const setBonusCount = Object.keys(setBonuses).length;

  return (
    <div className={clsx(className, styles.container)}>
      <CollapsibleTitle
        title={t('LoadoutBuilder.SetBonuses')}
        sectionId="loadout-builder-set-bonuses"
        defaultCollapsed={false}
      >
        <div className={styles.controls}>
          {setBonusCount > 0 && (
            <button
              type="button"
              className={styles.clearButton}
              onClick={handleClear}
              title={t('LoadoutBuilder.ClearSetBonuses')}
            >
              {t('LoadoutBuilder.Clear')}
            </button>
          )}
          <button
            type="button"
            className={styles.syncButton}
            onClick={handleSyncFromEquipped}
            title={t('LoadoutBuilder.SyncFromEquipped')}
          >
            <AppIcon icon={refreshIcon} />
          </button>
        </div>
      </CollapsibleTitle>
      
      {open && (
        <div className={styles.setBonusList}>
          {setBonusCount === 0 ? (
            <div className={styles.noSetBonuses}>
              {t('LoadoutBuilder.NoSetBonuses')}
            </div>
          ) : (
            Object.entries(setBonuses).map(([setHash, count]) => {
              const setDef = defs.EquipableItemSet.get(Number(setHash));
              return (
                <div key={setHash} className={styles.setBonusItem}>
                  <span>{setDef?.displayProperties.name || t('LoadoutBuilder.UnknownSet')}</span>
                  <span className={styles.count}>{count}</span>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
});

export default LoadoutOptimizerSetBonus;