import * as musicMetadata from 'music-metadata-browser';

export interface AudioMetadata {
  title?: string;
  artist?: string;
  picture?: string;
}

export const readAudioMetadata = async (file: File): Promise<AudioMetadata> => {
  try {
    // Basic fallback immediately
    const fallbackTitle = file.name.replace(/\.[^/.]+$/, "");
    
    // Attempt parse
    const metadata = await musicMetadata.parseBlob(file);
    const { common } = metadata;
    
    let base64String = "";
    if (common.picture && common.picture.length > 0) {
      const pic = common.picture[0];
      // Defensive check for data
      if (pic.data) {
          const base64 = btoa(
            new Uint8Array(pic.data).reduce((data, byte) => data + String.fromCharCode(byte), '')
          );
          base64String = `data:${pic.format};base64,${base64}`;
      }
    }

    return {
      title: common.title || fallbackTitle,
      artist: common.artist || "Unknown Artist",
      picture: base64String
    };
  } catch (error) {
    console.warn("Metadata read failed (fallback to filename):", error);
    // Graceful fallback to filename
    return {
        title: file.name.replace(/\.[^/.]+$/, ""),
        artist: "Unknown Artist"
    };
  }
};
