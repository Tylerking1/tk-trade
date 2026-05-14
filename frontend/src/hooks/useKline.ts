import { useState, useCallback } from 'react';
import type { KlineItem, Indicators, Patterns, AIScore } from '../types';
import { fetchKlineData, fetchPatterns, fetchAIScore } from '../services/api';

export function useKline() {
  const [klineData, setKlineData] = useState<KlineItem[]>([]);
  const [indicators, setIndicators] = useState<Indicators>({});
  const [patterns, setPatterns] = useState<Patterns>({});
  const [aiScore, setAiScore] = useState<AIScore | null>(null);
  const [loading, setLoading] = useState(false);

  const loadKline = useCallback(async (tsCode: string, startDate?: string, endDate?: string, period?: string) => {
    setLoading(true);
    try {
      const [klineRes, patternRes] = await Promise.all([
        fetchKlineData({ ts_code: tsCode, start_date: startDate, end_date: endDate, period }),
        fetchPatterns({ ts_code: tsCode, start_date: startDate, end_date: endDate }),
      ]);
      setKlineData(klineRes.data);
      setIndicators(klineRes.indicators);
      setPatterns(patternRes.patterns);

      fetchAIScore({ ts_code: tsCode, start_date: startDate, end_date: endDate })
        .then((res: any) => {
          if (res && typeof res.score === 'number' && Array.isArray(res.signals)) {
            setAiScore(res as AIScore);
          } else {
            setAiScore(null);
          }
        })
        .catch(() => setAiScore(null));
    } catch (err) {
      console.error('Failed to load kline:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  return { klineData, indicators, patterns, aiScore, loading, loadKline };
}
