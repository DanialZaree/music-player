import { Track } from "./spotify";

export async function searchITunesSongs(query: string): Promise<Track[]> {
  if (!query) return [];
  
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=15`;
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Failed to search iTunes");
  }
  
  const data = await response.json();
  
  return data.results.map((item: any) => ({
    id: item.trackId.toString(),
    title: item.trackName,
    artist: item.artistName,
    album: item.collectionName,
    // iTunes provides trackTimeMillis, convert to seconds
    duration: Math.floor((item.trackTimeMillis || 0) / 1000),
    // Request a higher resolution cover art (600x600 instead of 100x100)
    coverUrl: item.artworkUrl100 ? item.artworkUrl100.replace('100x100bb', '600x600bb') : "",
    previewUrl: item.previewUrl
  }));
}
