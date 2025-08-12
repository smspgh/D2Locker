import { PressTip } from 'app/d2l-ui/PressTip';
import { t } from 'app/i18next-t';
import { DimItem } from 'app/inventory/item-types';
import { DimStore } from 'app/inventory/store-types';
import { getArtifactBonus } from 'app/inventory/stores-helpers';
import { maxLightItemSet, maxLightLoadout } from 'app/loadout-drawer/auto-loadouts';
import { applyLoadout } from 'app/loadout-drawer/loadout-apply';
import { getLight } from 'app/loadout-drawer/loadout-utils';
import { AppIcon, powerActionIcon, powerIndicatorIcon } from 'app/shell/icons';
import { useThunkDispatch } from 'app/store/thunk-dispatch';
import helmetIcon from 'destiny-icons/armor_types/helmet.svg';
import xpIcon from 'images/xpIcon.svg';
import styles from './MaxlightButton.m.scss';

interface Props {
  allItems: DimItem[];
  d2lStore: DimStore;
  hasClassified: boolean;
}

export default function MaxlightButton({ allItems, d2lStore, hasClassified }: Props) {
  const dispatch = useThunkDispatch();

  const maxLight = getLight(d2lStore, maxLightItemSet(allItems, d2lStore).equippable);
  const artifactLight = getArtifactBonus(d2lStore);

  // Apply a loadout that's dynamically calculated to maximize Light level (preferring not to change currently-equipped items)
  const makeMaxLightLoadout = () => {
    const loadout = maxLightLoadout(allItems, d2lStore);
    dispatch(applyLoadout(d2lStore, loadout, { allowUndo: true }));
  };

  return (
    <>
      <span onClick={makeMaxLightLoadout}>
        <AppIcon icon={powerActionIcon} />
        <span>
          {d2lStore.destinyVersion === 2
            ? t('Loadouts.MaximizePower')
            : t('Loadouts.MaximizeLight')}
        </span>
        <PressTip
          tooltip={hasClassified ? t('Loadouts.Classified') : undefined}
          elementType="span"
          className={styles.light}
        >
          {d2lStore.destinyVersion === 1 ? (
            <>
              <AppIcon icon={powerIndicatorIcon} />
              {Math.floor(maxLight * 10) / 10}
            </>
          ) : (
            <>
              <img className={styles.yellowInlineSvg} src={helmetIcon} />
              {Math.floor(maxLight)}
              {Boolean(artifactLight) && (
                <>
                  {' + '}
                  <img className={styles.yellowInlineSvg} src={xpIcon} />
                  {artifactLight}
                </>
              )}
            </>
          )}

          {hasClassified && <sup>*</sup>}
        </PressTip>
      </span>
    </>
  );
}
