import React, { useEffect, useRef } from 'react';
import { LrcLine } from '../utils/lrcParser';
import { LoopRange } from '../hooks/useAudio';

interface LyricsProps {
  lines: LrcLine[];
  currentTime: number;
  loopRange?: LoopRange | null;
  loopCount?: number;
  pendingLoopStart?: number | null;
  onLineClick?: (index: number) => void;
}

export const Lyrics: React.FC<LyricsProps> = ({
  lines,
  currentTime,
  loopRange = null,
  loopCount = 1,
  pendingLoopStart = null,
  onLineClick,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeIndex = lines.findIndex((line, index) => {
    const nextLine = lines[index + 1];
    return currentTime >= line.time && (!nextLine || currentTime < nextLine.time);
  });

  const isInLoop = (line: LrcLine) =>
    !!loopRange && line.time >= loopRange.start && line.time < loopRange.end;

  const firstLoopIndex = loopRange ? lines.findIndex(isInLoop) : -1;

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

  return (
    <div 
      ref={containerRef} 
      className="flex-1 overflow-y-auto px-6 py-8 space-y-6 text-center select-none no-scrollbar"
      style={{ scrollBehavior: 'smooth' }}
    >
      {lines.map((line, index) => {
        const inLoop = isInLoop(line);
        const isPending =
          pendingLoopStart !== null && Math.abs(line.time - pendingLoopStart) < 0.001;

        let cls = 'transition-all duration-300 transform rounded-lg px-3 py-1 cursor-pointer ';
        if (index === activeIndex) {
          cls += 'text-gray-900 dark:text-white text-xl font-bold scale-105 ';
        } else if (inLoop) {
          cls += 'text-blue-700 dark:text-blue-300 text-lg ';
        } else if (isPending) {
          cls += 'text-amber-700 dark:text-amber-300 text-lg ';
        } else {
          cls += 'text-gray-400 dark:text-gray-500 text-lg blur-[0.5px] ';
        }
        if (inLoop) {
          cls += 'bg-blue-100/80 dark:bg-blue-900/40 border-l-4 border-blue-500 ';
        }
        if (isPending) {
          cls += 'bg-amber-100/80 dark:bg-amber-900/40 border-l-4 border-dashed border-amber-400 ';
        }

        return (
          <p
            key={index}
            className={cls}
            onClick={() => onLineClick?.(index)}
          >
            {index === firstLoopIndex && (
              <span className="block text-xs font-bold tracking-wide text-blue-500 dark:text-blue-400 mb-1">
                ↻ 区间循环 · 第 {loopCount} 遍
              </span>
            )}
            {isPending && (
              <span className="block text-xs font-bold tracking-wide text-amber-500 dark:text-amber-400 mb-1">
                已选起点，再点一句定终点
              </span>
            )}
            {line.text}
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
