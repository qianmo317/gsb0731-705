import { useState, useRef, useEffect } from 'react';
import { useLocalStorage } from './useLocalStorage';
import { LrcLine } from '../utils/lrcParser';

interface UseAudioProps {
  src: string;
  id: string; // Used for persistence key
  lines?: LrcLine[]; // Lyrics, used to resolve A-B loop region indices into times
}

// A-B repeat region, stored by lyric line indices (times are derived from `lines`).
export interface LoopRegion {
  startIndex: number;
  endIndex: number;
}

// Tolerance (seconds) used both for loop-back detection and "dragged out of region".
const LOOP_EPSILON = 0.08;

export const useAudio = ({ src, id, lines = [] }: UseAudioProps) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // --- A-B Loop (区间复读) state, owned entirely by this playback layer ---
  const [loopRegion, setLoopRegion] = useState<LoopRegion | null>(null);
  const [pendingStart, setPendingStart] = useState<number | null>(null); // start picked, waiting for end
  const [loopCount, setLoopCount] = useState(0); // "第几遍", 1-based while a region is active

  // --- Per-sentence intensive listening (逐句精听) state ---
  const [intensiveMode, setIntensiveMode] = useState(false); // the toggle
  const [intensiveIndex, setIntensiveIndex] = useState<number | null>(null); // sentence being repeated
  const [currentRepeat, setCurrentRepeat] = useState(0); // "第几遍" of the current sentence, 1-based

  // --- Cumulative practice stats (练习痕迹), per lesson ---
  // These extend the SAME `abloop-${id}` record written in earlier rounds; they
  // are not a separate store and persist even after a region is cleared.
  const [practiceLoops, setPracticeLoops] = useState(0); // total 区间复读 passes completed
  const [practiceSentences, setPracticeSentences] = useState(0); // total 逐句精听 sentences ground

  // Persist Volume (Global)
  const [volume, setVolume] = useLocalStorage<number>('audio-volume', 1.0);
  // Persist how many times each sentence repeats. Global study preference, so it
  // reuses the same useLocalStorage/global-key style as `audio-volume` above.
  const [repeatCount, setRepeatCount] = useLocalStorage<number>('intensive-repeat-count', 3);

  // Ref to track if we need to save progress when ID changes
  const progressRef = useRef(0);

  // Refs mirroring state/props so the audio event listeners (bound once per
  // src/id) always read fresh values instead of stale closures.
  const loopRegionRef = useRef<LoopRegion | null>(null);
  const pendingStartRef = useRef<number | null>(null);
  const linesRef = useRef<LrcLine[]>(lines);
  const durationRef = useRef(0);
  const idRef = useRef(id);

  // Refs for the intensive-listening state used inside the audio event handlers.
  const intensiveModeRef = useRef(false);
  const intensiveIndexRef = useRef<number | null>(null);
  const currentRepeatRef = useRef(0);
  const repeatCountRef = useRef(repeatCount);

  // Refs for cumulative stats, so event handlers persist without stale closures.
  const practiceLoopsRef = useRef(0);
  const practiceSentencesRef = useRef(0);

  useEffect(() => { loopRegionRef.current = loopRegion; }, [loopRegion]);
  useEffect(() => { pendingStartRef.current = pendingStart; }, [pendingStart]);
  useEffect(() => { linesRef.current = lines; }, [lines]);
  useEffect(() => { durationRef.current = duration; }, [duration]);
  useEffect(() => { idRef.current = id; }, [id]);
  useEffect(() => { intensiveModeRef.current = intensiveMode; }, [intensiveMode]);
  useEffect(() => { intensiveIndexRef.current = intensiveIndex; }, [intensiveIndex]);
  useEffect(() => { currentRepeatRef.current = currentRepeat; }, [currentRepeat]);
  useEffect(() => { repeatCountRef.current = repeatCount; }, [repeatCount]);
  useEffect(() => { practiceLoopsRef.current = practiceLoops; }, [practiceLoops]);
  useEffect(() => { practiceSentencesRef.current = practiceSentences; }, [practiceSentences]);

  // Resolve the active per-sentence scope: the framed region if one exists,
  // otherwise the whole track. This is how 逐句精听 coexists with 区间复读.
  const getScope = (): { start: number; end: number } => {
    const ls = linesRef.current;
    const region = loopRegionRef.current;
    if (region) return { start: region.startIndex, end: region.endIndex };
    return { start: 0, end: Math.max(0, ls.length - 1) };
  };

  // Concrete [start, end) times for a single sentence index. A sentence always
  // ends where the next lyric line begins (or the track end for the very last
  // line). The scope's boundary only decides whether we ADVANCE to a next
  // sentence (handled in setAudioTime), never how long one sentence plays, so
  // the last sentence of a framed region must NOT stretch to the track end.
  const getSentenceTimes = (index: number): { start: number; end: number } | null => {
    const ls = linesRef.current;
    const line = ls[index];
    if (!line) return null;
    const start = line.time;
    const next = ls[index + 1];
    const end = next ? next.time : (durationRef.current || Infinity);
    return { start, end };
  };

  // Resolve a region (line indices) into concrete [start, end) times.
  const getRegionTimes = (region: LoopRegion | null): { start: number; end: number } | null => {
    if (!region) return null;
    const ls = linesRef.current;
    const startLine = ls[region.startIndex];
    if (!startLine) return null;
    const start = startLine.time;
    const afterEnd = ls[region.endIndex + 1];
    const end = afterEnd ? afterEnd.time : (durationRef.current || Infinity);
    return { start, end };
  };

  // Persist the per-lesson record `abloop-${id}` = { region, count, loops, sentences }.
  // `region`/`count` are the resumable A-B loop (cleared when no region); `loops`
  // and `sentences` are cumulative practice stats that persist regardless.
  const persistLoop = (region: LoopRegion | null, count: number) => {
    try {
      const loops = practiceLoopsRef.current;
      const sentences = practiceSentencesRef.current;
      // Nothing worth keeping: drop the record entirely (keeps storage clean and
      // keeps this lesson out of the "练过" filter).
      if (!region && loops === 0 && sentences === 0) {
        window.localStorage.removeItem(`abloop-${idRef.current}`);
        return;
      }
      const record: any = { loops, sentences };
      if (region) {
        record.region = region;
        record.count = count;
      }
      window.localStorage.setItem(`abloop-${idRef.current}`, JSON.stringify(record));
    } catch (e) { /* ignore quota / privacy errors */ }
  };

  const clearLoop = () => {
    setLoopRegion(null);
    loopRegionRef.current = null;
    setPendingStart(null);
    pendingStartRef.current = null;
    setLoopCount(0);
    persistLoop(null, 0);
  };

  // Record one completed 区间复读 pass for the current lesson (cumulative).
  const bumpPracticeLoops = () => {
    const next = practiceLoopsRef.current + 1;
    practiceLoopsRef.current = next;
    setPracticeLoops(next);
    persistLoop(loopRegionRef.current, loopCountRefForPersist());
  };

  // Record `n` sentences ground via 逐句精听 for the current lesson (cumulative).
  const bumpPracticeSentences = (n: number) => {
    if (n <= 0) return;
    const next = practiceSentencesRef.current + n;
    practiceSentencesRef.current = next;
    setPracticeSentences(next);
    persistLoop(loopRegionRef.current, loopCountRefForPersist());
  };

  // loopCount lives in state; read the latest via ref-free closure fallback.
  const loopCountRef = useRef(0);
  useEffect(() => { loopCountRef.current = loopCount; }, [loopCount]);
  const loopCountRefForPersist = () => loopCountRef.current;

  useEffect(() => {
    // When ID changes, we need to load the saved time for the NEW ID.
    // The previous ID's progress is saved continuously or on pause, 
    // but strict isolation means we define usage: `progress-${id}`.
    
    // Reset transient state
    setPlaying(false);
    setError(null);
    setLoading(false);
    
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

    // Retrieve saved time just once per ID change
    // We cannot use useLocalStorage hook directly here because the key is dynamic 
    // and hooks cannot be called conditionally or in loops/callbacks easily if the key swaps.
    // Instead, we read localStorage manually for the dynamic ID or rely on the parent to pass valid initial state?
    // Actually, reading localStorage manually in useEffect is safe for this dynamic key behavior.
    
    let savedTime = 0;
    try {
        const saved = window.localStorage.getItem(`progress-${id}`);
        if (saved) savedTime = parseFloat(saved);
        // Safety check: ignore completed or near-completed (e.g. > 95%)? 
        // For listening apps, usually we want to resume unless it was literally finished.
    } catch (e) { console.warn("Failed to read saved progress", e); }

    // Switching lessons dissolves any active loop for the previous lesson, then
    // restores THIS lesson's own persisted region (so it survives a refresh).
    setPendingStart(null);
    pendingStartRef.current = null;
    let restoredRegion: LoopRegion | null = null;
    let restoredCount = 0;
    let restoredLoops = 0;
    let restoredSentences = 0;
    try {
        const rawLoop = window.localStorage.getItem(`abloop-${id}`);
        if (rawLoop) {
            const parsed = JSON.parse(rawLoop);
            if (parsed && parsed.region &&
                typeof parsed.region.startIndex === 'number' &&
                typeof parsed.region.endIndex === 'number') {
                restoredRegion = parsed.region;
                restoredCount = parsed.count || 1;
            }
            if (parsed && typeof parsed.loops === 'number') restoredLoops = parsed.loops;
            if (parsed && typeof parsed.sentences === 'number') restoredSentences = parsed.sentences;
        }
    } catch (e) { console.warn("Failed to read saved loop", e); }
    setLoopRegion(restoredRegion);
    loopRegionRef.current = restoredRegion;
    setLoopCount(restoredCount);
    // Restore cumulative practice stats for this lesson.
    setPracticeLoops(restoredLoops);
    practiceLoopsRef.current = restoredLoops;
    setPracticeSentences(restoredSentences);
    practiceSentencesRef.current = restoredSentences;
    // Intensive mode is a transient toggle; reset it when switching lessons.
    setIntensiveMode(false);
    intensiveModeRef.current = false;
    setIntensiveIndex(null);
    intensiveIndexRef.current = null;
    setCurrentRepeat(0);
    currentRepeatRef.current = 0;

    const setAudioData = () => {
      setDuration(audio.duration);
      durationRef.current = audio.duration;
      setLoading(false);
      // Resume if valid and not finished
      if (savedTime > 0 && savedTime < audio.duration - 2) { 
         audio.currentTime = savedTime;
         setCurrentTime(savedTime);
      }
    };

    const setAudioTime = () => {
      const curr = audio.currentTime;
      setCurrentTime(curr);
      progressRef.current = curr;

      // 逐句精听 takes precedence over plain region looping. It repeats the
      // current sentence `repeatCount` times, then advances to the next sentence
      // within scope (framed region, or whole track). After the last sentence's
      // final repeat it stops.
      if (intensiveModeRef.current) {
        const idx = intensiveIndexRef.current;
        if (idx === null) return;
        const st = getSentenceTimes(idx);
        if (st && curr >= st.end - LOOP_EPSILON) {
          if (currentRepeatRef.current < repeatCountRef.current) {
            // Repeat the same sentence again.
            audio.currentTime = st.start;
            setCurrentTime(st.start);
            setCurrentRepeat((c) => c + 1);
          } else {
            // The current sentence just finished its final repeat: it has been
            // fully "ground", so count it once toward practice stats.
            bumpPracticeSentences(1);
            // Move on to the next sentence within scope, or stop at the end.
            const scope = getScope();
            const nextIdx = idx + 1;
            if (nextIdx <= scope.end) {
              const nextSt = getSentenceTimes(nextIdx);
              setIntensiveIndex(nextIdx);
              intensiveIndexRef.current = nextIdx;
              setCurrentRepeat(1);
              currentRepeatRef.current = 1;
              if (nextSt) {
                audio.currentTime = nextSt.start;
                setCurrentTime(nextSt.start);
              }
            } else {
              // Last sentence finished: stop and arm to replay the scope.
              audio.pause();
              const startSt = getSentenceTimes(scope.start);
              if (startSt && isFinite(startSt.start)) {
                audio.currentTime = startSt.start;
                setCurrentTime(startSt.start);
              }
              setIntensiveIndex(scope.start);
              intensiveIndexRef.current = scope.start;
              setCurrentRepeat(1);
              currentRepeatRef.current = 1;
            }
          }
        }
        return;
      }

      // A-B loop enforcement: when we reach the region end, jump back to the
      // start and advance the "第几遍" counter. This uses the audio element
      // directly (not `seek`) so it never counts as a user "drag out".
      const region = loopRegionRef.current;
      if (region) {
        const t = getRegionTimes(region);
        if (t && curr >= t.end - LOOP_EPSILON) {
          audio.currentTime = t.start;
          setCurrentTime(t.start);
          bumpPracticeLoops(); // one completed 区间复读 pass
          setLoopCount((c) => {
            const next = (c || 0) + 1;
            persistLoop(loopRegionRef.current, next);
            return next;
          });
        }
      }
    };

    const onEnded = () => {
      // In 逐句精听, the track can end while we're still repeating the last
      // sentence (its end == track duration, so setAudioTime's boundary window
      // is often missed and `ended` fires first). Reaching the track end is NOT
      // by itself "the final repeat done": only count the sentence once it has
      // actually played the full `repeatCount` times.
      if (intensiveModeRef.current) {
        const idx = intensiveIndexRef.current;
        if (currentRepeatRef.current < repeatCountRef.current) {
          // Not the final repeat yet: replay this same sentence.
          const st = idx !== null ? getSentenceTimes(idx) : null;
          const startTime = st && isFinite(st.start) ? st.start : 0;
          audio.currentTime = startTime;
          setCurrentTime(startTime);
          const nextRepeat = currentRepeatRef.current + 1;
          currentRepeatRef.current = nextRepeat;
          setCurrentRepeat(nextRepeat);
          audio.play().catch(() => {});
          return;
        }
        // Final repeat completed: now the last sentence is fully ground.
        bumpPracticeSentences(1);
        const scope = getScope();
        const startSt = getSentenceTimes(scope.start);
        if (startSt && isFinite(startSt.start)) {
          audio.currentTime = startSt.start;
          setCurrentTime(startSt.start);
        } else {
          setCurrentTime(0);
        }
        setIntensiveIndex(scope.start);
        intensiveIndexRef.current = scope.start;
        setCurrentRepeat(1);
        currentRepeatRef.current = 1;
        setPlaying(false);
        return;
      }

      // If a loop reaches the very end of the track, keep looping instead of stopping.
      const region = loopRegionRef.current;
      if (region) {
        const t = getRegionTimes(region);
        if (t) {
          audio.currentTime = t.start;
          setCurrentTime(t.start);
          bumpPracticeLoops(); // one completed 区间复读 pass
          setLoopCount((c) => {
            const next = (c || 0) + 1;
            persistLoop(loopRegionRef.current, next);
            return next;
          });
          audio.play().catch(() => {});
          return;
        }
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
      // Cleanup: Save progress for the OLD id before we switch or unmount
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

  // Index of the sentence that contains `time` (clamped to the given scope).
  const findLineIndexAtTime = (time: number): number => {
    const ls = linesRef.current;
    if (ls.length === 0) return 0;
    let idx = 0;
    for (let i = 0; i < ls.length; i++) {
      if (time >= ls[i].time) idx = i;
      else break;
    }
    return idx;
  };

  const seek = (time: number) => {
    const audio = audioRef.current;
    if (!audio || !src || error) return;
    if (audio.readyState === 0) return; 
    
    audio.currentTime = time;
    setCurrentTime(time);

    // In 逐句精听, dragging re-anchors the cursor to the sentence under the new
    // time and restarts its repeat count from one.
    if (intensiveModeRef.current) {
      const scope = getScope();
      let idx = findLineIndexAtTime(time);
      idx = Math.min(Math.max(idx, scope.start), scope.end);
      setIntensiveIndex(idx);
      intensiveIndexRef.current = idx;
      setCurrentRepeat(1);
      currentRepeatRef.current = 1;
      return;
    }

    // Dragging the progress outside the active region dissolves the loop.
    const region = loopRegionRef.current;
    if (region) {
      const t = getRegionTimes(region);
      if (t && (time < t.start - LOOP_EPSILON || time >= t.end)) {
        clearLoop();
      }
    }
  };

  // Report a lyric-line tap; drives the A-B selection state machine.
  const selectLyricLine = (index: number) => {
    const audio = audioRef.current;
    const region = loopRegionRef.current;

    if (region) {
      // Tapping inside the framed region dissolves the loop.
      if (index >= region.startIndex && index <= region.endIndex) {
        clearLoop();
        return;
      }
      // Tapping elsewhere starts a fresh selection.
      setLoopRegion(null);
      loopRegionRef.current = null;
      setLoopCount(0);
      persistLoop(null, 0);
      setPendingStart(index);
      pendingStartRef.current = index;
      return;
    }

    const pending = pendingStartRef.current;
    if (pending === null) {
      // First tap: arm the start point.
      setPendingStart(index);
      pendingStartRef.current = index;
      return;
    }

    // Tapping the same line again cancels the pending start.
    if (pending === index) {
      setPendingStart(null);
      pendingStartRef.current = null;
      return;
    }

    // Second tap: form the region (auto-order start <= end).
    const startIndex = Math.min(pending, index);
    const endIndex = Math.max(pending, index);
    const newRegion: LoopRegion = { startIndex, endIndex };
    setPendingStart(null);
    pendingStartRef.current = null;
    setLoopRegion(newRegion);
    loopRegionRef.current = newRegion;
    setLoopCount(1);
    persistLoop(newRegion, 1);

    // Jump to the region start and begin repeating.
    const t = getRegionTimes(newRegion);
    if (audio && t && isFinite(t.start)) {
      audio.currentTime = t.start;
      setCurrentTime(t.start);
      if (!error) audio.play().catch(() => {});
    }

    // If 逐句精听 is on, re-anchor the per-sentence cursor to the new scope start.
    if (intensiveModeRef.current) {
      setIntensiveIndex(startIndex);
      intensiveIndexRef.current = startIndex;
      setCurrentRepeat(1);
      currentRepeatRef.current = 1;
    }
  };

  const changeVolume = (val: number) => {
      const clamped = Math.max(0, Math.min(1, val));
      setVolume(clamped);
  };

  // --- 逐句精听 controls (display components only report toggles/settings) ---

  // Turn intensive listening on/off. Enabling anchors to the sentence currently
  // playing (clamped into the active scope) and starts repeating it.
  const toggleIntensiveMode = () => {
    const audio = audioRef.current;
    const turningOn = !intensiveModeRef.current;
    setIntensiveMode(turningOn);
    intensiveModeRef.current = turningOn;

    if (turningOn) {
      const scope = getScope();
      let idx = findLineIndexAtTime(currentTime);
      idx = Math.min(Math.max(idx, scope.start), scope.end);
      setIntensiveIndex(idx);
      intensiveIndexRef.current = idx;
      setCurrentRepeat(1);
      currentRepeatRef.current = 1;
      // Snap to the sentence start so the first repeat plays it in full.
      const st = getSentenceTimes(idx);
      if (audio && st && isFinite(st.start)) {
        audio.currentTime = st.start;
        setCurrentTime(st.start);
      }
    } else {
      setIntensiveIndex(null);
      intensiveIndexRef.current = null;
      setCurrentRepeat(0);
      currentRepeatRef.current = 0;
    }
  };

  // Set how many times each sentence repeats (persisted). Clamped to >= 1.
  const changeRepeatCount = (val: number) => {
    const clamped = Math.max(1, Math.floor(val) || 1);
    setRepeatCount(clamped);
    repeatCountRef.current = clamped;
    // If the current sentence has already exceeded the new target, it will
    // advance on the next boundary; nothing else to do here.
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
    // A-B loop (区间复读)
    loopRegion,
    pendingStart,
    loopCount,
    selectLyricLine,
    clearLoop,
    // 逐句精听 (per-sentence intensive listening)
    intensiveMode,
    intensiveIndex,
    currentRepeat,
    repeatCount,
    toggleIntensiveMode,
    changeRepeatCount,
    // Cumulative practice stats (练习痕迹) for the current lesson
    practiceLoops,
    practiceSentences,
  };
};
