import React, { useEffect, useRef } from 'react';
import { LrcLine } from '../utils/lrcParser';
import { RepeatRange } from '../hooks/useAudio';

interface LyricsProps {
  lines: LrcLine[];
  currentTime: number;
  repeatRange: RepeatRange | null;
  repeatCount: number;
  repeatStartIndex: number | null;
  onLineClick: (index: number) => void;
  sentenceRepeat?: boolean;
  sentenceIteration?: number;
  sentenceRepeatCount?: number;
}

export const Lyrics: React.FC<LyricsProps> = ({
  lines,
  currentTime,
  repeatRange,
  repeatCount,
  repeatStartIndex,
  onLineClick,
  sentenceRepeat = false,
  sentenceIteration = 1,
  sentenceRepeatCount = 3,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeIndex = lines.findIndex((line, index) => {
    const nextLine = lines[index + 1];
    return currentTime >= line.time && (!nextLine || currentTime < nextLine.time);
  });

  const isInRange = (index: number) => {
    if (!repeatRange) return false;
    const t = lines[index].time;
    return t >= repeatRange.startTime && t < repeatRange.endTime;
  };

  useEffect(() => {
    if (activeIndex !== -1 && containerRef.current) {
      const activeElement = containerRef.current.children[activeIndex] as HTMLElement;
      if (activeElement) {
        activeElement.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }
    }
  }, [activeIndex]);

  const rangeStartIdx = repeatRange
    ? lines.findIndex((l) => l.time >= repeatRange.startTime)
    : -1;
  const rangeEndIdx = repeatRange
    ? lines.reduce((acc, l, i) => (l.time < repeatRange.endTime ? i : acc), -1)
    : -1;

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto px-6 py-8 space-y-6 text-center select-none no-scrollbar relative"
      style={{ scrollBehavior: 'smooth' }}
    >
      {sentenceRepeat ? (
        <div className="sticky top-0 z-20 flex justify-center pointer-events-none">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-600 text-white shadow-lg shadow-emerald-500/30">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="17 1 21 5 17 9"></polyline>
              <path d="M3 11V9a4 4 0 0 1 4-4h14"></path>
              <polyline points="7 23 3 19 7 15"></polyline>
              <path d="M21 13v2a4 4 0 0 1-4 4H3"></path>
            </svg>
            逐句精听{repeatRange ? ' · 区间内' : ''}
          </span>
        </div>
      ) : repeatRange ? (
        <div className="sticky top-0 z-20 flex justify-center pointer-events-none">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-600 text-white shadow-lg shadow-blue-500/30">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="17 1 21 5 17 9"></polyline>
              <path d="M3 11V9a4 4 0 0 1 4-4h14"></path>
              <polyline points="7 23 3 19 7 15"></polyline>
              <path d="M21 13v2a4 4 0 0 1-4 4H3"></path>
            </svg>
            区间复读 · 第 {repeatCount + 1} 遍
          </span>
        </div>
      ) : null}

      {lines.map((line, index) => {
        const inRange = isInRange(index);
        const isFirstInRange = inRange && index === rangeStartIdx;
        const isLastInRange = inRange && index === rangeEndIdx;
        const isPendingStart = repeatStartIndex === index;
        const isActive = index === activeIndex;
        const showSentenceBadge = sentenceRepeat && isActive;

        let boxClass = '';
        if (inRange) {
          boxClass = 'bg-blue-100/80 dark:bg-blue-900/30 border-l-2 border-r-2 border-blue-500';
          if (isFirstInRange) boxClass += ' border-t-2 rounded-t-xl pt-3';
          if (isLastInRange) boxClass += ' border-b-2 rounded-b-xl pb-3';
          if (!isFirstInRange) boxClass += ' -mt-6 pt-6';
        }

        return (
          <p
            key={index}
            className={`transition-all duration-300 transform cursor-pointer px-4 py-1 rounded-lg ${boxClass} ${
              isActive
                ? inRange
                  ? 'text-blue-700 dark:text-blue-200 text-xl font-bold scale-105'
                  : 'text-gray-900 dark:text-white text-xl font-bold scale-105'
                : inRange
                ? 'text-blue-700 dark:text-blue-200 text-lg font-medium'
                : 'text-gray-400 dark:text-gray-500 text-lg blur-[0.5px] hover:text-gray-600 dark:hover:text-gray-300'
            } ${isPendingStart ? 'ring-2 ring-blue-400 ring-offset-2 ring-offset-transparent rounded-xl animate-pulse' : ''}`}
            onClick={() => onLineClick(index)}
          >
            {line.text}
            {showSentenceBadge && (
              <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold align-middle bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
                {sentenceIteration}/{sentenceRepeatCount}
              </span>
            )}
          </p>
        );
      })}
      {lines.length === 0 && (
        <div className="flex flex-col items-center justify-center h-full text-gray-400">
          <p>No lyrics available</p>
        </div>
      )}
    </div>
  );
};
