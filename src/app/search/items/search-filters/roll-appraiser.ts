import { DimItem } from 'app/inventory/item-types';
import { quoteFilterString } from 'app/search/query-parser';
import { getRollAppraiserUtilsSync } from 'app/roll-appraiser/rollAppraiserService';
import { getWeaponSockets, getSocketsByIndexes } from 'app/utils/socket-utils';
import { ItemFilterDefinition } from '../item-filter-types';

/**
 * Generate perk name suggestions for a specific perk column
 */
function generatePerkNameSuggestions(columnIndex: number, keyword: string) {
  return ({ d2Definitions, allItems }: { d2Definitions: any; allItems: any }) => {
    if (!d2Definitions || !allItems) {
      return [];
    }

    const perkNames = new Set<string>();
    
    // Get perk names from weapons that have perks in the specified column
    for (const item of allItems) {
      if (item.bucket.inWeapons && item.sockets) {
        const weaponSockets = getWeaponSockets(item, { excludeEmptySockets: false });
        if (weaponSockets?.perks) {
          const perkSockets = getSocketsByIndexes(item.sockets, weaponSockets.perks.socketIndexes);
          const targetPerk = perkSockets[columnIndex];
          
          if (targetPerk) {
            for (const plug of targetPerk.plugOptions) {
              if (plug.plugDef.displayProperties.name) {
                perkNames.add(plug.plugDef.displayProperties.name.toLowerCase());
              }
            }
          }
        }
      }
    }

    return Array.from(perkNames, (s) => `${keyword}:${quoteFilterString(s)}`);
  };
}

/**
 * Helper function to get weapon ranking data for search filters
 */
function getWeaponRankingInfo(item: DimItem) {
  const utils = getRollAppraiserUtilsSync();
  
  // Log first call to verify utils availability
  if (!(window as any).rollAppraiserDebugLogged) {
    (window as any).rollAppraiserDebugLogged = true;
  }
  
  if (!utils || item.destinyVersion !== 2 || !item.bucket.inWeapons || !item.sockets) {
    return null;
  }

  // Get weapon sockets to identify perks
  const weaponSockets = getWeaponSockets(item, { excludeEmptySockets: false });
  if (!weaponSockets?.perks) {
    return null;
  }

  // Get all perk sockets from the perks category
  const perkSockets = getSocketsByIndexes(item.sockets, weaponSockets.perks.socketIndexes);
  
  const perkRankings: { index: number; perkHash: number; ranking: any }[] = [];
  const traitPerkHashes: number[] = [];

  // Load enhanced perk mapping
  const perkToEnhanced = require('data/d2/trait-to-enhanced-trait.json');

  // Process each perk socket and check ALL available perks for that socket
  perkSockets.forEach((socket, socketIndex) => {
    
    // Check all plug options available for this socket
    if (socket.plugOptions && socket.plugOptions.length > 0) {
      socket.plugOptions.forEach((plug) => {
        const perkHash = plug.plugDef.hash;
        const ranking = utils.getPerkRank(item.hash.toString(), perkHash.toString());
        
        if (ranking) {
          // Use the PerkIDX from the data if available, otherwise fall back to socket index
          const perkColumnIndex = ranking.perkIndex !== undefined ? ranking.perkIndex : socketIndex;
          perkRankings.push({
            index: perkColumnIndex,
            perkHash,
            ranking
          });
        }
        
        // Also check if this perk has an enhanced version
        const enhancedHash = perkToEnhanced[perkHash.toString()];
        if (enhancedHash) {
          const enhancedRanking = utils.getPerkRank(item.hash.toString(), enhancedHash);
          if (enhancedRanking) {
            const perkColumnIndex = enhancedRanking.perkIndex !== undefined ? enhancedRanking.perkIndex : socketIndex;
            perkRankings.push({
              index: perkColumnIndex,
              perkHash: parseInt(enhancedHash),
              ranking: enhancedRanking
            });
          }
        }
      });
    }
    
    // Also check the currently plugged perk if it's not in plugOptions
    if (socket.plugged && socket.isPerk) {
      const pluggedHash = socket.plugged.plugDef.hash;
      const pluggedRanking = utils.getPerkRank(item.hash.toString(), pluggedHash.toString());
      
      if (pluggedRanking) {
        const perkColumnIndex = pluggedRanking.perkIndex !== undefined ? pluggedRanking.perkIndex : socketIndex;
        // Check if this perk is already in our rankings
        const alreadyAdded = perkRankings.some(p => p.perkHash === pluggedHash);
        if (!alreadyAdded) {
          perkRankings.push({
            index: perkColumnIndex,
            perkHash: pluggedHash,
            ranking: pluggedRanking
          });
        }
      }
    }
    
    // For trait combo ranking, use only the currently plugged perks
    if (socket.plugged && socket.isPerk && (socketIndex === 2 || socketIndex === 3)) {
      traitPerkHashes.push(socket.plugged.plugDef.hash);
    }
  });

  // Get all possible combo rankings from available perks
  const combos: { rank: number; perk4: number; perk5: number }[] = [];
  
  // Get all available perks from columns 3 and 4 (socket index 2 and 3)
  const column3Perks: number[] = [];
  const column4Perks: number[] = [];
  
  perkSockets.forEach((socket, socketIndex) => {
    if (socketIndex === 2 && socket.plugOptions) {
      // Column 3 perks
      socket.plugOptions.forEach(plug => {
        column3Perks.push(plug.plugDef.hash);
        // Also check enhanced versions
        const enhancedHash = perkToEnhanced[plug.plugDef.hash.toString()];
        if (enhancedHash) {
          column3Perks.push(parseInt(enhancedHash));
        }
      });
      // Also include currently plugged if not in plugOptions
      if (socket.plugged && socket.isPerk) {
        const pluggedHash = socket.plugged.plugDef.hash;
        if (!column3Perks.includes(pluggedHash)) {
          column3Perks.push(pluggedHash);
        }
      }
    } else if (socketIndex === 3 && socket.plugOptions) {
      // Column 4 perks
      socket.plugOptions.forEach(plug => {
        column4Perks.push(plug.plugDef.hash);
        // Also check enhanced versions
        const enhancedHash = perkToEnhanced[plug.plugDef.hash.toString()];
        if (enhancedHash) {
          column4Perks.push(parseInt(enhancedHash));
        }
      });
      // Also include currently plugged if not in plugOptions
      if (socket.plugged && socket.isPerk) {
        const pluggedHash = socket.plugged.plugDef.hash;
        if (!column4Perks.includes(pluggedHash)) {
          column4Perks.push(pluggedHash);
        }
      }
    }
  });
  
  // Check all combinations of column 3 and column 4 perks
  for (const perk3 of column3Perks) {
    for (const perk4 of column4Perks) {
      const combo = utils.getTraitComboRank(
        item.hash.toString(),
        perk3.toString(),
        perk4.toString()
      );
      if (combo) {
        combos.push({
          rank: combo.rank,
          perk4: perk3,
          perk5: perk4
        });
      }
    }
  }
  
  // Find the best (lowest) combo rank
  const bestCombo = combos.length > 0 
    ? combos.reduce((best, current) => current.rank < best.rank ? current : best)
    : null;
  
  // Get combo ranking for currently equipped perks (for backwards compatibility)
  let comboRank = null;
  if (traitPerkHashes.length === 2) {
    comboRank = utils.getTraitComboRank(
      item.hash.toString(),
      traitPerkHashes[0].toString(),
      traitPerkHashes[1].toString()
    );
  }


  return {
    comboRank: comboRank?.rank || null,
    bestComboRank: bestCombo?.rank || null,
    perkRankings,
    reviewSummary: utils.getReviewSummary(item.hash.toString())
  };
}

