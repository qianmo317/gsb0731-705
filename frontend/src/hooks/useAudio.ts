import { useState, useRef, useEffect } from 'react';
import { useLocalStorage } from './useLocalStorage';
import { LrcLine } from '../utils/lrcParser';

interface UseAudioProps {
  src: string;
  id: string; // Used for persistence key
  lyrics?: LrcLine[]; // Sentence boundaries for sentence-by-sentence mode
}

export interface LoopRange {
  start: number;
  end: number;
}

export interface PracticeStats {
  loops: number;      // completed A-B loop passes
  sentences: number;  // sentences ground through sentence-by-sentence mode
}

// Practice traces live inside the existing `loop-${id}` record as a `stats`
// field — same storage, same key, older records without it simply read as 0.
export const readPracticeStats = (lessonId: string): PracticeStats => {
  try {
    const raw = window.localStorage.getItem(`loop-${lessonId}`);
    if (!raw) return { loops: 0, sentences: 0 };
    const st = JSON.parse(raw)?.stats;
    return {
      loops: typeof st?.loops === 'number' && st.loops > 0 ? st.loops : 0,
      sentences: typeof st?.sentences === 'number' && st.sentences > 0 ? st.sentences : 0,
    };
  } catch (e) {
    return { loops: 0, sentences: 0 };
  }
};

