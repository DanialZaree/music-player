import { Track } from "./spotify";

let cachedClientId: string | null = null;

async function getClientId(): Promise<string> {
  if (cachedClientId) return cachedClientId;

  try {
    const res = await fetch("https://soundcloud.com");
    const html = await res.text();
    const scripts = [...html.matchAll(/src="(https:\/\/a-v2\.sndcdn\.com\/assets\/[^"]+\.js)"/g)];

    for (let i = scripts.length - 1; i >= 0; i--) {
      const scriptUrl = scripts[i][1];
      const sr = await fetch(scriptUrl);
      const js = await sr.text();
      const m = js.match(/client_id:"([a-zA-Z0-9]+)"/);
      if (m) {
        cachedClientId = m[1];
        console.log("[SoundCloud] Got client_id:", cachedClientId);
        return cachedClientId;
      }
    }
  } catch (e) {
    console.warn("[SoundCloud] Failed to auto-fetch client_id:", e);
  }

  // Fallback hardcoded
  cachedClientId = "iErh0hlIS7lC1NEeRzcimBG8NFFF045C";
  return cachedClientId;
}

// Extended Track type to carry the stream endpoint
export interface SCTrack extends Track {
  streamEndpoint: string;
}

export async function searchSoundCloudSongs(query: string): Promise<SCTrack[]> {
  const clientId = await getClientId();
  const url = `https://api-v2.soundcloud.com/search/tracks?q=${encodeURIComponent(query)}&client_id=${clientId}&limit=20`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`SoundCloud search failed (${res.status}). Try a different query.`);

  const data = await res.json();
  const tracks: SCTrack[] = [];

  for (const item of data.collection ?? []) {
    const transcodings: any[] = item.media?.transcodings ?? [];
    const progressive = transcodings.find((t: any) => t.format?.protocol === "progressive");
    if (!progressive) continue;

    const artwork = (item.artwork_url ?? item.user?.avatar_url ?? "")
      .replace("-large", "-t500x500");

    tracks.push({
      id: String(item.id),
      title: item.title ?? "Unknown",
      artist: item.user?.username ?? "Unknown Artist",
      album: "",
      duration: Math.floor((item.duration ?? 0) / 1000),
      coverUrl: artwork,
      previewUrl: null as any,
      streamEndpoint: progressive.url,
    });
  }

  return tracks;
}

export async function resolveSoundCloudStream(streamEndpoint: string): Promise<string> {
  const clientId = await getClientId();
  const res = await fetch(`${streamEndpoint}?client_id=${clientId}`);
  if (!res.ok) throw new Error("Failed to resolve audio stream");
  const data = await res.json();
  if (!data.url) throw new Error("No stream URL in response");
  return data.url as string;
}
