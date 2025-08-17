import { t } from 'app/i18next-t';
import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Title,
  Tooltip,
} from 'chart.js';
import { useRef, useState } from 'react';
import { Line } from 'react-chartjs-2';
import { ChartOptions, ProcessedStatData } from '../types/armor-types';
import { getActiveRange } from '../utils/data-parser';
import styles from './TierChart.m.scss';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
  Legend
);

interface Props {
  stats: ProcessedStatData[];
  options: ChartOptions;
  viewMode: 'compact' | 'expanded';
}

export default function TierChart({ stats, options }: Props) {
  const chartRef = useRef<ChartJS<'line'>>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const getChartData = () => {
    let labels: string[] = [];
    let startIdx = options.startValue;
    let endIdx = options.endValue;

    // Determine range based on options
    if (options.showOnlyChangedRange && stats.length > 0) {
      const ranges = stats.map(stat => getActiveRange(stat));
      startIdx = Math.min(...ranges.map(r => r[0]));
      endIdx = Math.max(...ranges.map(r => r[1]));
    }

    // Create labels for x-axis
    labels = Array.from(
      { length: endIdx - startIdx + 1 },
      (_, i) => String(startIdx + i)
    );

    const datasets = stats.map((stat, idx) => {
      const dataToShow = options.showDifferences ? stat.differences : stat.values;
      const slicedData = dataToShow.slice(startIdx, endIdx + 1);

      // High contrast colors for dark background
      const colors = [
        '#00ffff', // cyan
        '#ff6b6b', // coral red
        '#4ecdc4', // turquoise
        '#ffd93d', // gold
        '#95e1d3', // mint
        '#ff9ff3', // pink
      ];

      const color = colors[idx % colors.length];

      return {
        label: stat.label,
        data: slicedData,
        borderColor: color,
        backgroundColor: `${color}15`,
        tension: 0.3,
        fill: true,
        pointRadius: slicedData.map((_, i) => {
          const actualIdx = startIdx + i;
          // Highlight critical points
          if (actualIdx === stat.maxDifferenceIndex) {return 10;}
          if (actualIdx === stat.plateauIndex) {return 8;}
          if (actualIdx === stat.firstNonZeroIndex) {return 6;}
          // Show points every 10 for clarity
          if (actualIdx % 10 === 0) {return 3;}
          return 0;
        }),
        pointBackgroundColor: slicedData.map((_, i) => {
          const actualIdx = startIdx + i;
          if (actualIdx === stat.maxDifferenceIndex) {return '#ff00ff';} // Magenta for max change
          if (actualIdx === stat.plateauIndex) {return '#ffff00';} // Yellow for plateau
          if (actualIdx === stat.firstNonZeroIndex) {return '#00ff00';} // Green for start
          return color;
        }),
        pointBorderColor: slicedData.map((_, i) => {
          const actualIdx = startIdx + i;
          if (actualIdx === stat.maxDifferenceIndex) {return '#ff00ff';}
          if (actualIdx === stat.plateauIndex) {return '#ffff00';}
          if (actualIdx === stat.firstNonZeroIndex) {return '#00ff00';}
          return color;
        }),
        pointBorderWidth: 2,
        pointHoverRadius: 10,
        borderWidth: 3,
      };
    });

    return {
      labels,
      datasets,
    };
  };

  const chartOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    plugins: {
      legend: {
        display: stats.length > 1,
        position: 'top' as const,
        labels: {
          color: '#ffffff',
          padding: 15,
          font: {
            size: 13,
            weight: '500',
          },
        },
      },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            const stat = stats[context.datasetIndex];
            if (!stat) {return '';}

            let label = context.dataset.label || '';
            const actualIdx = options.startValue + context.dataIndex;

            if (label) {
              label += ': ';
            }

            const value = context.parsed.y;
            if (stat.isPercentage && !options.showDifferences) {
              label += `${value.toFixed(2)  }%`;
            } else if (stat.unit && !options.showDifferences) {
              label += `${value.toFixed(2)  } ${  stat.unit}`;
            } else {
              label += value.toFixed(2);
            }

            // Add change indicator
            if (context.dataIndex > 0 && !options.showDifferences) {
              const prevValue = context.dataset.data[context.dataIndex - 1];
              const diff = value - prevValue;
              if (diff !== 0) {
                label += ` (${  diff > 0 ? '+' : ''  }${diff.toFixed(2)  })`;
              }
            }

            // Add special markers
            if (actualIdx === stat.maxDifferenceIndex) {
              label += ` 🔥 ${  (t as any)('ArmorAnalysis.MaxIncrease', 'MAX INCREASE')}`;
            }
            if (actualIdx === stat.plateauIndex) {
              label += ` 📊 ${  (t as any)('ArmorAnalysis.Plateau', 'PLATEAU')}`;
            }

            return label;
          },
          title: (tooltipItems: any) => (t as any)('ArmorAnalysis.StatValue', {
              value: tooltipItems[0].label
            })
        },
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        titleColor: '#fff',
        bodyColor: '#fff',
        borderColor: '#667eea',
        borderWidth: 1,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: options.showDifferences
            ? 'Change per Stat Point'
            : 'Benefit Value',
          color: '#ffffff',
          font: {
            size: 14,
            weight: '600',
          },
        },
        ticks: {
          color: '#ffffff',
          font: {
            size: 12,
            weight: '500',
          },
          callback: function(value: any) {
            if (stats.length > 0 && stats[0].isPercentage && !options.showDifferences) {
              return `${value.toFixed(1)  }%`;
            }
            return value.toFixed(1);
          },
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.2)',
          lineWidth: 1,
        },
      },
      x: {
        title: {
          display: true,
          text: stats.length > 0 ? stats[0].axisLabel : 'Stat Value (0-200)',
          color: '#ffffff',
          font: {
            size: 14,
            weight: '600',
          },
        },
        ticks: {
          color: '#ffffff',
          font: {
            size: 12,
            weight: '500',
          },
          stepSize: 10,
          min: 0,
          max: 200,
          callback: function(value: any) {
            // Show major ticks every 10 points
            if (value % 10 === 0) {
              return value.toString();
            }
            return null;
          },
        },
        grid: {
          color: (context: any) => {
            // Major grid lines every 10 points
            if (context.tick && context.tick.value % 10 === 0) {
              return 'rgba(255, 255, 255, 0.25)';
            }
            return 'rgba(255, 255, 255, 0.05)';
          },
          lineWidth: (context: any) => {
            if (context.tick && context.tick.value % 10 === 0) {
              return 1.5;
            }
            return 0.5;
          },
        },
      },
    },
    onHover: (_: any, activeElements: any[]) => {
      if (activeElements.length > 0) {
        setHoveredIndex(activeElements[0].index);
      } else {
        setHoveredIndex(null);
      }
    },
  };

  // Add annotations for plateau regions if enabled
  if (options.showPlateau && stats.length === 1 && stats[0].plateauIndex !== -1) {
    const stat = stats[0];
    const startIdx = options.showOnlyChangedRange ? stat.firstNonZeroIndex : options.startValue;
    const adjustedPlateauIdx = stat.plateauIndex - startIdx;

    if (adjustedPlateauIdx >= 0) {
      chartOptions.plugins.annotation = {
        annotations: {
          plateau: {
            type: 'box',
            xMin: adjustedPlateauIdx,
            xMax: options.endValue - startIdx,
            backgroundColor: 'rgba(245, 220, 86, 0.1)',
            borderColor: 'rgba(245, 220, 86, 0.5)',
            borderWidth: 1,
            label: {
              content: (t as any)('ArmorAnalysis.PlateauRegion', 'Plateau Region'),
              enabled: true,
              position: 'center',
              color: 'rgba(245, 220, 86, 0.8)',
            },
          },
        },
      };
    }
  }

  return (
    <div className={styles.chartWrapper}>
      <Line ref={chartRef} data={getChartData()} options={chartOptions} />
      {hoveredIndex !== null && stats.length > 0 && (
        <div className={styles.hoverInfo}>
          {(t as any)('ArmorAnalysis.ValueAt', {
            value: options.startValue + hoveredIndex,
            benefit: stats[0].values[options.startValue + hoveredIndex]?.toFixed(2) || '0'
          })}
        </div>
      )}
    </div>
  );
}
