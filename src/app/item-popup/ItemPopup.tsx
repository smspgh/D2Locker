import { AlertIcon } from 'app/d2l-ui/AlertIcon';
import BungieImage from 'app/d2l-ui/BungieImage';
import ClickOutside from 'app/d2l-ui/ClickOutside';
import { DestinyTooltipText } from 'app/d2l-ui/DestinyTooltipText';
import ElementIcon from 'app/d2l-ui/ElementIcon';
import { PressTipRoot } from 'app/d2l-ui/PressTip';
import Sheet from 'app/d2l-ui/Sheet';
import RichDestinyText from 'app/d2l-ui/destiny-symbols/RichDestinyText';
import { usePopper } from 'app/d2l-ui/usePopper';
import { t } from 'app/i18next-t';
import { DefItemIcon } from 'app/inventory/ItemIcon';
import { DimItem } from 'app/inventory/item-types';
import { sortedStoresSelector } from 'app/inventory/selectors';
import { getEvent, getSeason } from 'app/inventory/store/season';
import ItemMoveLocations from 'app/item-actions/ItemMoveLocations';
import { AmmoIcon } from 'app/item-popup/AmmoIcon';
import BreakerType from 'app/item-popup/BreakerType';
import { useD2Definitions } from 'app/manifest/selectors';
import type { ItemRarityName } from 'app/search/d2-known-values';
import { useIsPhonePortrait } from 'app/shell/selectors';
import OpenOnStreamDeckButton from 'app/stream-deck/OpenOnStreamDeckButton/OpenOnStreamDeckButton';
import { streamDeckEnabledSelector } from 'app/stream-deck/selectors';
import { getItemYear, itemTypeName, nonPullablePostmasterItem } from 'app/utils/item-utils';
import { Portal } from 'app/utils/temp-container';
import clsx from 'clsx';
import { D2EventInfo } from 'data/d2/d2-event-info-v2';
import { useMemo, useRef } from 'react';
import { useSelector } from 'react-redux';
import DesktopItemActions, { menuClassName } from './DesktopItemActions';
import ItemLocation from './ItemLocation';
import styles from './ItemPopup.m.scss';
import { useItemPopupTabs } from './ItemPopupTabs';
import ItemTagHotkeys from './ItemTagHotkeys';
import { ItemPopupExtraInfo } from './item-popup';
import { buildItemActionsModel } from './item-popup-actions';

const rarityClasses: Record<ItemRarityName, string> = {
  Exotic: styles.exotic,
  Legendary: styles.legendary,
  Rare: styles.rare,
  Uncommon: styles.uncommon,
  Common: styles.common,
  Unknown: '',
  Currency: '',
} as const;

// SeasonInfo component (copied from ItemDetails)
function SeasonInfo({
  defs,
  item,
  className,
  seasonNum,
}: {
  item: DimItem;
  defs: ReturnType<typeof useD2Definitions>;
  className?: string;
  seasonNum: number;
}) {
  const season = Object.values(defs?.Season.getAll() ?? {}).find(
    (s) => s.seasonNumber === seasonNum,
  );
  const event = getEvent(item);
  return (
    season && (
      <div className={clsx(className)}>
        {season.displayProperties?.hasIcon && (
          <BungieImage height={15} width={15} src={season.displayProperties?.icon} />
        )}{' '}
        {season.displayProperties?.name} (
        {t('Armory.Season', {
          season: season?.seasonNumber,
          year: getItemYear(item) ?? '?',
        })}
        ){Boolean(event) && ` - ${D2EventInfo[event!].name}`}
      </div>
    )
  );
}

/**
 * The item inspection popup, which is either a popup on desktop or a sheet on mobile.
 */
