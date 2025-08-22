import { settingsSelector } from 'app/d2l-api/selectors';
import SearchResults from 'app/search/SearchResults';
import { filteredItemsSelector, queryValidSelector } from 'app/search/items/item-search-filter';
import { toggleSearchResults } from 'app/shell/actions';
import { querySelector, searchResultsOpenSelector } from 'app/shell/selectors';
import { emptyArray } from 'app/utils/empty';
import { usePageTitle } from 'app/utils/hooks';
import { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import SearchSettings from './SearchSettings';

export default function FilterOptions() {
  usePageTitle('Filter Options');
  const settings = useSelector(settingsSelector);
  const dispatch = useDispatch();

  // Search results state
  const searchQuery = useSelector(querySelector);
  const queryValid = useSelector(queryValidSelector);
  const filteredItems = useSelector(filteredItemsSelector);
  const searchResultsOpen = useSelector(searchResultsOpenSelector);

  const handleCloseSearchResults = useCallback(
    () => dispatch(toggleSearchResults(false)),
    [dispatch],
  );

  return (
    <div className="d2l-page">
      <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
        <h1>Filter Options</h1>
        <SearchSettings settings={settings} />
      </div>

      {/* Search Results overlay for FilterOptions page */}
      {searchResultsOpen && searchQuery && (
        <SearchResults
          items={queryValid ? filteredItems : emptyArray()}
          onClose={handleCloseSearchResults}
        />
      )}
    </div>
  );
}
