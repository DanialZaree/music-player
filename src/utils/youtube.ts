import { Track } from "./spotify";

const INVIDIOUS_INSTANCES = [
  "https://inv.tux.pizza",
  "https://invidious.projectsegfau.lt",
  "https://yewtu.be",
  "https://invidious.nerdvpn.de",
  "https://invidious.privacydev.net",
  "https://invidious.flokinet.to"
];

export interface YouTubeSearchResult {
  videoId: string;
  title: string;
  author: string;
  lengthSeconds: number;
  thumbnail: string;
}

/**
 * Searches for a video ID on YouTube matching the artist and song title
 * by querying multiple public Invidious instances with a failover sequence.
 */
export async function searchYouTubeTrack(title: string, artist: string): Promise<string> {
  // Clean query
  const cleanTitle = title.replace(/[()[\]]/g, "").trim();
  const cleanArtist = artist.split(",")[0].trim(); // Use the main artist
  const query = encodeURIComponent(`${cleanArtist} ${cleanTitle}`);
  
  console.log(`[YouTube Search] Searching for: "${cleanArtist} - ${cleanTitle}"...`);

  for (const instance of INVIDIOUS_INSTANCES) {
    try {
      // Set a short timeout (4 seconds) to failover quickly if an instance is slow/down
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      
      const url = `${instance}/api/v1/search?q=${query}&type=video`;
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          "Accept": "application/json"
        }
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const results = await response.json();
        if (Array.isArray(results) && results.length > 0) {
          const videoResult = results.find((item: any) => item.type === "video" && item.videoId);
          if (videoResult) {
            console.log(`[YouTube Search] Success! Found videoId: ${videoResult.videoId} via ${instance}`);
            return videoResult.videoId;
          }
        }
      }
    } catch (e) {
      console.warn(`[YouTube Search] Instance ${instance} failed or timed out:`, e);
      // Continue trying other instances
    }
  }
  
  // If we reach here, all invidious instances failed.
  throw new Error("Unable to locate audio source. All streaming search nodes are currently offline. Please try again later.");
}

/**
 * Searches YouTube for songs and returns structured results that can be added to playlists.
 */
export async function searchYouTubeSongs(query: string): Promise<Track[]> {
  const encodedQuery = encodeURIComponent(query);
  
  console.log(`[YouTube Search] Searching songs: "${query}"...`);

  for (const instance of INVIDIOUS_INSTANCES) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      
      const url = `${instance}/api/v1/search?q=${encodedQuery}&type=video&sort_by=relevance`;
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { "Accept": "application/json" }
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const results = await response.json();
        if (Array.isArray(results)) {
          const tracks: Track[] = results
            .filter((item: any) => item.type === "video" && item.videoId)
            .slice(0, 15) // Limit to 15 results
            .map((item: any) => {
              // Pick the best available thumbnail
              const thumbnail = item.videoThumbnails?.find((t: any) => t.quality === "medium")?.url
                || item.videoThumbnails?.find((t: any) => t.quality === "default")?.url
                || item.videoThumbnails?.[0]?.url
                || `https://i.ytimg.com/vi/${item.videoId}/mqdefault.jpg`;
              
              return {
                id: item.videoId,
                title: item.title || "Unknown Track",
                artist: item.author || "Unknown Artist",
                album: "YouTube",
                duration: item.lengthSeconds || 0,
                coverUrl: thumbnail,
                previewUrl: null, // Will use YouTube IFrame player
              };
            });
          
          if (tracks.length > 0) {
            console.log(`[YouTube Search] Found ${tracks.length} results via ${instance}`);
            return tracks;
          }
        }
      }
    } catch (e) {
      console.warn(`[YouTube Search] Instance ${instance} failed:`, e);
    }
  }
  
  throw new Error("Search failed. All streaming nodes are currently offline. Please try again in a moment.");
}
