import { useEffect, useState } from 'react';
import { ProcessedStatData } from '../types/armor-types';
import { parseArmorData } from '../utils/data-parser';

interface UseArmorDataReturn {
  data: ProcessedStatData[] | null;
  loading: boolean;
  error: Error | null;
}

export default function useArmorData(): UseArmorDataReturn {
  const [data, setData] = useState<ProcessedStatData[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        // Load from the D2ArmorAnalysis directory
        const response = await fetch('/D2ArmorAnalysis/data.json');
        if (!response.ok) {
          throw new Error(`Failed to load armor data: ${response.statusText}`);
        }
        const rawData = await response.json();
        const processedData = parseArmorData(rawData);
        setData(processedData);
        setError(null);
      } catch (err) {
        console.error('Error loading armor analysis data:', err);
        setError(err instanceof Error ? err : new Error('Unknown error loading data'));
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  return { data, loading, error };
}
