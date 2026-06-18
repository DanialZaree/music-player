import { Track } from "./spotify";

export async function searchItunesSongs(query: string): Promise<Track[]> {
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=20`;
  
  console.log(`[Apple Music Search] Searching songs: "${query}"...`);

  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.results && Array.isArray(data.results)) {
      return data.results.map((item: any) => ({
        id: item.trackId.toString(),
        title: item.trackName || "Unknown Track",
        artist: item.artistName || "Unknown Artist",
        album: item.collectionName || "Unknown Album",
        duration: Math.round((item.trackTimeMillis || 0) / 1000),
        coverUrl: item.artworkUrl100 ? item.artworkUrl100.replace('100x100bb', '600x600bb') : "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=600&auto=format&fit=crop",
        previewUrl: null, // Always use YouTube for full-length playback
      }));
    }
    
    return [];
  } catch (error: any) {
    console.error("[Apple Music Search] Failed:", error);
    throw new Error("Search failed. Please check your connection and try again.");
  }
}
