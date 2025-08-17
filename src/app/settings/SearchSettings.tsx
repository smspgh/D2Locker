import React, { useState, useMemo, useCallback } from 'react';
import { t } from 'app/i18next-t';
import { Settings } from './initial-settings';
import { useSetSetting } from './hooks';
import Checkbox from './Checkbox';
import Select from './Select';
import styles from './SettingsPage.m.scss';
import { AppIcon, deleteIcon, plusIcon, editIcon } from 'app/shell/icons';
import { useSelector } from 'react-redux';
import { searchConfigSelector, filterFactorySelector } from 'app/search/items/item-search-filter';
import { allItemsSelector } from 'app/inventory/selectors';
import createAutocompleter from 'app/search/autocomplete';
import { useCombobox } from 'downshift';
import { parseQuery } from 'app/search/query-parser';
import { languageSelector } from 'app/d2l-api/selectors';
import { d2ManifestSelector } from 'app/manifest/selectors';
import { buildArmoryIndex } from 'app/search/armory-search';

// Autocomplete component moved outside to prevent re-creation
const AutocompleteSearchInput = React.memo(({ 
  value, 
  onChange, 
  onSelect, 
  placeholder, 
  resultCount,
  autocompleter 
}: {
  value: string;
  onChange: (value: string) => void;
  onSelect: (value: string) => void;
  placeholder: string;
  resultCount: number;
  autocompleter: any;
}) => {
  const suggestions = useMemo(() => {
    if (!value.trim()) return [];
    try {
      const result = autocompleter(
        value,           // query
        value.length,    // caretIndex (cursor at end)
        [],              // recentSearches (empty for now)
        false            // includeArmory
      ).slice(0, 5); // Limit to 5 suggestions
      return result;
    } catch (error) {
      console.warn('Autocomplete error:', error);
      return [];
    }
  }, [value, autocompleter]);

  const {
    isOpen,
    getMenuProps,
    getInputProps,
    getItemProps,
    highlightedIndex,
  } = useCombobox({
    inputValue: value,
    items: suggestions,
    onInputValueChange: ({ inputValue }) => onChange(inputValue || ''),
    onSelectedItemChange: ({ selectedItem }) => {
      if (selectedItem) {
        onSelect(selectedItem.query.body || selectedItem.query.fullText);
      }
    },
    itemToString: (item) => item?.query.body || item?.query.fullText || '',
  });

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <input
          {...getInputProps({
            type: 'text',
            placeholder,
            onKeyDown: (e: React.KeyboardEvent) => {
              if (e.key === 'Enter' && !isOpen) {
                onSelect(value);
              }
            },
          })}
          style={{ flex: 1 }}
        />
        {value.trim() && (
          <span style={{ fontSize: '0.9em', color: '#888' }}>
            ({resultCount} results)
          </span>
        )}
      </div>
      <div {...getMenuProps()}>
        {isOpen && suggestions.length > 0 && (
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              backgroundColor: 'var(--theme-surface-2)',
              border: '1px solid var(--theme-accent-border)',
              borderRadius: '4px',
              zIndex: 1000,
              maxHeight: '200px',
              overflowY: 'auto',
            }}
          >
            {suggestions.map((item, index) => (
              <div
                {...getItemProps({ item, index })}
                key={index}
                style={{
                  padding: '8px 12px',
                  cursor: 'pointer',
                  backgroundColor: highlightedIndex === index ? 'var(--theme-accent-primary)' : 'transparent',
                  color: highlightedIndex === index ? 'var(--theme-text-primary)' : 'inherit',
                }}
              >
                {item.query.body || item.query.fullText}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

export default function SearchSettings({ settings }: { settings: Settings }) {
  const setSetting = useSetSetting();
  const [newWeaponSearchTerm, setNewWeaponSearchTerm] = useState('');
  const [newWeaponSearchLogic, setNewWeaponSearchLogic] = useState<'AND' | 'OR'>('AND');
  const [newArmorSearchTerm, setNewArmorSearchTerm] = useState('');
  const [newArmorSearchLogic, setNewArmorSearchLogic] = useState<'AND' | 'OR'>('AND');
  
  // Search configuration and autocomplete
  const searchConfig = useSelector(searchConfigSelector);
  const filterFactory = useSelector(filterFactorySelector);
  const allItems = useSelector(allItemsSelector);
  const language = useSelector(languageSelector);
  const d2Manifest = useSelector(d2ManifestSelector);
  
  const armoryIndex = useMemo(() => buildArmoryIndex(d2Manifest, language), [d2Manifest, language]);
  
  const autocompleter = useMemo(() => {
    return createAutocompleter(searchConfig, armoryIndex);
  }, [searchConfig, armoryIndex]);
  
  // Get weapon/armor counts for search terms
  const getWeaponCount = useCallback((searchTerm: string) => {
    if (!searchTerm.trim()) return 0;
    try {
      const searchFilter = filterFactory(searchTerm);
      return allItems.filter(item => item.bucket?.sort === 'Weapons' && searchFilter(item)).length;
    } catch {
      return 0;
    }
  }, [filterFactory, allItems]);
  
  const getArmorCount = useCallback((searchTerm: string) => {
    if (!searchTerm.trim()) return 0;
    try {
      const searchFilter = filterFactory(searchTerm);
      return allItems.filter(item => item.bucket.inArmor && searchFilter(item)).length;
    } catch {
      return 0;
    }
  }, [filterFactory, allItems]);
  
  // Edit state for weapon terms
  const [editingWeaponIndex, setEditingWeaponIndex] = useState<number | null>(null);
  const [editWeaponTerm, setEditWeaponTerm] = useState('');
  const [editWeaponLogic, setEditWeaponLogic] = useState<'AND' | 'OR'>('AND');
  
  // Edit state for armor terms  
  const [editingArmorIndex, setEditingArmorIndex] = useState<number | null>(null);
  const [editArmorTerm, setEditArmorTerm] = useState('');
  const [editArmorLogic, setEditArmorLogic] = useState<'AND' | 'OR'>('AND');

  const handleWeaponSettingChange = (key: keyof NonNullable<Settings['searchFilterSettings']>['keepWeapon'], value: any) => {
    setSetting('searchFilterSettings', {
      ...settings.searchFilterSettings,
      keepWeapon: {
        ...settings.searchFilterSettings?.keepWeapon,
        [key]: value,
      },
    });
  };

  const handleArmorSettingChange = (key: keyof NonNullable<Settings['searchFilterSettings']>['keepArmor'], value: any) => {
    setSetting('searchFilterSettings', {
      ...settings.searchFilterSettings,
      keepArmor: {
        ...settings.searchFilterSettings?.keepArmor,
        [key]: value,
      },
    });
  };

  const addWeaponSearchTerm = () => {
    if (newWeaponSearchTerm.trim()) {
      const currentTerms = weaponSettings.additionalSearchTerms || [];
      const newTerm = { term: newWeaponSearchTerm.trim(), logic: newWeaponSearchLogic };
      handleWeaponSettingChange('additionalSearchTerms', [
        ...currentTerms, 
        newTerm
      ]);
      setNewWeaponSearchTerm('');
      setNewWeaponSearchLogic('AND'); // Reset to default
    }
  };

  const removeWeaponSearchTerm = (index: number) => {
    const currentTerms = weaponSettings.additionalSearchTerms || [];
    handleWeaponSettingChange('additionalSearchTerms', currentTerms.filter((_, i) => i !== index));
  };

  const updateWeaponSearchTermLogic = (index: number, logic: 'AND' | 'OR') => {
    const currentTerms = weaponSettings.additionalSearchTerms || [];
    const updatedTerms = currentTerms.map((termObj, i) => 
      i === index ? { ...termObj, logic } : termObj
    );
    handleWeaponSettingChange('additionalSearchTerms', updatedTerms);
  };

  const startEditingWeaponTerm = (index: number) => {
    const currentTerms = weaponSettings.additionalSearchTerms || [];
    const termToEdit = currentTerms[index];
    if (termToEdit) {
      setEditingWeaponIndex(index);
      setEditWeaponTerm(termToEdit.term);
      setEditWeaponLogic(termToEdit.logic);
    }
  };

  const saveWeaponTermEdit = () => {
    if (editingWeaponIndex !== null && editWeaponTerm.trim()) {
      const currentTerms = weaponSettings.additionalSearchTerms || [];
      const updatedTerms = currentTerms.map((termObj, i) => 
        i === editingWeaponIndex ? { term: editWeaponTerm.trim(), logic: editWeaponLogic } : termObj
      );
      handleWeaponSettingChange('additionalSearchTerms', updatedTerms);
      setEditingWeaponIndex(null);
      setEditWeaponTerm('');
      setEditWeaponLogic('AND');
    }
  };

  const cancelWeaponTermEdit = () => {
    setEditingWeaponIndex(null);
    setEditWeaponTerm('');
    setEditWeaponLogic('AND');
  };

  const addArmorSearchTerm = () => {
    if (newArmorSearchTerm.trim()) {
      const currentTerms = armorSettings.additionalSearchTerms || [];
      handleArmorSettingChange('additionalSearchTerms', [
        ...currentTerms, 
        { term: newArmorSearchTerm.trim(), logic: newArmorSearchLogic }
      ]);
      setNewArmorSearchTerm('');
      setNewArmorSearchLogic('AND'); // Reset to default
    }
  };

  const removeArmorSearchTerm = (index: number) => {
    const currentTerms = armorSettings.additionalSearchTerms || [];
    handleArmorSettingChange('additionalSearchTerms', currentTerms.filter((_, i) => i !== index));
  };

  const updateArmorSearchTermLogic = (index: number, logic: 'AND' | 'OR') => {
    const currentTerms = armorSettings.additionalSearchTerms || [];
    const updatedTerms = currentTerms.map((termObj, i) => 
      i === index ? { ...termObj, logic } : termObj
    );
    handleArmorSettingChange('additionalSearchTerms', updatedTerms);
  };

  const startEditingArmorTerm = (index: number) => {
    const currentTerms = armorSettings.additionalSearchTerms || [];
    const termToEdit = currentTerms[index];
    if (termToEdit) {
      setEditingArmorIndex(index);
      setEditArmorTerm(termToEdit.term);
      setEditArmorLogic(termToEdit.logic);
    }
  };

  const saveArmorTermEdit = () => {
    if (editingArmorIndex !== null && editArmorTerm.trim()) {
      const currentTerms = armorSettings.additionalSearchTerms || [];
      const updatedTerms = currentTerms.map((termObj, i) => 
        i === editingArmorIndex ? { term: editArmorTerm.trim(), logic: editArmorLogic } : termObj
      );
      handleArmorSettingChange('additionalSearchTerms', updatedTerms);
      setEditingArmorIndex(null);
      setEditArmorTerm('');
      setEditArmorLogic('AND');
    }
  };

  const cancelArmorTermEdit = () => {
    setEditingArmorIndex(null);
    setEditArmorTerm('');
    setEditArmorLogic('AND');
  };


  const logicOptions = [
    { value: 'AND', name: 'AND' },
    { value: 'OR', name: 'OR' },
  ];

  const weaponSettings = settings.searchFilterSettings?.keepWeapon || {};
  const armorSettings = settings.searchFilterSettings?.keepArmor || {};

  return (
    <section id="search-settings">
      <h2>{t('Settings.SearchSettings')}</h2>
      
      <div className={styles.section}>
        <h3>{t('Settings.KeepWeaponSettings')}</h3>
        
        <div className={styles.setting}>
          <Checkbox
            label={t('Settings.EnableKeepWeapon')}
            name="enableKeepWeapon"
            value={weaponSettings.enabled ?? true}
            onChange={(checked) => handleWeaponSettingChange('enabled', checked)}
          />
        </div>

        {weaponSettings.enabled && (
          <>

            <div className={styles.setting}>
              <label>{t('Settings.AdditionalSearchTerms')}</label>
              <div className={styles.fineprint}>{t('Settings.AdditionalSearchDesc')}</div>
              
              {(weaponSettings.additionalSearchTerms || []).length > 0 && (
                <div>
                  <strong>{t('Settings.CurrentSearchTerms')}:</strong>
                  {(weaponSettings.additionalSearchTerms || []).map((termObj, index) => (
                    <div key={index} className={styles.horizontal}>
                      {editingWeaponIndex === index ? (
                        <>
                          <AutocompleteSearchInput
                            value={editWeaponTerm}
                            onChange={setEditWeaponTerm}
                            onSelect={(value) => {
                              setEditWeaponTerm(value);
                              setTimeout(saveWeaponTermEdit, 100);
                            }}
                            placeholder="Edit search term"
                            resultCount={getWeaponCount(editWeaponTerm)}
                            autocompleter={autocompleter}
                          />
                          <Select
                            value={editWeaponLogic}
                            name={`editWeaponTerm${index}` as keyof Settings}
                            options={logicOptions}
                            onChange={(e) => setEditWeaponLogic(e.target.value as 'AND' | 'OR')}
                          />
                          <button
                            type="button"
                            className="d2l-button"
                            onClick={saveWeaponTermEdit}
                            title="Save"
                          >
                            ✓
                          </button>
                          <button
                            type="button"
                            className="d2l-button"
                            onClick={cancelWeaponTermEdit}
                            title="Cancel"
                          >
                            ✕
                          </button>
                        </>
                      ) : (
                        <>
                          <span>{termObj.term}</span>
                          <span style={{ fontSize: '0.9em', color: '#888', marginLeft: '8px' }}>
                            ({getWeaponCount(termObj.term)} results)
                          </span>
                          <Select
                            value={termObj.logic}
                            name={`weaponTerm${index}` as keyof Settings}
                            options={logicOptions}
                            onChange={(e) => updateWeaponSearchTermLogic(index, e.target.value as 'AND' | 'OR')}
                          />
                          <button
                            type="button"
                            className="d2l-button"
                            onClick={() => startEditingWeaponTerm(index)}
                            title="Edit"
                          >
                            <AppIcon icon={editIcon} />
                          </button>
                          <button
                            type="button"
                            className="d2l-button"
                            onClick={() => removeWeaponSearchTerm(index)}
                            title={t('Settings.RemoveSearchTerm')}
                          >
                            <AppIcon icon={deleteIcon} />
                          </button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
              
              <div>
                <strong>{t('Settings.AddNewSearchTerm')}:</strong>
                <div className={styles.horizontal}>
                  <AutocompleteSearchInput
                    value={newWeaponSearchTerm}
                    onChange={setNewWeaponSearchTerm}
                    onSelect={(value) => {
                      setNewWeaponSearchTerm(value);
                      // Auto-add if it's a valid search term
                      if (value.trim()) {
                        setTimeout(addWeaponSearchTerm, 100);
                      }
                    }}
                    placeholder={t('Settings.AdditionalSearchPlaceholder')}
                    resultCount={getWeaponCount(newWeaponSearchTerm)}
                    autocompleter={autocompleter}
                  />
                  <Select
                    label={t('Settings.SearchLogic')}
                    name={'weaponLogic' as keyof Settings}
                    value={newWeaponSearchLogic}
                    options={logicOptions}
                    onChange={(e) => setNewWeaponSearchLogic(e.target.value as 'AND' | 'OR')}
                  />
                  <button
                    type="button"
                    className="d2l-button"
                    onClick={addWeaponSearchTerm}
                  >
                    <AppIcon icon={plusIcon} /> {t('Settings.Add')}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      <div className={styles.section}>
        <h3>{t('Settings.KeepArmorSettings')}</h3>
        
        <div className={styles.setting}>
          <Checkbox
            label={t('Settings.EnableKeepArmor')}
            name="enableKeepArmor"
            value={armorSettings.enabled ?? true}
            onChange={(checked) => handleArmorSettingChange('enabled', checked)}
          />
        </div>

        {armorSettings.enabled && (
          <>

            <div className={styles.setting}>
              <label>{t('Settings.AdditionalSearchTerms')}</label>
              <div className={styles.fineprint}>{t('Settings.AdditionalSearchDesc')}</div>
              
              {(armorSettings.additionalSearchTerms || []).length > 0 && (
                <div>
                  <strong>{t('Settings.CurrentSearchTerms')}:</strong>
                  {(armorSettings.additionalSearchTerms || []).map((termObj, index) => (
                    <div key={index} className={styles.horizontal}>
                      {editingArmorIndex === index ? (
                        <>
                          <AutocompleteSearchInput
                            value={editArmorTerm}
                            onChange={setEditArmorTerm}
                            onSelect={(value) => {
                              setEditArmorTerm(value);
                              setTimeout(saveArmorTermEdit, 100);
                            }}
                            placeholder="Edit search term"
                            resultCount={getArmorCount(editArmorTerm)}
                            autocompleter={autocompleter}
                          />
                          <Select
                            value={editArmorLogic}
                            name={`editArmorTerm${index}` as keyof Settings}
                            options={logicOptions}
                            onChange={(e) => setEditArmorLogic(e.target.value as 'AND' | 'OR')}
                          />
                          <button
                            type="button"
                            className="d2l-button"
                            onClick={saveArmorTermEdit}
                            title="Save"
                          >
                            ✓
                          </button>
                          <button
                            type="button"
                            className="d2l-button"
                            onClick={cancelArmorTermEdit}
                            title="Cancel"
                          >
                            ✕
                          </button>
                        </>
                      ) : (
                        <>
                          <span>{termObj.term}</span>
                          <span style={{ fontSize: '0.9em', color: '#888', marginLeft: '8px' }}>
                            ({getArmorCount(termObj.term)} results)
                          </span>
                          <Select
                            value={termObj.logic}
                            name={`armorTerm${index}` as keyof Settings}
                            options={logicOptions}
                            onChange={(e) => updateArmorSearchTermLogic(index, e.target.value as 'AND' | 'OR')}
                          />
                          <button
                            type="button"
                            className="d2l-button"
                            onClick={() => startEditingArmorTerm(index)}
                            title="Edit"
                          >
                            <AppIcon icon={editIcon} />
                          </button>
                          <button
                            type="button"
                            className="d2l-button"
                            onClick={() => removeArmorSearchTerm(index)}
                            title={t('Settings.RemoveSearchTerm')}
                          >
                            <AppIcon icon={deleteIcon} />
                          </button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
              
              <div>
                <strong>{t('Settings.AddNewSearchTerm')}:</strong>
                <div className={styles.horizontal}>
                  <AutocompleteSearchInput
                    value={newArmorSearchTerm}
                    onChange={setNewArmorSearchTerm}
                    onSelect={(value) => {
                      setNewArmorSearchTerm(value);
                      // Auto-add if it's a valid search term
                      if (value.trim()) {
                        setTimeout(addArmorSearchTerm, 100);
                      }
                    }}
                    placeholder={t('Settings.AdditionalSearchPlaceholder')}
                    resultCount={getArmorCount(newArmorSearchTerm)}
                    autocompleter={autocompleter}
                  />
                  <Select
                    label={t('Settings.SearchLogic')}
                    name={'armorLogic' as keyof Settings}
                    value={newArmorSearchLogic}
                    options={logicOptions}
                    onChange={(e) => setNewArmorSearchLogic(e.target.value as 'AND' | 'OR')}
                  />
                  <button
                    type="button"
                    className="d2l-button"
                    onClick={addArmorSearchTerm}
                  >
                    <AppIcon icon={plusIcon} /> {t('Settings.Add')}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}