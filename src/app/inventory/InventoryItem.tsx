import { AlertIcon } from 'app/d2l-ui/AlertIcon';
import { percent } from 'app/shell/formatters';
import { nonPullablePostmasterItem } from 'app/utils/item-utils';
import clsx from 'clsx';
import { BucketHashes } from 'data/d2/generated-enums';
import React, { useMemo } from 'react';
import BungieImage from '../d2l-ui/BungieImage';
import { AppIcon, lockIcon, stickyNoteIcon } from '../shell/icons';
import { InventoryWishListRoll } from '../wishlists/wishlists';
import BadgeInfo, { shouldShowBadge } from './BadgeInfo';
import { TagValue } from './d2l-item-info';
import styles from './InventoryItem.m.scss';
import { DimItem } from './item-types';
import ItemIcon from './ItemIcon';
import ItemIconPlaceholder from './ItemIconPlaceholder';
import NewItemIndicator from './NewItemIndicator';
import { getSubclassIconInfo } from './subclass';
import { canSyncLockState } from './SyncTagLock';
import TagIcon from './TagIcon';
import { getRollAppraiserUtilsSync } from 'app/roll-appraiser/rollAppraiserService';
import { getSocketsByType } from 'app/utils/socket-utils';

export default function InventoryItem({
  item,
  isNew,
  tag,
  notes,
  searchHidden,
  autoLockTagged,
  wishlistRoll,
  hideSelectedSuper,
  onClick,
  onShiftClick,
  onDoubleClick,
  ref,
}: {
  item: DimItem;
  /** Show this item as new? */
  isNew?: boolean;
  /** User defined tag */
  tag?: TagValue;
  /** Notes for the item. Used to show the icon and put notes in tooltips. */
  notes?: string;
  /** Has this been hidden by a search? */
  searchHidden?: boolean;
  /** Is the setting to automatically lock tagged items on? */
  autoLockTagged: boolean;
  wishlistRoll?: InventoryWishListRoll;
  /** Hide the selected Super ability on subclasses? */
  hideSelectedSuper?: boolean;
  ref?: React.Ref<HTMLDivElement>;
  /** TODO: item locked needs to be passed in */
  onClick?: (e: React.MouseEvent) => void;
  onShiftClick?: (e: React.MouseEvent) => void;
  onDoubleClick?: (e: React.MouseEvent) => void;
}) {
  let enhancedOnClick = onClick;

  if (onShiftClick) {
    enhancedOnClick = (e: React.MouseEvent) => {
      if (e.shiftKey) {
        onShiftClick(e);
      } else if (onClick) {
        onClick(e);
      }
    };
  }

  const hasNotes = Boolean(notes);
  const savedNotes = hasNotes ? `\nNotes: ${notes}` : '';
  const isSubclass = item?.destinyVersion === 2 && item.bucket.hash === BucketHashes.Subclass;
  const subclassIconInfo = isSubclass && !hideSelectedSuper ? getSubclassIconInfo(item) : null;
  const hasBadge = shouldShowBadge(item);
  const itemStyles = clsx('item', {
    [styles.searchHidden]: searchHidden,
    [styles.subclass]: isSubclass,
    [styles.hasBadge]: hasBadge,
  });
  // Subtitle for engram powerlevel vs regular item type
  const subtitle = item.destinyVersion === 2 && item.isEngram ? item.power : item.typeName;

  // Memoize the contents of the item - most of the time if this is re-rendering it's for a search, or a new item
  const contents = useMemo(() => {
    // Subclasses have limited, but customized, display. They can't be new, or tagged, or locked, etc.
    if (subclassIconInfo) {
      return (
        <>
          {subclassIconInfo.base ? (
            <img
              src={subclassIconInfo.base}
              className={clsx('item-img', styles.subclassBase)}
              alt=""
            />
          ) : (
            <ItemIcon className={styles.subclassBase} item={item} />
          )}
          {subclassIconInfo.super && (
            <BungieImage src={subclassIconInfo.super} className={styles.subclassSuperIcon} alt="" />
          )}
        </>
      );
    }

    const isCapped = item.maxStackSize > 1 && item.amount === item.maxStackSize && item.uniqueStack;
    return (
      <>
        {item.percentComplete > 0 && !item.complete && (
          <div className={styles.xpBar}>
            <div className={styles.xpBarAmount} style={{ width: percent(item.percentComplete) }} />
          </div>
        )}
        <ItemIcon item={item} />
        <BadgeInfo item={item} isCapped={isCapped} wishlistRoll={wishlistRoll} />
        {item.bucket?.inWeapons && item.sockets && <ComboRankDisplay item={item} />}
        {(tag || item.locked || hasNotes) && (
          <div className={styles.icons}>
            {item.locked && (!autoLockTagged || !tag || !canSyncLockState(item)) && (
              <AppIcon className={styles.icon} icon={lockIcon} />
            )}
            {tag && <TagIcon className={styles.icon} tag={tag} />}
            {hasNotes && <AppIcon className={styles.icon} icon={stickyNoteIcon} />}
          </div>
        )}
        (
        {(nonPullablePostmasterItem(item) && <AlertIcon className={styles.warningIcon} />) ||
          (isNew && <NewItemIndicator />)}
      </>
    );
  }, [isNew, item, hasNotes, subclassIconInfo, tag, wishlistRoll, autoLockTagged]);

  return (
    <div
      id={item.index}
      onClick={enhancedOnClick}
      onDoubleClick={onDoubleClick}
      title={`${item.name}\n${subtitle}${savedNotes}`}
      className={itemStyles}
      ref={ref}
    >
      <ItemIconPlaceholder item={item} hasBadge={hasBadge}>
        {contents}
      </ItemIconPlaceholder>
    </div>
  );
}

/**
 * Display combo rank badge for weapons
 */
function ComboRankDisplay({ item }: { item: DimItem }) {
  const utils = getRollAppraiserUtilsSync();
  if (!utils) {return null;}

  const traitPerks = getSocketsByType(item, 'traits');
  if (traitPerks.length < 2) {return null;}
  
  const perk4Hash = traitPerks[0]?.plugged?.plugDef.hash;
  const perk5Hash = traitPerks[1]?.plugged?.plugDef.hash;
  
  if (!perk4Hash || !perk5Hash) {return null;}

  const comboRankData = utils.getTraitComboRank(item.hash.toString(), perk4Hash, perk5Hash);
  if (!comboRankData) {return null;}

  const getRankColor = (rank: number) => {
    switch (rank) {
      case 1: return styles.comboRank1;
      case 2: return styles.comboRank2;
      case 3: return styles.comboRank3;
      case 4: return styles.comboRank4;
      default: return styles.comboRank5;
    }
  };

  return (
    <div className={styles.comboRankBadge}>
      <div 
        className={clsx(styles.comboRankNumber, getRankColor(comboRankData.rank))}
        title={`Rank ${comboRankData.rank} combo (${comboRankData.count.toLocaleString()} users)`}
      >
        {comboRankData.rank}
      </div>
    </div>
  );
}
