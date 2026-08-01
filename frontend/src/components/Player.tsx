import React from 'react';
import { Play, Pause, FastForward, Rewind, Volume2, Repeat1, Minus, Plus } from 'lucide-react';

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
  sentenceMode?: boolean;
  sentenceRepeat?: number;
  sentencePass?: number;
  onToggleSentenceMode?: () => void;
  onSentenceRepeatChange?: (val: number) => void;
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
  sentenceMode = false,
  sentenceRepeat = 3,
  sentencePass = 1,
  onToggleSentenceMode,
  onSentenceRepeatChange
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

        {/* Sentence-by-sentence Mode */}
        {onToggleSentenceMode && (
          <div className="flex items-center space-x-3 px-4 py-2 mb-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
            <Repeat1 size={20} className={sentenceMode ? 'text-blue-500' : 'text-gray-400'} />
            <span className={`text-sm font-bold ${sentenceMode ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}`}>
              逐句精听
            </span>
            {sentenceMode && (
              <span className="text-xs text-blue-500 dark:text-blue-400 font-mono">
                本句 第 {sentencePass}/{sentenceRepeat} 遍
              </span>
            )}
            <div className="flex-1"></div>
            {sentenceMode && onSentenceRepeatChange && (
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => onSentenceRepeatChange(sentenceRepeat - 1)}
                  className="w-6 h-6 flex items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 active:scale-95 transition"
                >
                  <Minus size={14} />
                </button>
                <span className="text-xs font-mono text-gray-600 dark:text-gray-300 w-8 text-center">{sentenceRepeat} 遍</span>
                <button
                  onClick={() => onSentenceRepeatChange(sentenceRepeat + 1)}
                  className="w-6 h-6 flex items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 active:scale-95 transition"
                >
                  <Plus size={14} />
                </button>
              </div>
            )}
            <button
              onClick={onToggleSentenceMode}
              className={`w-11 h-6 rounded-full relative transition-colors ${sentenceMode ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${sentenceMode ? 'left-[22px]' : 'left-0.5'}`}></span>
            </button>
          </div>
        )}

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

      </div>
    </div>
  );
};
