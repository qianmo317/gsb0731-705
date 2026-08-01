import { useState, useEffect } from 'react';
import { PRACTICE_STATS_EVENT } from './useAudio';

export interface PracticeStats {
  totalLoops: number;
  totalSentences: number;
}

const STORAGE_PREFIX = 'repeat-';

export const readAllPracticeStats = (): Record<string, PracticeStats> => {
  const result: Record<string, PracticeStats> = {};
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith(STORAGE_PREFIX)) {
        const raw = window.localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          const totalLoops = parsed.totalLoops || 0;
          const totalSentences = parsed.totalSentences || 0;
          if (totalLoops > 0 || totalSentences > 0) {
            result[key.slice(STORAGE_PREFIX.length)] = { totalLoops, totalSentences };
          }
        }
      }
    }
  } catch (e) {
    console.warn('Failed to read practice stats', e);
  }
  return result;
};

export const usePracticeStats = () => {
  const [stats, setStats] = useState<Record<string, PracticeStats>>(readAllPracticeStats);

  useEffect(() => {
    const refresh = () => setStats(readAllPracticeStats());
    window.addEventListener(PRACTICE_STATS_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(PRACTICE_STATS_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  return stats;
};