const rollAppraiserFilters: ItemFilterDefinition[] = [
  // Combo rank filters
  {
    keywords: 'comborank',
    description: undefined as any,
    format: 'range',
    destinyVersion: 2,
    filter: ({ compare }) => (item) => {
        const info = getWeaponRankingInfo(item);
        // Use bestComboRank which checks all available perk combinations
        return info?.bestComboRank ? compare!(info.bestComboRank) : false;
      },
  },

  // Individual perk rank filters for each column
  {
    keywords: 'perk1rank',
    description: undefined as any,
    format: 'range',
    destinyVersion: 2,
    filter: ({ compare }) => (item) => {
        const info = getWeaponRankingInfo(item);
        const column1Perks = info?.perkRankings.filter(p => p.index === 0) || [];
        return column1Perks.some(perk => perk.ranking && compare!(perk.ranking.rank));
      },
  },

  {
    keywords: 'perk2rank',
    description: undefined as any,
    format: 'range',
    destinyVersion: 2,
    filter: ({ compare }) => (item) => {
        const info = getWeaponRankingInfo(item);
        const column2Perks = info?.perkRankings.filter(p => p.index === 1) || [];
        return column2Perks.some(perk => perk.ranking && compare!(perk.ranking.rank));
      },
  },

  {
    keywords: 'perk3rank',
    description: undefined as any,
    format: 'range',
    destinyVersion: 2,
    filter: ({ compare }) => (item) => {
        const info = getWeaponRankingInfo(item);
        if (!info?.perkRankings) {return false;}
        
        const column3Perks = info.perkRankings.filter(p => p.index === 2);
        const result = column3Perks.some(perk => perk.ranking && compare!(perk.ranking.rank));
        
        return result;
      },
  },

  {
    keywords: 'perk4rank',
    description: undefined as any,
    format: 'range',
    destinyVersion: 2,
    filter: ({ compare }) => (item) => {
        const info = getWeaponRankingInfo(item);
        const column4Perks = info?.perkRankings.filter(p => p.index === 3) || [];
        return column4Perks.some(perk => perk.ranking && compare!(perk.ranking.rank));
      },
  },

  // Perk name filters for each column
  {
    keywords: 'perk1name',
    description: undefined as any,
    format: 'freeform',
    destinyVersion: 2,
    suggestionsGenerator: generatePerkNameSuggestions(0, 'perk1name') as any,
    filter: ({ filterValue }) => (item) => {
      const info = getWeaponRankingInfo(item);
      if (!info || !item.sockets) {return false;}
      
      const weaponSockets = getWeaponSockets(item, { excludeEmptySockets: false });
      if (!weaponSockets?.perks) {return false;}
      
      const perkSockets = getSocketsByIndexes(item.sockets, weaponSockets.perks.socketIndexes);
      const firstPerk = perkSockets[0];
      
      if (!firstPerk) {return false;}
      
      // Check all plug options in this socket, not just the plugged one (for armory compatibility)
      return firstPerk.plugOptions.some(plug => {
        const perkName = plug.plugDef.displayProperties.name.toLowerCase();
        return perkName.includes(filterValue.toLowerCase());
      });
    },
  },

  {
    keywords: 'perk2name',
    description: undefined as any,
    format: 'freeform',
    destinyVersion: 2,
    suggestionsGenerator: generatePerkNameSuggestions(1, 'perk2name') as any,
    filter: ({ filterValue }) => (item) => {
      const info = getWeaponRankingInfo(item);
      if (!info || !item.sockets) {return false;}
      
      const weaponSockets = getWeaponSockets(item, { excludeEmptySockets: false });
      if (!weaponSockets?.perks) {return false;}
      
      const perkSockets = getSocketsByIndexes(item.sockets, weaponSockets.perks.socketIndexes);
      const secondPerk = perkSockets[1];
      
      if (!secondPerk) {return false;}
      
      // Check all plug options in this socket, not just the plugged one (for armory compatibility)
      return secondPerk.plugOptions.some(plug => {
        const perkName = plug.plugDef.displayProperties.name.toLowerCase();
        return perkName.includes(filterValue.toLowerCase());
      });
    },
  },

  {
    keywords: 'perk3name',
    description: undefined as any,
    format: 'freeform',
    destinyVersion: 2,
    suggestionsGenerator: generatePerkNameSuggestions(2, 'perk3name') as any,
    filter: ({ filterValue }) => (item) => {
      const info = getWeaponRankingInfo(item);
      if (!info || !item.sockets) {return false;}
      
      const weaponSockets = getWeaponSockets(item, { excludeEmptySockets: false });
      if (!weaponSockets?.perks) {return false;}
      
      const perkSockets = getSocketsByIndexes(item.sockets, weaponSockets.perks.socketIndexes);
      const thirdPerk = perkSockets[2];
      
      if (!thirdPerk) {return false;}
      
      // Check all plug options in this socket, not just the plugged one (for armory compatibility)
      return thirdPerk.plugOptions.some(plug => {
        const perkName = plug.plugDef.displayProperties.name.toLowerCase();
        return perkName.includes(filterValue.toLowerCase());
      });
    },
  },

  {
    keywords: 'perk4name',
    description: undefined as any,
    format: 'freeform',
    destinyVersion: 2,
    suggestionsGenerator: generatePerkNameSuggestions(3, 'perk4name') as any,
    filter: ({ filterValue }) => (item) => {
      const info = getWeaponRankingInfo(item);
      if (!info || !item.sockets) {return false;}
      
      const weaponSockets = getWeaponSockets(item, { excludeEmptySockets: false });
      if (!weaponSockets?.perks) {return false;}
      
      const perkSockets = getSocketsByIndexes(item.sockets, weaponSockets.perks.socketIndexes);
      const fourthPerk = perkSockets[3];
      
      if (!fourthPerk) {return false;}
      
      // Check all plug options in this socket, not just the plugged one (for armory compatibility)
      return fourthPerk.plugOptions.some(plug => {
        const perkName = plug.plugDef.displayProperties.name.toLowerCase();
        return perkName.includes(filterValue.toLowerCase());
      });
    },
  },

  // Review score filters
  {
    keywords: 'reviewcount',
    description: undefined as any,
    format: 'range',
    destinyVersion: 2,
    filter: ({ compare }) => (item) => {
      const info = getWeaponRankingInfo(item);
      return info?.reviewSummary ? compare!(info.reviewSummary.reviewCount) : false;
    },
  },

  {
    keywords: 'pvescore',
    description: undefined as any,
    format: 'range',
    destinyVersion: 2,
    filter: ({ compare }) => (item) => {
      const info = getWeaponRankingInfo(item);
      return info?.reviewSummary ? compare!(info.reviewSummary.pveAverage) : false;
    },
  },

  {
    keywords: 'pvpscore',
    description: undefined as any,
    format: 'range',
    destinyVersion: 2,
    filter: ({ compare }) => (item) => {
      const info = getWeaponRankingInfo(item);
      return info?.reviewSummary ? compare!(info.reviewSummary.pvpAverage) : false;
    },
  },

  {
    keywords: 'overallscore',
    description: undefined as any,
    format: 'range',
    destinyVersion: 2,
    filter: ({ compare }) => (item) => {
      const info = getWeaponRankingInfo(item);
      return info?.reviewSummary ? compare!(info.reviewSummary.overallAverage) : false;
    },
  },
];

// Make filters globally accessible for debugging
(window as any).rollAppraiserFilters = rollAppraiserFilters;

export default rollAppraiserFilters;