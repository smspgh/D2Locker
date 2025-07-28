import { isD1Store } from 'app/inventory/stores-helpers';
import React from 'react';
import { DimStore } from '../inventory/store-types';
import CharacterHeaderXPBar from './CharacterHeaderXP';
import CharacterTileButton from './CharacterTileButton';
import styles from './StoreHeading.m.scss';

// Wrap the {CharacterTile} with a button for the loadout menu and the D1 XP progress bar
function CharacterHeader({
  store,
  onClick,
  ref,
}: {
  store: DimStore;
  onClick: () => void;
  ref?: React.Ref<HTMLButtonElement>;
}) {
  return (
    <CharacterTileButton
      ref={ref}
      character={store}
      onClick={onClick}
      className={styles.characterHeader}
    >
      {!store.isVault && isD1Store(store) && <CharacterHeaderXPBar store={store} />}
    </CharacterTileButton>
  );
}

/**
 * This is the character dropdown used at the top of the inventory page.
 * It will render a {CharacterTile} in addition to a button for the loadout menu
 */
export default function StoreHeading({
  store,
  selectedStore,
  onTapped,
}: {
  store: DimStore;
  /** For mobile, this is whichever store is visible at the time. */
  selectedStore?: DimStore;
  /** Fires if a store other than the selected store is tapped. */
  onTapped?: (storeId: string) => void;
}) {
  const useOnTapped = store !== selectedStore && onTapped;
  const openCharacterTile = () => {
    if (useOnTapped) {
      onTapped(store.id);
      return;
    }
  };

  return (
    <CharacterHeader store={store} onClick={openCharacterTile} />
  );
}
