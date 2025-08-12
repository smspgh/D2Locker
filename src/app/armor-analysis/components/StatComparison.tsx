import React from 'react';
import { ProcessedArmor3Stat } from '../types/armor3-types';
import styles from './StatComparison.m.scss';

interface Props {
  stats: ProcessedArmor3Stat[];
  currentValues: { [statId: string]: number };
  compareStats: ProcessedArmor3Stat[];
  onAddCompareStat: (stat: ProcessedArmor3Stat) => void;
  onRemoveCompareStat: (stat: ProcessedArmor3Stat) => void;
}

export default function StatComparison({
  stats,
  currentValues,
  compareStats,
  onAddCompareStat,
  onRemoveCompareStat
}: Props) {
  // Calculate benefit values at specific stat points for comparison
  const comparisonPoints = [30, 50, 70, 80, 100, 120, 150, 200];
  
  const selectedStats = compareStats.length > 0 ? compareStats : stats;
  
  return (
    <div className={styles.statComparison}>
      <div className={styles.header}>
        <h2>Stat Comparison</h2>
        <p>Compare benefits across different stat values and breakpoints</p>
      </div>
      
      {/* Stat Selector */}
      <div className={styles.statSelector}>
        <h3>Select Stats to Compare</h3>
        <div className={styles.statButtons}>
          {stats.map(stat => {
            const isSelected = compareStats.some(s => s.id === stat.id);
            return (
              <button
                key={stat.id}
                className={`${styles.statButton} ${isSelected ? styles.selected : ''}`}
                onClick={() => {
                  if (isSelected) {
                    onRemoveCompareStat(stat);
                  } else {
                    onAddCompareStat(stat);
                  }
                }}
              >
                {stat.name}
                {isSelected && <span className={styles.removeIcon}>×</span>}
              </button>
            );
          })}
        </div>
      </div>
      
      {/* Comparison Table */}
      <div className={styles.comparisonTable}>
        <h3>Benefit Comparison at Key Breakpoints</h3>
        
        {selectedStats.map(stat => (
          <div key={stat.id} className={styles.statSection}>
            <h4>{stat.name}</h4>
            
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Stat Value</th>
                    {stat.primaryEffects.map(benefit => (
                      <th key={benefit.name} className={styles.primary}>
                        {benefit.name}
                        <span className={styles.unit}>({benefit.unit})</span>
                      </th>
                    ))}
                    {stat.enhancedEffects.map(benefit => (
                      <th key={benefit.name} className={styles.enhanced}>
                        {benefit.name}
                        <span className={styles.unit}>({benefit.unit})</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {comparisonPoints.map(point => {
                    const isCurrentValue = currentValues[stat.id] === point;
                    const isBreakpoint = stat.breakpoints.some(bp => bp.statValue === point);
                    
                    return (
                      <tr 
                        key={point} 
                        className={`
                          ${isCurrentValue ? styles.current : ''}
                          ${isBreakpoint ? styles.breakpoint : ''}
                        `}
                      >
                        <td className={styles.statValue}>
                          {point}
                          {isBreakpoint && (
                            <span className={styles.breakpointIcon} title={
                              stat.breakpoints.find(bp => bp.statValue === point)?.description
                            }>
                              ★
                            </span>
                          )}
                        </td>
                        {stat.primaryEffects.map(benefit => {
                          const value = point <= 100 ? benefit.values[point] : benefit.values[100];
                          const isMaxed = point >= 100 && benefit.range[1] === 100;
                          
                          return (
                            <td key={benefit.name} className={`${styles.primary} ${isMaxed ? styles.maxed : ''}`}>
                              {value > 0 ? `+${value.toFixed(1)}` : value.toFixed(1)}
                              {isMaxed && <span className={styles.maxIndicator}>MAX</span>}
                            </td>
                          );
                        })}
                        {stat.enhancedEffects.map(benefit => {
                          const value = point > 100 ? benefit.values[point] : 0;
                          const isActive = point > 100;
                          
                          return (
                            <td key={benefit.name} className={`${styles.enhanced} ${!isActive ? styles.locked : ''}`}>
                              {isActive ? `+${value.toFixed(1)}` : '-'}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            
            {/* Key Insights */}
            <div className={styles.insights}>
              <h5>Key Insights</h5>
              <ul>
                {stat.breakpoints
                  .filter(bp => bp.importance === 'critical' || bp.importance === 'major')
                  .map((bp, idx) => (
                    <li key={idx}>
                      <strong>{bp.statValue}:</strong> {bp.description}
                    </li>
                  ))}
                <li>
                  <strong>100:</strong> Primary effects maxed, enhanced effects unlock
                </li>
                {stat.id === 'grenade' && (
                  <li>
                    <strong>200:</strong> Maximum +65% PvE damage - highest stat damage bonus
                  </li>
                )}
                {stat.id === 'weapon' && (
                  <li>
                    <strong>200:</strong> Guaranteed double ammo from bricks in PvE
                  </li>
                )}
              </ul>
            </div>
          </div>
        ))}
      </div>
      
      {/* Efficiency Analysis */}
      <div className={styles.efficiencyAnalysis}>
        <h3>Investment Efficiency Analysis</h3>
        <div className={styles.efficiencyGrid}>
          {selectedStats.map(stat => (
            <div key={stat.id} className={styles.efficiencyCard}>
              <h4>{stat.name}</h4>
              
              <div className={styles.ranges}>
                <div className={styles.range}>
                  <span className={styles.rangeLabel}>0-70:</span>
                  <span className={styles.rangeValue}>High Efficiency</span>
                  <p>Maximum returns for ability cooldowns</p>
                </div>
                
                <div className={styles.range}>
                  <span className={styles.rangeLabel}>70-100:</span>
                  <span className={styles.rangeValue}>Diminishing Returns</span>
                  <p>Limited benefit, consider other stats</p>
                </div>
                
                <div className={styles.range}>
                  <span className={styles.rangeLabel}>101-200:</span>
                  <span className={styles.rangeValue}>Specialization</span>
                  <p>Powerful enhanced effects for focused builds</p>
                </div>
              </div>
              
              {/* Recommendations based on current value */}
              <div className={styles.recommendation}>
                <strong>Current: {currentValues[stat.id]}</strong>
                {currentValues[stat.id] < 70 && stat.id !== 'weapon' && (
                  <p>Consider investing to 70 for efficient ability uptime</p>
                )}
                {currentValues[stat.id] >= 70 && currentValues[stat.id] < 100 && (
                  <p>Near soft cap - evaluate if 100+ is worth it for enhanced effects</p>
                )}
                {currentValues[stat.id] >= 100 && (
                  <p>Enhanced effects active - deep specialization territory</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}