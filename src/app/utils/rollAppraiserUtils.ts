/**
 * Utilities for working with Roll Appraiser data rankings
 */

interface PerkRankData {
  rank: number;
  count: number;
  perkHash: number;
  perkEnhancedHash: number | null;
  show: boolean;
  perkIndex?: number;
}

interface TraitComboRankData {
  rank: number;
  indexInRank: number;
  count: number;
  perk4Hash: number;
  perk4EnhancedHash: number | null;
  perk5Hash: number;
  perk5EnhancedHash: number | null;
  show: boolean;
  dateSaved: string;
}

interface ReviewSummaryData {
  reviewCount: number;
  pveAverage: number;
  pvpAverage: number;
  overallAverage: number;
}

interface WeaponPerkRankData {
  perkHash: string;
  rank: number;
  count: number;
  perkEnhancedHash: number | null;
  show: boolean;
}

interface WeaponRankingData {
  itemHash: string;
  perkRankings: WeaponPerkRankData[];
  traitComboRanking: TraitComboRankData | null;
  masterworkRanking: PerkRankData | null;
  reviewSummary: ReviewSummaryData | null;
}

interface RollAppraiserData {
  Weapons: Record<string, unknown>;
  MasterworkMods: Record<string, PerkRankData[]>;
  PerkStats: Record<string, PerkRankData[][]>;
  TraitStats: Record<string, Record<string, TraitComboRankData[]>>;
  MWStats: Record<string, PerkRankData[]>;
  ReviewSummary: Record<string, ReviewSummaryData>;
}

export class RollAppraiserUtils {
  private data: RollAppraiserData;

  constructor(data: RollAppraiserData) {
    this.data = data;
  }

  /**
   * Get individual perk ranking for a specific weapon and perk
   * Handles enhanced/standard perk mapping by checking both variants
   */
  getPerkRank(itemHash: string, perkHash: string | number): PerkRankData | null {
    const weaponPerks = this.data.PerkStats[itemHash];
    if (!weaponPerks) {
      return null;
    }

    const targetHash = typeof perkHash === 'string' ? parseInt(perkHash, 10) : perkHash;

    // First, try direct hash match
    for (const perkArray of weaponPerks) {
      for (const perkData of perkArray) {
        if (perkData.PerkHash === targetHash) {
          return {
            rank: Number(perkData.Rank),
            count: Number(perkData.Count),
            perkHash: Number(perkData.PerkHash),
            perkEnhancedHash: perkData.PerkEnhancedHash ? Number(perkData.PerkEnhancedHash) : null,
            show: Boolean(perkData.Show),
            perkIndex: perkData.PerkIDX ? Number(perkData.PerkIDX) : undefined,
          };
        }
      }
    }

    // If no direct match, check if this is an enhanced perk and look for its standard version
    // Import the trait mapping here to avoid circular imports
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const perkToEnhanced = require('data/d2/trait-to-enhanced-trait.json') as Record<
      string,
      number
    >;
    const enhancedToPerk: Record<number, number> = {};
    for (const [standard, enhanced] of Object.entries(perkToEnhanced)) {
      enhancedToPerk[enhanced] = parseInt(standard, 10);
    }

    const standardHash = enhancedToPerk[targetHash];
    if (standardHash) {
      // Look for the standard version in the data
      for (const perkArray of weaponPerks) {
        for (const perkData of perkArray) {
          if (perkData.PerkHash === standardHash) {
            return {
              rank: Number(perkData.Rank),
              count: Number(perkData.Count),
              perkHash: Number(perkData.PerkHash),
              perkEnhancedHash: perkData.PerkEnhancedHash ? Number(perkData.PerkEnhancedHash) : null,
              show: Boolean(perkData.Show),
              perkIndex: perkData.PerkIDX ? Number(perkData.PerkIDX) : undefined,
            };
          }
        }
      }
    }

    return null;
  }

  /**
   * Get masterwork stat ranking for a specific weapon and MW perk
   */
  getMWRank(itemHash: string, mwPerkHash: string | number): PerkRankData | null {
    const weaponMWs = this.data.MWStats[itemHash];
    if (!weaponMWs) {
      return null;
    }

    const targetHash = typeof mwPerkHash === 'string' ? parseInt(mwPerkHash, 10) : mwPerkHash;

    for (const mwData of weaponMWs) {
      if (mwData.PerkHash === targetHash) {
        return {
          rank: Number(mwData.Rank),
          count: Number(mwData.Count),
          perkHash: Number(mwData.PerkHash),
          perkEnhancedHash: mwData.PerkEnhancedHash ? Number(mwData.PerkEnhancedHash) : null,
          show: Boolean(mwData.Show),
        };
      }
    }
    return null;
  }

