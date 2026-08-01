import { useState, useRef, useEffect } from 'react';
import { useLocalStorage } from './useLocalStorage';
import { LrcLine } from '../utils/lrcParser';

interface UseAudioProps {
  src: string;
  id: string; // Used for persistence key
  lyrics?: LrcLine[];
}

export interface RepeatRange {
  startTime: number;
  endTime: number;
}

interface StoredRepeat {
  startTime?: number;
  endTime?: number;
  count?: number;
  totalLoops?: number;
  totalSentences?: number;
}

interface SentenceState {
  index: number;
  iteration: number;
}

export const PRACTICE_STATS_EVENT = 'practice-stats-updated';

const readRepeatStorage = (id: string): StoredRepeat | null => {
  try {
    const raw = window.localStorage.getItem(`repeat-${id}`);
    if (raw) return JSON.parse(raw) as StoredRepeat;
  } catch (e) {
    console.warn('Failed to read repeat storage', e);
  }
  return null;
};

// Write the repeat-${id} record. When a range is active it stores the full
// active-range object plus cumulative stats; when no range is active but
// stats exist it stores stats only; otherwise the key is removed.
const writeRepeatStorage = (
  id: string,
  range: RepeatRange | null,
  count: number,
  totalLoops: number,
  totalSentences: number
) => {
  try {
    if (range) {
      const data: StoredRepeat = {
        startTime: range.startTime,
        endTime: range.endTime,
        count,
        totalLoops,
        totalSentences,
      };
      window.localStorage.setItem(`repeat-${id}`, JSON.stringify(data));
    } else if (totalLoops > 0 || totalSentences > 0) {
      const data: StoredRepeat = { totalLoops, totalSentences };
      window.localStorage.setItem(`repeat-${id}`, JSON.stringify(data));
    } else {
      window.localStorage.removeItem(`repeat-${id}`);
    }
  } catch (e) {
    console.warn('Failed to write repeat storage', e);
  }
};

// On lesson switch the active range is cancelled, but cumulative stats must
// survive. Strip the active-range fields while keeping the totals.
const preserveStatsOnly = (id: string) => {
  try {
    const raw = window.localStorage.getItem(`repeat-${id}`);
    if (raw) {
      const parsed = JSON.parse(raw) as StoredRepeat;
      const loops = parsed.totalLoops || 0;
      const sentences = parsed.totalSentences || 0;
      if (loops > 0 || sentences > 0) {
        window.localStorage.setItem(
          `repeat-${id}`,
          JSON.stringify({ totalLoops: loops, totalSentences: sentences })
        );
      } else {
        window.localStorage.removeItem(`repeat-${id}`);
      }
    }
  } catch (e) {}
};

