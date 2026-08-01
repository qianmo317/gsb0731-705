import { useState, useEffect, useCallback } from 'react';
import { PRACTICE_STATS_EVENT } from './useAudio';

export interface PracticeStats {
  totalLoopCount: number;
  totalSentences: number;
}

const EMPTY_STATS: PracticeStats = { totalLoopCount: 0, totalSentences: 0 };

const LOOP_KEY_PREFIX = 'loop-';

const readAllStats = (): Record<string, PracticeStats> => {
  const map: Record<string, PracticeStats> = {};
  try {
    const storage = window.localStorage;
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (!key || !key.startsWith(LOOP_KEY_PREFIX)) continue;
      const lessonId = key.slice(LOOP_KEY_PREFIX.length);
      try {
        const raw = storage.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          map[lessonId] = {
            totalLoopCount: typeof parsed.totalLoopCount === 'number' ? parsed.totalLoopCount : 0,
            totalSentences: typeof parsed.totalSentences === 'number' ? parsed.totalSentences : 0,
          };
        }
      } catch (e) { /* skip malformed entries */ }
    }
  } catch (e) { /* localStorage unavailable */ }
  return map;
};

export const usePracticeStats = () => {
  const [statsMap, setStatsMap] = useState<Record<string, PracticeStats>>(readAllStats);

  const refresh = useCallback(() => {
    setStatsMap(readAllStats());
  }, []);

  useEffect(() => {
    const handler = () => refresh();
    window.addEventListener(PRACTICE_STATS_EVENT, handler);
    // Also listen to native storage events for cross-tab sync
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener(PRACTICE_STATS_EVENT, handler);
      window.removeEventListener('storage', handler);
    };
  }, [refresh]);

  const getStats = useCallback(
    (id: string): PracticeStats => statsMap[id] ?? EMPTY_STATS,
    [statsMap]
  );

  const hasPractice = useCallback(
    (id: string): boolean => {
      const s = statsMap[id];
      return !!s && (s.totalLoopCount > 0 || s.totalSentences > 0);
    },
    [statsMap]
  );

  return { statsMap, getStats, hasPractice, refresh };
};
