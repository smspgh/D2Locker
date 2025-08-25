import { settingsSelector } from 'app/d2l-api/selectors';
import PageWithMenu from 'app/d2l-ui/PageWithMenu';
import { t } from 'app/i18next-t';
import { itemTagList } from 'app/inventory/d2l-item-info';
import Checkbox from 'app/settings/Checkbox';
import { useSetSetting } from 'app/settings/hooks';
import { IconQuality, IconQualityApplyTo } from 'app/settings/initial-settings';
import { itemSortSettingsSelector } from 'app/settings/item-sort';
import Select, { mapToOptions } from 'app/settings/Select';
import { fineprintClass, settingClass } from 'app/settings/SettingsPage';
import styles from 'app/settings/SettingsPage.m.scss';
import SortOrderEditor, { SortProperty } from 'app/settings/SortOrderEditor';
import { AppIcon, faList, settingsIcon } from 'app/shell/icons';
import { TierType } from 'bungie-api-ts/destiny2';
import { range } from 'es-toolkit';
import { useSelector } from 'react-redux';

// Sort options configuration with fallback labels
const SORT_OPTIONS = {
  typeName: { enabled: true, label: 'Settings.SortByType', fallback: 'Type' },
  rarity: { enabled: true, label: 'Settings.SortByRarity', fallback: 'Rarity' },
  primStat: { enabled: true, label: 'Settings.SortByPrimary', fallback: 'Power Level' },
  amount: { enabled: true, label: 'Settings.SortByAmount', fallback: 'Stack Size' },
  rating: { enabled: false, label: 'Settings.SortByRating', fallback: 'Armor Quality (D1)' },
  classType: { enabled: true, label: 'Settings.SortByClassType', fallback: 'Required Class' },
  ammoType: { enabled: true, label: 'Settings.SortByAmmoType', fallback: 'Ammo Type' },
  name: { enabled: true, label: 'Settings.SortName', fallback: 'Name' },
  tag: { enabled: true, label: 'Settings.SortByTag', fallback: 'Tag' },
  season: { enabled: true, label: 'Settings.SortBySeason', fallback: 'Season (D2)' },
  acquisitionRecency: {
    enabled: true,
    label: 'Settings.SortByRecent',
    fallback: 'Recently Acquired (D2)',
  },
  elementWeapon: { enabled: true, label: 'Settings.SortByWeaponElement', fallback: 'Damage Type' },
  masterworked: { enabled: true, label: 'Settings.SortByMasterwork', fallback: 'Masterworked' },
  crafted: { enabled: true, label: 'Settings.SortByCrafted', fallback: 'Crafted (D2)' },
  deepsight: { enabled: true, label: 'Settings.SortByDeepsight', fallback: 'Deepsight (D2)' },
  featured: { enabled: true, label: 'Settings.SortByFeatured', fallback: 'Featured (D2)' },
  tier: { enabled: true, label: 'Settings.SortByTier', fallback: 'Tier (D2)' },
};

