import React from 'react';
import { Play, Pause, FastForward, Rewind, Volume2, Headphones, Minus, Plus } from 'lucide-react';

interface PlayerProps {
  playing: boolean;
  currentTime: number;
  duration: number;
  onTogglePlay: () => void;
  onSeek: (time: number) => void;
  title: string;
  volume: number;
  onVolumeChange: (val: number) => void;
  onToggleFavorite?: () => void;
  isFavorite?: boolean;
  // 逐句精听 (per-sentence intensive listening)
  intensiveMode?: boolean;
  repeatCount?: number;
  onToggleIntensive?: () => void;
  onRepeatCountChange?: (val: number) => void;
}

const formatTime = (time: number) => {
  const mins = Math.floor(time / 60);
  const secs = Math.floor(time % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const Player: React.FC<PlayerProps> = ({ 
  playing, 
  currentTime, 
  duration, 
  onTogglePlay, 
  onSeek,
  title,
  volume,
  onVolumeChange,
  onToggleFavorite,
  isFavorite,
  intensiveMode = false,
  repeatCount = 3,
  onToggleIntensive,
  onRepeatCountChange,
}) => {
  return (
    <div className="bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 shadow-xl pb-safe transition-colors duration-300">
      <div className="px-6 py-4">
        <div className="mb-6 flex justify-between items-center">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white truncate pr-4">{title}</h3>
            {onToggleFavorite && (
              <button onClick={onToggleFavorite} className="p-2 transition active:scale-95">
                 <span className={`text-2xl ${isFavorite ? 'text-red-500' : 'text-gray-300'}`}>
                   {isFavorite ? '♥' : '♡'}
                 </span>
              </button>
            )}
        </div>
        
        {/* Progress Bar */}
        <div className="flex items-center space-x-3 mb-6">
          <span className="text-xs text-gray-400 w-10 text-right font-mono">{formatTime(currentTime)}</span>
          <input
            type="range"
            min={0}
            max={duration || 100}
            value={currentTime}
            onChange={(e) => onSeek(Number(e.target.value))}
            className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600 hover:accent-blue-500 transition-all"
          />
          <span className="text-xs text-gray-400 w-10 font-mono">{formatTime(duration)}</span>
        </div>

        {/* Controls */}
        <div className="flex justify-center items-center space-x-8 mb-6">
           <button 
             className="p-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition active:scale-95"
             onClick={() => onSeek(Math.max(0, currentTime - 10))}
           >
             <Rewind size={28} />
             <span className="sr-only">-10s</span>
           </button>
           
           <button 
             onClick={onTogglePlay}
             className="w-20 h-20 bg-blue-600 hover:bg-blue-500 rounded-full flex items-center justify-center text-white shadow-xl shadow-blue-500/30 active:scale-95 transition-all"
           >
             {playing ? (
               <Pause size={40} fill="currentColor" />
             ) : (
               <Play size={40} fill="currentColor" className="ml-2" />
             )}
           </button>

           <button 
             className="p-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition active:scale-95"
             onClick={() => onSeek(Math.min(duration, currentTime + 10))}
           >
             <FastForward size={28} />
             <span className="sr-only">+10s</span>
           </button>
        </div>

        {/* Volume Control */}
        <div className="flex items-center space-x-4 px-4 py-2 bg-gray-50 dark:bg-gray-800 rounded-xl">
           <Volume2 size={20} className="text-gray-400" />
           <input 
             type="range"
             min={0}
             max={1}
             step={0.05}
             value={volume}
             onChange={(e) => onVolumeChange(Number(e.target.value))}
             className="flex-1 h-1.5 bg-gray-300 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer accent-gray-500 dark:accent-gray-400"
           />
        </div>

        {/* 逐句精听 (Per-sentence Intensive Listening) */}
        {onToggleIntensive && (
          <div className="mt-3 flex items-center justify-between px-4 py-2 bg-gray-50 dark:bg-gray-800 rounded-xl">
            <button
              onClick={onToggleIntensive}
              className={`flex items-center gap-2 text-sm font-bold transition ${intensiveMode ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}`}
            >
              <Headphones size={20} />
              逐句精听
              <span className={`ml-1 inline-flex h-5 w-9 items-center rounded-full px-0.5 transition ${intensiveMode ? 'bg-green-500 justify-end' : 'bg-gray-300 dark:bg-gray-600 justify-start'}`}>
                <span className="h-4 w-4 rounded-full bg-white shadow" />
              </span>
            </button>

            {/* Repeat-count stepper */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">每句</span>
              <button
                onClick={() => onRepeatCountChange?.(repeatCount - 1)}
                disabled={repeatCount <= 1}
                className="p-1 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-200 disabled:opacity-40 active:scale-95 transition"
              >
                <Minus size={14} />
              </button>
              <span className="w-6 text-center text-sm font-bold tabular-nums dark:text-white">{repeatCount}</span>
              <button
                onClick={() => onRepeatCountChange?.(repeatCount + 1)}
                className="p-1 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-200 active:scale-95 transition"
              >
                <Plus size={14} />
              </button>
              <span className="text-xs text-gray-400">遍</span>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