export const useAudio = ({ src, id, lyrics = [] }: UseAudioProps) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Persist Volume (Global)
  const [volume, setVolume] = useLocalStorage<number>('audio-volume', 1.0);

  // Persist sentence-repeat target count (Global), same naming/storage style as volume
  const [sentenceRepeatCount, setSentenceRepeatCountState] = useLocalStorage<number>(
    'sentence-repeat-count',
    3
  );

  // Interval repeat state
  const [repeatRange, setRepeatRangeState] = useState<RepeatRange | null>(null);
  const [repeatCount, setRepeatCount] = useState(0);

  // Sentence-by-sentence intensive listening state
  const [sentenceRepeat, setSentenceRepeatState] = useState(false);
  const [sentenceIteration, setSentenceIteration] = useState(1);

  // Cumulative practice traces (per lesson), extended on the repeat-${id} structure
  const [totalLoops, setTotalLoops] = useState(0);
  const [totalSentences, setTotalSentences] = useState(0);

  // Refs mirroring state for use inside audio event listeners
  const progressRef = useRef(0);
  const repeatRangeRef = useRef<RepeatRange | null>(null);
  const repeatCountRef = useRef(0);
  const totalLoopsRef = useRef(0);
  const totalSentencesRef = useRef(0);
  const prevIdRef = useRef<string>('');
  const lyricsRef = useRef<LrcLine[]>(lyrics);
  const sentenceRepeatRef = useRef(sentenceRepeat);
  const sentenceRepeatTargetRef = useRef(sentenceRepeatCount);
  const sentenceStateRef = useRef<SentenceState>({ index: -1, iteration: 1 });

  // Keep refs in sync with state/props
  useEffect(() => {
    repeatRangeRef.current = repeatRange;
  }, [repeatRange]);

  useEffect(() => {
    repeatCountRef.current = repeatCount;
  }, [repeatCount]);

  useEffect(() => {
    totalLoopsRef.current = totalLoops;
  }, [totalLoops]);

  useEffect(() => {
    totalSentencesRef.current = totalSentences;
  }, [totalSentences]);

  useEffect(() => {
    lyricsRef.current = lyrics;
  }, [lyrics]);

  useEffect(() => {
    sentenceRepeatRef.current = sentenceRepeat;
  }, [sentenceRepeat]);

  useEffect(() => {
    sentenceRepeatTargetRef.current = sentenceRepeatCount;
  }, [sentenceRepeatCount]);

  // Notify practice-stats readers (e.g. the lesson list) whenever totals change.
  useEffect(() => {
    window.dispatchEvent(new Event(PRACTICE_STATS_EVENT));
  }, [totalLoops, totalSentences]);

  // When the active range or lyrics change while sentence repeat is on,
  // reset the sentence tracker so it re-binds to the new boundaries.
  useEffect(() => {
    if (sentenceRepeatRef.current) {
      sentenceStateRef.current = { index: -1, iteration: 1 };
    }
  }, [repeatRange, lyrics]);

  useEffect(() => {
    // Switching to another lesson cancels the active loop for the lesson we
    // leave, but keeps its cumulative practice stats.
    if (prevIdRef.current && prevIdRef.current !== id) {
      preserveStatsOnly(prevIdRef.current);
    }
    prevIdRef.current = id;

    // Reset transient state
    setPlaying(false);
    setError(null);
    setLoading(false);

    // Load saved repeat range + cumulative stats for this lesson (survives refresh)
    let loadedRepeat: RepeatRange | null = null;
    let loadedCount = 0;
    let loadedLoops = 0;
    let loadedSentences = 0;
    const parsed = readRepeatStorage(id);
    if (parsed) {
      if (typeof parsed.startTime === 'number' && typeof parsed.endTime === 'number') {
        loadedRepeat = { startTime: parsed.startTime, endTime: parsed.endTime };
        loadedCount = parsed.count || 0;
      }
      loadedLoops = parsed.totalLoops || 0;
      loadedSentences = parsed.totalSentences || 0;
    }

    setRepeatRangeState(loadedRepeat);
    repeatRangeRef.current = loadedRepeat;
    setRepeatCount(loadedCount);
    repeatCountRef.current = loadedCount;
    setTotalLoops(loadedLoops);
    totalLoopsRef.current = loadedLoops;
    setTotalSentences(loadedSentences);
    totalSentencesRef.current = loadedSentences;

    // Reset sentence tracker on lesson switch
    sentenceStateRef.current = { index: -1, iteration: 1 };

    // Cleanup old audio
    if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
    }

    if (!src) return;

    const audio = new Audio(src);
    audioRef.current = audio;
    audio.volume = volume; // Apply global volume
    setLoading(true);

    let savedTime = 0;
    try {
        const saved = window.localStorage.getItem(`progress-${id}`);
        if (saved) savedTime = parseFloat(saved);
    } catch (e) { console.warn("Failed to read saved progress", e); }

    const setAudioData = () => {
      setDuration(audio.duration);
      setLoading(false);
      // Resume if valid and not finished
      if (savedTime > 0 && savedTime < audio.duration - 2) {
         audio.currentTime = savedTime;
         setCurrentTime(savedTime);
      }
    };

    const persist = () => {
      writeRepeatStorage(
        id,
        repeatRangeRef.current,
        repeatCountRef.current,
        totalLoopsRef.current,
        totalSentencesRef.current
      );
    };

    const performLoop = () => {
      const range = repeatRangeRef.current;
      if (!range) return false;
      audio.currentTime = range.startTime;
      const nextCount = repeatCountRef.current + 1;
      repeatCountRef.current = nextCount;
      setRepeatCount(nextCount);
      const nextLoops = totalLoopsRef.current + 1;
      totalLoopsRef.current = nextLoops;
      setTotalLoops(nextLoops);
      persist();
      if (audio.paused) {
        audio.play().catch(() => {});
      }
      return true;
    };

    const bumpSentence = () => {
      const next = totalSentencesRef.current + 1;
      totalSentencesRef.current = next;
      setTotalSentences(next);
      persist();
    };

    // Compute the inclusive sentence index range affected by the active range
    // (or the whole lyric set when no range is selected).
    const getSentenceBounds = () => {
      const lines = lyricsRef.current;
      let startIdx = 0;
      let endIdx = lines.length - 1;
      const range = repeatRangeRef.current;
      if (range && lines.length) {
        const s = lines.findIndex((l) => l.time >= range.startTime);
        startIdx = s === -1 ? 0 : s;
        let e = -1;
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].time < range.endTime) e = i;
        }
        endIdx = e === -1 ? lines.length - 1 : e;
      }
      return { startIdx, endIdx, lines };
    };

    const findSentenceIndexAt = (time: number, startIdx: number, endIdx: number, lines: LrcLine[]) => {
      let idx = startIdx;
      for (let i = startIdx; i <= endIdx; i++) {
        if (time >= lines[i].time - 0.05) idx = i;
        else break;
      }
      return idx;
    };

    // Returns true if it handled the boundary (seeked / advanced / stopped).
    const handleSentenceBoundary = (curr: number): boolean => {
      if (!sentenceRepeatRef.current) return false;
      const { startIdx, endIdx, lines } = getSentenceBounds();
      if (!lines.length) return false;

      const state = sentenceStateRef.current;
      const target = sentenceRepeatTargetRef.current;

      if (state.index === -1) {
        const idx = findSentenceIndexAt(curr, startIdx, endIdx, lines);
        state.index = idx;
        state.iteration = 1;
        setSentenceIteration(1);
        return false;
      }

      // End time of the currently tracked sentence: next line's start,
      // or range end / audio duration for the last sentence.
      let sentenceEnd: number;
      if (state.index < endIdx) {
        sentenceEnd = lines[state.index + 1].time;
      } else if (repeatRangeRef.current) {
        sentenceEnd = repeatRangeRef.current.endTime;
      } else {
        sentenceEnd = audio.duration || Infinity;
      }

      if (curr < sentenceEnd - 0.05) return false;

      if (state.iteration < target) {
        // Repeat the same sentence
        audio.currentTime = lines[state.index].time;
        state.iteration += 1;
        setSentenceIteration(state.iteration);
        if (audio.paused) audio.play().catch(() => {});
        return true;
      }

      // This sentence has been repeated enough times: count it as "ground",
      // then advance to the next sentence, or stop.
      bumpSentence();

      if (state.index < endIdx) {
        state.index += 1;
        state.iteration = 1;
        setSentenceIteration(1);
        audio.currentTime = lines[state.index].time;
        if (audio.paused) audio.play().catch(() => {});
        return true;
      }

      // Last sentence finished -> stop.
      audio.pause();
      return true;
    };

    const setAudioTime = () => {
      const curr = audio.currentTime;
      setCurrentTime(curr);
      progressRef.current = curr;

      // Sentence repeat takes precedence over the infinite interval loop;
      // when it is on we walk sentence by sentence (within a range if boxed).
      if (sentenceRepeatRef.current) {
        handleSentenceBoundary(curr);
        return;
      }

      const range = repeatRangeRef.current;
      if (range && curr >= range.endTime - 0.05) {
        performLoop();
      }
    };

    const onEnded = () => {
      if (sentenceRepeatRef.current) {
        // Give the boundary handler a chance to repeat the last sentence
        // or to stop cleanly.
        const handled = handleSentenceBoundary(audio.duration || audio.currentTime);
        if (handled) return;
        setPlaying(false);
        return;
      }
      if (repeatRangeRef.current) {
        performLoop();
        return;
      }
      setPlaying(false);
      setCurrentTime(0);
      try {
        window.localStorage.removeItem(`progress-${id}`);
      } catch (e) {}
    };

    const onError = (e: Event) => {
      console.warn("Audio error event:", e);
      setLoading(false);
      setPlaying(false);

      const errCode = audio.error?.code;
      const errMsg = audio.error?.message;

      if (errCode === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED) {
          setError("Sources not supported / 404");
      } else if (errCode === MediaError.MEDIA_ERR_DECODE) {
          setError("Decode error");
      } else if (errCode === MediaError.MEDIA_ERR_NETWORK) {
          setError("Network error");
      } else {
          setError(`Error ${errCode}: ${errMsg}`);
      }
    };

    const onPause = () => {
        setPlaying(false);
        // Save progress on pause
        try {
            window.localStorage.setItem(`progress-${id}`, audio.currentTime.toString());
        } catch (e) {}
    };

    const onPlay = () => {
        setPlaying(true);
    };

    audio.addEventListener('loadedmetadata', setAudioData);
    audio.addEventListener('timeupdate', setAudioTime);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('play', onPlay);

    return () => {
      // Save progress for the OLD id before we switch or unmount
      if (audio.currentTime > 0) {
          try {
             window.localStorage.setItem(`progress-${id}`, audio.currentTime.toString());
          } catch (e) {}
      }

      audio.pause();
      audio.removeEventListener('loadedmetadata', setAudioData);
      audio.removeEventListener('timeupdate', setAudioTime);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('play', onPlay);
      audio.src = "";
    };
  }, [src, id]); // Re-run when source or ID changes

  // Handle Volume Changes
  useEffect(() => {
    if (audioRef.current) {
        audioRef.current.volume = volume;
    }
  }, [volume]);

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio || !src || error) return;

    if (playing) {
      audio.pause();
    } else {
      try {
        await audio.play();
      } catch (err) {
        console.error("Playback failed:", err);
      }
    }
  };

  const seek = (time: number) => {
    const audio = audioRef.current;
    if (!audio || !src || error) return;
    if (audio.readyState === 0) return;

    audio.currentTime = time;
    setCurrentTime(time);

    // User seeking outside the active interval cancels the loop (but keeps stats).
    // Internal loop seeks set audio.currentTime directly and never reach here.
    const range = repeatRangeRef.current;
    if (range && (time < range.startTime || time >= range.endTime)) {
      clearRepeatRange();
    }

    // Reset sentence tracker so it re-binds to the sentence at the new position.
    if (sentenceRepeatRef.current) {
      sentenceStateRef.current = { index: -1, iteration: 1 };
    }
  };

  const changeVolume = (val: number) => {
      const clamped = Math.max(0, Math.min(1, val));
      setVolume(clamped);
  };

  const setRepeatRange = (startTime: number, endTime: number) => {
    const audio = audioRef.current;
    const range: RepeatRange = { startTime, endTime };
    setRepeatRangeState(range);
    repeatRangeRef.current = range;
    setRepeatCount(0);
    repeatCountRef.current = 0;
    writeRepeatStorage(
      id,
      range,
      0,
      totalLoopsRef.current,
      totalSentencesRef.current
    );

    if (audio && audio.readyState > 0) {
      audio.currentTime = startTime;
      setCurrentTime(startTime);
      if (audio.paused) {
        audio.play().catch(() => {});
      }
    }
  };

  const clearRepeatRange = () => {
    setRepeatRangeState(null);
    repeatRangeRef.current = null;
    setRepeatCount(0);
    repeatCountRef.current = 0;
    writeRepeatStorage(
      id,
      null,
      0,
      totalLoopsRef.current,
      totalSentencesRef.current
    );
  };

  const setSentenceRepeat = (on: boolean) => {
    setSentenceRepeatState(on);
    sentenceRepeatRef.current = on;
    sentenceStateRef.current = { index: -1, iteration: 1 };
    setSentenceIteration(1);

    // When turning on, bind immediately to the sentence at the current position.
    if (on && audioRef.current) {
      const audio = audioRef.current;
      const lines = lyricsRef.current;
      const range = repeatRangeRef.current;
      let startIdx = 0;
      let endIdx = lines.length - 1;
      if (range && lines.length) {
        const s = lines.findIndex((l) => l.time >= range.startTime);
        startIdx = s === -1 ? 0 : s;
        let e = -1;
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].time < range.endTime) e = i;
        }
        endIdx = e === -1 ? lines.length - 1 : e;
      }
      if (lines.length) {
        let idx = startIdx;
        for (let i = startIdx; i <= endIdx; i++) {
          if (audio.currentTime >= lines[i].time - 0.05) idx = i;
          else break;
        }
        sentenceStateRef.current = { index: idx, iteration: 1 };
        setSentenceIteration(1);
      }
    }
  };

  const setSentenceRepeatCount = (n: number) => {
    const clamped = Math.max(1, Math.min(99, Math.floor(n)));
    setSentenceRepeatCountState(clamped);
    sentenceRepeatTargetRef.current = clamped;
  };

  return {
    playing,
    currentTime,
    duration,
    togglePlay,
    seek,
    volume,
    changeVolume,
    error,
    loading,
    repeatRange,
    repeatCount,
    setRepeatRange,
    clearRepeatRange,
    sentenceRepeat,
    sentenceIteration,
    sentenceRepeatCount,
    setSentenceRepeat,
    setSentenceRepeatCount,
    totalLoops,
    totalSentences,
  };
};
