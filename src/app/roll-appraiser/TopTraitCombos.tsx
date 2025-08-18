import BungieImage from 'app/d2l-ui/BungieImage';
import { DimItem } from 'app/inventory/item-types';
import { useD2Definitions } from 'app/manifest/selectors';
import { AppIcon, faCaretDown, faCaretUp } from 'app/shell/icons';
import clsx from 'clsx';
import { useMemo, useState } from 'react';
import styles from './TopTraitCombos.m.scss';
import { useRollAppraiserUtils } from './useRollAppraiserData';

interface TraitComboEntry {
  rank: number;
  perk4Hash: number;
  perk4EnhancedHash: number | null;
  perk5Hash: number;
  perk5EnhancedHash: number | null;
  count: number;
  show: boolean;
}

interface TopTraitCombosProps {
  item: DimItem;
  className?: string;
}

export default function TopTraitCombos({ item, className }: TopTraitCombosProps) {
  const defs = useD2Definitions();
  const { utils } = useRollAppraiserUtils();
  const [isExpanded, setIsExpanded] = useState(false);

  const topCombos = useMemo(() => {
    if (!utils || !item.hash) {
      return [];
    }

    // Access the TraitStats data directly from utils
    const weaponTraits = (utils as any).data?.TraitStats?.[item.hash.toString()];
    if (!weaponTraits) {
      return [];
    }

    // Convert trait entries to a more usable format
    const traitEntries: TraitComboEntry[] = Object.values(weaponTraits)
      .filter((trait: any) => trait.Show) // Only show visible entries
      .map((trait: any) => ({
        rank: trait.comboRank,
        perk4Hash: trait.Perk4Hash,
        perk4EnhancedHash: trait.Perk4EnhancedHash,
        perk5Hash: trait.Perk5Hash,
        perk5EnhancedHash: trait.Perk5EnhancedHash,
        count: trait.Count,
        show: trait.Show,
      }));

    // Sort by rank (lower rank = better) and take top 5
    return traitEntries.sort((a, b) => a.rank - b.rank).slice(0, 5);
  }, [utils, item.hash]);

  const getRankColor = (rank: number) => {
    switch (rank) {
      case 1:
        return styles.rank1;
      case 2:
        return styles.rank2;
      case 3:
        return styles.rank3;
      case 4:
        return styles.rank4;
      default:
        return styles.rank5;
    }
  };

  if (!defs || topCombos.length === 0) {
    return null;
  }

  return (
    <div className={clsx(styles.topTraitCombos, className)}>
      <button
        className={styles.header}
        onClick={() => setIsExpanded(!isExpanded)}
        type="button"
        aria-expanded={isExpanded}
      >
        <AppIcon icon={isExpanded ? faCaretDown : faCaretUp} className={styles.chevron} />
        <h3 className={styles.title}>Top 5 Trait Combinations</h3>
        <span className={styles.count}>({topCombos.length} combos)</span>
      </button>

      {isExpanded && (
        <div className={styles.combos}>
          {topCombos.map((combo) => {
            const perk4Def = defs.InventoryItem.get(combo.perk4Hash);
            const perk5Def = defs.InventoryItem.get(combo.perk5Hash);

            if (!perk4Def || !perk5Def) {
              return null;
            }

            return (
              <div
                key={`${combo.perk4Hash}-${combo.perk5Hash}`}
                className={clsx(styles.combo, getRankColor(combo.rank))}
              >
                <div className={styles.rank}>#{combo.rank}</div>
                <div className={styles.perks}>
                  <div className={styles.perk}>
                    <BungieImage
                      src={perk4Def.displayProperties.icon}
                      width={24}
                      height={24}
                      alt={perk4Def.displayProperties.name}
                    />
                    <span className={styles.perkName}>{perk4Def.displayProperties.name}</span>
                  </div>
                  <div className={styles.separator}>+</div>
                  <div className={styles.perk}>
                    <BungieImage
                      src={perk5Def.displayProperties.icon}
                      width={24}
                      height={24}
                      alt={perk5Def.displayProperties.name}
                    />
                    <span className={styles.perkName}>{perk5Def.displayProperties.name}</span>
                  </div>
                </div>
                <div className={styles.comboCount}>{combo.count.toLocaleString()} users</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
