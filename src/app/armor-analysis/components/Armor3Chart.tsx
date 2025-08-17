import React, { useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions,
  TooltipItem
} from 'chart.js';
import { ProcessedArmor3Stat, ProcessedBenefit } from '../types/armor3-types';
import styles from './Armor3Chart.m.scss';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface Props {
  stat: ProcessedArmor3Stat;
  showBreakpoints: boolean;
  showPvP: boolean;
  currentStatValue?: number;
  onPointClick?: (point: any) => void;
}

// Expanded color palette with unique distinct colors for each benefit
const distinctColors = [
  '#00E676', // Bright Green
  '#2196F3', // Blue  
  '#FF5722', // Deep Orange
  '#9C27B0', // Purple
  '#FFC107', // Amber
  '#00BCD4', // Cyan
  '#4CAF50', // Green
  '#FF9800', // Orange
  '#E91E63', // Pink
  '#3F51B5', // Indigo
  '#FFEB3B', // Yellow
  '#795548', // Brown
  '#607D8B', // Blue Grey
  '#F44336', // Red
  '#8BC34A', // Light Green
  '#673AB7', // Deep Purple
  '#FF6F00', // Dark Orange
  '#1976D2', // Dark Blue
  '#D32F2F', // Dark Red
  '#388E3C'  // Dark Green
];

