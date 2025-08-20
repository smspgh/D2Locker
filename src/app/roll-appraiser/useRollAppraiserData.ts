import { DimItem } from 'app/inventory/item-types';
import { RollAppraiserUtils, WeaponRankingData } from 'app/utils/rollAppraiserUtils';
import { getSocketsByIndexes, getWeaponSockets } from 'app/utils/socket-utils';
import { useEffect, useState } from 'react';
import { getRollAppraiserUtils, getRollAppraiserUtilsSync } from './rollAppraiserService';

/**
 * Hook to get roll appraiser utils
 */
export function useRollAppraiserUtils() {
  const [utils, setUtils] = useState<RollAppraiserUtils | null>(() => getRollAppraiserUtilsSync());
  const [loading, setLoading] = useState(!utils);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!utils) {
      getRollAppraiserUtils()
        .then((loadedUtils) => {
          setUtils(loadedUtils);
          setLoading(false);
        })
        .catch((err: any) => {
          setError(err instanceof Error ? err : new Error(String(err)));
          setLoading(false);
        });
    }
  }, [utils]);

  return { utils, loading, error };
}

/**
 * Hook to get weapon ranking data for a specific item
 */
export function useWeaponRankingData(item: DimItem | null): WeaponRankingData | null {
  const { utils } = useRollAppraiserUtils();
  const [rankingData, setRankingData] = useState<WeaponRankingData | null>(null);

  useEffect(() => {
    if (!utils || !item || item.destinyVersion !== 2 || !item.bucket.inWeapons) {
      setRankingData(() => null);
      return;
    }

    // Get perk hashes from the weapon's sockets
    const perkHashes: number[] = [];
    const traitPerkHashes: number[] = [];
    let masterworkHash: number | undefined = undefined;

    if (item.sockets) {
      // Use getWeaponSockets to properly identify weapon perks
      const weaponSockets = getWeaponSockets(item, { excludeEmptySockets: false });

      if (weaponSockets?.perks) {
        // Get all perk sockets from the perks category
        const perkSockets = getSocketsByIndexes(item.sockets, weaponSockets.perks.socketIndexes);

        // Filter to only plugged perks
        const pluggedPerks = perkSockets.filter((s) => s.plugged && s.isPerk);

        for (let index = 0; index < pluggedPerks.length; index++) {
          const socket = pluggedPerks[index];
          if (socket.plugged) {
            perkHashes.push(socket.plugged.plugDef.hash);
            // Columns 3 and 4 (indexes 2 and 3) are typically trait perks
            if (index === 2 || index === 3) {
              traitPerkHashes.push(socket.plugged.plugDef.hash);
            }
          }
        }
      }

      // Check for masterwork
      for (const socket of item.sockets.allSockets) {
        if (
          socket.plugged &&
          socket.plugged.plugDef.plug?.plugCategoryIdentifier === 'intrinsics.stat'
        ) {
          masterworkHash = socket.plugged.plugDef.hash;
        }
      }
    }

    const weaponData = utils.getWeaponData(
      item.hash.toString(),
      perkHashes.map(String),
      masterworkHash?.toString(),
    );

    // Override trait combo ranking if we have specific trait perks identified
    if (traitPerkHashes.length === 2 && weaponData) {
      const comboRank = utils.getTraitComboRank(
        item.hash.toString(),
        traitPerkHashes[0].toString(),
        traitPerkHashes[1].toString(),
      );
      // Only log in debug mode
      if (!comboRank && $D2L_FLAVOR === 'dev') {
        console.log('No combo rank found for weapon:', item.name, {
          itemHash: item.hash,
          perk4: traitPerkHashes[0],
          perk5: traitPerkHashes[1],
          allPerks: perkHashes,
          hasTraitData: Boolean(utils.hasDataForWeapon(item.hash.toString())),
        });
      } else if (comboRank && $D2L_FLAVOR === 'dev') {
        console.log('Found combo rank for weapon:', item.name, {
          rank: comboRank.rank,
          perk4: comboRank.perk4Hash,
          perk5: comboRank.perk5Hash,
          count: comboRank.count,
        });
      }
      weaponData.traitComboRanking = comboRank;
    }

    setRankingData(() => weaponData);
  }, [utils, item]);

  return rankingData;
}

/**
 * Hook to check if a weapon has any ranking data
 */
export function useHasRankingData(item: DimItem | null): boolean {
  const { utils } = useRollAppraiserUtils();

  if (!utils || !item || item.destinyVersion !== 2 || !item.bucket.inWeapons) {
    return false;
  }

  return utils.hasDataForWeapon(item.hash.toString());
}
