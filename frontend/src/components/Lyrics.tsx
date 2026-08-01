import React, { useEffect, useRef } from 'react';
import { LrcLine } from '../utils/lrcParser';
import { LoopRegion } from '../hooks/useAudio';

interface LyricsProps {
  lines: LrcLine[];
  currentTime: number;
  loopRegion?: LoopRegion | null;
  pendingStart?: number | null;
  loopCount?: number;
  onLineClick?: (index: number) => void;
  // 逐句精听 (per-sentence intensive listening)
  intensiveMode?: boolean;
  intensiveIndex?: number | null;
  currentRepeat?: number;
  repeatCount?: number;
}

export const Lyrics: React.FC<LyricsProps> = ({
  lines,
  currentTime,
  loopRegion = null,
  pendingStart = null,
  loopCount = 0,
  onLineClick,
  intensiveMode = false,
  intensiveIndex = null,
  currentRepeat = 0,
  repeatCount = 0,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeIndex = lines.findIndex((line, index) => {
    const nextLine = lines[index + 1];
    return currentTime >= line.time && (!nextLine || currentTime < nextLine.time);
  });

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

  const inRegion = (index: number) =>
    !!loopRegion && index >= loopRegion.startIndex && index <= loopRegion.endIndex;

  return (
    <div className="relative h-full flex flex-col">
      {/* 逐句精听 status banner (coexists with the A-B loop banner) */}
      {intensiveMode && (
        <div className="flex-none mx-auto mb-1 px-4 py-1.5 rounded-full bg-green-600 text-white text-sm font-bold shadow-lg flex items-center gap-2 z-20">
          <span>🎧 逐句精听</span>
          {intensiveIndex !== null && <span className="opacity-90">第 {intensiveIndex + 1} 句</span>}
          <span className="opacity-75">· 第 {currentRepeat}/{repeatCount} 遍</span>
        </div>
      )}
      {/* A-B repeat status banner */}
      {loopRegion ? (
        <div className="flex-none mx-auto mb-1 px-4 py-1.5 rounded-full bg-blue-600 text-white text-sm font-bold shadow-lg flex items-center gap-2 z-20">
          <span>🔁 复读中</span>
          <span className="opacity-90">第 {loopCount} 遍</span>
          <span className="opacity-75">
            · 第 {loopRegion.startIndex + 1}
            {loopRegion.endIndex > loopRegion.startIndex ? `–${loopRegion.endIndex + 1}` : ''} 句
          </span>
          <span className="opacity-60 font-normal">（点框内解除）</span>
        </div>
      ) : pendingStart !== null ? (
        <div className="flex-none mx-auto mb-1 px-4 py-1.5 rounded-full bg-amber-500 text-white text-sm font-bold shadow-lg z-20">
          已选起点（第 {pendingStart + 1} 句），请再点一句作为终点
        </div>
      ) : null}

      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto px-6 py-8 space-y-6 text-center select-none no-scrollbar"
        style={{ scrollBehavior: 'smooth' }}
      >
        {lines.map((line, index) => {
          const framed = inRegion(index);
          const isPending = pendingStart === index;
          const isIntensive = intensiveMode && intensiveIndex === index;
          return (
            <p
              key={index}
              onClick={() => onLineClick?.(index)}
              className={`transition-all duration-300 transform cursor-pointer rounded-lg px-3 py-1 ${
                index === activeIndex
                  ? 'text-gray-900 dark:text-white text-xl font-bold scale-105'
                  : 'text-gray-400 dark:text-gray-500 text-lg blur-[0.5px]'
              } ${
                framed
                  ? 'bg-blue-100 dark:bg-blue-900/40 border-l-4 border-blue-500 !blur-0'
                  : isPending
                  ? 'bg-amber-100 dark:bg-amber-900/40 border-l-4 border-dashed border-amber-500 !blur-0'
                  : 'border-l-4 border-transparent'
              } ${
                isIntensive ? 'ring-2 ring-green-500 !blur-0' : ''
              }`}
            >
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
    </div>
  );
};
