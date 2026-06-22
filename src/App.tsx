import { useState, useCallback, useRef, useEffect } from "react";
import TitleBar from "./TitleBar";
import Player from "./components/Player";
import LyricsView from "./components/LyricsView";
import { Track } from "./utils/spotify";
import { searchYouTubeSongs } from "./utils/youtube";
import { GlassCard } from "@developer-hub/liquid-glass";
import ColorBends from "./components/ColorBends";
import DotField from "./components/DotField";
import "./App.css";

const BACKGROUND_COLORS = ["#222222", "#111111", "#050505"];

function App() {
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [repeatMode, setRepeatMode] = useState(false);

  // Audio timings
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Search state — lives here so we can wire the header input directly
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Track[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const handlePlayTrack = (track: Track) => {
    // Sync call during click event to unlock audio context
    (window as any).__playerUnlock?.();
    
    setCurrentTrack(track);
    setIsPlaying(true);
    setShowResults(false);
    setSearchQuery("");
  };

  const handleSearch = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setSearching(true);
    setSearchError("");
    setSearchResults([]);
    setShowResults(true);

    try {
      let tracks: Track[] = [];
      
      // Try Rust backend first (no CORS issues)
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        tracks = await invoke<Track[]>("search_youtube_music", { query: searchQuery.trim() });
        console.log(`[Search] Got ${tracks.length} results via Rust backend`);
      } catch (rustErr) {
        console.warn("[Search] Rust backend failed, falling back to JS...", rustErr);
        tracks = await searchYouTubeSongs(searchQuery.trim());
      }

      setSearchResults(tracks);
    } catch (err: any) {
      setSearchError(err.message || "Search failed.");
    } finally {
      setSearching(false);
    }
  }, [searchQuery]);

  const handleNextTrack = useCallback(() => {
    if (!currentTrack) return;
    if (repeatMode) {
      const prevTrack = currentTrack;
      setCurrentTrack(null);
      setTimeout(() => {
        setCurrentTrack(prevTrack);
        setIsPlaying(true);
      }, 50);
      return;
    }
    setIsPlaying(false);
  }, [currentTrack, repeatMode]);

  const handlePrevTrack = useCallback(() => {
    if (!currentTrack) return;
    if (currentTime > 3) {
      if (currentTrack.previewUrl) {
        const audio = document.querySelector("audio");
        if (audio) audio.currentTime = 0;
      } else {
        const prevTrack = currentTrack;
        setCurrentTrack(null);
        setTimeout(() => {
          setCurrentTrack(prevTrack);
          setIsPlaying(true);
        }, 50);
      }
      setCurrentTime(0);
    }
  }, [currentTrack, currentTime]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Sync Media Session (Keyboard Media Keys)
  useEffect(() => {
    if ("mediaSession" in navigator) {
      if (currentTrack) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: currentTrack.title,
          artist: currentTrack.artist,
          album: "YouTube Music",
          artwork: [
            { src: currentTrack.coverUrl, sizes: "512x512", type: "image/jpeg" }
          ]
        });
      } else {
        navigator.mediaSession.metadata = null;
      }

      navigator.mediaSession.setActionHandler("play", () => setIsPlaying(true));
      navigator.mediaSession.setActionHandler("pause", () => setIsPlaying(false));
      navigator.mediaSession.setActionHandler("previoustrack", handlePrevTrack);
      navigator.mediaSession.setActionHandler("nexttrack", handleNextTrack);
    }
  }, [currentTrack, handleNextTrack, handlePrevTrack]);

  useEffect(() => {
    if ("mediaSession" in navigator) {
      navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
    }
  }, [isPlaying]);

  const formatDuration = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const rSecs = secs % 60;
    return `${mins}:${rSecs < 10 ? "0" : ""}${rSecs}`;
  };

  return (
    <div className="text-on-background select-none h-screen flex flex-col bg-background overflow-hidden">
      {/* TitleBar for window controls */}
      <TitleBar />

      {/* Main scrollable area */}
      <div className="flex-1 flex flex-col overflow-y-auto overflow-x-hidden relative custom-scrollbar">

        {/* Atmospheric Liquid Background */}
        <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
          <div className="absolute inset-0">
            <ColorBends
              colors={BACKGROUND_COLORS}
              resolution={0.5}
              speed={0.2}
              frequency={1.0}
              noise={0.15}
              bandWidth={6}
              rotation={90}
              iterations={1}
              intensity={0.8}
              scale={1}
              warpStrength={1}
              mouseInfluence={1}
              parallax={0.5}
              autoRotate={0}
            />
          </div>
          <div className="absolute inset-0 opacity-80">
            <DotField
              dotRadius={1.0}
              dotSpacing={10}
              cursorRadius={50}
              cursorForce={0.00}
              bulgeOnly={true}
              bulgeStrength={67}
              glowRadius={50}
              sparkle={true}
              waveAmplitude={0}
              gradientFrom="#444444"
              gradientTo="#222222"
              glowColor="#111111"
            />
          </div>
        </div>

        {/* Header / Search Area */}
        <header className="fixed top-8 pt-8 left-0 w-full z-40 bg-transparent flex flex-col items-center px-[32px] transition-all duration-700 ease-[cubic-bezier(0.2,0.8,0.2,1)]">
          <div ref={searchRef} className="w-full max-w-[1000px] relative">
            {/* Search Input Bar */}
            <div className="w-full relative" style={{ width: "100%" }}>
              <GlassCard cornerRadius={999} blurAmount={0.02} displacementScale={100} className="w-full relative shadow-lg" style={{ width: "100%", display: "block" }}>
                <form onSubmit={handleSearch} className="flex items-center px-6 py-4 w-full">
              <span className="material-symbols-outlined text-primary mr-4">music_note</span>
              <input
                className="bg-transparent border-none focus:outline-none text-lg text-on-surface placeholder:text-on-surface-variant/40 w-full"
                placeholder="Search YouTube Music..."
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (!e.target.value.trim()) setShowResults(false);
                }}
                onFocus={() => {
                  if (searchResults.length > 0) setShowResults(true);
                }}
              />
              {searching && (
                <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin shrink-0" />
              )}
              {searchQuery && !searching && (
                <button
                  type="button"
                  onClick={() => { setSearchQuery(""); setShowResults(false); setSearchResults([]); }}
                  className="text-on-surface-variant hover:text-white transition-colors shrink-0"
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              )}
              </form>
            </GlassCard>
            </div>

            {/* Search Results Dropdown */}
            {showResults && (searchResults.length > 0 || searchError) && (
              <div className="absolute top-full left-0 right-0 mt-3 z-50">
                <div className="w-full relative shadow-2xl border border-white/10 bg-[#1a1a1a]/60 backdrop-blur-2xl rounded-[24px]">
                  <div className="max-h-[55vh] flex flex-col overflow-hidden rounded-[24px]">
                    <div className="overflow-y-auto overflow-x-hidden custom-scrollbar">
                  {searchError && (
                    <div className="p-4 text-rose-300 text-xs font-semibold text-center">{searchError}</div>
                  )}
                  {searchResults.length > 0 && (
                    <div className="py-2">
                      {searchResults.map((track) => {
                        const isCurrent = currentTrack?.id === track.id;
                        return (
                          <div
                            key={track.id}
                            onClick={() => handlePlayTrack(track)}
                            className={`flex items-center gap-4 px-5 py-3 cursor-pointer transition-colors duration-200 hover:bg-white/10 ${isCurrent ? "bg-white/10" : ""}`}
                          >
                            <img
                              src={track.coverUrl}
                              alt={track.title}
                              className="w-12 h-12 rounded-xl object-cover shadow-md border border-white/10 shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <p className={`truncate text-sm font-semibold ${isCurrent ? "text-primary" : "text-white"}`}>
                                {track.title}
                              </p>
                              <p className="truncate text-xs text-on-surface-variant/60">{track.artist}</p>
                            </div>
                            <span className="text-xs text-on-surface-variant/50 font-mono shrink-0">
                              {formatDuration(track.duration)}
                            </span>
                            <div className="w-8 h-8 rounded-full flex items-center justify-center glass-btn text-primary shrink-0">
                              <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                                {isCurrent && isPlaying ? "pause" : "play_arrow"}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </header>

        {/* Main Canvas Content */}
        <main className="flex-1 flex flex-col items-center justify-center pt-32 pb-48 px-[32px] relative w-full max-w-6xl mx-auto z-10" onClick={() => setShowResults(false)}>
          <LyricsView
            currentTrack={currentTrack}
            currentTime={currentTime}
            duration={duration}
            isPlaying={isPlaying}
            onPlayPause={() => setIsPlaying(!isPlaying)}
          />
        </main>

        {/* Playback Controls Footer */}
        <div className="z-50">
          <Player
            currentTrack={currentTrack}
            isPlaying={isPlaying}
            setIsPlaying={setIsPlaying}
            onNextTrack={handleNextTrack}
            onPrevTrack={handlePrevTrack}
            repeatMode={repeatMode}
            setRepeatMode={setRepeatMode}
            currentTime={currentTime}
            setCurrentTime={setCurrentTime}
            duration={duration}
            setDuration={setDuration}
          />
        </div>

      </div>
    </div>
  );
}

export default App;
