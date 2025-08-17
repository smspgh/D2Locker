import React, { useState } from 'react';
import { t } from 'app/i18next-t';
import { Settings } from './initial-settings';
import { useSetSetting } from './hooks';
import Checkbox from './Checkbox';
import Select from './Select';
import styles from './SettingsPage.m.scss';
import { AppIcon, deleteIcon, plusIcon } from 'app/shell/icons';

export default function SearchSettings({ settings }: { settings: Settings }) {
  const setSetting = useSetSetting();
  const [newWeaponSearchTerm, setNewWeaponSearchTerm] = useState('');
  const [newWeaponSearchLogic, setNewWeaponSearchLogic] = useState<'AND' | 'OR'>('AND');
  const [newArmorSearchTerm, setNewArmorSearchTerm] = useState('');
  const [newArmorSearchLogic, setNewArmorSearchLogic] = useState<'AND' | 'OR'>('AND');

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
                      <span>{termObj.term}</span>
                      <Select
                        value={termObj.logic}
                        name={`weaponTerm${index}` as keyof Settings}
                        options={logicOptions}
                        onChange={(e) => updateWeaponSearchTermLogic(index, e.target.value as 'AND' | 'OR')}
                      />
                      <button
                        type="button"
                        className="d2l-button"
                        onClick={() => removeWeaponSearchTerm(index)}
                        title={t('Settings.RemoveSearchTerm')}
                      >
                        <AppIcon icon={deleteIcon} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              
              <div>
                <strong>{t('Settings.AddNewSearchTerm')}:</strong>
                <div className={styles.horizontal}>
                  <input
                    type="text"
                    value={newWeaponSearchTerm}
                    onChange={(e) => setNewWeaponSearchTerm(e.target.value)}
                    placeholder={t('Settings.AdditionalSearchPlaceholder')}
                    onKeyPress={(e) => e.key === 'Enter' && addWeaponSearchTerm()}
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
                      <span>{termObj.term}</span>
                      <Select
                        value={termObj.logic}
                        name={`armorTerm${index}` as keyof Settings}
                        options={logicOptions}
                        onChange={(e) => updateArmorSearchTermLogic(index, e.target.value as 'AND' | 'OR')}
                      />
                      <button
                        type="button"
                        className="d2l-button"
                        onClick={() => removeArmorSearchTerm(index)}
                        title={t('Settings.RemoveSearchTerm')}
                      >
                        <AppIcon icon={deleteIcon} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              
              <div>
                <strong>{t('Settings.AddNewSearchTerm')}:</strong>
                <div className={styles.horizontal}>
                  <input
                    type="text"
                    value={newArmorSearchTerm}
                    onChange={(e) => setNewArmorSearchTerm(e.target.value)}
                    placeholder={t('Settings.AdditionalSearchPlaceholder')}
                    onKeyPress={(e) => e.key === 'Enter' && addArmorSearchTerm()}
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