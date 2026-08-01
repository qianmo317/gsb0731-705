// Practice stats (练习痕迹) live inside the SAME per-lesson record that the
// playback layer already writes: localStorage key `abloop-${id}`. That record is
// `{ region?, count?, loops, sentences }`. This module only reads those existing
// records for the lesson list and removes one when a local lesson is deleted; it
// does NOT introduce a separate store.

export interface PracticeStats {
  loops: number; // cumulative 区间复读 passes
  sentences: number; // cumulative 逐句精听 sentences ground
}

const KEY = (id: string) => `abloop-${id}`;

export const getPracticeStats = (id: string): PracticeStats => {
  try {
    const raw = window.localStorage.getItem(KEY(id));
    if (!raw) return { loops: 0, sentences: 0 };
    const parsed = JSON.parse(raw);
    return {
      loops: typeof parsed?.loops === 'number' ? parsed.loops : 0,
      sentences: typeof parsed?.sentences === 'number' ? parsed.sentences : 0,
    };
  } catch (e) {
    return { loops: 0, sentences: 0 };
  }
};

export const hasPracticeRecord = (id: string): boolean => {
  const { loops, sentences } = getPracticeStats(id);
  return loops > 0 || sentences > 0;
};

// Remove a lesson's practice/loop record (and its resume progress) entirely.
// Called when a local lesson is deleted so its traces are cleared too.
export const removePracticeRecord = (id: string): void => {
  try {
    window.localStorage.removeItem(KEY(id));
    window.localStorage.removeItem(`progress-${id}`);
  } catch (e) { /* ignore */ }
};
