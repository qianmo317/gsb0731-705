import React, { useRef, useState } from 'react';
import { readAudioMetadata } from '../utils/metadata';
import { Music, FileText, Upload } from 'lucide-react';

interface UploadZoneProps {
  onUpload: (files: { audio: File; lrc?: File; metadata: any }) => void;
}

export const UploadZone: React.FC<UploadZoneProps> = ({ onUpload }) => {
  const audioInputRef = useRef<HTMLInputElement>(null);
  const lrcInputRef = useRef<HTMLInputElement>(null);
  
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [lrcFile, setLrcFile] = useState<File | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'audio' | 'lrc') => {
      const file = e.target.files?.[0];
      if (file) {
          if (type === 'audio') setAudioFile(file);
          else setLrcFile(file);
      }
  };

  const handleUpload = async () => {
    if (!audioFile) return;

    const metadata = await readAudioMetadata(audioFile);
    let category = 'Local Upload';

    // Try to parse category from LRC if provided
    if (lrcFile) {
        try {
            const text = await lrcFile.text();
            const match = text.match(/\[category:(.*?)\]/i);
            if (match && match[1]) {
                category = match[1].trim();
            }
        } catch (e) {
            console.warn("Failed to parse LRC category", e);
        }
    }

    // Pass the merged metadata
    onUpload({ 
        audio: audioFile, 
        lrc: lrcFile || undefined, 
        metadata: { ...metadata, category } 
    });
    
    // Reset
    setAudioFile(null);
    setLrcFile(null);
    if (audioInputRef.current) audioInputRef.current.value = '';
    if (lrcInputRef.current) lrcInputRef.current.value = '';
  };

  return (
    <div className="p-4 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
      <div className="space-y-3">
        {/* Audio Input */}
        <label className={`flex items-center justify-between p-3 border-2 border-dashed rounded-xl cursor-pointer transition-colors group
            ${audioFile 
               ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
               : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-750'}
        `}>
          <div className="flex items-center space-x-3 overflow-hidden">
             <div className={`p-2 rounded-full ${audioFile ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'}`}>
                <Music size={18} />
             </div>
             <span className={`text-sm truncate font-medium ${audioFile ? 'text-blue-700 dark:text-blue-300' : 'text-gray-500 dark:text-gray-400'}`}>
                {audioFile ? audioFile.name : '选择音频 (MP3)'}
             </span>
          </div>
          <input 
             ref={audioInputRef} 
             type="file" 
             accept=".mp3,audio/*" 
             className="hidden" 
             onChange={(e) => handleFileChange(e, 'audio')}
          />
        </label>
        
        {/* LRC Input */}
        <label className={`flex items-center justify-between p-3 border-2 border-dashed rounded-xl cursor-pointer transition-colors group
            ${lrcFile 
               ? 'border-green-500 bg-green-50 dark:bg-green-900/20' 
               : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-750'}
        `}>
          <div className="flex items-center space-x-3 overflow-hidden">
             <div className={`p-2 rounded-full ${lrcFile ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'}`}>
                <FileText size={18} />
             </div>
             <span className={`text-sm truncate font-medium ${lrcFile ? 'text-green-700 dark:text-green-300' : 'text-gray-500 dark:text-gray-400'}`}>
                {lrcFile ? lrcFile.name : '选择歌词 (LRC) - 可选'}
             </span>
          </div>
          <input 
             ref={lrcInputRef} 
             type="file" 
             accept=".lrc,.txt" 
             className="hidden"
             onChange={(e) => handleFileChange(e, 'lrc')}
          />
        </label>
        
        {/* Confirm Button */}
        <button 
           onClick={handleUpload}
           disabled={!audioFile}
           className={`w-full py-3 rounded-xl font-bold shadow-lg flex items-center justify-center space-x-2 transition-all active:scale-95
              ${audioFile 
                 ? 'bg-blue-600 text-white shadow-blue-500/30 hover:bg-blue-700 cursor-pointer' 
                 : 'bg-gray-200 text-gray-400 dark:bg-gray-700 dark:text-gray-500 cursor-not-allowed shadow-none'}
           `}
        >
           <Upload size={18} />
           <span>确认导入</span>
        </button>
      </div>
    </div>
  );
};
