import React, { useEffect, useRef } from 'react';
import { LrcLine } from '../utils/lrcParser';

interface LyricsProps {
  lines: LrcLine[];
  currentTime: number;
}

export const Lyrics: React.FC<LyricsProps> = ({ lines, currentTime }) => {
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

  return (
    <div 
      ref={containerRef} 
      className="flex-1 overflow-y-auto px-6 py-8 space-y-6 text-center select-none no-scrollbar"
      style={{ scrollBehavior: 'smooth' }}
    >
      {lines.map((line, index) => (
        <p
          key={index}
          className={`transition-all duration-300 transform ${
            index === activeIndex
              ? 'text-gray-900 dark:text-white text-xl font-bold scale-105'
              : 'text-gray-400 dark:text-gray-500 text-lg blur-[0.5px]'
          }`}
          onClick={() => {
             // Optional: Seek to this time (needs parent handler)
             // For now just display
          }}
        >
          {line.text}
        </p>
      ))}
      {lines.length === 0 && (
        <div className="flex flex-col items-center justify-center h-full text-gray-400">
          <p>No lyrics available</p>
        </div>
      )}
    </div>
  );
};
