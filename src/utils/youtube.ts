import { Track } from "./spotify";

/**
 * Multiple backend strategies for finding a YouTube videoId:
 * 1. Piped API instances (most reliable, purpose-built API)
 * 2. Invidious API instances (with dynamic fetch from official registry)
 * 3. Static fallback list
 */

const PIPED_INSTANCES: string[] = [];

const INVIDIOUS_STATIC_FALLBACKS = [
  "https://inv.thepixora.com",
  "https://yt.chocolatemoo53.com",
];

export interface YouTubeSearchResult {
  videoId: string;
  title: string;
  author: string;
  lengthSeconds: number;
  thumbnail: string;
}

/**
 * Try Piped API first — these have a dedicated /search endpoint that returns JSON.
 */
async function searchViaPiped(query: string): Promise<string | null> {
  for (const instance of PIPED_INSTANCES) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const url = `${instance}/search?q=${query}&filter=videos`;
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { "Accept": "application/json" }
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        const items = data.items || data;
        if (Array.isArray(items) && items.length > 0) {
          // Piped returns url like "/watch?v=xxxxx"
          const first = items.find((item: any) => item.url || item.videoId);
          if (first) {
            const videoId = first.videoId || first.url?.replace("/watch?v=", "");
            if (videoId) {
              console.log(`[Piped] Found videoId: ${videoId} via ${instance}`);
              return videoId;
            }
          }
        }
      }
    } catch (e) {
      console.warn(`[Piped] ${instance} failed:`, e);
    }
  }
  return null;
}

/**
 * Fallback: try Invidious API instances.
 */
async function searchViaInvidious(query: string): Promise<string | null> {
  // Try dynamic list first
  let instances = [...INVIDIOUS_STATIC_FALLBACKS];
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    const res = await fetch("https://api.invidious.io/instances.json?sort_by=type,health", {
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    
    if (res.ok) {
      const data = await res.json();
      // Extract instances that have api: true and are https
      const apiInstances = data
        .filter((entry: any) => {
          const info = entry[1];
          return info && info.api === true && info.type === "https" && info.uri;
        })
        .map((entry: any) => entry[1].uri as string);
      
      if (apiInstances.length > 0) {
        instances = [...apiInstances, ...instances];
      }
    }
  } catch (e) {
    console.warn("[Invidious] Could not fetch dynamic instances list:", e);
  }

  // Deduplicate
  const unique = [...new Set(instances)];

  for (const instance of unique) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const url = `${instance}/api/v1/search?q=${query}&type=video`;
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { "Accept": "application/json" }
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const results = await response.json();
        if (Array.isArray(results) && results.length > 0) {
          const videoResult = results.find((item: any) => item.type === "video" && item.videoId);
          if (videoResult) {
            console.log(`[Invidious] Found videoId: ${videoResult.videoId} via ${instance}`);
            return videoResult.videoId;
          }
        }
      }
    } catch (e) {
      console.warn(`[Invidious] ${instance} failed:`, e);
    }
  }
  return null;
}

/**
 * Main search function — tries Piped first, then Invidious.
 */
export async function searchYouTubeTrack(title: string, artist: string): Promise<string> {
  const cleanTitle = title.replace(/[()[\]]/g, "").trim();
  const cleanArtist = artist.split(",")[0].trim();
  const query = encodeURIComponent(`${cleanArtist} ${cleanTitle}`);

  console.log(`[YouTube Search] Searching for: "${cleanArtist} - ${cleanTitle}"...`);

  // Strategy 1: Piped
  const pipedResult = await searchViaPiped(query);
  if (pipedResult) return pipedResult;

  // Strategy 2: Invidious
  const invidiousResult = await searchViaInvidious(query);
  if (invidiousResult) return invidiousResult;

  throw new Error("Unable to locate audio source. All streaming nodes are currently offline. Please try again later.");
}

/**
 * Searches YouTube for songs and returns structured results.
 */
export async function searchYouTubeSongs(query: string): Promise<Track[]> {
  const encodedQuery = encodeURIComponent(query);

  console.log(`[YouTube Search] Searching songs: "${query}"...`);

  // Try Piped first
  for (const instance of PIPED_INSTANCES) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const url = `${instance}/search?q=${encodedQuery}&filter=videos`;
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { "Accept": "application/json" }
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        const items = data.items || data;
        if (Array.isArray(items) && items.length > 0) {
          const tracks: Track[] = items
            .filter((item: any) => item.url || item.videoId)
            .slice(0, 15)
            .map((item: any) => {
              const videoId = item.videoId || item.url?.replace("/watch?v=", "");
              return {
                id: videoId || Math.random().toString(36).substring(2, 9),
                title: item.title || "Unknown Track",
                artist: item.uploaderName || item.author || "Unknown Artist",
                album: "YouTube",
                duration: item.duration || 0,
                coverUrl: item.thumbnail?.replace("mqdefault", "hqdefault").replace("default", "hqdefault") || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
                previewUrl: null,
              };
            });

          if (tracks.length > 0) {
            console.log(`[Piped] Found ${tracks.length} results via ${instance}`);
            return tracks;
          }
        }
      }
    } catch (e) {
      console.warn(`[Piped] ${instance} failed:`, e);
    }
  }

  // Fallback: Invidious
  for (const instance of INVIDIOUS_STATIC_FALLBACKS) {
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
            .slice(0, 15)
            .map((item: any) => {
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
                coverUrl: thumbnail?.replace("mqdefault", "hqdefault").replace("default", "hqdefault") || `https://i.ytimg.com/vi/${item.videoId}/hqdefault.jpg`,
                previewUrl: null,
              };
            });

          if (tracks.length > 0) {
            console.log(`[Invidious] Found ${tracks.length} results via ${instance}`);
            return tracks;
          }
        }
      }
    } catch (e) {
      console.warn(`[Invidious] ${instance} failed:`, e);
    }
  }

  throw new Error("Search failed. All streaming nodes are currently offline. Please try again in a moment.");
}
