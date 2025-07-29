console.log('TOP OF ROLL APPRAISER MODULE');

import { DimItem } from 'app/inventory/item-types';
import { quoteFilterString } from 'app/search/query-parser';
import { getRollAppraiserUtilsSync } from 'app/roll-appraiser/rollAppraiserService';
import { getWeaponSockets, getSocketsByIndexes } from 'app/utils/socket-utils';
import { ItemFilterDefinition } from '../item-filter-types';

console.log('Roll appraiser filters module loaded');

/**
 * Generate perk name suggestions for a specific perk column
 */
function generatePerkNameSuggestions(columnIndex: number, keyword: string) {
  return ({ d2Definitions, allItems }) => {
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
  if (!window.rollAppraiserDebugLogged) {
    window.rollAppraiserDebugLogged = true;
    console.log('getWeaponRankingInfo first call - utils available:', Boolean(utils));
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
      });
    }
    
    // For trait combo ranking, use only the currently plugged perks
    if (socket.plugged && socket.isPerk && (socketIndex === 2 || socketIndex === 3)) {
      traitPerkHashes.push(socket.plugged.plugDef.hash);
    }
  });

  // Get combo ranking
  let comboRank = null;
  if (traitPerkHashes.length === 2) {
    comboRank = utils.getTraitComboRank(
      item.hash.toString(),
      traitPerkHashes[0].toString(),
      traitPerkHashes[1].toString()
    );
  }

  // Debug log perk index distribution
  if (perkRankings.length > 0 && !window.perkIndexLogged) {
    window.perkIndexLogged = true;
    console.log('Perk index distribution:', perkRankings.map(p => ({ hash: p.perkHash, index: p.index })));
    console.log('Unique indexes found:', [...new Set(perkRankings.map(p => p.index))].sort());
  }

  return {
    comboRank: comboRank?.rank || null,
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
    filter: ({ compare }) => {
      console.log('comborank filter created');
      return (item) => {
        const info = getWeaponRankingInfo(item);
        return info?.comboRank ? compare!(info.comboRank) : false;
      };
    },
  },

  // Individual perk rank filters for each column
  {
    keywords: 'perk1rank',
    description: undefined as any,
    format: 'range',
    destinyVersion: 2,
    filter: ({ compare }) => {
      console.log('perk1rank filter created - looking for index 2');
      return (item) => {
        const info = getWeaponRankingInfo(item);
        const column1Perks = info?.perkRankings.filter(p => p.index === 2) || [];
        return column1Perks.some(perk => perk.ranking && compare!(perk.ranking.rank));
      };
    },
  },

  {
    keywords: 'perk2rank',
    description: undefined as any,
    format: 'range',
    destinyVersion: 2,
    filter: ({ compare }) => {
      console.log('perk2rank filter created - looking for index 3');
      return (item) => {
        const info = getWeaponRankingInfo(item);
        const column2Perks = info?.perkRankings.filter(p => p.index === 3) || [];
        return column2Perks.some(perk => perk.ranking && compare!(perk.ranking.rank));
      };
    },
  },

  {
    keywords: 'perk3rank',
    description: undefined as any,
    format: 'range',
    destinyVersion: 2,
    filter: ({ compare }) => {
      console.log('perk3rank filter created');
      return (item) => {
        const info = getWeaponRankingInfo(item);
        if (!info || !info.perkRankings) return false;
        
        const column3Perks = info.perkRankings.filter(p => p.index === 4);
        const result = column3Perks.some(perk => perk.ranking && compare!(perk.ranking.rank));
        
        if (result) {
          console.log(`MATCH: ${item.name} has perk in column 3 (index 4) matching rank criteria`);
        }
        
        return result;
      };
    },
  },

  {
    keywords: 'perk4rank',
    description: undefined as any,
    format: 'range',
    destinyVersion: 2,
    filter: ({ compare }) => {
      console.log('perk4rank filter created - looking for index 5');
      return (item) => {
        const info = getWeaponRankingInfo(item);
        const column4Perks = info?.perkRankings.filter(p => p.index === 5) || [];
        return column4Perks.some(perk => perk.ranking && compare!(perk.ranking.rank));
      };
    },
  },

  // Perk name filters for each column
  {
    keywords: 'perk1name',
    description: undefined as any,
    format: 'freeform',
    destinyVersion: 2,
    suggestionsGenerator: generatePerkNameSuggestions(0, 'perk1name'),
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
    suggestionsGenerator: generatePerkNameSuggestions(1, 'perk2name'),
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
    suggestionsGenerator: generatePerkNameSuggestions(2, 'perk3name'),
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
    suggestionsGenerator: generatePerkNameSuggestions(3, 'perk4name'),
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

console.log('Roll appraiser filters created:', rollAppraiserFilters.length, 'filters');
console.log('Filter keywords:', rollAppraiserFilters.map(f => f.keywords));

// Make filters globally accessible for debugging
(window as any).rollAppraiserFilters = rollAppraiserFilters;

export default rollAppraiserFilters;