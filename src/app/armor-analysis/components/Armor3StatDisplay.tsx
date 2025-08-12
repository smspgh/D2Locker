import React from 'react';
import { ProcessedArmor3Stat, ProcessedBenefit } from '../types/armor3-types';
import styles from './Armor3StatDisplay.m.scss';

interface Props {
  stat: ProcessedArmor3Stat;
  currentValue: number;
  showPvP: boolean;
  highlightBreakpoints: boolean;
  compareValue?: number;
}

export default function Armor3StatDisplay({ 
  stat, 
  currentValue, 
  showPvP, 
  highlightBreakpoints,
  compareValue 
}: Props) {
  // Find active breakpoints
  const activeBreakpoints = stat.breakpoints.filter(bp => bp.statValue <= currentValue);
  const nextBreakpoint = stat.breakpoints.find(bp => bp.statValue > currentValue);
  
  // Determine which effects are active
  const isPrimaryActive = currentValue > 0 && currentValue <= 100;
  const isEnhancedActive = currentValue > 100;
  
  return (
    <div className={styles.statDisplay}>
      <div className={styles.header}>
        <h3 className={styles.statName}>{stat.name}</h3>
        <div className={styles.currentValue}>
          <span className={styles.value}>{currentValue}</span>
          {compareValue !== undefined && compareValue !== currentValue && (
            <span className={styles.compareValue}>
              ({compareValue > currentValue ? '+' : ''}{compareValue - currentValue})
            </span>
          )}
        </div>
      </div>
      
      <p className={styles.description}>{stat.description}</p>
      
      {/* Primary Effects Section */}
      <div className={`${styles.effectSection} ${isPrimaryActive ? styles.active : ''}`}>
        <h4 className={styles.sectionTitle}>
          Primary Effects (0-100)
          {currentValue > 100 && <span className={styles.maxed}>MAXED</span>}
        </h4>
        <div className={styles.benefits}>
          {stat.primaryEffects.map((benefit, idx) => (
            <BenefitDisplay
              key={idx}
              benefit={benefit}
              currentValue={Math.min(currentValue, 100)}
              showPvP={showPvP}
              isActive={isPrimaryActive || currentValue > 100}
            />
          ))}
        </div>
      </div>
      
      {/* Enhanced Effects Section */}
      <div className={`${styles.effectSection} ${isEnhancedActive ? styles.active : styles.locked}`}>
        <h4 className={styles.sectionTitle}>
          Enhanced Effects (101-200)
          {currentValue <= 100 && <span className={styles.locked}>LOCKED</span>}
        </h4>
        <div className={styles.benefits}>
          {stat.enhancedEffects.map((benefit, idx) => (
            <BenefitDisplay
              key={idx}
              benefit={benefit}
              currentValue={currentValue}
              showPvP={showPvP}
              isActive={isEnhancedActive}
            />
          ))}
        </div>
      </div>
      
      {/* Breakpoints Section */}
      {highlightBreakpoints && (
        <div className={styles.breakpoints}>
          <h4 className={styles.sectionTitle}>Key Breakpoints</h4>
          <div className={styles.breakpointList}>
            {activeBreakpoints.map((bp, idx) => (
              <div key={idx} className={`${styles.breakpoint} ${styles[bp.importance]}`}>
                <span className={styles.bpValue}>{bp.statValue}</span>
                <span className={styles.bpDesc}>{bp.description}</span>
              </div>
            ))}
            {nextBreakpoint && (
              <div className={`${styles.breakpoint} ${styles.next}`}>
                <span className={styles.bpValue}>{nextBreakpoint.statValue}</span>
                <span className={styles.bpDesc}>{nextBreakpoint.description}</span>
                <span className={styles.pointsNeeded}>
                  (+{nextBreakpoint.statValue - currentValue} needed)
                </span>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Recommendations */}
      {stat.recommendations.length > 0 && (
        <div className={styles.recommendations}>
          <h4 className={styles.sectionTitle}>Build Recommendations</h4>
          {stat.recommendations
            .filter(rec => currentValue >= rec.minValue - 10 && currentValue <= rec.maxValue + 10)
            .map((rec, idx) => (
              <div key={idx} className={`${styles.recommendation} ${styles[rec.priority]}`}>
                <span className={styles.buildType}>{rec.buildType}</span>
                <span className={styles.range}>{rec.minValue}-{rec.maxValue}</span>
                <p className={styles.reasoning}>{rec.reasoning}</p>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

// Sub-component for individual benefit display
function BenefitDisplay({ 
  benefit, 
  currentValue, 
  showPvP, 
  isActive 
}: { 
  benefit: ProcessedBenefit;
  currentValue: number;
  showPvP: boolean;
  isActive: boolean;
}) {
  // Calculate the actual value based on current stat
  const effectiveValue = currentValue >= benefit.range[0] && currentValue <= benefit.range[1]
    ? benefit.values[currentValue]
    : currentValue > benefit.range[1] 
      ? benefit.values[benefit.range[1]]
      : 0;
  
  const showBenefit = (!benefit.isPvE || !showPvP) || (benefit.isPvE && !benefit.isPvP);
  
  if (!showBenefit && !showPvP) return null;
  
  return (
    <div className={`${styles.benefit} ${!isActive ? styles.inactive : ''}`}>
      <div className={styles.benefitHeader}>
        <span className={styles.benefitName}>{benefit.name}</span>
        {benefit.isPvE && benefit.isPvP && (
          <span className={styles.pveTags}>PvE/PvP</span>
        )}
        {benefit.isPvE && !benefit.isPvP && (
          <span className={styles.pveTag}>PvE</span>
        )}
        {!benefit.isPvE && benefit.isPvP && (
          <span className={styles.pvpTag}>PvP</span>
        )}
      </div>
      <div className={styles.benefitValue}>
        <span className={styles.current}>
          {effectiveValue > 0 ? '+' : ''}{effectiveValue.toFixed(1)}{benefit.unit}
        </span>
        <span className={styles.max}>
          / {benefit.maxValue}{benefit.unit}
        </span>
      </div>
      {benefit.description && (
        <p className={styles.benefitNote}>{benefit.description}</p>
      )}
      <div className={styles.progressBar}>
        <div 
          className={styles.progress}
          style={{ 
            width: `${(effectiveValue / benefit.maxValue) * 100}%` 
          }}
        />
      </div>
    </div>
  );
}