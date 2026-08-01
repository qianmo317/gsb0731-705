import { get, set, keys, del } from 'idb-keyval';

export interface SavedLesson {
  id: string;
  title: string;
  category: string;
  audioFile: Blob;
  lrcFile?: Blob;
  createdAt: number;
}

const STORE_PREFIX = 'lesson_';

export const saveLocalLesson = async (lesson: { id: string; title: string; category: string }, audio: File, lrc?: File) => {
  const data: SavedLesson = {
    id: lesson.id,
    title: lesson.title,
    category: lesson.category,
    audioFile: audio,
    lrcFile: lrc,
    createdAt: Date.now(),
  };
  await set(STORE_PREFIX + lesson.id, data);
};

export const loadLocalLessons = async () => {
  const allKeys = await keys();
  const lessonKeys = allKeys.filter(k => typeof k === 'string' && k.startsWith(STORE_PREFIX));
  
  const lessons = await Promise.all(lessonKeys.map(k => get<SavedLesson>(k)));
  
  // Convert Blobs to URLs
  return lessons.filter((l): l is SavedLesson => !!l).map(l => ({
    id: l.id,
    title: l.title,
    category: l.category,
    audioUrl: URL.createObjectURL(l.audioFile),
    lrcUrl: l.lrcFile ? URL.createObjectURL(l.lrcFile) : undefined,
    keywords: ['local']
  }));
};

export const deleteLocalLesson = async (id: string) => {
    await del(STORE_PREFIX + id);
    // Remove the lesson's playback progress and practice traces together.
    try {
        window.localStorage.removeItem(`progress-${id}`);
        window.localStorage.removeItem(`repeat-${id}`);
        window.dispatchEvent(new Event('practice-stats-updated'));
    } catch (e) {
        console.warn('Failed to clean up local lesson data', e);
    }
};
