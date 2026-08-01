import { useState, useRef, useEffect, useCallback } from 'react';
import { useLocalStorage } from './useLocalStorage';

interface UseAudioProps {
  src: string;
  id: string; // Used for persistence key
}

interface LoopState {
  start: number | null;
  end: number | null;
  count: number;
  // Cumulative practice stats (persisted per-lesson, survive loop clearing)
  totalLoopCount: number;   // total A-B loop repetitions completed across sessions
  totalSentences: number;   // total sentences polished via sentence-by-sentence mode
}

export interface LrcLineLike {
  time: number;
  text: string;
}

const EMPTY_LOOP: LoopState = { start: null, end: null, count: 0, totalLoopCount: 0, totalSentences: 0 };

export const PRACTICE_STATS_EVENT = 'practice-stats-changed';

export const useAudio = ({ src, id }: UseAudioProps) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  
  // Persist Volume (Global)
  const [volume, setVolume] = useLocalStorage<number>('audio-volume', 1.0);

  // Persist sentence-by-sentence intensive listening settings (Global)
  const [sentenceLoop, setSentenceLoop] = useLocalStorage<boolean>('audio-sentence-loop', false);
  const [sentenceReps, setSentenceReps] = useLocalStorage<number>('audio-sentence-reps', 3);

  // Live sentence-loop tracking (not persisted; recomputed per session)
  const [sentenceCount, setSentenceCount] = useState(0); // how many times current sentence has played

  // Ref to latest lyric lines so event listeners always see current data
  const linesRef = useRef<LrcLineLike[]>([]);

  // Persist per-lesson loop state (start, end, count)
  const [loop, setLoop] = useState<LoopState>(EMPTY_LOOP);

  // Refs mirroring loop state for use inside timeupdate/ended event listeners
  const loopStartRef = useRef<number | null>(null);
  const loopEndRef = useRef<number | null>(null);
  const loopCountRef = useRef(0);

  // Cumulative practice stats refs (survive loop clearing, persist in localStorage)
  const totalLoopCountRef = useRef(0);
  const totalSentencesRef = useRef(0);

  // Refs mirroring sentence-loop state for event listeners
  const sentenceLoopRef = useRef(sentenceLoop);
  const sentenceRepsRef = useRef(sentenceReps);
  const sentenceCountRef = useRef(0);

  // Ref to distinguish initial mount from lesson switch
  const isFirstLoadRef = useRef(true);

  useEffect(() => { loopStartRef.current = loop.start; }, [loop.start]);
  useEffect(() => { loopEndRef.current = loop.end; }, [loop.end]);
  useEffect(() => { loopCountRef.current = loop.count; }, [loop.count]);
  useEffect(() => { totalLoopCountRef.current = loop.totalLoopCount; }, [loop.totalLoopCount]);
  useEffect(() => { totalSentencesRef.current = loop.totalSentences; }, [loop.totalSentences]);
  useEffect(() => { sentenceLoopRef.current = sentenceLoop; }, [sentenceLoop]);
  useEffect(() => { sentenceRepsRef.current = sentenceReps; }, [sentenceReps]);
  useEffect(() => { sentenceCountRef.current = sentenceCount; }, [sentenceCount]);

  // Ref to track if we need to save progress when ID changes
  const progressRef = useRef(0);

  useEffect(() => {
    // When ID changes, we need to load the saved time for the NEW ID.
    // The previous ID's progress is saved continuously or on pause, 
    // but strict isolation means we define usage: `progress-${id}`.
    
    // Reset transient state
    setPlaying(false);
    setError(null);
    setLoading(false);

    // On lesson switch (not initial mount), clear loop state.
    // On initial mount / refresh, loop state is restored from localStorage below.
    if (!isFirstLoadRef.current) {
        setLoop(EMPTY_LOOP);
        loopStartRef.current = null;
        loopEndRef.current = null;
        loopCountRef.current = 0;
        sentenceCountRef.current = 0;
        setSentenceCount(0);
    }
    isFirstLoadRef.current = false;
    
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

    // Restore loop state for this lesson (after refresh)
    try {
        const savedLoop = window.localStorage.getItem(`loop-${id}`);
        if (savedLoop) {
            const parsed = JSON.parse(savedLoop);
            if (parsed && typeof parsed === 'object' &&
                (parsed.start === null || typeof parsed.start === 'number') &&
                (parsed.end === null || typeof parsed.end === 'number')) {
                const restored: LoopState = {
                    start: parsed.start,
                    end: parsed.end,
                    count: typeof parsed.count === 'number' ? parsed.count : 0,
                    totalLoopCount: typeof parsed.totalLoopCount === 'number' ? parsed.totalLoopCount : 0,
                    totalSentences: typeof parsed.totalSentences === 'number' ? parsed.totalSentences : 0,
                };
                setLoop(restored);
                loopStartRef.current = restored.start;
                loopEndRef.current = restored.end;
                loopCountRef.current = restored.count;
                totalLoopCountRef.current = restored.totalLoopCount;
                totalSentencesRef.current = restored.totalSentences;
            }
        }
    } catch (e) { console.warn("Failed to read saved loop state", e); }

    const setAudioData = () => {
      setDuration(audio.duration);
      setLoading(false);
      // Resume if valid and not finished
      if (savedTime > 0 && savedTime < audio.duration - 2) { 
         audio.currentTime = savedTime;
         setCurrentTime(savedTime);
      }
    };

    // Determine the effective sentence range given current A-B loop bounds.
    // Returns the indices of lyric lines that fall within [loopStart, loopEnd)
    // (or the entire track if no A-B loop is active).
    const getSentenceRange = (): { startIdx: number; endIdx: number } => {
      const lines = linesRef.current;
      const ls = loopStartRef.current;
      const le = loopEndRef.current;
      if (lines.length === 0) return { startIdx: -1, endIdx: -1 };

      if (ls === null || le === null) {
        return { startIdx: 0, endIdx: lines.length - 1 };
      }

      // Find first line whose time >= loop start
      let startIdx = lines.findIndex(l => l.time >= ls);
      if (startIdx === -1) startIdx = 0;
      // Find last line whose time < loop end
      let endIdx = -1;
      for (let i = lines.length - 1; i >= 0; i--) {
        if (lines[i].time < le) { endIdx = i; break; }
      }
      if (endIdx === -1 || endIdx < startIdx) endIdx = startIdx;
      return { startIdx, endIdx };
    };

    // Get the end time (in seconds) of a given lyric line index.
    // For the last line it falls back to the A-B loop end, audio duration, or 0.
    const getLineEndTime = (idx: number): number => {
      const lines = linesRef.current;
      if (idx < 0 || idx >= lines.length) return 0;
      const next = lines[idx + 1];
      if (next) return next.time;
      const le = loopEndRef.current;
      if (le !== null) return le;
      return audio.duration || 0;
    };

    // Persist the full loop state (including cumulative stats) and notify listeners.
    const saveLoopState = (state: {
      start: number | null;
      end: number | null;
      count: number;
      totalLoopCount: number;
      totalSentences: number;
    }) => {
      try {
        if (state.start === null && state.end === null &&
            state.totalLoopCount === 0 && state.totalSentences === 0) {
          window.localStorage.removeItem(`loop-${id}`);
        } else {
          window.localStorage.setItem(`loop-${id}`, JSON.stringify(state));
        }
      } catch (e) {}
      try { window.dispatchEvent(new Event(PRACTICE_STATS_EVENT)); } catch (e) {}
    };

    // Bump cumulative A-B loop count by one and persist.
    const bumpLoopCount = (ls: number, le: number, newCount: number) => {
      const total = totalLoopCountRef.current + 1;
      totalLoopCountRef.current = total;
      loopCountRef.current = newCount;
      setLoop(prev => ({ ...prev, count: newCount, totalLoopCount: total }));
      saveLoopState({ start: ls, end: le, count: newCount, totalLoopCount: total, totalSentences: totalSentencesRef.current });
    };

    // Bump cumulative polished-sentence count by one and persist.
    const bumpSentenceStat = () => {
      const total = totalSentencesRef.current + 1;
      totalSentencesRef.current = total;
      setLoop(prev => ({ ...prev, totalSentences: total }));
      saveLoopState({
        start: loopStartRef.current,
        end: loopEndRef.current,
        count: loopCountRef.current,
        totalLoopCount: totalLoopCountRef.current,
        totalSentences: total,
      });
    };

    const setAudioTime = () => {
      const curr = audio.currentTime;
      const ls = loopStartRef.current;
      const le = loopEndRef.current;
      const sl = sentenceLoopRef.current;
      const reps = Math.max(1, sentenceRepsRef.current);

      // --- Sentence-by-sentence intensive listening ---
      // When enabled, it takes precedence over the continuous A-B wrap behavior.
      // If an A-B loop is also set, sentences are constrained to that range.
      if (sl) {
        const lines = linesRef.current;
        if (lines.length > 0) {
          const { startIdx, endIdx } = getSentenceRange();
          if (startIdx !== -1) {
            // Find current sentence (within the effective range)
            let curIdx = -1;
            for (let i = endIdx; i >= startIdx; i--) {
              if (curr >= lines[i].time - 0.05) { curIdx = i; break; }
            }
            // If before the first sentence, snap to first
            if (curIdx === -1 && curr < lines[startIdx].time) {
              curIdx = startIdx;
            }
            if (curIdx !== -1) {
              let lineEnd = getLineEndTime(curIdx);
              // Clamp line end to A-B loop end if applicable
              if (le !== null && lineEnd > le) lineEnd = le;

              if (curr >= lineEnd) {
                const played = sentenceCountRef.current + 1;
                if (played < reps && curIdx < endIdx) {
                  // More reps remain for this sentence — but if there is a next
                  // sentence within range, we still repeat current sentence.
                  // Actually: repeat current sentence until reps exhausted, then advance.
                  sentenceCountRef.current = played;
                  setSentenceCount(played);
                  audio.currentTime = lines[curIdx].time;
                  setCurrentTime(lines[curIdx].time);
                  progressRef.current = lines[curIdx].time;
                  return;
                } else if (played < reps && curIdx === endIdx) {
                  // Last sentence in range but more reps remaining → repeat it
                  sentenceCountRef.current = played;
                  setSentenceCount(played);
                  audio.currentTime = lines[curIdx].time;
                  setCurrentTime(lines[curIdx].time);
                  progressRef.current = lines[curIdx].time;
                  return;
                } else {
                  // Reps exhausted for this sentence — count it as polished
                  bumpSentenceStat();
                  if (curIdx < endIdx) {
                    // Advance to next sentence, reset counter
                    const nextIdx = curIdx + 1;
                    sentenceCountRef.current = 0;
                    setSentenceCount(0);
                    audio.currentTime = lines[nextIdx].time;
                    setCurrentTime(lines[nextIdx].time);
                    progressRef.current = lines[nextIdx].time;
                    return;
                  } else {
                    // Last sentence finished — stop playback
                    sentenceCountRef.current = 0;
                    setSentenceCount(0);
                    audio.pause();
                    // Keep currentTime at the end of the last line so user sees where it stopped
                    setCurrentTime(curr);
                    progressRef.current = curr;
                    return;
                  }
                }
              }
            }
          }
        }
      }

      // A-B loop: if playback reaches/passes the end, wrap back to start
      // (only when sentence-by-sentence mode is not active, since it handles its own boundaries)
      if (!sl && ls !== null && le !== null && curr >= le) {
        const newCount = loopCountRef.current + 1;
        bumpLoopCount(ls, le, newCount);
        audio.currentTime = ls;
        setCurrentTime(ls);
        progressRef.current = ls;
        return;
      }

      setCurrentTime(curr);
      progressRef.current = curr;
    };

    const onEnded = () => {
      const sl = sentenceLoopRef.current;
      const reps = Math.max(1, sentenceRepsRef.current);

      // Sentence-by-sentence mode: handle last sentence repetition at natural end
      if (sl) {
        const lines = linesRef.current;
        const { endIdx } = getSentenceRange();
        if (lines.length > 0 && endIdx !== -1) {
          const played = sentenceCountRef.current + 1;
          if (played < reps) {
            // Repeat last sentence
            sentenceCountRef.current = played;
            setSentenceCount(played);
            audio.currentTime = lines[endIdx].time;
            setCurrentTime(lines[endIdx].time);
            audio.play().catch(() => {});
            return;
          }
          // Finished all reps of last sentence — count it as polished and stop
          bumpSentenceStat();
          sentenceCountRef.current = 0;
          setSentenceCount(0);
        }
        setPlaying(false);
        try { window.localStorage.removeItem(`progress-${id}`); } catch (e) {}
        return;
      }

      const ls = loopStartRef.current;
      const le = loopEndRef.current;

      // If A-B loop is active, restart from loop start instead of ending
      if (ls !== null && le !== null) {
        const newCount = loopCountRef.current + 1;
        bumpLoopCount(ls, le, newCount);
        audio.currentTime = ls;
        setCurrentTime(ls);
        audio.play().catch(() => {});
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

  const seek = (time: number) => {
    const audio = audioRef.current;
    if (!audio || !src || error) return;
    if (audio.readyState === 0) return; 

    audio.currentTime = time;
    setCurrentTime(time);

    // User seeked → reset current sentence repeat counter
    sentenceCountRef.current = 0;
    setSentenceCount(0);

    // If user seeks outside the active A-B loop range, clear the loop
    const ls = loopStartRef.current;
    const le = loopEndRef.current;
    if (ls !== null && le !== null && (time < ls || time >= le)) {
      clearLoop();
    }
  };

  const changeVolume = (val: number) => {
      const clamped = Math.max(0, Math.min(1, val));
      setVolume(clamped);
  };

  // Called by the parent when lyric lines are loaded/changed, so the playback
  // layer can compute sentence boundaries for intensive listening.
  // Wrapped in useCallback so the parent's useEffect doesn't re-run on every
  // render (which would reset the sentence counter mid-playback).
  const setLyricLines = useCallback((lines: LrcLineLike[]) => {
    linesRef.current = lines || [];
    sentenceCountRef.current = 0;
    setSentenceCount(0);
  }, []);

  const toggleSentenceLoop = () => {
    setSentenceLoop(prev => {
      const next = !prev;
      sentenceLoopRef.current = next;
      if (next) {
        // Reset counter when switching on; the timeupdate handler will pick up
        // the current sentence naturally as playback continues.
        sentenceCountRef.current = 0;
        setSentenceCount(0);
      }
      return next;
    });
  };

  const changeSentenceReps = (val: number) => {
    const clamped = Math.max(1, Math.min(20, Math.round(val)));
    setSentenceReps(clamped);
    sentenceRepsRef.current = clamped;
  };

  const persistLoop = (start: number | null, end: number | null, count: number) => {
    try {
      if (start === null && end === null &&
          totalLoopCountRef.current === 0 && totalSentencesRef.current === 0) {
        window.localStorage.removeItem(`loop-${id}`);
      } else {
        window.localStorage.setItem(`loop-${id}`, JSON.stringify({
          start, end, count,
          totalLoopCount: totalLoopCountRef.current,
          totalSentences: totalSentencesRef.current,
        }));
      }
    } catch (e) {}
  };

  const clearLoop = () => {
    loopStartRef.current = null;
    loopEndRef.current = null;
    loopCountRef.current = 0;
    // Preserve cumulative practice stats; only clear active A-B selection
    setLoop(prev => ({ ...EMPTY_LOOP, totalLoopCount: prev.totalLoopCount, totalSentences: prev.totalSentences }));
    persistLoop(null, null, 0);
  };

  // Called by the Lyrics component when a lyric line is clicked.
  // `time` = start time of the clicked line.
  // `nextLineTime` = start time of the line after it (or duration if it's the last line).
  // All loop state logic stays here in the playback management layer.
  const handleLyricClick = (time: number, nextLineTime: number) => {
    const audio = audioRef.current;
    if (!audio || !src || error) return;

    const ls = loopStartRef.current;
    const le = loopEndRef.current;

    // If a complete loop is active and user clicks inside the looped range, clear it
    if (ls !== null && le !== null && time >= ls && time < le) {
      clearLoop();
      return;
    }

    if (ls === null) {
      // Set start point; end point not yet chosen
      loopStartRef.current = time;
      loopEndRef.current = null;
      loopCountRef.current = 0;
      setLoop(prev => ({ start: time, end: null, count: 0, totalLoopCount: prev.totalLoopCount, totalSentences: prev.totalSentences }));
      persistLoop(time, null, 0);
    } else if (le === null) {
      // Set end point (the next line's start time, or audio duration for last line)
      let endTime = nextLineTime;
      // If user clicked a line before the start, reset: use this click as new start
      if (time < ls) {
        loopStartRef.current = time;
        loopEndRef.current = null;
        loopCountRef.current = 0;
        setLoop(prev => ({ start: time, end: null, count: 0, totalLoopCount: prev.totalLoopCount, totalSentences: prev.totalSentences }));
        persistLoop(time, null, 0);
        return;
      }
      // Prevent zero-width loop (same line) — just treat as a new start
      if (endTime <= ls) {
        endTime = audio.duration || endTime;
      }
      loopEndRef.current = endTime;
      loopCountRef.current = 1;
      setLoop(prev => ({ start: ls, end: endTime, count: 1, totalLoopCount: prev.totalLoopCount, totalSentences: prev.totalSentences }));
      persistLoop(ls, endTime, 1);

      // Seek to loop start so the looped section begins playing
      audio.currentTime = ls;
      setCurrentTime(ls);
    } else {
      // Loop already complete and click was outside range → start fresh with new start
      loopStartRef.current = time;
      loopEndRef.current = null;
      loopCountRef.current = 0;
      setLoop(prev => ({ start: time, end: null, count: 0, totalLoopCount: prev.totalLoopCount, totalSentences: prev.totalSentences }));
      persistLoop(time, null, 0);
    }
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
    loop,
    handleLyricClick,
    clearLoop,
    sentenceLoop,
    sentenceReps,
    sentenceCount,
    toggleSentenceLoop,
    changeSentenceReps,
    setLyricLines,
  };
};
