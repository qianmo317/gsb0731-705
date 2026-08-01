import React, { useEffect, useRef } from 'react';
import { LrcLine } from '../utils/lrcParser';

export interface LoopInfo {
  start: number | null;
  end: number | null;
  count: number;
}

interface LyricsProps {
  lines: LrcLine[];
  currentTime: number;
  loop?: LoopInfo;
  duration?: number;
  onLineClick?: (time: number, nextLineTime: number) => void;
  sentenceLoop?: boolean;
  sentenceReps?: number;
  sentenceCount?: number;
}

export const Lyrics: React.FC<LyricsProps> = ({
  lines,
  currentTime,
  loop,
  duration,
  onLineClick,
  sentenceLoop = false,
  sentenceReps = 3,
  sentenceCount = 0,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeIndex = lines.findIndex((line, index) => {
    const nextLine = lines[index + 1];
    return currentTime >= line.time && (!nextLine || currentTime < nextLine.time);
  });

  const loopActive = !!(loop && loop.start !== null && loop.end !== null);
  const loopSelecting = !!(loop && loop.start !== null && loop.end === null);

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

  const isInLoop = (line: LrcLine, index: number): boolean => {
    if (!loop || loop.start === null) return false;
    const nextLine = lines[index + 1];
    const lineEnd = nextLine ? nextLine.time : (duration ?? Infinity);
    // A line is "inside" if its time >= start and it begins before end
    if (loop.end === null) {
      return line.time === loop.start;
    }
    return line.time >= loop.start && line.time < loop.end && lineEnd > loop.start;
  };

  const isLoopStart = (line: LrcLine): boolean => {
    return loop?.start === line.time;
  };

  const isLoopEnd = (_line: LrcLine, index: number): boolean => {
    if (!loop || loop.end === null) return false;
    const nextLine = lines[index + 1];
    return nextLine ? nextLine.time === loop.end : (duration ?? -1) === loop.end;
  };

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto px-6 py-8 space-y-2 text-center select-none no-scrollbar"
      style={{ scrollBehavior: 'smooth' }}
    >
      {sentenceLoop && (
        <div className="sticky top-0 z-20 flex justify-center pointer-events-none">
          <span className="inline-flex items-center gap-2 bg-emerald-600 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg shadow-emerald-500/30">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 1 0 9-9"></path>
              <polyline points="3 4 3 12 11 12"></polyline>
            </svg>
            逐句精听 · 第 {Math.min(sentenceCount + 1, sentenceReps)}/{sentenceReps} 遍
          </span>
        </div>
      )}
      {!sentenceLoop && loopActive && loop && (
        <div className="sticky top-0 z-20 flex justify-center pointer-events-none">
          <span className="inline-flex items-center gap-2 bg-blue-600 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg shadow-blue-500/30">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="17 1 21 5 17 9"></polyline>
              <path d="M3 11V9a4 4 0 0 1 4-4h14"></path>
              <polyline points="7 23 3 19 7 15"></polyline>
              <path d="M21 13v2a4 4 0 0 1-4 4H3"></path>
            </svg>
            区间循环 · 第 {loop.count} 遍
          </span>
        </div>
      )}
      {!sentenceLoop && loopSelecting && (
        <div className="sticky top-0 z-20 flex justify-center pointer-events-none">
          <span className="inline-flex items-center gap-2 bg-amber-500 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg shadow-amber-500/30">
            再点一句设定终点
          </span>
        </div>
      )}

      {lines.map((line, index) => {
        const inLoop = isInLoop(line, index);
        const atStart = isLoopStart(line);
        const atEnd = isLoopEnd(line, index);
        const nextLine = lines[index + 1];
        const nextLineTime = nextLine ? nextLine.time : (duration ?? 0);
        const isCurrent = index === activeIndex;
        const sentenceActive = sentenceLoop && isCurrent;

        return (
          <p
            key={index}
            className={`relative transition-all duration-300 transform cursor-pointer px-4 py-2 rounded-xl
              ${isCurrent
                ? 'text-gray-900 dark:text-white text-xl font-bold scale-105'
                : 'text-gray-400 dark:text-gray-500 text-lg blur-[0.5px]'}
              ${inLoop && !sentenceLoop
                ? 'bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-300/60 dark:ring-blue-700/40 text-blue-700 dark:text-blue-300'
                : ''}
              ${inLoop && isCurrent && !sentenceLoop
                ? 'bg-blue-100 dark:bg-blue-900/40 ring-blue-500'
                : ''}
              ${sentenceActive
                ? 'bg-emerald-50 dark:bg-emerald-900/20 ring-1 ring-emerald-400/60 dark:ring-emerald-600/40 text-emerald-700 dark:text-emerald-300'
                : ''}
              hover:bg-gray-100/60 dark:hover:bg-gray-800/40
            `}
            onClick={() => {
              if (onLineClick) onLineClick(line.time, nextLineTime);
            }}
          >
            {atStart && loopActive && !sentenceLoop && (
              <span className="absolute -left-1 top-1/2 -translate-y-1/2 w-1.5 h-8 bg-blue-500 rounded-r-full"></span>
            )}
            {atEnd && loopActive && !sentenceLoop && (
              <span className="absolute -right-1 top-1/2 -translate-y-1/2 w-1.5 h-8 bg-blue-500 rounded-l-full"></span>
            )}
            {atStart && loopSelecting && !sentenceLoop && (
              <span className="absolute -left-1 top-1/2 -translate-y-1/2 w-1.5 h-8 bg-amber-500 rounded-r-full"></span>
            )}
            <span className={`mr-2 text-[10px] font-mono align-middle opacity-60
              ${inLoop && !sentenceLoop ? 'text-blue-500 dark:text-blue-400' : ''}
              ${sentenceActive ? 'text-emerald-500 dark:text-emerald-400 opacity-100' : ''}
              ${atStart || atEnd ? 'opacity-100' : ''}`}>
              {atStart && !sentenceLoop ? 'A' : atEnd && !sentenceLoop ? 'B' : ''}
            </span>
            {line.text}
            {sentenceActive && (
              <span className="ml-2 inline-flex items-center justify-center min-w-[1.75rem] h-5 px-1.5 text-[10px] font-bold bg-emerald-600 text-white rounded-full align-middle">
                {Math.min(sentenceCount + 1, sentenceReps)}/{sentenceReps}
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
