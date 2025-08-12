# Search Query Logic Explanation

This document explains the logic behind a complex search query used in D2Locker for identifying valuable items worth keeping.

## The Query

```
(is:crafted) or
(is:bestarmor) or 
(is:dupebest is:weapon) or 
(comborank:<=4) or 
(maxpowertier:legendary:6) or 
((maxbasestatvalue:total is:legendary is:titan) or (is:bestarmor is:legendary is:titan)) or 
((maxbasestatvalue:total is:legendary is:hunter) or (is:bestarmor is:legendary is:hunter)) or 
((maxbasestatvalue:total is:legendary is:warlock) or (is:bestarmor is:legendary is:warlock))
```

## Overall Purpose

This search query identifies items that should be **kept** rather than deleted or dismantled. It uses an OR-based approach, meaning an item only needs to match ONE of these conditions to be considered valuable.

## Breakdown by Category

### 1. Crafted Items
```
(is:crafted)
```
- **Logic**: Keep all crafted weapons
- **Reason**: Crafted weapons are valuable because they can be reshaped with different perks and enhanced with better traits
- **Impact**: Protects investment in weapon crafting progress

### 2. Best Armor Overall
```
(is:bestarmor)
```
- **Logic**: Keep the best armor piece for each class/type/tier combination
- **How it works**: Groups armor by Guardian class (Titan/Hunter/Warlock), armor slot (helmet/chest/etc.), and rarity tier (Legendary/Exotic)
- **Selection criteria**: 
  - For armor with custom stats: Highest custom stat value
  - For weapons: Best perk combination rank
  - Fallback: Highest power level, then tag priority, masterwork status, etc.
- **Impact**: Ensures you keep at least one good piece in every armor category

### 3. Best Duplicate Weapons
```
(is:dupebest is:weapon)
```
- **Logic**: Among duplicate weapons (same name/type), keep only the best one
- **Selection criteria**: Best perk combination rank (lower numbers = better), then power, tags, etc.
- **Impact**: Prevents hoarding multiple copies of the same weapon when you only need the best roll

### 4. High-Ranking Weapon Combinations
```
(comborank:<=4)
```
- **Logic**: Keep weapons with perk combinations ranked 4 or better in the roll appraiser data
- **Reason**: These are considered good to excellent rolls according to community/PvE data
- **Impact**: Preserves weapons with strong perk synergies even if they're not the absolute best duplicate

### 5. Top Legendary Items per Slot
```
(maxpowertier:legendary:6)
```
- **Logic**: Keep the top 6 legendary items in each equipment slot
- **How it works**: 
  - Groups items by equipment slot and Guardian class
  - Ranks ONLY legendary items by power level
  - Keeps the top 6 from each group
- **Reason**: Provides infusion fuel options and backup gear without exotic constraints
- **Impact**: Maintains a healthy selection of legendary alternatives

### 6. Class-Specific Legendary Armor Optimization
```
((maxbasestatvalue:total is:legendary is:titan) or (is:bestarmor is:legendary is:titan)) or 
((maxbasestatvalue:total is:legendary is:hunter) or (is:bestarmor is:legendary is:hunter)) or 
((maxbasestatvalue:total is:legendary is:warlock) or (is:bestarmor is:legendary is:warlock))
```

Each class has the same logic with two protection layers:

#### Layer 1: Maximum Base Stat Total
- `maxbasestatvalue:total is:legendary is:titan`
- **Logic**: Keep legendary armor pieces that have the highest total base stats for each Titan armor slot
- **Focus**: Raw stat optimization regardless of stat distribution

#### Layer 2: Best Armor Protection  
- `is:bestarmor is:legendary is:titan`
- **Logic**: Keep the best legendary armor piece per slot based on custom stat priorities
- **Focus**: Optimized for your personal stat preferences and build requirements

#### Why Both Layers?
- **Redundancy**: Ensures valuable armor is protected even if custom stats aren't configured
- **Different optimization goals**: Total stats vs. targeted stat builds
- **Build flexibility**: Provides options for both generic high-stat builds and specialized builds

## Query Strategy

### Conservative Approach
This query errs on the side of **keeping too much** rather than accidentally deleting something valuable. It's designed for players who want automated protection without manual review of every item.

### Complementary Filters
The different conditions complement each other:
- **Crafted + Combo Rank**: Covers both craftable and non-craftable weapons
- **Best Armor + Max Stats**: Covers both custom and default stat priorities  
- **Duplicate Best + Power Tier**: Balances keeping the best while maintaining options

### Performance Considerations
- Uses OR logic, so items are evaluated quickly (stops at first match)
- Most specific filters (crafted, best armor) are checked first
- Broader filters (power tier, stat totals) provide safety nets

## Usage Scenarios

This query is ideal for:
- **Vault cleaning**: Mass deletion of non-essential items
- **Inventory management**: Automated keep/dismantle decisions
- **Backup protection**: Ensuring you don't accidentally delete good items
- **Build preparation**: Maintaining gear options for different builds

## Customization Notes

To adapt this query:
- **Adjust `comborank:<=4`**: Lower number = stricter weapon requirements
- **Modify `maxpowertier:legendary:6`**: Change count based on vault space needs  
- **Add class restrictions**: Further narrow armor selections if needed
- **Include exotic considerations**: Add similar logic for exotic items if desired