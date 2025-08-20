import {
  TagValue as ApiTagValue,
  ItemAnnotation,
  ItemHashTag,
} from '@destinyitemmanager/dim-api-types';
import { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { I18nKey, tl } from 'app/i18next-t';
import { ThunkResult } from 'app/store/types';
import { filterMap, isEmpty } from 'app/utils/collections';
import { infoLog } from 'app/utils/log';
import { keyBy } from 'es-toolkit';
import { banIcon, tagIcon } from '../shell/icons';
import { setItemNote, setItemTag, tagCleanup } from './actions';
import { DimItem } from './item-types';
import { itemInfosSelector } from './selectors';
import { DimStore } from './store-types';

// sortOrder: orders items within a bucket, ascending
export const tagConfig = {
  keep: {
    type: 'keep' as const,
    label: tl('Tags.Keep'),
    sortOrder: 1,
    hotkey: 'shift+1',
    icon: tagIcon,
  },
  junk: {
    type: 'junk' as const,
    label: tl('Tags.Junk'),
    sortOrder: 2,
    hotkey: 'shift+2',
    icon: banIcon,
  },
  hotperk: {
    type: 'hotperk' as const,
    label: tl('Tags.Favorite'),
    sortOrder: 0,
    hotkey: 'shift+3',
    icon: tagIcon,
  },
};

export type TagValue = keyof typeof tagConfig;
export type TagCommand = TagValue | 'clear';

// Type conversion helpers
export function toApiTagValue(tag: TagValue | undefined): ApiTagValue | undefined {
  // The API expects different values, so we need to map them
  if (!tag) {
    return undefined;
  }
  // For now, we'll cast it as the API might accept our values
  return tag as ApiTagValue;
}

export function fromApiTagValue(tag: ApiTagValue | undefined): TagValue | undefined {
  if (!tag) {
    return undefined;
  }
  // Map API values back to our values
  if (tag === 'keep' || tag === 'junk') {
    return tag as TagValue;
  }
  // Map API tags to our supported tags
  if (tag === 'favorite') {
    return 'keep';
  } // Map favorite -> keep
  if (tag === 'archive') {
    return 'junk';
  }
  if (tag === 'infuse') {
    return 'junk';
  }
  // Handle any remaining old hotperk tags by converting to keep
  if (tag === 'hotperk') {
    return 'keep';
  }
  // Default for unknown tags
  return undefined;
}

/**
 * Priority order for which items should get moved off a character (into the vault or another character)
 * when the character is full and you want to move something new in. Tag values earlier in this list
 * are more likely to be moved.
 */
export const characterDisplacePriority: (TagValue | 'none')[] = [
  // Junk items should move to the vault
  'junk',
  'none',
  'keep',
];

/**
 * Priority order for which items should get moved out of the vault (onto a character)
 * when the vault is full and you want to move something new in. Tag values earlier in this list
 * are more likely to be moved.
 */
export const vaultDisplacePriority: (TagValue | 'none')[] = [
  // Junk should probably bubble towards the character so you remember to delete them!
  'junk',
  'none',
  'keep',
];

/**
 * Priority order for which items should get chosen to replace an equipped item.
 * Tag values earlier in this list are more likely to be chosen.
 */
export const equipReplacePriority: (TagValue | 'none')[] = ['keep', 'none', 'junk'];

export interface ItemInfos {
  [itemId: string]: ItemAnnotation;
}

export interface TagInfo {
  type?: TagValue;
  label: I18nKey;
  sortOrder?: number;
  displacePriority?: number;
  hotkey?: string;
  icon?: string | IconDefinition;
}

// populate tag list from tag config info
export const itemTagList: TagInfo[] = Object.values(tagConfig);

export const vaultGroupTagOrder = filterMap(itemTagList, (tag) => tag.type);

export const itemTagSelectorList: TagInfo[] = [
  { label: tl('Tags.TagItem') },
  ...Object.values(tagConfig),
];

/**
 * Delete items from the loaded items that don't appear in newly-loaded stores
 */
export function cleanInfos(stores: DimStore[]): ThunkResult {
  return async (dispatch, getState) => {
    if (!stores.length || stores.some((s) => s.items.length === 0 || s.hadErrors)) {
      // don't accidentally wipe out notes
      return;
    }

    const infos = itemInfosSelector(getState());

    if (isEmpty(infos)) {
      return;
    }

    const infosWithCraftedDate = Object.values(infos).filter((i) => i.craftedDate);
    const infosByCraftedDate = keyBy(infosWithCraftedDate, (i) => i.craftedDate!);

    let maxItemId = 0n;

    // Tags/notes are stored keyed by instance ID. Start with all the keys of the
    // existing tags and notes and remove the ones that are still here, and the rest
    // should be cleaned up because they refer to deleted items.
    const cleanupIds = new Set(Object.keys(infos));
    for (const store of stores) {
      for (const item of store.items) {
        const itemId = BigInt(item.id);
        if (itemId > maxItemId) {
          maxItemId = itemId;
        }
        const info = infos[item.id];
        if (info && (info.tag !== undefined || info.notes?.length)) {
          cleanupIds.delete(item.id);
        } else if (item.craftedInfo?.craftedDate) {
          // Double-check crafted items - we may have them under a different ID.
          // If so, patch up the data by re-tagging them under the new ID.
          // We'll delete the old item's info, but the new infos will be saved.
          const craftedInfo = infosByCraftedDate[item.craftedInfo.craftedDate];
          if (craftedInfo) {
            if (craftedInfo.tag) {
              // Convert API tag to our local tag type
              const localTag = fromApiTagValue(craftedInfo.tag);
              if (localTag) {
                dispatch(
                  setItemTag({
                    itemId: item.id,
                    tag: localTag,
                    craftedDate: item.craftedInfo.craftedDate,
                  }),
                );
              }
            }
            if (craftedInfo.notes) {
              dispatch(
                setItemNote({
                  itemId: item.id,
                  note: craftedInfo.notes,
                  craftedDate: item.craftedInfo.craftedDate,
                }),
              );
            }
          }
        }
      }
    }

    if (cleanupIds.size > 0) {
      const eligibleCleanupIds = Array.from(cleanupIds).filter((id) => {
        // Validate ID before converting to BigInt
        if (!id || typeof id !== 'string' || id.trim() === '') {
          return false;
        }
        try {
          return BigInt(id) < maxItemId;
        } catch {
          // Skip invalid IDs that can't be converted to BigInt
          return false;
        }
      });
      // Removed warning log for infos with newer IDs - this is normal behavior
      // if (cleanupIds.size > eligibleCleanupIds.length) {
      //   warnLog(
      //     'cleanInfos',
      //     `${cleanupIds.size - eligibleCleanupIds.length} infos have IDs newer than the newest ID in inventory`,
      //   );
      // }
      if (eligibleCleanupIds.length > 0) {
        infoLog('cleanInfos', `Purging tag/notes from ${eligibleCleanupIds.length} deleted items`);
        dispatch(tagCleanup(eligibleCleanupIds));
      }
    }
  };
}

export function getTag(
  item: DimItem,
  itemInfos: ItemInfos,
  itemHashTags?: {
    [itemHash: string]: ItemHashTag;
  },
): TagValue | undefined {
  if (!item.taggable) {
    return undefined;
  }

  const apiTag = item.instanced ? itemInfos[item.id]?.tag : itemHashTags?.[item.hash]?.tag;

  // Convert API tag to our local tag type
  if (apiTag === 'keep' || apiTag === 'junk') {
    return apiTag as TagValue;
  }
  // Map API tags to our supported tags
  if (apiTag === 'favorite') {
    return 'hotperk';
  }
  if (apiTag === 'archive') {
    return 'junk';
  }
  if (apiTag === 'infuse') {
    return 'junk';
  }

  return undefined;
}

export function getNotes(
  item: DimItem,
  itemInfos: ItemInfos,
  itemHashTags?: {
    [itemHash: string]: ItemHashTag;
  },
): string | undefined {
  return item.taggable
    ? (item.instanced ? itemInfos[item.id]?.notes : itemHashTags?.[item.hash]?.notes) || undefined
    : undefined;
}
