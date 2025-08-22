import { t } from 'app/i18next-t';
import { DimItem, DimSocket } from 'app/inventory/item-types';
import { showNotification } from 'app/notifications/notifications';
import { useRollAppraiserUtils } from 'app/roll-appraiser/useRollAppraiserData';
import { getSocketsByIndexes, getWeaponSockets } from 'app/utils/socket-utils';
import perkToEnhanced from 'data/d2/trait-to-enhanced-trait.json';
import ActionButton from './ActionButton';

interface BestPerksButtonProps {
  item: DimItem;
  label?: boolean;
  onPlugClicked?: (value: { item: DimItem; socket: DimSocket; plugHash: number }) => void;
}

interface RawTraitData {
  comboRank: number;
  Perk4Hash: number;
  Perk4EnhancedHash: number | null;
  Perk5Hash: number;
  Perk5EnhancedHash: number | null;
  Count: number;
  Show: boolean;
}

export default function BestPerksButton({ item, label, onPlugClicked }: BestPerksButtonProps) {
  const { utils } = useRollAppraiserUtils();

  const selectBestPerks = () => {
    if (!item.sockets || !utils || !item.bucket?.inWeapons) {
      showNotification({
        type: 'error',
        title: t('BestPerks.Error'),
        body: t('BestPerks.NotApplicable'),
      });
      return;
    }

    if (!onPlugClicked) {
      showNotification({
        type: 'info',
        title: t('BestPerks.Info'),
        body: t('BestPerks.OpenItemDetails'),
      });
      return;
    }

    try {
      // Get weapon sockets (perk columns)
      const weaponSockets = getWeaponSockets(item, {
        excludeEmptySockets: false,
        includeFakeMasterwork: Boolean(item.crafted),
      });
      if (!weaponSockets?.perks) {
        throw new Error('No weapon perks found');
      }

      // Get the actual socket objects for perks
      const perkSockets = getSocketsByIndexes(item.sockets, weaponSockets.perks.socketIndexes);

      // Store best perks for trait columns only (we can only apply changes to trait columns)
      const bestPerks: { socket: DimSocket; bestHash: number }[] = [];

      // Handle trait combo optimization (columns 3 and 4 only - these are the only ones we can apply)
      const column3Perks: number[] = [];
      const column4Perks: number[] = [];
      let column3Socket: DimSocket | null = null;
      let column4Socket: DimSocket | null = null;

      // Get perks from columns 3 and 4 for combo analysis
      for (const [socketIndex, socket] of perkSockets.entries()) {
        if (socketIndex === 2) {
          column3Socket = socket;
          if (socket.reusablePlugItems) {
            for (const plug of socket.reusablePlugItems) {
              if (plug.enabled) {
                column3Perks.push(plug.plugItemHash);
              }
            }
          }
          if (socket.plugged && !column3Perks.includes(socket.plugged.plugDef.hash)) {
            column3Perks.push(socket.plugged.plugDef.hash);
          }
        } else if (socketIndex === 3) {
          column4Socket = socket;
          if (socket.reusablePlugItems) {
            for (const plug of socket.reusablePlugItems) {
              if (plug.enabled) {
                column4Perks.push(plug.plugItemHash);
              }
            }
          }
          if (socket.plugged && !column4Perks.includes(socket.plugged.plugDef.hash)) {
            column4Perks.push(socket.plugged.plugDef.hash);
          }
        }
      }

      // Only optimize combo if both columns have perks
      if (column3Perks.length > 0 && column4Perks.length > 0 && column3Socket && column4Socket) {
        // Check all combinations of available perks to find the best one
        let bestCombo: {
          rank: number;
          perk3Hash: number;
          perk4Hash: number;
          perk3Enhanced?: number;
          perk4Enhanced?: number;
        } | null = null;

        for (const perk3 of column3Perks) {
          for (const perk4 of column4Perks) {
            // Try with the actual perk hashes first
            const combo = utils.getTraitComboRank(
              item.hash.toString(),
              perk3.toString(),
              perk4.toString(),
            );
            if (combo && (!bestCombo || combo.rank < bestCombo.rank)) {
              bestCombo = {
                rank: combo.rank,
                perk3Hash: perk3,
                perk4Hash: perk4,
              };
            }

            // Also check if these perks map to standard versions in the ranking data
            const standardPerk3 = Object.entries(perkToEnhanced).find(
              ([, enhanced]) => enhanced === perk3.toString(),
            )?.[0];
            const standardPerk4 = Object.entries(perkToEnhanced).find(
              ([, enhanced]) => enhanced === perk4.toString(),
            )?.[0];

            if (standardPerk3 || standardPerk4) {
              const altCombo = utils.getTraitComboRank(
                item.hash.toString(),
                (standardPerk3 || perk3).toString(),
                (standardPerk4 || perk4).toString(),
              );
              if (altCombo && (!bestCombo || altCombo.rank < bestCombo.rank)) {
                bestCombo = {
                  rank: altCombo.rank,
                  perk3Hash: standardPerk3 ? parseInt(standardPerk3, 10) : perk3,
                  perk4Hash: standardPerk4 ? parseInt(standardPerk4, 10) : perk4,
                  perk3Enhanced: standardPerk3 ? perk3 : undefined,
                  perk4Enhanced: standardPerk4 ? perk4 : undefined,
                };
              }
            }
          }
        }

        if (bestCombo) {
          // Prefer enhanced versions if available
          const targetPerk3 = bestCombo.perk3Enhanced || bestCombo.perk3Hash;
          const targetPerk4 = bestCombo.perk4Enhanced || bestCombo.perk4Hash;

          // Override individual best perks with combo best perks
          for (const [index, bp] of bestPerks.entries()) {
            if (bp.socket === column3Socket) {
              bestPerks[index] = { socket: column3Socket, bestHash: targetPerk3 };
            } else if (bp.socket === column4Socket) {
              bestPerks[index] = { socket: column4Socket, bestHash: targetPerk4 };
            }
          }

          // Add if not already in the list
          if (
            !bestPerks.find((bp) => bp.socket === column3Socket) &&
            column3Socket.plugged?.plugDef.hash !== targetPerk3
          ) {
            bestPerks.push({ socket: column3Socket, bestHash: targetPerk3 });
          }
          if (
            !bestPerks.find((bp) => bp.socket === column4Socket) &&
            column4Socket.plugged?.plugDef.hash !== targetPerk4
          ) {
            bestPerks.push({ socket: column4Socket, bestHash: targetPerk4 });
          }
        }
      }

      // Select all the best perks
      let selectedCount = 0;
      for (const { socket, bestHash } of bestPerks) {
        onPlugClicked({ item, socket, plugHash: bestHash });
        selectedCount++;
      }

      if (selectedCount > 0) {
        showNotification({
          type: 'success',
          title: t('BestPerks.Selected'),
          body: t('BestPerks.SelectedCount', { count: selectedCount }),
        });
      } else {
        showNotification({
          type: 'info',
          title: t('BestPerks.AlreadyOptimal'),
          body: t('BestPerks.NoChangesNeeded'),
        });
      }
    } catch (error) {
      console.error('Error applying best perks:', error);
      showNotification({
        type: 'error',
        title: t('BestPerks.Error'),
        body: error instanceof Error ? error.message : t('BestPerks.UnknownError'),
      });
    }
  };

  // Only show for weapons with trait combination data
  if (!item.bucket?.inWeapons || !utils) {
    return null;
  }

  const utilsData = utils as {
    data?: { TraitStats?: Record<string, Record<string, RawTraitData>> };
  };
  const hasTraitData = utilsData.data?.TraitStats?.[item.hash.toString()];

  if (!hasTraitData) {
    return null;
  }

  return (
    <ActionButton onClick={selectBestPerks} title={t('BestPerks.ButtonHelp')}>
      <span style={{ fontWeight: 'bold', fontSize: '11px' }}>BP</span>
      {label && <span style={{ marginLeft: '6px' }}>{t('BestPerks.Button')}</span>}
    </ActionButton>
  );
}
