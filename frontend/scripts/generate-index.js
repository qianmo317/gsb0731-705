import fs from 'fs/promises';
import path from 'path';

const CONFIG = {
  audioDir: './public/audio',
  dataFile: './public/data.json',
  audioExtensions: ['.mp3'],
  lrcExtension: '.lrc'
};

async function generateIndex() {
  try {
    // 1. Ensure audio directory exists
    try {
      await fs.access(CONFIG.audioDir);
    } catch {
      console.error(`Error: Audio directory not found at ${CONFIG.audioDir}`);
      process.exit(1);
    }

    // 2. Read existing data to preserve manual edits (keywords, etc.)
    let existingData = [];
    try {
      const dataContent = await fs.readFile(CONFIG.dataFile, 'utf-8');
      existingData = JSON.parse(dataContent);
    } catch (error) {
      // Ignore if file doesn't exist
    }
    const existingMap = new Map(existingData.map(item => [item.id, item]));

    // 3. Scan directory
    const files = await fs.readdir(CONFIG.audioDir);
    const audioFiles = files.filter(f => CONFIG.audioExtensions.includes(path.extname(f).toLowerCase()));

    const newItemsPromise = audioFiles.map(async (file) => {
      const ext = path.extname(file);
      const id = path.basename(file, ext); // e.g. "lesson-1"
      
      // Default formatting
      const rawTitle = id.replace(/-/g, ' ');
      const defaultTitle = rawTitle.charAt(0).toUpperCase() + rawTitle.slice(1);
      
      const existing = existingMap.get(id) || {};
      
      // Check for LRC
      const lrcFilename = `${id}${CONFIG.lrcExtension}`;
      const hasLrc = files.includes(lrcFilename);
      
      let category = existing.category || 'General';

      // Reads LRC content to extract [category:xxx]
      if (hasLrc) {
        try {
          const lrcPath = path.join(CONFIG.audioDir, lrcFilename);
          const lrcContent = await fs.readFile(lrcPath, 'utf-8');
          // Regex to find [category: something]
          const categoryMatch = lrcContent.match(/\[category:\s*(.*?)\]/i);
          if (categoryMatch && categoryMatch[1]) {
            category = categoryMatch[1].trim();
          }
        } catch (err) {
          console.warn(`Failed to read LRC for ${id}:`, err);
        }
      }

      return {
        id,
        title: existing.title || defaultTitle,
        category: category,
        keywords: existing.keywords || [],
        audioUrl: `/audio/${file}`,
        ...(hasLrc ? { lrcUrl: `/audio/${lrcFilename}` } : {})
      };
    });

    const newItems = await Promise.all(newItemsPromise);

    // 4. Write result
    // Sort by ID for consistency
    newItems.sort((a, b) => a.id.localeCompare(b.id));

    await fs.writeFile(CONFIG.dataFile, JSON.stringify(newItems, null, 2));
    console.log(`Successfully updated ${CONFIG.dataFile} with ${newItems.length} items.`);
    
  } catch (error) {
    console.error("Script failed:", error);
    process.exit(1);
  }
}

generateIndex();
