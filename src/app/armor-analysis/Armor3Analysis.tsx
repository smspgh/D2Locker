import { t } from 'app/i18next-t';
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router';
import styles from './ArmorAnalysis.m.scss';
import useArmor3Data from './hooks/useArmor3Data';
import { useCurrentCharacterStats, useCurrentCharacterInfo, useAvailableCharacters, useCharacterStats, useCharacterInfo } from './hooks/useCurrentCharacterStats';
import { ProcessedArmor3Stat } from './types/armor3-types';
import Armor3Chart from './components/Armor3Chart';

function Armor3AnalysisInner() {
  const { data, loading, error, reload } = useArmor3Data();
  const availableCharacters = useAvailableCharacters();
  const defaultCharacterInfo = useCurrentCharacterInfo();
  const location = useLocation();
  
  // Character selection state
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | undefined>(undefined);
  
  // Use selected character or fall back to current/first available
  const effectiveCharacterId = selectedCharacterId || defaultCharacterInfo.characterId || availableCharacters[0]?.id;
  const characterStats = useCharacterStats(effectiveCharacterId);
  const characterInfo = useCharacterInfo(effectiveCharacterId);
  
  // Simplified state management
  const [selectedStat, setSelectedStat] = useState<ProcessedArmor3Stat | null>(null);
  const [currentStatValues, setCurrentStatValues] = useState<{ [statId: string]: number }>(characterStats);
  const [selectedChartPoint, setSelectedChartPoint] = useState<any>(null);
  
  // Auto-select first stat when data loads
  useEffect(() => {
    if (data && data.length > 0 && !selectedStat) {
      setSelectedStat(data[0]);
    }
  }, [data, selectedStat]);
  
  // Update stat values when character changes
  // Fixed: Only update if the values actually changed to prevent navigation blocking
  useEffect(() => {
    const statsChanged = JSON.stringify(currentStatValues) !== JSON.stringify(characterStats);
    if (statsChanged) {
      setCurrentStatValues(characterStats);
    }
  }, [characterStats]); // currentStatValues is intentionally not in deps to avoid loop
  
  const handleStatSelect = (stat: ProcessedArmor3Stat) => {
    setSelectedStat(stat);
    setSelectedChartPoint(null); // Reset chart selection when switching stats
  };
  
  const handleChartPointClick = (point: any) => {
    setSelectedChartPoint(point);
  };
  
  if (loading) {
    return (
      <div className="d2l-page">
        <div className={styles.loading}>
          {t('Loading.Profile')}
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="d2l-page">
        <div className={styles.error}>
          {t('Views.ErrorLoading', { error: error.message })}
          <button onClick={reload} className={styles.retryButton}>
            {t('Views.TryAgain')}
          </button>
        </div>
      </div>
    );
  }
  
  if (!data) {
    return null;
  }

  return (
    <div className={`d2l-page ${styles.armorAnalysis}`}>
      <div className={styles.header}>
        <div className={styles.titleSection}>
          <h1>{t('ArmorAnalysis.Title', { defaultValue: 'Armor Analysis' })}</h1>
          <p className={styles.subtitle}>
            {characterInfo.characterName} ({characterInfo.className?.replace(/^(Human|Awoken|Exo)\s+/, '') || 'Guardian'}) - PvE Focused Analysis
          </p>
        </div>
        
        {/* Character Cards */}
        {availableCharacters.length > 1 && (
          <div className={styles.characterCards}>
            <div className={styles.characterCardsLabel}>{t('LoadoutBuilder.SelectCharacter', { defaultValue: 'Character:' })}</div>
            <div className={styles.characterCardsGrid}>
              {availableCharacters.map(character => {
                const cleanClassName = character.className?.replace(/^(Human|Awoken|Exo)\s+/, '') || 'Guardian';
                const characterName = character.name || cleanClassName;
                const isSelected = character.id === effectiveCharacterId;
                
                return (
                  <button
                    key={character.id}
                    onClick={() => setSelectedCharacterId(character.id)}
                    className={`${styles.characterCard} ${isSelected ? styles.selected : ''}`}
                  >
                    <div className={styles.characterCardName}>{characterName}</div>
                    <div className={styles.characterCardPower}>⚡{character.powerLevel}</div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
      
      {/* Stat Tabs */}
      <div className={styles.statTabs}>
        {data.map(stat => (
          <button
            key={stat.id}
            className={`${styles.statTab} ${selectedStat?.id === stat.id ? styles.active : ''}`}
            onClick={() => handleStatSelect(stat)}
          >
            <div className={styles.statTabName}>{stat.name}</div>
            <div className={styles.statTabValue}>{currentStatValues[stat.id]}</div>
          </button>
        ))}
      </div>

      {selectedStat && (
        <>
          {/* Summary Cards */}
          <div className={styles.summaryCards}>
            <div className={styles.summaryCard}>
              <h3>Current Value</h3>
              <div className={styles.summaryValue}>
                {currentStatValues[selectedStat.id]}
                <span className={styles.summaryMax}> / 200</span>
              </div>
            </div>
            
            <div className={styles.summaryCard}>
              <h3>Next Breakpoint</h3>
              <div className={styles.summaryValue}>
                {(() => {
                  const currentVal = currentStatValues[selectedStat.id];
                  const nextBreakpoint = selectedStat.breakpoints
                    ? selectedStat.breakpoints
                        .filter(bp => bp.statValue > currentVal)
                        .sort((a, b) => a.statValue - b.statValue)[0]
                    : null;
                  return nextBreakpoint ? nextBreakpoint.statValue : 'Max';
                })()}
              </div>
            </div>
            
            <div className={styles.summaryCard}>
              <h3>Active Benefits</h3>
              <div className={styles.summaryBenefits}>
                {[...selectedStat.primaryEffects, ...selectedStat.enhancedEffects]
                  .filter(benefit => {
                    const currentVal = currentStatValues[selectedStat.id];
                    return benefit.breakpoints && benefit.breakpoints.some(bp => currentVal >= bp.statValue);
                  })
                  .length}
              </div>
            </div>
            
            <div className={styles.summaryCard}>
              <h3>Total Points</h3>
              <div className={styles.summaryValue}>
                {Object.values(currentStatValues).reduce((sum, val) => sum + val, 0)}
                <span className={styles.summaryMax}> / 600</span>
              </div>
            </div>
          </div>

          {/* Chart */}
          <div className={styles.chartSection}>
            <Armor3Chart
              stat={selectedStat}
              showBreakpoints={true}
              showPvP={false}
              currentStatValue={currentStatValues[selectedStat.id]}
              onPointClick={handleChartPointClick}
            />
          </div>

          {/* Detail Box */}
          {selectedChartPoint && (
            <div className={styles.detailBox}>
              <h3>Breakpoint Details</h3>
              <div className={styles.detailContent}>
                <p><strong>Stat Value:</strong> {selectedChartPoint.statValue}</p>
                <p><strong>Benefit:</strong> {selectedChartPoint.benefitName}</p>
                <p><strong>Description:</strong> {selectedChartPoint.description}</p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Temporary minimal version - delete this when restoring full component
/*
export default function Armor3Analysis() {
  const location = useLocation();
  const { data, loading, error, reload } = useArmor3Data();
  const currentCharacterStats = useCurrentCharacterStats();
  const characterInfo = useCurrentCharacterInfo();
  
  // State management from original component
  const [selectedStat, setSelectedStat] = useState(null);
  const [currentStatValues, setCurrentStatValues] = useState(currentCharacterStats);
  const [chartOptions, setChartOptions] = useState({
    showPrimaryEffects: true,
    showEnhancedEffects: true,
    showBreakpoints: true,
    showRecommendations: true,
    showPvEValues: true,
    showPvPValues: false,
    compareMode: false,
    highlightSoftCaps: true,
    displayRange: [0, 200],
    selectedStats: []
  });
  const [selectedBenefits, setSelectedBenefits] = useState([]);
  const [compareStats, setCompareStats] = useState([]);
  const [buildMode, setBuildMode] = useState('viewer');
  
  useEffect(() => {
    console.log('Armor3Analysis mounted at', location.pathname);
    return () => {
      console.log('Armor3Analysis unmounting');
    };
  }, []);

  // Auto-select first stat when data loads (from original component)
  useEffect(() => {
    if (data && data.length > 0 && !selectedStat) {
      setSelectedStat(data[0]);
      // Select first two benefits by default
      const defaultBenefits = [
        ...data[0].primaryEffects.slice(0, 1),
        ...data[0].enhancedEffects.slice(0, 1)
      ].map(b => b.name);
      setSelectedBenefits(defaultBenefits);
    }
  }, [data, selectedStat]);
  
  // Update stat values when character changes (from original component)
  // Only update if the values actually changed
  useEffect(() => {
    const statsChanged = JSON.stringify(currentStatValues) !== JSON.stringify(currentCharacterStats);
    if (statsChanged) {
      setCurrentStatValues(currentCharacterStats);
    }
  }, [currentCharacterStats]); // currentStatValues is intentionally not in deps to avoid loop
  
  // Show loading state
  if (loading) {
    return (
      <div className="d2l-page">
        <h1>Armor Analysis</h1>
        <p>Loading...</p>
        <p>Current path: {location.pathname}</p>
      </div>
    );
  }
  
  // Show error state
  if (error) {
    return (
      <div className="d2l-page">
        <h1>Armor Analysis</h1>
        <p>Error: {error.message}</p>
        <button onClick={reload}>Try Again</button>
        <p>Current path: {location.pathname}</p>
      </div>
    );
  }
  
  // Return minimal content with data, character info, and state
  return (
    <div className="d2l-page">
      <h1>Armor Analysis (With State Management)</h1>
      <p>Data loaded: {data ? `${data.length} stats` : 'No data'}</p>
      <p>Character: {characterInfo.characterName} ({characterInfo.className})</p>
      <p>Total stats: {Object.values(currentCharacterStats).reduce((sum, val) => sum + val, 0)}</p>
      <p>Selected stat: {selectedStat ? selectedStat.name : 'None'}</p>
      <p>Build mode: {buildMode}</p>
      <p>Current path: {location.pathname}</p>
    </div>
  );
}
*/

// Full component with navigation fix
export default function Armor3Analysis() {
  try {
    return <Armor3AnalysisInner />;
  } catch (error) {
    console.error('Error in Armor3Analysis:', error);
    return <div>Error loading Armor Analysis</div>;
  }
}