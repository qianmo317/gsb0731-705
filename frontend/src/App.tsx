import { useState, useEffect, useMemo } from 'react';
import { useAudio } from './hooks/useAudio';
import { useSearch } from './hooks/useSearch';
import { useFavorites } from './hooks/useFavorites';
import { useLocalStorage } from './hooks/useLocalStorage';
import { parseLRC, LrcLine } from './utils/lrcParser';

import { Lyrics } from './components/Lyrics';
import { Player } from './components/Player';
import { SearchBar } from './components/SearchBar';
import { UploadZone } from './components/UploadZone';
import { CategoryTabs } from './components/CategoryTabs';
import { FavoriteButton } from './components/FavoriteButton';
import { ChevronDown, ListMusic } from 'lucide-react'; // Import icons

interface Lesson {
  id: string;
  title: string;
  category: string;
  keywords?: string[];
  audioUrl?: string;
  lrcUrl?: string;
}

function AppImproved() {
  // --- Data & State ---
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [currentLessonId, setCurrentLessonId] = useState<string>('');
  const [lyrics, setLyrics] = useState<LrcLine[]>([]);
  const [isPlayerExpanded, setIsPlayerExpanded] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('全部');
  const [isDarkMode, setIsDarkMode] = useLocalStorage('darkMode', false);

  // --- Hooks ---
  const { favorites, toggleFavorite, isFavorite } = useFavorites();
  const { setQuery, filteredItems: searchResults } = useSearch(lessons);

  // --- Filtering Logic ---
  const categories = useMemo(() => {
     const cats = new Set(lessons.map(l => l.category).filter(Boolean));
     return ['全部', '收藏', ...Array.from(cats)];
  }, [lessons]);

  const displayedLessons = useMemo(() => {
    let result = searchResults;
    
    if (selectedCategory === '收藏') {
      result = result.filter(l => favorites.includes(l.id));
    } else if (selectedCategory !== '全部') {
      result = result.filter(l => l.category === selectedCategory);
    }
    
    return result;
  }, [searchResults, selectedCategory, favorites]);

  // --- Audio Hook ---
  const currentLesson = lessons.find(l => l.id === currentLessonId);
  const audioSrc = currentLesson?.audioUrl || '';
  
  const { 
      playing, 
      currentTime, 
      duration, 
      togglePlay, 
      seek, 
      volume, 
      changeVolume, 
      error, 
      loading 
  } = useAudio({
    src: audioSrc,
    id: currentLessonId
  });

  // --- Effects ---
  useEffect(() => {
    const loadData = async () => {
        try {
            // 1. Fetch Static Data
            const res = await fetch('/data.json');
            const staticData: Lesson[] = await res.json();
            
            // 2. Load Local Custom Data from IndexedDB
            let customData: Lesson[] = [];
            try {
                const { loadLocalLessons } = await import('./utils/db');
                customData = await loadLocalLessons();
            } catch (e) {
                console.warn("Failed to load custom lessons:", e);
            }

            // 3. Merge (Custom first)
            const combined = [...customData, ...staticData];
            setLessons(combined);
            
            // Init selection if needed
            if (combined.length > 0 && !currentLessonId) {
               setCurrentLessonId(combined[0].id);
            }
        } catch (err) {
            console.error("Data load failed", err);
        }
    };
    loadData();
  }, []);

  useEffect(() => {
    if (!currentLesson?.lrcUrl) {
        setLyrics([]);
        return;
    }

    const loadLrc = async () => {
        try {
            const res = await fetch(currentLesson.lrcUrl as string);
            if (!res.ok) throw new Error("Failed to fetch LRC");
            const text = await res.text();
            setLyrics(parseLRC(text));
        } catch (err) {
            console.error("Failed to load LRC", err);
            setLyrics([]);
        }
    };

    loadLrc();
  }, [currentLesson?.lrcUrl]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
  }, [isDarkMode]);

  // --- Handlers ---
  const handleUpload = async ({ audio, lrc, metadata }: { audio: File; lrc?: File; metadata: any }) => {
     const newId = `local-${Date.now()}`;
     // Use metadata category if available, else default
     const category = metadata.category || '本地上传';
     
     const newLesson: Lesson = {
       id: newId,
       title: metadata.title || audio.name.replace(/\.[^/.]+$/, ""),
       category: category,
       audioUrl: URL.createObjectURL(audio),
       lrcUrl: lrc ? URL.createObjectURL(lrc) : undefined,
       keywords: ['local']
     };
     
     // Update State
     setLessons(prev => [newLesson, ...prev]);
     setCurrentLessonId(newId);
     // On mobile we expand, on PC it's always visible in right column
     setIsPlayerExpanded(true);

     // Persist to IndexedDB
     try {
         const { saveLocalLesson } = await import('./utils/db');
         await saveLocalLesson(
             { id: newId, title: newLesson.title, category: newLesson.category }, 
             audio, 
             lrc
         );
     } catch (e) {
         console.warn("Failed to save custom lesson to DB", e);
     }
  };

  const handleLessonSelect = (id: string) => {
      setCurrentLessonId(id);
      setIsPlayerExpanded(true);
  };

  // --- Render ---
  return (
    <div className={`h-full min-h-screen transition-colors duration-300 ${isDarkMode ? 'dark bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'} font-sans`}>
      
      {/* Max Width Container for PC */}
      <div className="max-w-[1200px] mx-auto h-full flex flex-col md:flex-row overflow-hidden shadow-2xl bg-white dark:bg-gray-900 md:border-x md:border-gray-200 dark:md:border-gray-800">

          {/* LEFT PANEL (List) - Width varies by breakpoint */}
          <div className="flex-1 flex flex-col h-full md:w-5/12 lg:w-4/12 md:border-r border-gray-100 dark:border-gray-800 z-10 relative">
              {/* 1. Header & Search */}
              <div className="flex-none bg-white/90 dark:bg-gray-800/90 backdrop-blur-md z-10 px-4 py-3 shadow-sm border-b border-gray-100 dark:border-gray-700">
                <div className="flex items-center space-x-3 mb-2">
                    <h1 className="text-lg font-bold flex items-center">
                        <span className="bg-blue-600 text-white p-1 rounded mr-2"><ListMusic size={18} /></span>
                        听力练习
                    </h1>
                    <div className="flex-1"></div>
                    <button 
                      onClick={() => setIsDarkMode(!isDarkMode)}
                      className="p-2 bg-gray-100 dark:bg-gray-700 rounded-full text-lg transition active:scale-95"
                    >
                      {isDarkMode ? '🌙' : '☀️'}
                    </button>
                </div>
                <SearchBar onSearch={setQuery} />
              </div>

              {/* 2. Categories */}
              <div className="flex-none bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800">
                 <CategoryTabs 
                    categories={categories} 
                    selectedCategory={selectedCategory} 
                    onSelect={setSelectedCategory} 
                 />
              </div>

              {/* 3. List Content */}
              <div className="flex-1 overflow-y-auto p-4 pb-32 md:pb-4 space-y-3 scroll-smooth scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-700">
                 {/* Upload Zone */}
                 {selectedCategory === '全部' && <UploadZone onUpload={handleUpload} />}

                 {displayedLessons.length === 0 ? (
                     <div className="text-center py-10 text-gray-400">没有找到相关课程</div>
                 ) : (
                     displayedLessons.map(l => (
                        <div key={l.id} 
                          onClick={() => handleLessonSelect(l.id)}
                          className={`group relative p-3 rounded-xl shadow-sm border flex items-center space-x-4 active:scale-[0.98] transition-all cursor-pointer
                              ${currentLessonId === l.id ? 'border-blue-500 ring-1 ring-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750'}
                          `}
                        >
                          {/* Icon / Avatar */}
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold shadow-sm transition-colors
                              ${currentLessonId === l.id ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300'}
                          `}>
                            {l.title.substring(0,1).toUpperCase()}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                             <h3 className={`font-bold text-sm truncate ${currentLessonId === l.id ? 'text-blue-700 dark:text-blue-400' : 'text-gray-800 dark:text-gray-100'}`}>
                                {l.title}
                             </h3>
                             <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{l.category}</p>
                          </div>

                          {/* Actions */}
                          <div onClick={(e) => e.stopPropagation()}>
                              <FavoriteButton 
                                isFavorite={isFavorite(l.id)} 
                                onToggle={() => toggleFavorite(l.id)} 
                              />
                          </div>
                          
                          {/* Playing Indicator */}
                          {currentLessonId === l.id && playing && (
                              <div className="absolute top-1 right-1">
                                  <span className="flex h-3 w-3 relative">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
                                  </span>
                              </div>
                          )}
                        </div>
                     ))
                 )}
              </div>
          </div>

          {/* RIGHT PANEL (Desktop Player) - Hidden on Mobile, Visible on MD+ */}
          <div className="hidden md:flex md:w-7/12 lg:w-8/12 flex-col bg-gray-50 dark:bg-gray-900 relative user-select-none">
             {/* Large Cover Art / Visual */}
             <div className="flex-none p-8 flex justify-center items-center bg-gray-100 dark:bg-gray-800/50">
                 <div className={`w-32 h-32 lg:w-40 lg:h-40 rounded-full shadow-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white transition-all duration-700 ${playing ? 'animate-spin-slow' : ''}`}>
                    <ListMusic size={40} className="opacity-80" />
                 </div>
                 <div className="ml-6">
                    <h2 className="text-2xl font-bold dark:text-white line-clamp-2 max-w-sm">{currentLesson?.title || '请选择课程'}</h2>
                    <p className="text-md text-gray-500 dark:text-gray-400 mt-1">{currentLesson?.category}</p>
                 </div>
                 <div className="flex-1"></div>
                 <FavoriteButton className="transform scale-125" isFavorite={isFavorite(currentLessonId)} onToggle={() => toggleFavorite(currentLessonId)} />
             </div>

             {/* Lyrics Area - Taking up most space */}
             <div className="flex-1 overflow-hidden relative w-full">
                 <div className="absolute inset-0 bg-gradient-to-b from-gray-50 via-transparent to-gray-50 dark:from-gray-900 dark:to-gray-900 opacity-10 pointer-events-none z-10"></div>
                 <Lyrics lines={lyrics} currentTime={currentTime}/>
             </div>

             {/* Bottom Controls */}
             <div className="flex-none p-6 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800">
                 <Player 
                     playing={playing} 
                     currentTime={currentTime} 
                     duration={duration} 
                     onTogglePlay={togglePlay} 
                     onSeek={seek}
                     title={currentLesson?.title || ''}
                     volume={volume}
                     onVolumeChange={changeVolume}
                 />
             </div>
          </div>

          {/* MOBILE ELEMENTS (Mini Player & Drawer) - Only show on MD-, hidden on MD+ */}
          <div className="md:hidden block">
              {/* 4. Mini Player (Sticky Bottom) */}
              {currentLesson && !isPlayerExpanded && (
                <div 
                  onClick={() => setIsPlayerExpanded(true)}
                  className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 dark:bg-gray-900/95 backdrop-blur-lg border-t border-gray-200 dark:border-gray-800 p-2 pb-safe shadow-2xl cursor-pointer transition-transform duration-300"
                >
                  <div className="flex items-center space-x-3 max-w-lg mx-auto">
                     {/* Rotating Art */}
                     <div className="relative w-12 h-12 flex-none">
                         <div className={`w-full h-full rounded-full bg-gradient-to-tr from-gray-700 to-black flex items-center justify-center text-white text-xs shadow-md ${playing ? 'animate-spin-slow' : ''}`}>
                            <span className="text-[8px]">VINYL</span>
                         </div>
                         <div className="absolute inset-0 m-auto w-3 h-3 bg-white dark:bg-gray-900 rounded-full border border-gray-300"></div>
                     </div>

                     <div className="flex-1 min-w-0">
                       <h4 className="font-bold text-sm truncate dark:text-white">{currentLesson.title}</h4>
                       <p className="text-xs text-blue-500 truncate">
                         {error ? <span className="text-red-500">{error}</span> : (loading ? '加载中...' : (playing ? '播放中' : '已暂停'))}
                       </p>
                     </div>

                     <div className="flex items-center space-x-2">
                        <FavoriteButton isFavorite={isFavorite(currentLesson.id)} onToggle={(e) => { e.stopPropagation(); toggleFavorite(currentLesson.id); }} />
                        <button 
                            onClick={(e) => { e.stopPropagation(); togglePlay(); }}
                            className="p-3 bg-gray-100 dark:bg-gray-800 rounded-full text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-700 transition"
                        >
                            {playing ? <div className="w-3 h-3 bg-current rounded-sm" /> : <div className="w-0 h-0 border-l-[12px] border-l-current border-y-[6px] border-y-transparent ml-1" />}
                        </button>
                     </div>
                  </div>
                  {/* Progress Line */}
                  <div className="absolute top-0 left-0 h-0.5 bg-blue-600 transition-all duration-500 ease-linear" style={{ width: `${(currentTime / (duration||1))*100}%` }}></div>
                </div>
              )}

              {/* 5. Full Player Drawer (Mobile Only) */}
              <div 
                className={`fixed inset-0 z-40 bg-white dark:bg-gray-900 flex flex-col transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${isPlayerExpanded ? 'translate-y-0' : 'translate-y-full'}`}
              >
                 {/* Drawer Handle / Header */}
                 <div className="flex-none flex justify-between items-center p-4 pt-8 md:pt-4 bg-gradient-to-b from-white to-transparent dark:from-gray-900 z-10">
                    <button onClick={() => setIsPlayerExpanded(false)} className="p-2 text-gray-500 hover:text-gray-900 dark:hover:text-white transition">
                      <ChevronDown size={28} />
                    </button>
                    <span className="text-xs font-bold tracking-[0.2em] text-gray-400">正在播放</span>
                 </div>

                 {/* Visual Art */}
                 <div className="flex-none flex justify-center py-4">
                     <div className={`w-64 h-64 rounded-3xl shadow-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white transform transition-transform duration-700 ease-out ${playing ? 'scale-100 shadow-blue-500/50' : 'scale-95 shadow-lg'}`}>
                        <ListMusic size={64} className="opacity-80" />
                     </div>
                 </div>

                 {/* Info & Favorite */}
                 <div className="flex-none px-8 py-2 flex justify-between items-start">
                     <div>
                        <h2 className="text-xl font-bold dark:text-white line-clamp-2">{currentLesson?.title || '请选择课程'}</h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{currentLesson?.category}</p>
                     </div>
                     <FavoriteButton className="mt-1 transform scale-125" isFavorite={isFavorite(currentLessonId)} onToggle={() => toggleFavorite(currentLessonId)} />
                 </div>

                 {/* Lyrics (Scrollable Middle) */}
                 <div className="flex-1 overflow-hidden relative my-4 mask-image-gradient">
                     <div className="absolute inset-0 bg-gradient-to-b from-white via-transparent to-white dark:from-gray-900 dark:to-gray-900 opacity-20 pointer-events-none z-10"></div>
                     <Lyrics lines={lyrics} currentTime={currentTime}/>
                 </div>

                 {/* Bottom Controls */}
                 <div className="flex-none pb-8 bg-white dark:bg-gray-900 px-2">
                     <Player 
                         playing={playing} 
                         currentTime={currentTime} 
                         duration={duration} 
                         onTogglePlay={togglePlay} 
                         onSeek={seek}
                         title={currentLesson?.title || ''}
                         volume={volume}
                         onVolumeChange={changeVolume}
                     />
                 </div>
              </div>
          </div>
      </div>
    </div>
  );
}

export default AppImproved;