  /**
   * Get trait combo ranking for a specific weapon and perk combination
   * Now uses the comboRank property directly from TraitStats data
   */
  getTraitComboRank(
    itemHash: string,
    perk4Hash: string | number,
    perk5Hash: string | number,
  ): TraitComboRankData | null {
    const weaponTraits = this.data.TraitStats[itemHash];
    if (!weaponTraits) {
      return null;
    }

    const targetPerk4 = typeof perk4Hash === 'string' ? parseInt(perk4Hash, 10) : perk4Hash;
    const targetPerk5 = typeof perk5Hash === 'string' ? parseInt(perk5Hash, 10) : perk5Hash;

    let comboRank = 1;
    let indexInRank = 0;

    // Iterate through all traits to find the combo and determine its rank by its position
    for (const trait of Object.values(weaponTraits)) {
      const perk4Matches =
        trait.Perk4Hash === targetPerk4 || trait.Perk4EnhancedHash === targetPerk4;
      const perk5Matches =
        trait.Perk5Hash === targetPerk5 || trait.Perk5EnhancedHash === targetPerk5;

      if (perk4Matches && perk5Matches) {
        // Found our combo! Return the rank we've calculated based on its position.
        return {
          rank: comboRank,
          indexInRank: indexInRank,
          count: Number(trait.Count),
          perk4Hash: Number(trait.Perk4Hash),
          perk4EnhancedHash: trait.Perk4EnhancedHash ? Number(trait.Perk4EnhancedHash) : null,
          perk5Hash: Number(trait.Perk5Hash),
          perk5EnhancedHash: trait.Perk5EnhancedHash ? Number(trait.Perk5EnhancedHash) : null,
          show: Boolean(trait.Show),
          dateSaved: String(trait.DateSaved),
        };
      }

      // Increment counters for the next perk in the list
      indexInRank++;
      if (indexInRank % 4 === 0) {
        comboRank++;
        indexInRank = 0; // Reset index for the new rank
      }
    }

    return null; // Return null if the combo isn't found
  }

  /**
   * Get review summary for a weapon
   */
  getReviewSummary(itemHash: string): ReviewSummaryData | null {
    const review = this.data.ReviewSummary[itemHash];
    if (!review) {
      return null;
    }

    return {
      reviewCount: Number(review.ReviewCount),
      pveAverage: Number(review.PVEAvg),
      pvpAverage: Number(review.PVPAvg),
      overallAverage: Number(review.OverallAvg),
    };
  }

  /**
   * Get comprehensive weapon data including all rankings and reviews
   */
  getWeaponData(
    itemHash: string,
    perkHashes: (string | number)[] = [],
    mwHash?: string | number,
  ): WeaponRankingData {
    const result: WeaponRankingData = {
      itemHash,
      perkRankings: [],
      traitComboRanking: null,
      masterworkRanking: null,
      reviewSummary: this.getReviewSummary(itemHash),
    };

    // Get individual perk rankings
    for (const perkHash of perkHashes) {
      const perkRank = this.getPerkRank(itemHash, perkHash);
      if (perkRank) {
        result.perkRankings.push({
          perkHash: perkHash.toString(),
          rank: perkRank.rank,
          count: perkRank.count,
          perkEnhancedHash: perkRank.perkEnhancedHash,
          show: perkRank.show,
        });
      }
    }

    // Get trait combo ranking (assuming last two perks are the trait perks)
    if (perkHashes.length >= 2) {
      const perk4 = perkHashes[perkHashes.length - 2];
      const perk5 = perkHashes[perkHashes.length - 1];
      result.traitComboRanking = this.getTraitComboRank(itemHash, perk4, perk5);
    }

    // Get masterwork ranking
    if (mwHash) {
      result.masterworkRanking = this.getMWRank(itemHash, mwHash);
    }

    return result;
  }

  /**
   * Check if weapon has any ranking data
   */
  hasDataForWeapon(itemHash: string): boolean {
    return Boolean(
      this.data.PerkStats[itemHash] ||
        this.data.TraitStats[itemHash] ||
        this.data.MWStats[itemHash] ||
        this.data.ReviewSummary[itemHash],
    );
  }
}

export type {
  PerkRankData,
  ReviewSummaryData,
  RollAppraiserData,
  TraitComboRankData,
  WeaponPerkRankData,
  WeaponRankingData,
};
