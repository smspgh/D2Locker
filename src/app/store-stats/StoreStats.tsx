import type { DimStore } from 'app/inventory/store-types';
import { useIsPhonePortrait } from 'app/shell/selectors';
import { StoreCharacterStats } from '../store-stats/CharacterStats';
import AccountCurrencies from './AccountCurrencies';
import { D1StoreCharacterStats } from './D1CharacterStats';
import styles from './StoreStats.m.scss';
import VaultCapacity from './VaultCapacity';

/** Render the store stats for any store type (character or vault) */
export default function StoreStats({ store }: { store: DimStore }) {
  const isPhonePortrait = useIsPhonePortrait();
  return store.isVault ? (
    <div className={styles.vaultStats}>
      <AccountCurrencies />
      {!isPhonePortrait && <VaultCapacity />}
    </div>
  ) : store.destinyVersion === 1 ? (
    <D1StoreCharacterStats store={store} />
  ) : (
    <div className="stat-bars">
      <StoreCharacterStats store={store} />
    </div>
  );
}
