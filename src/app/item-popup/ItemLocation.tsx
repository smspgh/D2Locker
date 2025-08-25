import ClassIcon from 'app/d2l-ui/ClassIcon';
import { t } from 'app/i18next-t';
import { DimItem } from 'app/inventory/item-types';
import { sortedStoresSelector } from 'app/inventory/selectors';
import { getStore } from 'app/inventory/stores-helpers';
import { useSelector } from 'react-redux';
import styles from './ItemLocation.m.scss';

/**
 * Component that displays the current location of an item (Vault, or Character with class icon and name)
 */
export default function ItemLocation({ item }: { item: DimItem }) {
  const stores = useSelector(sortedStoresSelector);
  const itemStore = getStore(stores, item.owner);

  if (!itemStore) {
    return null;
  }

  if (itemStore.isVault) {
    return <div className={styles.itemLocation}>{t('MovePopup.InVault')}</div>;
  }

  const locationPrefix = item.equipped
    ? t('MovePopup.EquippedOnShort')
    : t('MovePopup.AllocatedOnShort');

  return (
    <div className={styles.itemLocation}>
      {locationPrefix}
      <ClassIcon classType={itemStore.classType} className={styles.classIcon} />(
      {itemStore.className})
    </div>
  );
}
