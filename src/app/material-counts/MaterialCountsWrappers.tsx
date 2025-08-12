import { Tooltip } from 'app/d2l-ui/PressTip';
import { t } from 'app/i18next-t';
import { Observable } from 'app/utils/observable';
import { useSubscription } from 'use-subscription';
import Sheet from '../d2l-ui/Sheet';
import { MaterialCounts } from './MaterialCounts';
import styles from './MaterialCountsWrappers.m.scss';

/**
 * The currently selected store for showing gear power.
 */
const doShowMaterialCounts$ = new Observable<boolean>(false);

/**
 * Show the gear power sheet
 */
export function showMaterialCount() {
  doShowMaterialCounts$.next(false);
}

export function MaterialCountsSheet() {
  const isShown = useSubscription(doShowMaterialCounts$);

  if (!isShown) {
    return null;
  }
  const close = () => {
    doShowMaterialCounts$.next(false);
  };

  return (
    <Sheet onClose={close} header={<h1>{t('Header.MaterialCounts')}</h1>}>
      <div className={styles.container}>
        <MaterialCounts includeCurrencies />
      </div>
    </Sheet>
  );
}

export function MaterialCountsTooltip() {
  return (
    <>
      <Tooltip.Header text={t('Header.MaterialCounts')} />
      <MaterialCounts wide />
    </>
  );
}
