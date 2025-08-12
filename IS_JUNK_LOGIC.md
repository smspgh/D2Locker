# is:junk Search Filter Logic

This document outlines the complete logic used by the `is:junk` search filter in D2Locker. The filter identifies items that are considered "junk" (safe to dismantle) based on various criteria.

## Overview

The `is:junk` filter returns items that do NOT meet any of the "keep" criteria. If an item meets ANY of the keep criteria below, it is NOT considered junk.

## Keep Criteria (Items NOT Marked as Junk)

The following 8 criteria determine which items are kept (not marked as junk):

### 1. Crafted Items
**Filter:** `is:crafted`
- **Logic:** Any item with `crafted === 'crafted'` is kept
- **Reason:** Crafted items represent player investment and can be reshaped

### 2. Legendary Weapons with Good Perk Combinations
**Filter:** `is:weapon is:legendary comborank:<=3`
- **Logic:** 
  - Item must be a weapon (`bucket.sort === 'Weapons'`)
  - Item must be legendary rarity
  - Checks ALL available perk combinations in trait columns (not just equipped)
  - Includes both standard and enhanced versions of perks
  - If ANY combination of available perks has a combo rank of 3 or better, the item is kept
- **Reason:** Weapons with top-tier perk combinations are valuable

### 3. Exotic Weapons (Not Lower Duplicates)
**Filter:** `is:weapon is:exotic -is:dupelower`
- **Logic:**
  - Item must be a weapon
  - Item must be exotic rarity
  - If no duplicates exist, the item is kept
  - If duplicates exist, only the best duplicate is kept (determined by `sortDupesBest`)
- **Reason:** Exotic weapons are rare and valuable, but we don't need multiple copies of worse rolls

### 4. Best Armor
**Filter:** `is:bestarmor`
- **Logic:**
  - Item must be armor (`bucket.inArmor`)
  - Groups armor by class, type, and tier
  - Within each group, sorts by custom stats/tags
  - Only the best item in each group is kept
- **Reason:** Keeps the highest stat armor for each slot/class combination

### 5. High Power Legendary Weapons (Infusion Only)
**Filter:** `maxpowertier:legendary:3`
- **Logic:**
  - Item must be a legendary weapon
  - Item must have a power level
  - Item must NOT already qualify for keeping under criteria 1-4
  - Groups remaining items by weapon slot (Kinetic, Energy, Power)
  - Sorts by power level (descending)
  - Keeps top 3 items in each weapon slot
- **Reason:** Maintains high power weapons solely for infusion purposes

### 6. High Power Legendary Armor (Infusion Only)
**Filter:** `maxpowertier:legendary:3` (for each class)
- **Logic:**
  - Item must be legendary armor
  - Item must have a power level
  - Item must NOT already qualify for keeping under criteria 1-4
  - Groups remaining items by bucket hash and class type
  - Sorts by power level (descending)
  - Keeps top 3 items in each slot per class
- **Reason:** Maintains high power armor solely for infusion purposes

### 7. High Power Rare Weapons (Infusion Only)
**Filter:** `maxpowertier:rare:3`
- **Logic:**
  - Item must be a rare (blue) weapon
  - Item must have a power level
  - Item must NOT already qualify for keeping under criteria 1-4
  - Groups remaining items by weapon slot (Kinetic, Energy, Power)
  - Sorts by power level (descending)
  - Keeps top 3 items in each weapon slot
- **Reason:** Blue weapons useful solely for power leveling and infusion

### 8. High Power Rare Armor (Infusion Only)
**Filter:** `maxpowertier:rare:3` (for each class)
- **Logic:**
  - Item must be rare (blue) armor
  - Item must have a power level
  - Item must NOT already qualify for keeping under criteria 1-4
  - Groups remaining items by bucket hash and class type
  - Sorts by power level (descending)
  - Keeps top 3 items in each slot per class
- **Reason:** Blue armor useful solely for power leveling

## Additional Logic

### Scope
- The filter only applies to weapons and armor
- Other item types (consumables, mods, etc.) are automatically excluded from junk

### Performance Optimizations
- Pre-computes duplicate groups for weapons and armor
- Pre-sorts items by power level for each slot
- Caches roll appraiser data for perk combination checks

## Example Usage

```
# Show all junk items
is:junk

# Show junk weapons only
is:junk is:weapon

# Show junk armor only  
is:junk is:armor

# Show all items worth keeping (opposite of junk)
is:keep

# Invert - show items that are NOT junk (same as is:keep)
-is:junk
```

## Related Filters

- **`is:keep`**: Shows the exact opposite of `is:junk` - all items that meet any of the 8 keep criteria
- **`-is:junk`**: Alternative syntax for `is:keep` (shows items that are NOT junk)

## Implementation Notes

1. **Combo Rank Evaluation**: The filter now evaluates ALL possible perk combinations available on a weapon, not just the currently selected perks. This ensures weapons with good rolls available aren't accidentally marked as junk.

2. **Enhanced Perks**: Both standard and enhanced versions of perks are considered when evaluating combo ranks.

3. **Duplicate Detection**: Uses the `makeDupeID` function to identify duplicate items based on their base properties, then sorts them using tags and custom stats to determine the "best" version.

4. **Power Level Tracking**: Maintains separate tracking for legendary and rare weapons/armor to ensure adequate infusion material is kept. 

5. **Infusion-Only Logic**: Power tier criteria (5-8) only consider items that would otherwise be marked as junk. This prevents keeping duplicate high-power items that are already being kept for their good rolls, exotic status, or best stats.

6. **Debug Logging**: Both `is:junk` and `is:keep` filters log why items are being kept to the browser console. Look for messages like `KEEP: [Item Name] (crafted, combo rank 2)` to understand why specific items qualify for keeping.