export default function ItemDisplayOptions() {
  const settings = useSelector(settingsSelector);
  const itemSortSettings = useSelector(itemSortSettingsSelector);
  const setSetting = useSetSetting();

  const itemSortOrderChanged = (sortOrder: SortProperty[]) => {
    setSetting(
      'itemSortOrderCustom',
      sortOrder.filter((o) => o.enabled).map((o) => o.id),
    );
    setSetting(
      'itemSortReversals',
      sortOrder.filter((o) => o.reversed).map((o) => o.id),
    );
  };

  const onChangeNumeric: React.ChangeEventHandler<HTMLInputElement | HTMLSelectElement> = (e) => {
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val)) {
      setSetting(e.target.name as 'charColMobile', val);
    }
  };

  const charColOptions = range(2, 6).map((num) => ({
    value: num,
    name: t('Settings.ColumnSize', { num }),
  }));

  // Create tag list string for display
  const tagLabelList = itemTagList.map((tagLabel) => t(tagLabel.label));
  const listSeparator = ['ja', 'zh-cht', 'zh-chs'].includes(settings.language) ? '、' : ', ';
  const tagListString = tagLabelList.join(listSeparator);

  // Build sort properties for the editor
  const allSortOptions: SortProperty[] = Object.entries(SORT_OPTIONS)
    .filter(([, config]) => config.enabled)
    .map(([id, config]) => {
      let label: string;
      try {
        // Try to get translated label, with fallback for 'tag' special case
        if (id === 'tag') {
          label = t(config.label, { taglist: tagListString, defaultValue: config.fallback });
        } else {
          label = t(config.label, { defaultValue: config.fallback });
        }
      } catch {
        // If translation fails, use fallback
        label = config.fallback;
      }

      return {
        id,
        displayName: label, // SortOrderEditor expects 'displayName', not 'label'
        enabled: itemSortSettings.sortOrder.includes(id),
        reversed: itemSortSettings.sortReversals.includes(id),
      };
    });

  // Sort the options: enabled first (in current order), then disabled alphabetically
  const enabledOptions = allSortOptions
    .filter((option) => option.enabled)
    .sort((a, b) => {
      // Sort enabled options by their position in the current sort order
      const aIndex = itemSortSettings.sortOrder.indexOf(a.id);
      const bIndex = itemSortSettings.sortOrder.indexOf(b.id);
      return aIndex - bIndex;
    });

  const disabledOptions = allSortOptions
    .filter((option) => !option.enabled)
    .sort((a, b) => a.displayName.localeCompare(b.displayName));

  const sortOrder: SortProperty[] = [...enabledOptions, ...disabledOptions];

  // Icon quality options
  const iconQualityOptions = mapToOptions({
    standard: 'Standard',
    highres: 'High Resolution',
    screenshot: 'Screenshot',
  });

  const iconApplyToOptions = mapToOptions({
    all: 'All Items',
    weapons: 'Weapons Only',
    armor: 'Armor Only',
  });

  // Tier options for filtering
  const tierOptions = [
    { value: TierType.Basic, label: 'Common' },
    { value: TierType.Common, label: 'Uncommon' },
    { value: TierType.Rare, label: 'Rare' },
    { value: TierType.Superior, label: 'Legendary' },
    { value: TierType.Exotic, label: 'Exotic' },
  ];

  const handleTierChange = (tier: TierType, checked: boolean) => {
    const currentTiers = settings.iconQualityTiers || [
      TierType.Basic,
      TierType.Common,
      TierType.Rare,
      TierType.Superior,
      TierType.Exotic,
    ];

    const newTiers = checked ? [...currentTiers, tier] : currentTiers.filter((t) => t !== tier);

    setSetting('iconQualityTiers', newTiers);
  };

  return (
    <PageWithMenu>
      <div className={styles.settings}>
        <h1>
          <AppIcon icon={faList} /> Item Display Options
        </h1>

        <section>
          <h2>{t('LockerOptions.SortingHeader', { defaultValue: 'Item Sorting' })}</h2>
          <div className={settingClass}>
            <label>{t('Settings.SetSort')}</label>
            <SortOrderEditor order={sortOrder} onSortOrderChanged={itemSortOrderChanged} />
            <div className={fineprintClass}>
              {t('LockerOptions.SortingDescription', {
                defaultValue:
                  'Drag and drop to reorder. Check to enable. Click arrows to reverse sort direction.',
              })}
            </div>
          </div>
        </section>

        <section>
          <h2>
            <AppIcon icon={settingsIcon} /> Icon Quality Settings
          </h2>

          <div className={settingClass}>
            <Select
              label={t('LockerOptions.IconQuality', { defaultValue: 'Icon Quality' })}
              name="iconQuality"
              value={settings.iconQuality || 'highres'}
              options={iconQualityOptions}
              onChange={(e) => setSetting('iconQuality', e.target.value as IconQuality)}
            />
            <div className={fineprintClass}>
              {t('LockerOptions.IconQualityDescription', {
                defaultValue: 'Choose the quality of icons to display for items.',
              })}
              <ul style={{ marginTop: '8px', marginBottom: 0 }}>
                <li>
                  <strong>
                    {t('LockerOptions.IconQualityStandard', { defaultValue: 'Standard' })}:
                  </strong>{' '}
                  {t('LockerOptions.IconQualityStandardDesc', {
                    defaultValue: 'Use regular icons (smaller file size)',
                  })}
                </li>
                <li>
                  <strong>
                    {t('LockerOptions.IconQualityHighRes', { defaultValue: 'High Resolution' })}:
                  </strong>{' '}
                  {t('LockerOptions.IconQualityHighResDesc', {
                    defaultValue: 'Use high-res icons when available (current default)',
                  })}
                </li>
                <li>
                  <strong>
                    {t('LockerOptions.IconQualityScreenshot', { defaultValue: 'Screenshot' })}:
                  </strong>{' '}
                  {t('LockerOptions.IconQualityScreenshotDesc', {
                    defaultValue:
                      'Use item screenshots as icons (experimental, may look inconsistent)',
                  })}
                </li>
              </ul>
            </div>
          </div>

          <div className={settingClass}>
            <Select
              label={t('LockerOptions.IconQualityApplyTo', { defaultValue: 'Apply To' })}
              name="iconQualityApplyTo"
              value={settings.iconQualityApplyTo || 'all'}
              options={iconApplyToOptions}
              onChange={(e) =>
                setSetting('iconQualityApplyTo', e.target.value as IconQualityApplyTo)
              }
            />
            <div className={fineprintClass}>
              Choose which items should use the selected icon quality.
            </div>
          </div>

          <div className={settingClass}>
            <label>{t('LockerOptions.IconQualityTiers', { defaultValue: 'Item Tiers' })}</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {tierOptions.map((tier) => (
                <Checkbox
                  key={tier.value}
                  label={tier.label}
                  name={`tier-${tier.value}`}
                  value={(
                    settings.iconQualityTiers || [
                      TierType.Basic,
                      TierType.Common,
                      TierType.Rare,
                      TierType.Superior,
                      TierType.Exotic,
                    ]
                  ).includes(tier.value)}
                  onChange={(checked) => handleTierChange(tier.value, checked)}
                />
              ))}
            </div>
            <div className={fineprintClass}>
              {t('LockerOptions.IconQualityTiersDesc', {
                defaultValue: 'Select which item tiers should use the custom icon quality setting.',
              })}
            </div>
          </div>
        </section>

        <section>
          <h2>{t('LockerOptions.DisplayHeader', { defaultValue: 'Display Options' })}</h2>

          <div className={settingClass}>
            <Checkbox
              label={t('Settings.ShowNewItems')}
              name="showNewItems"
              value={settings.showNewItems}
              onChange={(checked) => setSetting('showNewItems', checked)}
            />
            <div className={fineprintClass}>
              {t('Settings.ShowNewItemsDescription', {
                defaultValue: 'Display a green indicator on newly acquired items.',
              })}
            </div>
          </div>

          <div className={settingClass}>
            <Select
              label={t('Settings.InventoryColumnsMobile', {
                defaultValue: 'Character inventory width on mobile portrait',
              })}
              name="charColMobile"
              value={settings.charColMobile}
              options={charColOptions}
              onChange={onChangeNumeric}
            />
            <div className={fineprintClass}>
              {t('Settings.InventoryColumnsMobileDescription', {
                defaultValue: 'Number of columns for character inventory on mobile portrait view.',
              })}
            </div>
          </div>
        </section>
      </div>
    </PageWithMenu>
  );
}
