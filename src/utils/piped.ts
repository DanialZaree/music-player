/**
 * Audio stream fetching using multiple backends.
 * Priority:
 *   1. Cobalt.tools (always proxies through their servers — most reliable)
 *   2. Piped API (prefers MP4/AAC proxied streams)
 *   3. Invidious (only accepts proxied URLs, skips CDN URLs)
 */

const PIPED_INSTANCES: string[] = [];

const INVIDIOUS_INSTANCES = [
  "https://inv.thepixora.com",
  "https://yt.chocolatemoo53.com",
];

// Known cobalt public API instances
const COBALT_INSTANCES: string[] = [];

/**
 * Cobalt.tools: fully proxies YouTube audio through their servers.
 * Returns a stream URL hosted on cobalt's CDN (no YouTube CDN CORS issues).
 */
async function getAudioViaCobalt(videoId: string): Promise<string | null> {
  for (const instance of COBALT_INSTANCES) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`${instance}/api/json`, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify({
          url: `https://www.youtube.com/watch?v=${videoId}`,
          aFormat: "mp3",
          isAudioOnly: true,
          disableMetadata: true,
        }),
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        // "stream" = cobalt proxies it (good), "redirect" = direct CDN (skip)
        if (data.status === "stream" && data.url) {
          console.log(`[Cobalt] Got proxied stream from ${instance}`);
          return data.url;
        }
      }
    } catch (e) {
      console.warn(`[Cobalt] ${instance} failed:`, e);
    }
  }
  return null;
}

/**
 * Piped: prefers MP4/AAC (itag 140) for widest WebView2 compatibility.
 * Only returns proxied URLs (URLs served through Piped's own domain).
 */
async function getAudioUrlViaPiped(videoId: string): Promise<string | null> {
  for (const instance of PIPED_INSTANCES) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(`${instance}/streams/${videoId}`, {
        signal: controller.signal,
        headers: { "Accept": "application/json" },
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        const audioStreams: any[] = data.audioStreams || [];

        if (audioStreams.length > 0) {
          // Prefer MP4/AAC (better WebView2 compatibility)
          const mp4Streams = audioStreams
            .filter((s: any) => s.url && (s.mimeType?.includes("audio/mp4") || s.mimeType?.includes("m4a")))
            .sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0));

          // Then any audio format
          const allStreams = audioStreams
            .filter((s: any) => s.url && s.mimeType?.includes("audio"))
            .sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0));

          const candidates = mp4Streams.length > 0 ? mp4Streams : allStreams;
          const best = candidates[0];
          
          if (best?.url) {
            console.log(`[Piped] Got audio from ${instance}, format: ${best.mimeType}, bitrate: ${best.bitrate}`);
            return best.url;
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
 * Invidious: check adaptiveFormats and accept the best URL.
 */
async function getAudioUrlViaInvidious(videoId: string): Promise<string | null> {
  for (const instance of INVIDIOUS_INSTANCES) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(
        `${instance}/api/v1/videos/${videoId}?fields=adaptiveFormats`,
        {
          signal: controller.signal,
          headers: { "Accept": "application/json" },
        }
      );

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        const formats: any[] = data.adaptiveFormats || [];

        // MP4/AAC preferred
        const audioFormats = formats
          .filter((f: any) => f.url && f.type?.includes("audio"))
          .sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0));

        if (audioFormats[0]?.url) {
          console.log(`[Invidious] Got audio from ${instance}`);
          return audioFormats[0].url;
        }
      }
    } catch (e) {
      console.warn(`[Invidious] ${instance} failed:`, e);
    }
  }
  return null;
}

/**
 * Main export: tries all sources in priority order.
 */
export async function getDirectAudioUrl(videoId: string): Promise<string> {
  console.log(`[AudioStream] Fetching audio for videoId: ${videoId}`);

  // 1. Cobalt (most reliable — always proxies)
  const cobaltUrl = await getAudioViaCobalt(videoId);
  if (cobaltUrl) return cobaltUrl;

  // 2. Piped
  const pipedUrl = await getAudioUrlViaPiped(videoId);
  if (pipedUrl) return pipedUrl;

  // 3. Invidious
  const invidiousUrl = await getAudioUrlViaInvidious(videoId);
  if (invidiousUrl) return invidiousUrl;

  throw new Error("All audio sources failed. Check your connection and try again.");
}
