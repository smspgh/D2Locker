import { DimStore } from 'app/inventory/store-types';
import { DestinyClass } from 'bungie-api-ts/destiny2';
import styles from './ClassOverlay.m.scss';

/**
 * Component that displays a small class letter (T/W/H) overlay on move buttons
 * to indicate which character the button will move items to
 */
export default function ClassOverlay({ store }: { store: DimStore }) {
  if (store.isVault) {
    return null;
  }

  const getClassLetter = (classType: DestinyClass): string => {
    switch (classType) {
      case DestinyClass.Titan:
        return 'T';
      case DestinyClass.Warlock:
        return 'W';
      case DestinyClass.Hunter:
        return 'H';
      default:
        return '';
    }
  };

  const classLetter = getClassLetter(store.classType);

  if (!classLetter) {
    return null;
  }

  return (
    <div className={styles.classOverlay} title={store.className}>
      {classLetter}
    </div>
  );
}
