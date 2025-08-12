import { t } from 'app/i18next-t';
import { ChartOptions } from '../types/armor-types';
import styles from './ChartControls.m.scss';

interface Props {
  options: ChartOptions;
  onChange: (options: Partial<ChartOptions>) => void;
  maxValue: number;
}

export default function ChartControls({ options, onChange, maxValue }: Props) {
  const handleRangeChange = (field: 'startValue' | 'endValue', value: number) => {
    if (field === 'startValue' && value < options.endValue) {
      onChange({ [field]: value });
    } else if (field === 'endValue' && value > options.startValue) {
      onChange({ [field]: value });
    }
  };

  return (
    <div className={styles.chartControls}>
      <div className={styles.controlGroup}>
        <label>{(t as any)('ArmorAnalysis.DisplayOptions', 'Display Options')}</label>

        <div className={styles.toggles}>
          <button
            className={`${styles.toggle} ${options.showOnlyChangedRange ? styles.active : ''}`}
            onClick={() => onChange({ showOnlyChangedRange: !options.showOnlyChangedRange })}
            title={(t as any)('ArmorAnalysis.ShowActiveRange', 'Show only active range')}
          >
            <span className="fa fa-compress" />
            <span>{(t as any)('ArmorAnalysis.ActiveRange', 'Active Range')}</span>
          </button>

          <button
            className={`${styles.toggle} ${options.showDifferences ? styles.active : ''}`}
            onClick={() => onChange({ showDifferences: !options.showDifferences })}
            title={(t as any)('ArmorAnalysis.ShowDifferences', 'Show tier-to-tier differences')}
          >
            <span className="fa fa-chart-line" />
            <span>{(t as any)('ArmorAnalysis.Differences', 'Differences')}</span>
          </button>

          <button
            className={`${styles.toggle} ${options.showPlateau ? styles.active : ''}`}
            onClick={() => onChange({ showPlateau: !options.showPlateau })}
            title={(t as any)('ArmorAnalysis.ShowPlateau', 'Highlight plateau region')}
          >
            <span className="fa fa-chart-area" />
            <span>{(t as any)('ArmorAnalysis.Plateau', 'Plateau')}</span>
          </button>

          <button
            className={`${styles.toggle} ${options.compareMode ? styles.active : ''}`}
            onClick={() => onChange({ compareMode: !options.compareMode })}
            title={(t as any)('ArmorAnalysis.CompareMode', 'Compare multiple stats')}
          >
            <span className="fa fa-code-branch" />
            <span>{(t as any)('ArmorAnalysis.Compare', 'Compare')}</span>
          </button>
        </div>
      </div>

      {!options.showOnlyChangedRange && (
        <div className={styles.rangeControls}>
          <div className={styles.rangeGroup}>
            <label htmlFor="startRange">
              {(t as any)('ArmorAnalysis.StartValue', 'Start')}
            </label>
            <input
              id="startRange"
              type="range"
              min={0}
              max={maxValue - 1}
              value={options.startValue}
              onChange={(e) => handleRangeChange('startValue', parseInt(e.target.value))}
              className={styles.rangeSlider}
            />
            <span className={styles.rangeValue}>{options.startValue}</span>
          </div>

          <div className={styles.rangeGroup}>
            <label htmlFor="endRange">
              {(t as any)('ArmorAnalysis.EndValue', 'End')}
            </label>
            <input
              id="endRange"
              type="range"
              min={1}
              max={maxValue}
              value={options.endValue}
              onChange={(e) => handleRangeChange('endValue', parseInt(e.target.value))}
              className={styles.rangeSlider}
            />
            <span className={styles.rangeValue}>{options.endValue}</span>
          </div>
        </div>
      )}
    </div>
  );
}
