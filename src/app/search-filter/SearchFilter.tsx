import { settingsSelector } from 'app/d2l-api/selectors';
import SearchResults from 'app/search/SearchResults';
import { filteredItemsSelector, queryValidSelector } from 'app/search/items/item-search-filter';
import { toggleSearchResults } from 'app/shell/actions';
import { querySelector, searchResultsOpenSelector } from 'app/shell/selectors';
import { useThunkDispatch } from 'app/store/thunk-dispatch';
import { emptyArray } from 'app/utils/empty';
import { usePageTitle } from 'app/utils/hooks';
import { useCallback } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router';
import SearchSettings from '../settings/SearchSettings';

export default function SearchFilter() {
  usePageTitle('Search / Filter');
  const settings = useSelector(settingsSelector);
  const dispatch = useThunkDispatch();
  const navigate = useNavigate();

  // Search results state
  const searchQuery = useSelector(querySelector);
  const queryValid = useSelector(queryValidSelector);
  const filteredItems = useSelector(filteredItemsSelector);
  const searchResultsOpen = useSelector(searchResultsOpenSelector);

  const handleCloseSearchResults = useCallback(
    () => dispatch(toggleSearchResults(false)),
    [dispatch],
  );

  const handleShowSearchHistory = () => {
    navigate('../search-history');
  };

  return (
    <div className="d2l-page">
      <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
        <h1>Search / Filter</h1>

        {/* Search History Button */}
        <div style={{ marginBottom: '24px' }}>
          <button
            type="button"
            className="d2l-button"
            onClick={handleShowSearchHistory}
            style={{
              fontSize: '16px',
              padding: '12px 24px',
              background: 'var(--theme-accent-primary)',
              color: 'var(--theme-text-contrast)',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Search History
          </button>
        </div>

        {/* Filter Settings */}
        <SearchSettings settings={settings} />
      </div>

      {/* Search Results overlay for SearchFilter page */}
      {searchResultsOpen && searchQuery && (
        <SearchResults
          items={queryValid ? filteredItems : emptyArray()}
          onClose={handleCloseSearchResults}
        />
      )}
    </div>
  );
}
