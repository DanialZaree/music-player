import React, { useEffect, useRef, useState } from "react";
import { Track } from "../utils/spotify";

interface LyricsViewProps {
  currentTrack: Track | null;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  onPlayPause: () => void;
}

interface LyricLine {
  time: number;
  text: string;
}

const LyricsView: React.FC<LyricsViewProps> = ({ currentTrack, currentTime, isPlaying, onPlayPause }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [lyrics, setLyrics] = useState<LyricLine[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [isSynced, setIsSynced] = useState(true);

  const parseLrc = (lrcStr: string): LyricLine[] => {
    const lines = lrcStr.split('\n');
    const parsed: LyricLine[] = [];
    const regex = /^\[(\d{2}):(\d{2}\.\d{2,3})\]\s*(.*)$/;
    
    for (const line of lines) {
      const match = line.match(regex);
      if (match) {
        const min = parseInt(match[1]);
        const sec = parseFloat(match[2]);
        const time = min * 60 + sec;
        const text = match[3].trim();
        if (text || parsed.length > 0) {
          parsed.push({ time, text: text || "..." });
        }
      }
    }
    return parsed;
  };

  useEffect(() => {
    if (!currentTrack) {
      setLyrics([]);
      return;
    }

    const cleanTitle = (title: string) => {
      let t = title
        .replace(/\(.*?(official|lyric|video|audio|performance).*?\)/gi, '')
        .replace(/\[.*?(official|lyric|video|audio|performance).*?\]/gi, '')
        .replace(/\|.*$/g, ''); // Remove anything after a pipe
      
      // Extract title if formatted as "Artist - Title"
      if (t.includes(' - ')) {
        const parts = t.split(' - ');
        t = parts.slice(1).join(' - '); // Take everything after the first dash
      }
      return t.replace(/['"]/g, '').trim();
    };

    const cleanArtist = (artist: string, title: string) => {
      // If the title has "Artist - Title", prefer the artist from the title
      if (title.includes(' - ')) {
        return title.split(' - ')[0].trim();
      }
      return artist.replace(/ - Topic$/i, '').trim();
    };

    const fetchLyrics = async () => {
      setLoading(true);
      try {
        const t = cleanTitle(currentTrack.title);
        const a = cleanArtist(currentTrack.artist, currentTrack.title);
        
        // Use the search API which is much more forgiving than exact match 'get'
        const query = `${t} ${a}`.trim();
        const url = `https://lrclib.net/api/search?q=${encodeURIComponent(query)}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("Search failed");
        const results = await res.json();
        
        if (!results || results.length === 0) {
          throw new Error("No lyrics found");
        }

        // Prefer synced lyrics, otherwise take the first plain text
        const bestResult = results.find((r: any) => r.syncedLyrics) || results[0];

        if (bestResult.syncedLyrics) {
          setIsSynced(true);
          setLyrics(parseLrc(bestResult.syncedLyrics));
        } else if (bestResult.plainLyrics) {
          setIsSynced(false);
          const plainLines = bestResult.plainLyrics.split('\n').map((text: string) => ({ time: 0, text: text.trim() || "..." }));
          setLyrics(plainLines);
        } else {
          throw new Error("Empty lyrics payload");
        }
      } catch (err) {
        console.warn("[Lyrics] Failed to fetch lyrics:", err);
        setLyrics([]);
      } finally {
        setLoading(false);
      }
    };

    fetchLyrics();
  }, [currentTrack]);

  useEffect(() => {
    if (lyrics.length === 0 || !isSynced) {
      setActiveIndex(-1);
      return;
    }

    let currentActive = -1;
    for (let i = 0; i < lyrics.length; i++) {
      if (currentTime >= lyrics[i].time) {
        currentActive = i;
      } else {
        break;
      }
    }
    setActiveIndex(currentActive);
  }, [currentTime, lyrics, isSynced]);

  useEffect(() => {
    if (activeIndex === -1 || !containerRef.current) return;
    const activeEl = containerRef.current.children[activeIndex] as HTMLElement;
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    }
  }, [activeIndex]);

  if (!currentTrack) {
    return (
      <div className="flex flex-col items-center justify-center text-on-surface-variant/50 w-full h-full">
        <span className="material-symbols-outlined text-[64px] mb-4 opacity-50">music_note</span>
        <h2 className="font-display-lg text-2xl">No Track Selected</h2>
      </div>
    );
  }

  return (
    <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
      {/* Left: Album Art */}
      <div className="flex justify-center lg:justify-end w-full">
        <div className="w-full max-w-[500px] aspect-square rounded-[48px] overflow-hidden glass-card p-2 group relative z-10">
          <img 
            className="w-full h-full object-cover rounded-[40px] shadow-[0_20px_40px_rgba(0,0,0,0.4)]" 
            src={currentTrack.coverUrl} 
            alt={currentTrack.title} 
          />
          {/* Play Overlay (Hover) */}
          <div 
            onClick={onPlayPause}
            className="absolute inset-2 bg-background/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm cursor-pointer z-20 rounded-[40px]"
          >
            <div className="w-24 h-24 glass-btn rounded-full flex items-center justify-center text-white shadow-glow hover:scale-110 transition-transform">
              <span className="material-symbols-outlined text-5xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                {isPlaying ? "pause" : "play_arrow"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Right: Track Info & Lyrics */}
      <div className="flex flex-col items-center lg:items-start text-center lg:text-left h-full w-full max-h-[70vh]">
        <div className="mb-4">
          <span className="px-4 py-1.5 glass-island rounded-full text-[12px] font-bold tracking-[0.2em] text-primary uppercase inline-block">
            {isPlaying ? "Currently Playing" : "Paused"}
          </span>
        </div>
        <h2 className="font-display-lg text-display-lg md:text-[64px] text-white mb-2 leading-tight drop-shadow-lg truncate w-full max-w-full">
          {currentTrack.title}
        </h2>
        <p className="font-body-lg text-body-lg text-secondary mb-8 drop-shadow-md truncate w-full max-w-full">
          {currentTrack.artist}
        </p>

        {/* Scrolling Lyrics */}
        <div className="w-full flex-1 relative min-h-[300px] max-h-[400px] rounded-[32px] overflow-hidden bg-transparent backdrop-blur-3xl">
          <div className="w-full h-full overflow-y-auto overflow-x-hidden custom-scrollbar">
            <div ref={containerRef} className="space-y-6 font-body-lg text-[22px] leading-[1.8] text-center lg:text-left py-6 px-6 pb-32">
            {loading ? (
              <p className="lyric-inactive animate-pulse">Loading lyrics...</p>
            ) : lyrics.length === 0 ? (
              <p className="lyric-inactive">Instrumental or lyrics unavailable.</p>
            ) : (
              lyrics.map((line, idx) => {
                const isActive = isSynced ? idx === activeIndex : false;
                return (
                  <p 
                    key={idx} 
                    className={`transition-all duration-500 transform origin-center lg:origin-left ${
                      isActive 
                        ? "lyric-active font-medium scale-105" 
                        : "lyric-inactive hover:text-white/60"
                    }`}
                  >
                    {line.text}
                  </p>
                );
              })
            )}
          </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LyricsView;
