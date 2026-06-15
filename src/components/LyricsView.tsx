import React, { useEffect, useRef, useState } from "react";
import { Track } from "../utils/spotify";

interface LyricsViewProps {
  currentTrack: Track | null;
  currentTime: number;
  duration: number;
}

interface LyricLine {
  time: number; // time in seconds when this line is sung
  text: string;
}


const LyricsView: React.FC<LyricsViewProps> = ({ currentTrack, currentTime }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [lyrics, setLyrics] = useState<LyricLine[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [isSynced, setIsSynced] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Helper to parse LRC format
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
        // Skip empty text unless it's just spacing
        if (text || parsed.length > 0) {
          parsed.push({ time, text: text || "..." });
        }
      }
    }
    return parsed;
  };

  // Load or generate lyrics when current track changes
  useEffect(() => {
    if (!currentTrack) {
      setLyrics([]);
      setError(null);
      return;
    }

    // Fetch real lyrics from lrclib.net
    const fetchLyrics = async () => {
      setLoading(true);
      setError(null);
      try {
        const url = `https://lrclib.net/api/get?artist_name=${encodeURIComponent(currentTrack.artist)}&track_name=${encodeURIComponent(currentTrack.title)}`;
        const res = await fetch(url);
        
        if (!res.ok) {
          throw new Error("Lyrics not found");
        }

        const data = await res.json();
        
        if (data.syncedLyrics) {
          setIsSynced(true);
          setLyrics(parseLrc(data.syncedLyrics));
        } else if (data.plainLyrics) {
          setIsSynced(false);
          const plainLines = data.plainLyrics.split('\n').map((text: string) => ({ time: 0, text: text.trim() || "..." }));
          setLyrics(plainLines);
        } else {
          throw new Error("No lyrics available");
        }
      } catch (err) {
        console.error("Lyrics fetch error:", err);
        setLyrics([]);
        setError("We couldn't find the lyrics for this song.");
      } finally {
        setLoading(false);
      }
    };

    fetchLyrics();
  }, [currentTrack]);

  // Track active lyric line based on current time
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

  // Scroll active lyric to center
  useEffect(() => {
    if (activeIndex === -1 || !containerRef.current) return;
    
    const activeEl = containerRef.current.children[activeIndex] as HTMLElement;
    if (activeEl) {
      activeEl.scrollIntoView({
        behavior: "smooth",
        block: "center",
        inline: "nearest"
      });
    }
  }, [activeIndex]);

  return (
    <div className="flex-1 h-full flex flex-col md:flex-row p-8 select-none overflow-hidden gap-8">
      {/* Left side: Track Thumbnail & Card */}
      {currentTrack ? (
        <div className="w-full md:w-80 flex flex-col items-center justify-center p-8 rounded-[32px] bg-white/5 backdrop-blur-[50px] border border-white/10 shrink-0 shadow-[0_8px_32px_rgba(0,0,0,0.1)] relative">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 blur-[100px] rounded-full pointer-events-none" />
          
          <div className="w-56 h-56 rounded-3xl overflow-hidden shadow-[0_20px_40px_rgba(0,0,0,0.4)] border border-white/20 relative group mb-8">
            <img
              src={currentTrack.coverUrl}
              alt={currentTrack.title}
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            />
          </div>

          <div className="text-center w-full z-10">
            <h3 className="text-2xl font-black text-white truncate px-2 drop-shadow-md">
              {currentTrack.title}
            </h3>
            <p className="text-sm text-white/60 truncate mt-2 font-medium">{currentTrack.artist}</p>
            <p className="text-[10px] text-white/40 font-bold tracking-widest uppercase mt-4 truncate px-4 py-2 rounded-xl bg-white/10 border border-white/10 shadow-inner">
              {currentTrack.album}
            </p>
          </div>
        </div>
      ) : (
        <div className="w-full md:w-80 flex flex-col items-center justify-center p-6 rounded-[32px] bg-white/5 backdrop-blur-[50px] shrink-0 border border-white/10 text-center text-white/40">
          <p className="text-sm font-semibold">No Track Selected</p>
        </div>
      )}

      {/* Right side: Scrolling Lyrics Container */}
      <div className="flex-1 h-full overflow-y-auto relative rounded-[32px] bg-white/5 backdrop-blur-[50px] p-8 border border-white/10 scroll-smooth shadow-[0_8px_32px_rgba(0,0,0,0.1)]">
        {/* Shadow overlays for scrolling effect */}
        <div className="fixed top-0 left-0 right-0 h-24 bg-gradient-to-b from-black/60 to-transparent pointer-events-none z-10" />
        <div className="fixed bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-black/60 to-transparent pointer-events-none z-10" />

        {loading ? (
          <div className="h-full flex items-center justify-center text-center text-blue-400">
            <div className="space-y-4">
              <svg className="w-10 h-10 animate-spin mx-auto" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <h4 className="text-sm font-semibold text-blue-300">Finding lyrics...</h4>
            </div>
          </div>
        ) : error ? (
          <div className="h-full flex items-center justify-center text-center text-white/30">
            <div className="space-y-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10 text-white/20 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <h4 className="text-sm font-semibold text-white/40">{error}</h4>
            </div>
          </div>
        ) : lyrics.length > 0 ? (
          <div ref={containerRef} className={`space-y-8 py-48 flex flex-col items-center text-center ${!isSynced ? 'justify-start mt-10' : 'justify-center'}`}>
            {!isSynced && (
              <div className="mb-8 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-semibold text-white/40 tracking-wider">
                Lyrics are not time-synced
              </div>
            )}
            {lyrics.map((line, idx) => {
              const isActive = isSynced ? idx === activeIndex : false;
              return (
                <div
                  key={idx}
                  className={`transition-all duration-700 py-3 px-8 rounded-3xl max-w-2xl text-2xl md:text-3xl font-bold leading-tight cursor-default ${
                    isActive
                      ? "text-white scale-110 drop-shadow-xl translate-y-[-4px] bg-white/10 border border-white/10"
                      : isSynced ? "text-white/20 scale-100 hover:text-white/40" : "text-white/60 hover:text-white/80"
                  }`}
                >
                  {line.text}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-center text-white/30">
            <div className="space-y-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10 text-white/25 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
              <h4 className="text-sm font-semibold text-white/40">No Audio Playing</h4>
              <p className="text-xs text-white/25 max-w-[200px]">Play a song to view time-synced scrolling lyrics.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LyricsView;