export const useAudio = ({ src, id, lyrics = [] }: UseAudioProps) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Sentence-by-sentence mode (逐句精听). Repeat count persisted globally
  // like volume; the toggle itself is in-memory only.
  const [sentenceMode, setSentenceMode] = useState(false);
  const [sentenceRepeat, setSentenceRepeat] = useLocalStorage<number>('sentence-repeat-count', 3);
  const [sentencePass, setSentencePass] = useState(1);
  const lyricsRef = useRef<LrcLine[]>(lyrics);
  const sentenceModeRef = useRef(sentenceMode);
  const sentenceRepeatRef = useRef(sentenceRepeat);
  const sentenceIdxRef = useRef(-1);
  const sentencePassRef = useRef(1);
  // True after the last in-scope sentence finished its final pass and playback stopped
  const sentenceDoneRef = useRef(false);

  // A-B loop state (persisted per lesson as `loop-${id}`)
  const [loopRange, setLoopRange] = useState<LoopRange | null>(null);
  const [loopCount, setLoopCount] = useState(1);
  // First lyric tap: pending start line (its own [start, end) span), waiting for the end tap
  const [pendingLoopLine, setPendingLoopLine] = useState<LoopRange | null>(null);
  const loopRangeRef = useRef<LoopRange | null>(null);
  const loopCountRef = useRef(1);

  // Cumulative practice traces, stored on the same `loop-${id}` record
  const [practiceStats, setPracticeStats] = useState<PracticeStats>({ loops: 0, sentences: 0 });
  const statsRef = useRef<PracticeStats>({ loops: 0, sentences: 0 });

  // Single writer for the `loop-${id}` record: range fields + stats field.
  // Removes the key entirely when there is nothing worth keeping.
  const saveRecord = () => {
    try {
      const key = `loop-${id}`;
      const rec: Record<string, unknown> = {};
      const range = loopRangeRef.current;
      if (range) {
        rec.start = range.start;
        rec.end = range.end;
        rec.count = loopCountRef.current;
      }
      const st = statsRef.current;
      if (st.loops > 0 || st.sentences > 0) {
        rec.stats = { loops: st.loops, sentences: st.sentences };
      }
      if (Object.keys(rec).length > 0) {
        window.localStorage.setItem(key, JSON.stringify(rec));
      } else {
        window.localStorage.removeItem(key);
      }
    } catch (e) {}
  };

  const bumpLoopPass = () => {
    statsRef.current = { ...statsRef.current, loops: statsRef.current.loops + 1 };
    setPracticeStats(statsRef.current);
    saveRecord();
  };

  const bumpSentenceGround = () => {
    statsRef.current = { ...statsRef.current, sentences: statsRef.current.sentences + 1 };
    setPracticeStats(statsRef.current);
    saveRecord();
  };

  const applyLoop = (range: LoopRange | null, count = 1) => {
    loopRangeRef.current = range;
    loopCountRef.current = count;
    setLoopRange(range);
    setLoopCount(count);
    saveRecord();
    // Scope changed: restart the sentence walk counting
    sentenceIdxRef.current = -1;
    sentencePassRef.current = 1;
    sentenceDoneRef.current = false;
    setSentencePass(1);
  };

  const clearLoop = () => {
    applyLoop(null, 1);
    setPendingLoopLine(null);
  };

  // Called when a lyric line is tapped. lineStart/lineEnd define that line's time span.
  const handleLoopLineClick = (lineStart: number, lineEnd: number) => {
    const loop = loopRangeRef.current;
    // Tap inside the framed range: release the loop
    if (loop && lineStart >= loop.start && lineStart < loop.end) {
      clearLoop();
      return;
    }
    // First tap: mark pending start
    if (!pendingLoopLine) {
      setPendingLoopLine({ start: lineStart, end: lineEnd });
      return;
    }
    // Second tap: frame the range (works regardless of tap order)
    const start = Math.min(pendingLoopLine.start, lineStart);
    const end = Math.max(pendingLoopLine.end, lineEnd);
    setPendingLoopLine(null);
    applyLoop({ start, end }, 1);
  };

  // Sentences covered by the sentence walk: the framed range if any, else the whole track
  const getScopeSentences = (): LrcLine[] => {
    const loop = loopRangeRef.current;
    if (!loop) return lyricsRef.current;
    return lyricsRef.current.filter((l) => l.time >= loop.start && l.time < loop.end);
  };

  // Keep refs fresh for the audio event handlers (registered once per lesson)
  useEffect(() => { lyricsRef.current = lyrics; }, [lyrics]);
  useEffect(() => { sentenceRepeatRef.current = sentenceRepeat; }, [sentenceRepeat]);
  useEffect(() => {
    sentenceModeRef.current = sentenceMode;
    // Restart counting whenever the mode is toggled
    sentenceIdxRef.current = -1;
    sentencePassRef.current = 1;
    sentenceDoneRef.current = false;
    setSentencePass(1);
  }, [sentenceMode]);

  const toggleSentenceMode = () => setSentenceMode((v) => !v);

  const changeSentenceRepeat = (val: number) => {
    const clamped = Math.max(1, Math.min(10, Math.round(val)));
    setSentenceRepeat(clamped);
  };
  
  // Persist Volume (Global)
  const [volume, setVolume] = useLocalStorage<number>('audio-volume', 1.0);
  
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

    // Restore persisted loop for this lesson (switching lessons naturally
    // deactivates the previous loop since state is keyed by id)
    setPendingLoopLine(null);
    let restoredLoop: LoopRange | null = null;
    let restoredCount = 1;
    let restoredStats: PracticeStats = { loops: 0, sentences: 0 };
    try {
        const raw = window.localStorage.getItem(`loop-${id}`);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed.start === 'number' && typeof parsed.end === 'number' && parsed.end > parsed.start) {
                restoredLoop = { start: parsed.start, end: parsed.end };
                if (typeof parsed.count === 'number' && parsed.count > 0) restoredCount = parsed.count;
            }
            const st = parsed?.stats;
            if (st) {
                restoredStats = {
                    loops: typeof st.loops === 'number' && st.loops > 0 ? st.loops : 0,
                    sentences: typeof st.sentences === 'number' && st.sentences > 0 ? st.sentences : 0,
                };
            }
        }
    } catch (e) {}
    loopRangeRef.current = restoredLoop;
    loopCountRef.current = restoredCount;
    setLoopRange(restoredLoop);
    setLoopCount(restoredCount);
    statsRef.current = restoredStats;
    setPracticeStats(restoredStats);
    // New lesson: restart the sentence walk
    sentenceIdxRef.current = -1;
    sentencePassRef.current = 1;
    sentenceDoneRef.current = false;
    setSentencePass(1);

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

    const setAudioData = () => {
      setDuration(audio.duration);
      setLoading(false);
      // Resume if valid and not finished
      if (savedTime > 0 && savedTime < audio.duration - 2) { 
         audio.currentTime = savedTime;
         setCurrentTime(savedTime);
      }
    };

    // Jump back to the loop start and bump the persisted pass counter.
    // Bypasses seek() on purpose: rewinding inside the range must not clear the loop.
    const loopBack = () => {
      const loop = loopRangeRef.current;
      if (!loop) return;
      audio.currentTime = loop.start;
      setCurrentTime(loop.start);
      loopCountRef.current += 1;
      setLoopCount(loopCountRef.current);
      bumpLoopPass(); // also persists the record
    };

    const setAudioTime = () => {
      const curr = audio.currentTime;
      const loop = loopRangeRef.current;
      const scopeSents = sentenceModeRef.current ? getScopeSentences() : [];

      if (scopeSents.length > 0) {
        // Sentence-by-sentence mode: repeat each sentence N passes, then roll on.
        // Note: the moment the playhead crosses a sentence end it already belongs
        // to the NEXT sentence, so a finished pass is detected via posIdx > idx
        // (or, for the last in-scope sentence, curr crossing the scope end).
        let posIdx = -1;
        for (let i = 0; i < scopeSents.length; i++) {
          if (curr >= scopeSents[i].time - 0.01) posIdx = i;
        }
        if (posIdx >= 0) {
          if (sentenceIdxRef.current === -1) {
            // (Re)start counting from the sentence under the playhead
            sentenceIdxRef.current = posIdx;
            sentencePassRef.current = 1;
            setSentencePass(1);
          }
          const idx = sentenceIdxRef.current;
          const sentEnd = idx + 1 < scopeSents.length
            ? scopeSents[idx + 1].time
            : (loop ? loop.end : audio.duration);

          if (sentenceDoneRef.current) {
            // Stopped after the final pass: idle until the user moves the
            // playhead back inside (seek() also clears the flag)
            if (curr < sentEnd - 0.3) {
              sentenceDoneRef.current = false;
              sentencePassRef.current = 1;
              setSentencePass(1);
            }
            setCurrentTime(curr);
            return;
          }

          const crossedEnd = posIdx > idx || (posIdx === idx && curr >= sentEnd && curr < sentEnd + 2);
          if (crossedEnd) {
            const target = Math.max(1, sentenceRepeatRef.current);
            if (sentencePassRef.current < target) {
              // Rewind to the sentence start for the next pass
              sentencePassRef.current += 1;
              setSentencePass(sentencePassRef.current);
              audio.currentTime = scopeSents[idx].time;
              setCurrentTime(scopeSents[idx].time);
              return;
            }
            if (idx === scopeSents.length - 1) {
              // Last sentence in scope finished its final pass: stop here
              bumpSentenceGround();
              sentenceDoneRef.current = true;
              audio.pause();
              setCurrentTime(curr);
              return;
            }
            // Passes done: adopt the sentence under the playhead, count fresh
            bumpSentenceGround();
            sentenceIdxRef.current = posIdx;
            sentencePassRef.current = 1;
            setSentencePass(1);
          }
        }
      } else if (loop && curr >= loop.end && curr < loop.end + 2) {
        // Reached the loop end: rewind. The +2s window avoids hijacking playback
        // when the current position is legitimately outside the range.
        loopBack();
        return;
      }
      setCurrentTime(curr);
      progressRef.current = curr;
      
      // Save periodically (e.g. every 2 seconds is handled by the UI/event loop naturally via timeupdate)
      // Writing to localStorage on every frame (timeupdate fires frequently) is bad. 
      // Let's debounce or just save on pause/destruct. 
      // Actually, standard practice for simple apps: save on pause/unmount is better for performance, 
      // but riskier if crash. Let's do a simple check to save every ~5s or just on pause.
      // For this app, let's stick to saving on UNMOUNT or ID CHANGE (cleanup) + PAUSE.
    };

    const onEnded = () => {
      const loop = loopRangeRef.current;
      const scopeSents = sentenceModeRef.current ? getScopeSentences() : [];
      if (scopeSents.length > 0) {
        // Sentence mode with the last in-scope sentence running to the file end
        const target = Math.max(1, sentenceRepeatRef.current);
        if (sentencePassRef.current < target) {
          sentencePassRef.current += 1;
          setSentencePass(sentencePassRef.current);
          audio.currentTime = scopeSents[scopeSents.length - 1].time;
          audio.play().catch(() => {});
          return;
        }
        // Final pass done: stop. Reset the walk so replaying starts fresh.
        bumpSentenceGround();
        sentenceIdxRef.current = -1;
        sentencePassRef.current = 1;
        sentenceDoneRef.current = true;
        setSentencePass(1);
      } else if (loop && loop.end >= audio.duration - 0.5) {
        // Loop runs to the end of the file (last lyric line as end point):
        // 'ended' fires before timeupdate crosses loop.end, so rewind here.
        loopBack();
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
      
      // Switching lessons releases the loop for good: strip the range fields
      // from the record. Practice stats stay — they are only removed when the
      // lesson itself is deleted. Refresh never runs this cleanup (full page
      // unload), so same-lesson reload still restores the range.
      try {
         const raw = window.localStorage.getItem(`loop-${id}`);
         if (raw) {
            const rec = JSON.parse(raw);
            const st = rec?.stats;
            if (st && (st.loops > 0 || st.sentences > 0)) {
               window.localStorage.setItem(`loop-${id}`, JSON.stringify({ stats: { loops: st.loops || 0, sentences: st.sentences || 0 } }));
            } else {
               window.localStorage.removeItem(`loop-${id}`);
            }
         }
      } catch (e) {}
      loopRangeRef.current = null;

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
      // Sentence walk finished earlier: replay starts from the sentence start
      if (sentenceDoneRef.current && sentenceModeRef.current) {
        const sents = getScopeSentences();
        const idx = sentenceIdxRef.current;
        if (idx >= 0 && sents[idx]) {
          audio.currentTime = sents[idx].time;
          setCurrentTime(sents[idx].time);
        }
        sentenceIdxRef.current = -1;
        sentencePassRef.current = 1;
        sentenceDoneRef.current = false;
        setSentencePass(1);
      }
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

    // Dragging the progress outside the framed range releases the loop
    const loop = loopRangeRef.current;
    if (loop && (time < loop.start || time >= loop.end)) {
      clearLoop();
    }

    // Manual seek: recount the sentence under the new position
    sentenceIdxRef.current = -1;
    sentencePassRef.current = 1;
    sentenceDoneRef.current = false;
    setSentencePass(1);

    audio.currentTime = time;
    setCurrentTime(time);
  };

  const changeVolume = (val: number) => {
      const clamped = Math.max(0, Math.min(1, val));
      setVolume(clamped);
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
    loopRange,
    loopCount,
    pendingLoopStart: pendingLoopLine ? pendingLoopLine.start : null,
    handleLoopLineClick,
    clearLoop,
    sentenceMode,
    sentenceRepeat,
    sentencePass,
    toggleSentenceMode,
    changeSentenceRepeat,
    practiceStats,
  };
};