export default function ItemPopup({
  item,
  element,
  extraInfo,
  boundarySelector,
  zIndex,
  _noLink,
  onClose,
}: {
  item: DimItem;
  element?: HTMLElement;
  extraInfo?: ItemPopupExtraInfo;
  boundarySelector?: string;
  zIndex?: number;
  /** Don't allow opening Armory from the header link */
  _noLink?: boolean;
  onClose: () => void;
}) {
  const stores = useSelector(sortedStoresSelector);
  const isPhonePortrait = useIsPhonePortrait();
  const d2Defs = useD2Definitions();

  const popupRef = useRef<HTMLDivElement>(null);
  usePopper({
    placement: 'right',
    contents: popupRef,
    reference: { current: element || null },
    boundarySelector,
    arrowClassName: styles.arrow,
    menuClassName: menuClassName,
  });

  // TODO: we need this to fire after popper repositions the popup. Maybe try again when we switch to floatingui.
  // useFocusFirstFocusableElement(popupRef);

  const itemActionsModel = useMemo(
    () => item && buildItemActionsModel(item, stores),
    [item, stores],
  );

  const { content, tabButtons } = useItemPopupTabs(item, extraInfo, itemActionsModel);

  const streamDeckEnabled = $featureFlags.elgatoStreamDeck
    ? // eslint-disable-next-line react-hooks/rules-of-hooks
      useSelector(streamDeckEnabledSelector)
    : false;

  const failureStrings = Array.from(extraInfo?.failureStrings ?? []);

  // Mobile header info
  const itemDef = d2Defs?.InventoryItem.get(item.hash);
  const collectible =
    item.collectibleHash && d2Defs ? d2Defs.Collectible.get(item.collectibleHash) : undefined;
  const seasonNum = getSeason(item);
  const flavorText = itemDef?.flavorText || itemDef?.displaySource;

  const header = (
    <div className={styles.header}>
      {/* Mobile-specific item header info */}
      {isPhonePortrait && itemDef && d2Defs && (
        <div className={styles.mobileItemHeader}>
          <div className={styles.mobileHeaderTop}>
            <div className={styles.mobileIcon}>
              <DefItemIcon itemDef={itemDef} />
            </div>
            <div className={styles.mobileInfo}>
              <h1 className={styles.mobileItemName}>{item.name}</h1>
              <div className={styles.mobileItemDetails}>
                <ElementIcon element={item.element} />
                <BreakerType item={item} />
                {item.destinyVersion === 2 && item.ammoType > 0 && (
                  <AmmoIcon type={item.ammoType} />
                )}
                <span>{itemTypeName(item)}</span>
              </div>
              <ItemLocation item={item} />
            </div>
          </div>
          <div className={styles.mobileHeaderBottom}>
            {seasonNum >= 0 && <SeasonInfo defs={d2Defs} item={item} seasonNum={seasonNum} />}
            {collectible?.sourceString && (
              <div className={styles.mobileSource}>{collectible.sourceString}</div>
            )}
            {flavorText && <div className={styles.mobileFlavor}>{flavorText}</div>}
            <DestinyTooltipText item={item} />
            {item.description && (
              <div className={styles.mobileDescription}>
                <RichDestinyText text={item.description} />
              </div>
            )}
          </div>
        </div>
      )}

      {failureStrings?.map(
        (failureString) =>
          failureString.length > 0 && (
            <div className={styles.failureReason} key={failureString}>
              <RichDestinyText text={failureString} ownerId={item.owner} />
            </div>
          ),
      )}
      {nonPullablePostmasterItem(item) && (
        <div className={styles.failureReason}>
          <AlertIcon /> {t('MovePopup.CantPullFromPostmaster')}
        </div>
      )}
      {/* Tab buttons */}
      {tabButtons}
    </div>
  );

  return isPhonePortrait ? (
    <Sheet
      onClose={onClose}
      zIndex={zIndex}
      header={header}
      headerClassName={styles.sheetHeader}
      closeButtonClassName={styles.sheetClose}
      sheetClassName={clsx(rarityClasses[item.rarity], styles.movePopupDialog)}
      footer={
        itemActionsModel.hasMoveControls && (
          <div className={styles.mobileMoveLocations}>
            <ItemMoveLocations key={item.index} item={item} actionsModel={itemActionsModel} />
          </div>
        )
      }
    >
      <div className={styles.popupBackground}>
        {content}
        {/* Mobile Actions removed - Tag/Lock/Compare are now in ItemDetails, Consolidate/Distribute not needed */}
      </div>
    </Sheet>
  ) : (
    <Portal>
      <div
        className={clsx(
          'item-popup',
          styles.movePopupDialog,
          rarityClasses[item.rarity],
          styles.desktopPopupRoot,
        )}
        style={{ zIndex }}
        ref={popupRef}
        role="dialog"
        aria-modal="false"
      >
        <ClickOutside onClickOutside={onClose}>
          <PressTipRoot value={popupRef}>
            <ItemTagHotkeys item={item} />
            <div className={styles.desktopPopup}>
              <div className={clsx(styles.desktopPopupBody, styles.popupBackground)}>
                {header}
                {content}
                {streamDeckEnabled && item.bucket.inInventory && (
                  <OpenOnStreamDeckButton type="inventory-item" label item={item} />
                )}
              </div>
              {itemActionsModel.hasControls && (
                <div className={styles.desktopActions}>
                  <DesktopItemActions item={item} actionsModel={itemActionsModel} />
                </div>
              )}
            </div>
          </PressTipRoot>
        </ClickOutside>
        <div className={clsx('arrow', styles.arrow, rarityClasses[item.rarity])} />
      </div>
    </Portal>
  );
}