export default function Armor3Chart({
  stat,
  showBreakpoints,
  showPvP,
  currentStatValue,
  onPointClick
}: Props) {
  const chartData = useMemo(() => {
    const labels = Array.from({ length: 201 }, (_, i) => i.toString());
    const datasets: any[] = [];
    
    // Helper to create dataset for a benefit
    const createBenefitDataset = (benefit: ProcessedBenefit, statName: string, color: string, isDashed = false) => {
      // Filter values based on PvE/PvP selection
      const values = showPvP && benefit.pvpValues ? benefit.pvpValues : benefit.values;
      
      return {
        label: benefit.name, // Simplified label since legend is disabled
        data: values,
        borderColor: color,
        backgroundColor: `${color  }20`,
        borderWidth: 2,
        borderDash: isDashed ? [5, 5] : [],
        pointRadius: 0,
        pointHoverRadius: 6,
        tension: 0.1
      };
    };
    
    let colorIndex = 0;
    
    // Add primary effects datasets (always show all)
    stat.primaryEffects.forEach((benefit) => {
      datasets.push(createBenefitDataset(
        benefit, 
        stat.name, 
        distinctColors[colorIndex % distinctColors.length]
      ));
      colorIndex++;
    });
    
    // Add enhanced effects datasets (always show all)
    stat.enhancedEffects.forEach((benefit) => {
      datasets.push(createBenefitDataset(
        benefit, 
        stat.name, 
        distinctColors[colorIndex % distinctColors.length]
      ));
      colorIndex++;
    });
    
    
    return { labels, datasets };
  }, [stat, showPvP]);
  
  const chartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    onClick: (event, elements) => {
      if (elements.length > 0 && onPointClick) {
        const element = elements[0];
        const statValue = parseInt(chartData.labels[element.index]);
        
        // Find breakpoint at this stat value
        const breakpoint = stat.breakpoints?.find(bp => bp.statValue === statValue);
        if (breakpoint) {
          onPointClick({
            statValue,
            benefitName: breakpoint.description,
            description: breakpoint.description
          });
        }
      }
    },
    plugins: {
      legend: {
        display: false // Disable Chart.js built-in legend since we have our own below
      },
      title: {
        display: false
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        titleColor: '#fff',
        bodyColor: '#fff',
        borderColor: '#333',
        borderWidth: 1,
        padding: 12,
        displayColors: true,
        callbacks: {
          title: (items: TooltipItem<'line'>[]) => {
            const statValue = parseInt(items[0].label || '0');
            return `Stat Value: ${statValue}`;
          },
          afterTitle: (items: TooltipItem<'line'>[]) => {
            const statValue = parseInt(items[0].label || '0');
            const activeBreakpoints = stat.breakpoints ? stat.breakpoints.filter(bp => bp.statValue === statValue) : [];
            if (activeBreakpoints.length > 0) {
              return `\nBreakpoint: ${  activeBreakpoints.map(bp => bp.description).join('\n')}`;
            }
            return '';
          }
        }
      }
    },
    scales: {
      x: {
        min: 0,
        max: 200,
        grid: {
          display: true,
          drawOnChartArea: true,
          color: (context) => {
            const value = context.tick.value;
            if (currentStatValue !== undefined && value === currentStatValue) {
              return 'rgba(79, 195, 247, 0.9)'; // Blue for current stat
            }
            if (value === 100) {
              return 'rgba(255, 193, 7, 0.9)'; // Gold color for tier boundary  
            }
            return 'rgba(255, 255, 255, 0.15)';
          },
          lineWidth: (context) => {
            const value = context.tick.value;
            if (currentStatValue !== undefined && value === currentStatValue) {
              return 3; // Current stat position
            }
            if (value === 100) {
              return 4; // Strong threshold between primary and enhanced
            }
            return value % 20 === 0 ? 1.5 : 0.8;
          }
        },
        ticks: {
          // Generate custom ticks that include current stat value
          callback: function(value: any, index: any, ticks: any) {
            const num = parseInt(value);
            // Always show current stat value and tier boundary
            if (currentStatValue !== undefined && num === currentStatValue) {return num;}
            if (num === 100) {return num;}
            // Show major intervals
            if (num % 20 === 0) {return num;}
            return '';
          },
          color: (context) => {
            const value = context.tick.value;
            if (currentStatValue !== undefined && value === currentStatValue) {
              return '#4FC3F7'; // Blue for current stat
            }
            if (value === 100) {
              return '#FFC107'; // Gold for tier boundary
            }
            return '#aaa';
          }
        },
        // Force specific tick values to be included
        afterBuildTicks: function(scale: any) {
          const ticks = [];
          const ticksToInclude = new Set();
          
          // Always include these key values
          ticksToInclude.add(0);
          ticksToInclude.add(100);
          ticksToInclude.add(200);
          
          // Include current stat value if defined
          if (currentStatValue !== undefined) {
            ticksToInclude.add(currentStatValue);
          }
          
          // Include major intervals
          for (let i = 0; i <= 200; i += 20) {
            ticksToInclude.add(i);
          }
          
          // Include breakpoints if they exist
          if (showBreakpoints && stat.breakpoints) {
            stat.breakpoints.forEach(bp => ticksToInclude.add(bp.statValue));
          }
          
          // Convert to sorted array and create tick objects
          const sortedValues = Array.from(ticksToInclude).sort((a, b) => a - b);
          scale.ticks = sortedValues.map(value => ({ value }));
        }
      },
      y: {
        grid: {
          color: 'rgba(255, 255, 255, 0.1)'
        },
        ticks: {
          color: '#aaa',
          callback: function(value: any) {
            // Format based on the first visible dataset's unit
            const visibleDataset = chartData.datasets.find(d => !d.hidden);
            if (visibleDataset) {
              const benefit = [...stat.primaryEffects, ...stat.enhancedEffects]
                .find(b => visibleDataset.label?.includes(b.name));
              if (benefit?.unit === '%') {
                return `${value  }%`;
              }
            }
            return value;
          }
        }
      }
    },
    elements: {
      line: {
        borderWidth: 2
      }
    }
  };
  
  
  return (
    <div className={styles.chartContainer}>
      <div className={styles.chartHeader}>
        <h3 className={styles.chartTitle}>
          {stat.name} Stat Benefits
          {showPvP && <span className={styles.pvpIndicator}>PvP Values</span>}
        </h3>
      </div>
      <div className={styles.chart}>
        <Line data={chartData} options={chartOptions} />
      </div>
      
      {/* Vertical Legend List */}
      <div className={styles.legendList}>
        {/* Show each benefit with its unique color and current value */}
        {stat.primaryEffects.map((benefit, idx) => {
          const currentBenefitValue = currentStatValue !== undefined ? benefit.values[currentStatValue] || 0 : 0;
          const formattedValue = benefit.unit === '%' 
            ? `${currentBenefitValue.toFixed(1)}%`
            : `${currentBenefitValue.toFixed(1)}${benefit.unit || ''}`;
          
          return (
            <div key={`primary-${benefit.name}`} className={styles.legendItem}>
              <span 
                className={styles.legendDot} 
                style={{ backgroundColor: distinctColors[idx % distinctColors.length] }}
              />
              <span className={styles.benefitName}>{benefit.name}</span>
              <span className={styles.benefitValue}>{formattedValue}</span>
            </div>
          );
        })}
        {stat.enhancedEffects.map((benefit, idx) => {
          const currentBenefitValue = currentStatValue !== undefined ? benefit.values[currentStatValue] || 0 : 0;
          const formattedValue = benefit.unit === '%' 
            ? `${currentBenefitValue.toFixed(1)}%`
            : `${currentBenefitValue.toFixed(1)}${benefit.unit || ''}`;
          
          return (
            <div key={`enhanced-${benefit.name}`} className={styles.legendItem}>
              <span 
                className={styles.legendDot} 
                style={{ backgroundColor: distinctColors[(stat.primaryEffects.length + idx) % distinctColors.length] }}
              />
              <span className={styles.benefitName}>{benefit.name}</span>
              <span className={styles.benefitValue}>{formattedValue}</span>
            </div>
          );
        })}
      </div>
      
    </div>
  );
}