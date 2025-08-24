import { languageSelector } from 'app/d2l-api/selectors';
import { t } from 'app/i18next-t';
import { allItemsSelector } from 'app/inventory/selectors';
import { d2ManifestSelector } from 'app/manifest/selectors';
import { buildArmoryIndex } from 'app/search/armory-search';
import createAutocompleter from 'app/search/autocomplete';
import { filterFactorySelector, searchConfigSelector } from 'app/search/items/item-search-filter';
import searchBarStyles from 'app/search/SearchBar.m.scss';
import { setSearchQuery, toggleSearchResults } from 'app/shell/actions';
import { useThunkDispatch } from 'app/store/thunk-dispatch';
import { Portal } from 'app/utils/temp-container';
import { useCombobox } from 'downshift';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { useSetSetting } from './hooks';
import { Settings } from './initial-settings';
// eslint-disable-next-line css-modules/no-unused-class
import styles from './SettingsPage.m.scss';

// Interface for search term objects
interface SearchTerm {
  term: string;
  logic: 'AND' | 'OR';
  group?: number;
}

// Autocomplete component moved outside to prevent re-creation
const AutocompleteSearchInput = React.memo(
  ({
    value,
    onChange,
    placeholder,
    autocompleter,
  }: {
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
    autocompleter: ReturnType<typeof createAutocompleter>;
  }) => {
    const inputRef = React.useRef<HTMLInputElement>(null);
    const [localValue, setLocalValue] = useState(value);
    const containerRef = React.useRef<HTMLDivElement>(null);

    // Sync with external value changes
    useEffect(() => {
      const timeoutId = setTimeout(() => {
        setLocalValue(value);
      }, 0);
      return () => clearTimeout(timeoutId);
    }, [value]);

    const suggestions = useMemo(() => {
      if (!localValue.trim()) {
        return [];
      }
      try {
        const result = autocompleter(
          localValue, // query
          localValue.length, // caretIndex (cursor at end)
          [], // recentSearches (empty for now)
          false, // includeArmory
        ).slice(0, 7); // Limit to 7 suggestions
        return result;
      } catch (error) {
        console.warn('Autocomplete error:', error);
        return [];
      }
    }, [localValue, autocompleter]);

    const handleInputChange = useCallback(
      (newValue: string) => {
        setLocalValue(newValue);
        onChange(newValue);
      },
      [onChange],
    );

    const { isOpen, getMenuProps, getInputProps, getItemProps, highlightedIndex } = useCombobox({
      inputValue: localValue,
      items: suggestions,
      onInputValueChange: ({ inputValue, type }) => {
        // Only handle the change if it's from user input
        if (type === useCombobox.stateChangeTypes.InputChange && inputValue !== undefined) {
          handleInputChange(inputValue);
        }
      },
      onSelectedItemChange: ({ selectedItem }) => {
        if (selectedItem) {
          const suggestionText =
            (selectedItem.query as { body?: string; fullText: string }).body ||
            (selectedItem.query as { fullText: string }).fullText;

          // Replace the entire input with the suggestion
          setLocalValue(suggestionText);
          onChange(suggestionText);

          // Keep focus on the input
          requestAnimationFrame(() => {
            if (inputRef.current) {
              inputRef.current.focus();
              inputRef.current.setSelectionRange(suggestionText.length, suggestionText.length);
            }
          });
        }
      },
      itemToString: (item) =>
        (item?.query as { body?: string; fullText?: string })?.body ||
        (item?.query as { fullText?: string })?.fullText ||
        '',
      stateReducer: (state, actionAndChanges) => {
        const { type, changes } = actionAndChanges;
        switch (type) {
          case useCombobox.stateChangeTypes.InputKeyDownEnter:
          case useCombobox.stateChangeTypes.ItemClick:
            return {
              ...changes,
              isOpen: false,
            };
          case useCombobox.stateChangeTypes.InputBlur:
            // Keep dropdown open if clicking on an item
            if (state.highlightedIndex !== -1) {
              return {
                ...changes,
                isOpen: state.isOpen,
              };
            }
            return changes;
          default:
            return changes;
        }
      },
    });

    return (
      <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
        <input
          {...getInputProps({
            ref: inputRef,
            type: 'text',
            placeholder,
            onChange: (e) => {
              // Prevent default behavior
              e.persist?.();
            },
          })}
          style={{ width: '100%', boxSizing: 'border-box' }}
        />
        {isOpen && suggestions.length > 0 && (
          <Portal>
            <div
              {...getMenuProps()}
              className={searchBarStyles.menu}
              style={{
                position: 'fixed',
                zIndex: 99999,
                maxHeight: '300px',
                overflowY: 'auto',
                background: 'var(--theme-search-dropdown-bg)',
                border: '1px solid var(--theme-search-dropdown-border)',
                borderRadius: '4px',
                boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
                ...(containerRef.current &&
                  (() => {
                    const rect = containerRef.current.getBoundingClientRect();
                    const spaceBelow = window.innerHeight - rect.bottom;
                    const spaceAbove = rect.top;
                    const menuHeight = Math.min(300, suggestions.length * 40);

                    // Make dropdown wider than input - minimum 300px or 1.5x the input width
                    const dropdownWidth = Math.max(300, rect.width * 1.5);
                    // Center the dropdown if it's wider than the input
                    const leftOffset = Math.max(0, rect.left - (dropdownWidth - rect.width) / 2);
                    // Ensure it doesn't go off the right edge of the screen
                    const adjustedLeft = Math.min(
                      leftOffset,
                      window.innerWidth - dropdownWidth - 10,
                    );

                    if (spaceBelow >= menuHeight || spaceBelow > spaceAbove) {
                      // Show below
                      return {
                        top: `${rect.bottom + 2}px`,
                        left: `${adjustedLeft}px`,
                        width: `${dropdownWidth}px`,
                      };
                    } else {
                      // Show above
                      return {
                        bottom: `${window.innerHeight - rect.top + 2}px`,
                        left: `${adjustedLeft}px`,
                        width: `${dropdownWidth}px`,
                      };
                    }
                  })()),
              }}
            >
              {suggestions.map((item, index) => {
                const itemKey =
                  (item.query as { body?: string; fullText: string }).body ||
                  (item.query as { fullText: string }).fullText;
                return (
                  <div
                    key={`suggestion-${itemKey}`}
                    {...getItemProps({ item, index })}
                    className={searchBarStyles.menuItem}
                    style={{
                      backgroundColor:
                        highlightedIndex === index ? 'var(--theme-accent-primary)' : 'transparent',
                      cursor: 'pointer',
                      padding: '8px 12px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className={searchBarStyles.menuItemIcon}>🔍</span>
                      <span>
                        {(item.query as { body?: string; fullText: string }).body ||
                          (item.query as { fullText: string }).fullText}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </Portal>
        )}
      </div>
    );
  },
);

AutocompleteSearchInput.displayName = 'AutocompleteSearchInput';

export default function SearchSettings({ settings }: { settings: Settings }) {
  const setSetting = useSetSetting();
  const dispatch = useThunkDispatch();
  // No separate state needed - we'll add rows directly to the table

  // State for collapsing sections
  const [weaponCollapsed, setWeaponCollapsed] = React.useState(false);
  const [armorCollapsed, setArmorCollapsed] = React.useState(false);

  // Search configuration and autocomplete
  const searchConfig = useSelector(searchConfigSelector);
  const filterFactory = useSelector(filterFactorySelector);
  const allItems = useSelector(allItemsSelector);
  const language = useSelector(languageSelector);
  const d2Manifest = useSelector(d2ManifestSelector);

  const armoryIndex = useMemo(() => buildArmoryIndex(d2Manifest, language), [d2Manifest, language]);

  const autocompleter = useMemo(
    () => createAutocompleter(searchConfig, armoryIndex),
    [searchConfig, armoryIndex],
  );

  // Get weapon/armor counts for search terms
  const getWeaponCount = useCallback(
    (searchTerm: string) => {
      if (!searchTerm.trim()) {
        return 0;
      }
      try {
        const searchFilter = filterFactory(searchTerm);
        return allItems.filter((item) => item.bucket?.sort === 'Weapons' && searchFilter(item))
          .length;
      } catch {
        return 0;
      }
    },
    [filterFactory, allItems],
  );

  const getArmorCount = useCallback(
    (searchTerm: string) => {
      if (!searchTerm.trim()) {
        return 0;
      }
      try {
        const searchFilter = filterFactory(searchTerm);
        return allItems.filter((item) => item.bucket.inArmor && searchFilter(item)).length;
      } catch {
        return 0;
      }
    },
    [filterFactory, allItems],
  );

  // No edit state needed - everything is inline editable

  const weaponSettings = (settings.searchFilterSettings?.keepWeapon || {}) as NonNullable<
    Settings['searchFilterSettings']
  >['keepWeapon'];
  const armorSettings = (settings.searchFilterSettings?.keepArmor || {}) as NonNullable<
    Settings['searchFilterSettings']
  >['keepArmor'];

  const handleWeaponSettingChange = useCallback(
    (key: keyof NonNullable<Settings['searchFilterSettings']>['keepWeapon'], value: unknown) => {
      setSetting('searchFilterSettings', {
        ...settings.searchFilterSettings,
        keepWeapon: {
          ...settings.searchFilterSettings?.keepWeapon,
          [key]: value,
        },
      });
    },
    [setSetting, settings.searchFilterSettings],
  );

  const handleArmorSettingChange = useCallback(
    (key: keyof NonNullable<Settings['searchFilterSettings']>['keepArmor'], value: unknown) => {
      setSetting('searchFilterSettings', {
        ...settings.searchFilterSettings,
        keepArmor: {
          ...settings.searchFilterSettings?.keepArmor,
          [key]: value,
        },
      });
    },
    [setSetting, settings.searchFilterSettings],
  );

  const removeWeaponSearchTerm = useCallback(
    (index: number) => {
      const currentTerms = (weaponSettings.additionalSearchTerms as SearchTerm[]) || [];
      handleWeaponSettingChange(
        'additionalSearchTerms',
        currentTerms.filter((_, i) => i !== index),
      );
    },
    [weaponSettings.additionalSearchTerms, handleWeaponSettingChange],
  );

  const updateWeaponSearchTerm = useCallback(
    (index: number, field: 'term' | 'logic' | 'group', value: string | number) => {
      const currentTerms = (weaponSettings.additionalSearchTerms as SearchTerm[]) || [];
      const updatedTerms = currentTerms.map((termObj, i) =>
        i === index ? { ...termObj, [field]: value } : termObj,
      );
      handleWeaponSettingChange('additionalSearchTerms', updatedTerms);
    },
    [weaponSettings.additionalSearchTerms, handleWeaponSettingChange],
  );

  const addNewWeaponTerm = useCallback(() => {
    const currentTerms = (weaponSettings.additionalSearchTerms as SearchTerm[]) || [];
    const newTerm: SearchTerm = { term: '', logic: 'AND' as const, group: 0 };
    handleWeaponSettingChange('additionalSearchTerms', [...currentTerms, newTerm]);
  }, [weaponSettings.additionalSearchTerms, handleWeaponSettingChange]);

  const updateArmorSearchTerm = useCallback(
    (index: number, field: 'term' | 'logic' | 'group', value: string | number) => {
      const currentTerms = (armorSettings.additionalSearchTerms as SearchTerm[]) || [];
      const updatedTerms = currentTerms.map((termObj, i) =>
        i === index ? { ...termObj, [field]: value } : termObj,
      );
      handleArmorSettingChange('additionalSearchTerms', updatedTerms);
    },
    [armorSettings.additionalSearchTerms, handleArmorSettingChange],
  );

  const removeArmorSearchTerm = useCallback(
    (index: number) => {
      const currentTerms = (armorSettings.additionalSearchTerms as SearchTerm[]) || [];
      handleArmorSettingChange(
        'additionalSearchTerms',
        currentTerms.filter((_, i) => i !== index),
      );
    },
    [armorSettings.additionalSearchTerms, handleArmorSettingChange],
  );

  const addNewArmorTerm = useCallback(() => {
    const currentTerms = (armorSettings.additionalSearchTerms as SearchTerm[]) || [];
    const newTerm: SearchTerm = { term: '', logic: 'AND' as const, group: 0 };
    handleArmorSettingChange('additionalSearchTerms', [...currentTerms, newTerm]);
  }, [armorSettings.additionalSearchTerms, handleArmorSettingChange]);

  const showSearchResults = useCallback(
    (searchTerm: string, itemType: 'weapon' | 'armor') => {
      if (searchTerm.trim()) {
        // Combine the search term with the appropriate item type filter using explicit 'and'
        const typeFilter = itemType === 'weapon' ? 'is:weapon' : 'is:armor';
        const combinedQuery = `${typeFilter} and ${searchTerm}`;

        // Set the search query in the main search bar
        dispatch(setSearchQuery(combinedQuery));
        // Open the search results
        dispatch(toggleSearchResults(true));
      }
    },
    [dispatch],
  );

  return (
    <section id="filter-options">
      <h2>Filter Options</h2>

      <div className={styles.section as string}>
        <button
          type="button"
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            userSelect: 'none',
            fontSize: 'inherit',
            fontWeight: 'bold',
            textAlign: 'left',
            width: '100%',
          }}
          onClick={() => setWeaponCollapsed(!weaponCollapsed)}
        >
          {weaponCollapsed ? '▶' : '▼'} {t('Settings.KeepWeaponSettings')}
        </button>

        {!weaponCollapsed && (
          <>
            <div className={styles.setting}>
              <div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '8px',
                  }}
                >
                  <strong>{t('Settings.CurrentSearchTerms')}:</strong>
                  <button
                    type="button"
                    onClick={addNewWeaponTerm}
                    style={{
                      background: '#4CAF50',
                      border: 'none',
                      color: 'white',
                      borderRadius: '50%',
                      width: '24px',
                      height: '24px',
                      fontSize: '16px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    title="Add new search term"
                  >
                    +
                  </button>
                </div>
                <div style={{ overflowX: 'auto', overflowY: 'visible', position: 'relative' }}>
                  <table style={{ width: '100%', fontSize: '14px', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #444' }}>
                        <th style={{ textAlign: 'left', padding: '8px 4px' }}>Term</th>
                        <th style={{ textAlign: 'center', padding: '8px 4px', minWidth: '60px' }}>
                          Group
                        </th>
                        <th style={{ textAlign: 'center', padding: '8px 4px', minWidth: '70px' }}>
                          Logic
                        </th>
                        <th style={{ textAlign: 'center', padding: '8px 4px', minWidth: '60px' }}>
                          Results
                        </th>
                        <th style={{ textAlign: 'center', padding: '8px 4px', minWidth: '30px' }} />
                      </tr>
                    </thead>
                    <tbody>
                      {((weaponSettings.additionalSearchTerms as SearchTerm[]) || []).map(
                        (termObj, index) => (
                          <tr
                            // eslint-disable-next-line @eslint-react/no-array-index-key
                            key={`weapon-row-${index}`}
                            style={{ borderBottom: '1px solid #333' }}
                          >
                            <td style={{ padding: '8px 4px' }}>
                              <AutocompleteSearchInput
                                value={termObj.term}
                                onChange={(value) => updateWeaponSearchTerm(index, 'term', value)}
                                placeholder="Enter search term"
                                autocompleter={autocompleter}
                              />
                            </td>
                            <td style={{ padding: '8px 4px', textAlign: 'center' }}>
                              <input
                                type="number"
                                min="1"
                                max="4"
                                value={(termObj.group ?? 0) + 1}
                                onChange={(e) =>
                                  updateWeaponSearchTerm(
                                    index,
                                    'group',
                                    parseInt(e.target.value, 10) - 1,
                                  )
                                }
                                style={{
                                  width: '40px',
                                  textAlign: 'center',
                                  backgroundColor: '#333',
                                  color: '#fff',
                                  border: '1px solid #555',
                                  borderRadius: '4px',
                                  padding: '2px',
                                }}
                              />
                            </td>
                            <td style={{ padding: '8px 4px', textAlign: 'center' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label
                                  style={{
                                    fontSize: '11px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                  }}
                                >
                                  <input
                                    type="radio"
                                    name={`weaponLogic${index}`}
                                    value="AND"
                                    checked={termObj.logic === 'AND'}
                                    onChange={() => updateWeaponSearchTerm(index, 'logic', 'AND')}
                                    style={{ margin: 0 }}
                                  />
                                  AND
                                </label>
                                <label
                                  style={{
                                    fontSize: '11px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                  }}
                                >
                                  <input
                                    type="radio"
                                    name={`weaponLogic${index}`}
                                    value="OR"
                                    checked={termObj.logic === 'OR'}
                                    onChange={() => updateWeaponSearchTerm(index, 'logic', 'OR')}
                                    style={{ margin: 0 }}
                                  />
                                  OR
                                </label>
                              </div>
                            </td>
                            <td style={{ padding: '8px 4px', textAlign: 'center' }}>
                              {termObj.term && (
                                <button
                                  type="button"
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    color: '#4CAF50',
                                    cursor: 'pointer',
                                    fontSize: '12px',
                                    textDecoration: 'underline',
                                  }}
                                  onClick={() => showSearchResults(termObj.term, 'weapon')}
                                  title="Click to see matching weapons"
                                >
                                  {getWeaponCount(termObj.term)}
                                </button>
                              )}
                            </td>
                            <td style={{ padding: '8px 4px', textAlign: 'center' }}>
                              <button
                                type="button"
                                onClick={() => removeWeaponSearchTerm(index)}
                                style={{
                                  background: '#f44336',
                                  border: 'none',
                                  color: 'white',
                                  borderRadius: '50%',
                                  width: '20px',
                                  height: '20px',
                                  fontSize: '12px',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                                title="Remove search term"
                              >
                                −
                              </button>
                            </td>
                          </tr>
                        ),
                      )}
                      {((weaponSettings.additionalSearchTerms as SearchTerm[]) || []).length ===
                        0 && (
                        <tr>
                          <td
                            colSpan={5}
                            style={{ padding: '16px', textAlign: 'center', color: '#888' }}
                          >
                            No search terms added. Click the + button to add one.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      <div className={styles.section as string}>
        <button
          type="button"
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            userSelect: 'none',
            fontSize: 'inherit',
            fontWeight: 'bold',
            textAlign: 'left',
            width: '100%',
          }}
          onClick={() => setArmorCollapsed(!armorCollapsed)}
        >
          {armorCollapsed ? '▶' : '▼'} {t('Settings.KeepArmorSettings')}
        </button>

        {!armorCollapsed && (
          <>
            <div className={styles.setting}>
              <div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '2px',
                  }}
                >
                  <strong>{t('Settings.CurrentSearchTerms')}:</strong>
                  <button
                    type="button"
                    onClick={addNewArmorTerm}
                    style={{
                      background: '#4CAF50',
                      border: 'none',
                      color: 'white',
                      borderRadius: '50%',
                      width: '24px',
                      height: '24px',
                      fontSize: '16px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    title="Add new search term"
                  >
                    +
                  </button>
                </div>
                <div style={{ overflowX: 'auto', overflowY: 'visible', position: 'relative' }}>
                  <table style={{ width: '100%', fontSize: '14px', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #444' }}>
                        <th style={{ textAlign: 'left', padding: '8px 4px' }}>Term</th>
                        <th style={{ textAlign: 'center', padding: '8px 4px', minWidth: '60px' }}>
                          Group
                        </th>
                        <th style={{ textAlign: 'center', padding: '8px 4px', minWidth: '70px' }}>
                          Logic
                        </th>
                        <th style={{ textAlign: 'center', padding: '8px 4px', minWidth: '60px' }}>
                          Results
                        </th>
                        <th style={{ textAlign: 'center', padding: '8px 4px', minWidth: '30px' }} />
                      </tr>
                    </thead>
                    <tbody>
                      {((armorSettings.additionalSearchTerms as SearchTerm[]) || []).map(
                        (termObj, index) => (
                          <tr
                            // eslint-disable-next-line @eslint-react/no-array-index-key
                            key={`armor-row-${index}`}
                            style={{ borderBottom: '1px solid #333' }}
                          >
                            <td style={{ padding: '8px 4px' }}>
                              <AutocompleteSearchInput
                                value={termObj.term}
                                onChange={(value) => updateArmorSearchTerm(index, 'term', value)}
                                placeholder="Enter search term"
                                autocompleter={autocompleter}
                              />
                            </td>
                            <td style={{ padding: '8px 4px', textAlign: 'center' }}>
                              <input
                                type="number"
                                min="1"
                                max="4"
                                value={(termObj.group ?? 0) + 1}
                                onChange={(e) =>
                                  updateArmorSearchTerm(
                                    index,
                                    'group',
                                    parseInt(e.target.value, 10) - 1,
                                  )
                                }
                                style={{
                                  width: '40px',
                                  textAlign: 'center',
                                  backgroundColor: '#333',
                                  color: '#fff',
                                  border: '1px solid #555',
                                  borderRadius: '4px',
                                  padding: '2px',
                                }}
                              />
                            </td>
                            <td style={{ padding: '8px 4px', textAlign: 'center' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label
                                  style={{
                                    fontSize: '11px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                  }}
                                >
                                  <input
                                    type="radio"
                                    name={`armorLogic${index}`}
                                    value="AND"
                                    checked={termObj.logic === 'AND'}
                                    onChange={() => updateArmorSearchTerm(index, 'logic', 'AND')}
                                    style={{ margin: 0 }}
                                  />
                                  AND
                                </label>
                                <label
                                  style={{
                                    fontSize: '11px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                  }}
                                >
                                  <input
                                    type="radio"
                                    name={`armorLogic${index}`}
                                    value="OR"
                                    checked={termObj.logic === 'OR'}
                                    onChange={() => updateArmorSearchTerm(index, 'logic', 'OR')}
                                    style={{ margin: 0 }}
                                  />
                                  OR
                                </label>
                              </div>
                            </td>
                            <td style={{ padding: '8px 4px', textAlign: 'center' }}>
                              {termObj.term && (
                                <button
                                  type="button"
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    color: '#4CAF50',
                                    cursor: 'pointer',
                                    fontSize: '12px',
                                    textDecoration: 'underline',
                                  }}
                                  onClick={() => showSearchResults(termObj.term, 'armor')}
                                  title="Click to see matching armor"
                                >
                                  {getArmorCount(termObj.term)}
                                </button>
                              )}
                            </td>
                            <td style={{ padding: '8px 4px', textAlign: 'center' }}>
                              <button
                                type="button"
                                onClick={() => removeArmorSearchTerm(index)}
                                style={{
                                  background: '#f44336',
                                  border: 'none',
                                  color: 'white',
                                  borderRadius: '50%',
                                  width: '20px',
                                  height: '20px',
                                  fontSize: '12px',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                                title="Remove search term"
                              >
                                −
                              </button>
                            </td>
                          </tr>
                        ),
                      )}
                      {((armorSettings.additionalSearchTerms as SearchTerm[]) || []).length ===
                        0 && (
                        <tr>
                          <td
                            colSpan={5}
                            style={{ padding: '16px', textAlign: 'center', color: '#888' }}
                          >
                            No search terms added. Click the + button to add one.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
