import { useEffect, useState } from 'react';
import { ProcessedArmor3Stat } from '../types/armor3-types';
import { parseArmor3Data } from '../utils/armor3-parser';

interface UseArmor3DataReturn {
  data: ProcessedArmor3Stat[] | null;
  loading: boolean;
  error: Error | null;
  reload: () => void;
}

export default function useArmor3Data(): UseArmor3DataReturn {
  const [data, setData] = useState<ProcessedArmor3Stat[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadData = async (abortController?: AbortController) => {
    try {
      setLoading(true);
      setError(null);
      
      // Load the new Armor 3.0 data
      const response = await fetch('/D2ArmorAnalysis/armor3-data.json', {
        signal: abortController?.signal
      });
      if (!response.ok) {
        throw new Error(`Failed to load Armor 3.0 data: ${response.statusText}`);
      }
      
      const rawData = await response.json();
      const processedData = parseArmor3Data(rawData);
      
      setData(processedData);
    } catch (err) {
      if (err.name === 'AbortError') {
        console.log('Armor 3.0 data fetch aborted');
        return;
      }
      console.error('Error loading Armor 3.0 analysis data:', err);
      setError(err instanceof Error ? err : new Error('Unknown error loading data'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const abortController = new AbortController();
    loadData(abortController);
    
    return () => {
      console.log('useArmor3Data - aborting fetch');
      abortController.abort();
    };
  }, []);

  return { data, loading, error, reload: () => loadData() };
}