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
  PerkStats: Record<string, any[][]>;
  TraitStats: Record<string, any[]>;
  MWStats: Record<string, any[]>;
  ReviewSummary: Record<string, any>;
}

export class RollAppraiserUtils {
  private data: RollAppraiserData;

  constructor(data: RollAppraiserData) {
    this.data = data;
  }

  /**
   * Get individual perk ranking for a specific weapon and perk
   */
  getPerkRank(itemHash: string, perkHash: string | number): PerkRankData | null {
    const weaponPerks = this.data.PerkStats[itemHash];
    if (!weaponPerks) {return null;}

    const targetHash = typeof perkHash === 'string' ? parseInt(perkHash) : perkHash;

    for (const perkArray of weaponPerks) {
      for (const perkData of perkArray) {
        if (perkData.PerkHash === targetHash) {
          return {
            rank: perkData.Rank,
            count: perkData.Count,
            perkHash: perkData.PerkHash,
            perkEnhancedHash: perkData.PerkEnhancedHash,
            show: perkData.Show,
            perkIndex: perkData.PerkIDX,
          };
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
    if (!weaponMWs) {return null;}

    const targetHash = typeof mwPerkHash === 'string' ? parseInt(mwPerkHash) : mwPerkHash;

    for (const mwData of weaponMWs) {
      if (mwData.PerkHash === targetHash) {
        return {
          rank: mwData.Rank,
          count: mwData.Count,
          perkHash: mwData.PerkHash,
          perkEnhancedHash: mwData.PerkEnhancedHash || null,
          show: mwData.Show,
        };
      }
    }
    return null;
  }

  /**
   * Get trait combo ranking for a specific weapon and perk combination
   * Each combo rank consists of 4 entries covering all standard/enhanced variations
   * We need to find which rank group contains our perk combination
   */
  getTraitComboRank(
    itemHash: string,
    perk4Hash: string | number,
    perk5Hash: string | number,
  ): TraitComboRankData | null {
    const weaponTraits = this.data.TraitStats[itemHash];
    if (!weaponTraits) {return null;}

    const targetPerk4 = typeof perk4Hash === 'string' ? parseInt(perk4Hash) : perk4Hash;
    const targetPerk5 = typeof perk5Hash === 'string' ? parseInt(perk5Hash) : perk5Hash;

    // Find which 4-entry group contains our perk combination
    for (let groupStart = 0; groupStart < weaponTraits.length; groupStart += 4) {
      const groupEnd = Math.min(groupStart + 4, weaponTraits.length);
      
      // Check if any entry in this group matches our perks
      for (let i = groupStart; i < groupEnd; i++) {
        const trait = weaponTraits[i];
        
        // Check if our perks match either the standard or enhanced versions
        const perk4Matches = 
          trait.Perk4Hash === targetPerk4 || 
          trait.Perk4EnhancedHash === targetPerk4 ||
          (trait.Perk4Hash === targetPerk4 && trait.Perk4EnhancedHash === null) ||
          (trait.Perk4EnhancedHash === targetPerk4 && trait.Perk4Hash !== null);
          
        const perk5Matches = 
          trait.Perk5Hash === targetPerk5 || 
          trait.Perk5EnhancedHash === targetPerk5 ||
          (trait.Perk5Hash === targetPerk5 && trait.Perk5EnhancedHash === null) ||
          (trait.Perk5EnhancedHash === targetPerk5 && trait.Perk5Hash !== null);
        
        if (perk4Matches && perk5Matches) {
          // Found our combo! Calculate rank based on group
          const rank = Math.floor(groupStart / 4) + 1;
          
          // Find the entry with "Show": true for display purposes
          const displayEntry = weaponTraits.slice(groupStart, groupEnd).find(t => t.Show) || trait;
          
          return {
            rank,
            indexInRank: i % 4,
            count: displayEntry.Count,
            perk4Hash: displayEntry.Perk4Hash,
            perk4EnhancedHash: displayEntry.Perk4EnhancedHash,
            perk5Hash: displayEntry.Perk5Hash,
            perk5EnhancedHash: displayEntry.Perk5EnhancedHash,
            show: displayEntry.Show,
            dateSaved: displayEntry.DateSaved,
          };
        }
      }
    }

    return null;
  }

  /**
   * Get review summary for a weapon
   */
  getReviewSummary(itemHash: string): ReviewSummaryData | null {
    const review = this.data.ReviewSummary[itemHash];
    if (!review) {return null;}

    return {
      reviewCount: review.ReviewCount,
      pveAverage: review.PVEAvg,
      pvpAverage: review.PVPAvg,
      overallAverage: review.OverallAvg,
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
    perkHashes.forEach((perkHash) => {
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
    });

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
    return Boolean(this.data.PerkStats[itemHash] ||
      this.data.TraitStats[itemHash] ||
      this.data.MWStats[itemHash] ||
      this.data.ReviewSummary[itemHash]);
  }
}

export type {
  PerkRankData,
  TraitComboRankData,
  ReviewSummaryData,
  WeaponPerkRankData,
  WeaponRankingData,
  RollAppraiserData,
};