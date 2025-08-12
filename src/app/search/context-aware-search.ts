import { createSelector } from 'reselect';
import { RootState } from 'app/store/types';
import { filteredItemsSelector } from './items/item-search-filter';

/**
 * A selector that provides context-aware filtered items.
 * Returns inventory items for most pages, but should be extended
 * to return armory items when on the armory-search page.
 * 
 * Note: This is a placeholder implementation that currently returns
 * inventory items. The actual armory filtering happens in the 
 * ArmorySearch component itself.
 */
export const contextAwareFilteredItemsSelector = createSelector(
  (state: RootState) => state.shell.searchQuery,
  filteredItemsSelector,
  (_state: RootState) => {
    // Get current pathname from the router state
    // This is a simplified approach - in a real implementation we'd
    // need to integrate with the router or use a different approach
    return typeof window !== 'undefined' ? window.location.pathname : '';
  },
  (_searchQuery, inventoryFilteredItems, _pathname) => {
    // const _onArmorySearch = pathname.endsWith('armory-search');
    
    // For now, just return inventory items
    // The armory search count will be handled by the component directly
    return inventoryFilteredItems;
  }
);