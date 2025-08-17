import React, { useState, useMemo } from 'react';
import { ProcessedArmor3Stat, BuildConstraints } from '../types/armor3-types';
import { analyzeStatDistribution } from '../utils/armor3-parser';
import { calculateEfficiencyScore } from '../utils/armor3-calculations';
import styles from './BuildOptimizer.m.scss';

interface Props {
  stats: ProcessedArmor3Stat[];
  currentValues: { [statId: string]: number };
  onStatChange: (statId: string, value: number) => void;
}

export default function BuildOptimizer({ stats, currentValues, onStatChange }: Props) {
  const [buildType, setBuildType] = useState<BuildConstraints['buildType']>('pve-dps');
  const [totalPoints, setTotalPoints] = useState(550);
  
  // Analyze current distribution
  const analysis = useMemo(() => 
    analyzeStatDistribution(currentValues), 
    [currentValues]
  );
  
  // Build type presets
  const buildPresets = {
    'pve-dps': {
      name: 'PvE DPS',
      description: 'Maximize damage output for raids and dungeons',
      priorities: ['weapon', 'grenade', 'super'],
      breakpoints: [
        { statId: 'weapon', minValue: 100 },
        { statId: 'grenade', minValue: 70 },
        { statId: 'super', minValue: 30 }
      ]
    },
    'pve-survivability': {
      name: 'PvE Tank',
      description: 'Maximum survivability for difficult content',
      priorities: ['health', 'class', 'melee'],
      breakpoints: [
        { statId: 'health', minValue: 100 },
        { statId: 'class', minValue: 100 }
      ]
    },
    'pvp-aggressive': {
      name: 'PvP Aggressive',
      description: 'Fast-paced aggressive PvP playstyle',
      priorities: ['melee', 'class', 'weapon'],
      breakpoints: [
        { statId: 'melee', minValue: 70 },
        { statId: 'class', minValue: 70 }
      ]
    },
    'pvp-defensive': {
      name: 'PvP Defensive',
      description: 'Defensive PvP build with high survivability',
      priorities: ['health', 'class', 'grenade'],
      breakpoints: [
        { statId: 'health', minValue: 60 },
        { statId: 'class', minValue: 100 }
      ]
    },
    'hybrid': {
      name: 'Balanced',
      description: 'Versatile build for all activities',
      priorities: ['health', 'weapon', 'grenade'],
      breakpoints: [
        { statId: 'health', minValue: 50 },
        { statId: 'weapon', minValue: 50 },
        { statId: 'grenade', minValue: 70 }
      ]
    }
  };
  
  const currentPreset = buildPresets[buildType];
  
  // Optimize distribution
  const optimizeDistribution = () => {
    const result: { [statId: string]: number } = {};
    let remainingPoints = totalPoints;
    
    // First, meet all breakpoint requirements
    for (const breakpoint of currentPreset.breakpoints) {
      result[breakpoint.statId] = breakpoint.minValue;
      remainingPoints -= breakpoint.minValue;
    }
    
    // Initialize other stats to 0
    for (const stat of stats) {
      if (!result[stat.id]) {
        result[stat.id] = 0;
      }
    }
    
    // Distribute remaining points based on priorities
    while (remainingPoints > 0 && currentPreset.priorities.length > 0) {
      for (const priorityStat of currentPreset.priorities) {
        if (remainingPoints <= 0) {break;}
        
        const currentValue = result[priorityStat] || 0;
        
        // Find next valuable breakpoint for this stat
        const stat = stats.find(s => s.id === priorityStat);
        if (!stat) {continue;}
        
        // Determine optimal investment
        let targetValue = currentValue;
        
        // Key thresholds to aim for
        const thresholds = [30, 70, 80, 100, 150, 200];
        for (const threshold of thresholds) {
          if (threshold > currentValue && threshold <= currentValue + remainingPoints) {
            targetValue = threshold;
            break;
          }
        }
        
        // If no threshold found, add up to 20 points
        if (targetValue === currentValue && currentValue < 200) {
          targetValue = Math.min(200, currentValue + Math.min(20, remainingPoints));
        }
        
        const pointsToAdd = targetValue - currentValue;
        if (pointsToAdd > 0) {
          result[priorityStat] = targetValue;
          remainingPoints -= pointsToAdd;
        }
      }
    }
    
    // Update the stat values
    for (const [statId, value] of Object.entries(result)) {
      onStatChange(statId, value);
    }
  };
  
  // Calculate efficiency for each stat
  const statEfficiencies = useMemo(() => {
    const efficiencies: { [statId: string]: number } = {};
    for (const stat of stats) {
      const benefits = [...stat.primaryEffects, ...stat.enhancedEffects];
      efficiencies[stat.id] = calculateEfficiencyScore(currentValues[stat.id], benefits.map(b => ({
        name: b.name,
        range: b.range[0] === 0 ? '0-100' : '101-200',
        scaling_model: b.scalingType as any,
        max_value: b.maxValue,
        unit: b.unit,
        pve_only: b.isPvE && !b.isPvP
      })));
    }
    return efficiencies;
  }, [stats, currentValues]);
  
  return (
    <div className={styles.buildOptimizer}>
      <div className={styles.header}>
        <h2>Build Optimizer</h2>
        <p>Optimize your stat distribution for specific playstyles</p>
      </div>
      
      {/* Build Type Selector */}
      <div className={styles.buildTypeSection}>
        <h3>Select Build Type</h3>
        <div className={styles.buildTypes}>
          {Object.entries(buildPresets).map(([key, preset]) => (
            <div
              key={key}
              className={`${styles.buildType} ${buildType === key ? styles.selected : ''}`}
              onClick={() => setBuildType(key as BuildConstraints['buildType'])}
            >
              <h4>{preset.name}</h4>
              <p>{preset.description}</p>
            </div>
          ))}
        </div>
      </div>
      
      {/* Total Points Control */}
      <div className={styles.pointsControl}>
        <label>
          <span>Total Stat Points Available</span>
          <input
            type="number"
            min="300"
            max="700"
            value={totalPoints}
            onChange={(e) => setTotalPoints(parseInt(e.target.value) || 550)}
          />
          <span className={styles.hint}>Typical range: 550-600 with mods</span>
        </label>
      </div>
      
      {/* Current Distribution */}
      <div className={styles.currentDistribution}>
        <h3>Current Distribution</h3>
        <div className={styles.statGrid}>
          {stats.map(stat => (
            <div key={stat.id} className={styles.statRow}>
              <div className={styles.statInfo}>
                <span className={styles.statName}>{stat.name}</span>
                <span className={styles.efficiency}>
                  Efficiency: {statEfficiencies[stat.id]?.toFixed(0)}%
                </span>
              </div>
              <div className={styles.statControl}>
                <input
                  type="range"
                  min="0"
                  max="200"
                  value={currentValues[stat.id]}
                  onChange={(e) => onStatChange(stat.id, parseInt(e.target.value))}
                  className={styles.statSlider}
                />
                <input
                  type="number"
                  min="0"
                  max="200"
                  value={currentValues[stat.id]}
                  onChange={(e) => onStatChange(stat.id, parseInt(e.target.value) || 0)}
                  className={styles.statInput}
                />
              </div>
              {/* Breakpoint indicators */}
              <div className={styles.breakpoints}>
                {stat.breakpoints
                  .filter(bp => bp.importance === 'critical' || bp.importance === 'major')
                  .map((bp, idx) => (
                    <span
                      key={idx}
                      className={`${styles.breakpoint} ${
                        currentValues[stat.id] >= bp.statValue ? styles.reached : ''
                      }`}
                      title={bp.description}
                    >
                      {bp.statValue}
                    </span>
                  ))}
              </div>
            </div>
          ))}
        </div>
        
        {/* Total and Analysis */}
        <div className={styles.analysisSection}>
          <div className={styles.totalDisplay}>
            <span>Total Points Used:</span>
            <span className={`${styles.totalValue} ${
              analysis.totalPoints > totalPoints ? styles.exceeded : ''
            }`}>
              {analysis.totalPoints} / {totalPoints}
            </span>
          </div>
          
          {/* Warnings */}
          {analysis.warnings.length > 0 && (
            <div className={styles.warnings}>
              <h4>Warnings</h4>
              {analysis.warnings.map((warning, idx) => (
                <div key={idx} className={styles.warning}>
                  <span className="fa fa-warning" />
                  {warning}
                </div>
              ))}
            </div>
          )}
          
          {/* Suggestions */}
          {analysis.suggestions.length > 0 && (
            <div className={styles.suggestions}>
              <h4>Suggestions</h4>
              {analysis.suggestions.map((suggestion, idx) => (
                <div key={idx} className={styles.suggestion}>
                  <span className="fa fa-lightbulb-o" />
                  {suggestion}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      
      {/* Optimization Actions */}
      <div className={styles.actions}>
        <button
          className={styles.optimizeButton}
          onClick={optimizeDistribution}
        >
          <span className="fa fa-magic" />
          Optimize for {currentPreset.name}
        </button>
        
        <button
          className={styles.resetButton}
          onClick={() => {
            for (const stat of stats) {
              onStatChange(stat.id, 50);
            }
          }}
        >
          <span className="fa fa-refresh" />
          Reset All
        </button>
      </div>
      
      {/* Build Requirements */}
      <div className={styles.requirements}>
        <h3>Build Requirements</h3>
        <div className={styles.requirementsList}>
          <div className={styles.priorities}>
            <h4>Priority Stats</h4>
            <ol>
              {currentPreset.priorities.map(statId => (
                <li key={statId}>
                  {stats.find(s => s.id === statId)?.name || statId}
                </li>
              ))}
            </ol>
          </div>
          
          <div className={styles.minimums}>
            <h4>Minimum Breakpoints</h4>
            {currentPreset.breakpoints.map((bp, idx) => (
              <div key={idx} className={styles.requirement}>
                <span>{stats.find(s => s.id === bp.statId)?.name}: </span>
                <span className={styles.reqValue}>{bp.minValue}+</span>
                {currentValues[bp.statId] >= bp.minValue ? (
                  <span className={styles.met}>✓</span>
                ) : (
                  <span className={styles.notMet}>✗</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}