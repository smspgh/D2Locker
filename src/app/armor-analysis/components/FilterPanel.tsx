import { t } from 'app/i18next-t';
import clsx from 'clsx';
import { FilterOptions } from '../types/armor-types';
import styles from './FilterPanel.m.scss';

interface Props {
  options: FilterOptions;
  onChange: (options: Partial<FilterOptions>) => void;
  onClose: () => void;
  categories: string[];
}

export default function FilterPanel({ options, onChange, onClose, categories }: Props) {
  const handleCategoryToggle = (category: string) => {
    const newCategories = options.categories.includes(category)
      ? options.categories.filter(c => c !== category)
      : [...options.categories, category];
    onChange({ categories: newCategories });
  };

  const handleClearFilters = () => {
    onChange({
      categories: [],
      searchQuery: '',
      showPercentagesOnly: false,
      showAbsoluteOnly: false,
      minValue: 0,
      maxValue: 200
    });
  };

  return (
    <div className={styles.filterPanel}>
      <div className={styles.panelHeader}>
        <h3>{(t as any)('ArmorAnalysis.Filters', 'Filters')}</h3>
        <button className={styles.closeButton} onClick={onClose}>
          <span className="fa fa-times" />
        </button>
      </div>

      <div className={styles.filterSection}>
        <label>{(t as any)('ArmorAnalysis.SearchStats', 'Search Stats')}</label>
        <input
          type="text"
          placeholder={(t as any)('ArmorAnalysis.SearchPlaceholder', 'Type to search...')}
          value={options.searchQuery}
          onChange={(e) => onChange({ searchQuery: e.target.value })}
          className={styles.searchInput}
        />
      </div>

      <div className={styles.filterSection}>
        <label>{(t as any)('ArmorAnalysis.Categories', 'Categories')}</label>
        <div className={styles.categoryButtons}>
          {categories.map(category => (
            <button
              key={category}
              className={clsx(styles.categoryButton, {
                [styles.active]: options.categories.includes(category)
              })}
              onClick={() => handleCategoryToggle(category)}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.filterSection}>
        <label>{(t as any)('ArmorAnalysis.ValueType', 'Value Type')}</label>
        <div className={styles.typeToggles}>
          <button
            className={clsx(styles.typeToggle, {
              [styles.active]: options.showPercentagesOnly
            })}
            onClick={() => onChange({
              showPercentagesOnly: !options.showPercentagesOnly,
              showAbsoluteOnly: false
            })}
          >
            {(t as any)('ArmorAnalysis.PercentagesOnly', 'Percentages Only')}
          </button>
          <button
            className={clsx(styles.typeToggle, {
              [styles.active]: options.showAbsoluteOnly
            })}
            onClick={() => onChange({
              showAbsoluteOnly: !options.showAbsoluteOnly,
              showPercentagesOnly: false
            })}
          >
            {(t as any)('ArmorAnalysis.AbsoluteOnly', 'Absolute Values Only')}
          </button>
        </div>
      </div>

      <div className={styles.panelFooter}>
        <button className={styles.clearButton} onClick={handleClearFilters}>
          {(t as any)('ArmorAnalysis.ClearFilters', 'Clear All')}
        </button>
      </div>
    </div>
  );
}
