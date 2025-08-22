import { settingsSelector } from 'app/d2l-api/selectors';
import PageWithMenu from 'app/d2l-ui/PageWithMenu';
import { t } from 'app/i18next-t';
import { itemTagList } from 'app/inventory/d2l-item-info';
import Checkbox from 'app/settings/Checkbox';
import { useSetSetting } from 'app/settings/hooks';
import { itemSortSettingsSelector } from 'app/settings/item-sort';
import { fineprintClass, settingClass } from 'app/settings/SettingsPage';
import styles from 'app/settings/SettingsPage.m.scss';
import SortOrderEditor, { SortProperty } from 'app/settings/SortOrderEditor';
import { AppIcon, faList } from 'app/shell/icons';
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
        </section>
      </div>
    </PageWithMenu>
  );
}
