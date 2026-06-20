import { useState, useCallback, useRef, useEffect } from "react";
import TitleBar from "./TitleBar";
import Player from "./components/Player";
import LyricsView from "./components/LyricsView";
import { Track } from "./utils/spotify";
import { searchYouTubeSongs } from "./utils/youtube";
import "./App.css";

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
      <div className="flex-1 overflow-y-auto overflow-x-hidden relative custom-scrollbar">

        {/* Atmospheric Liquid Background */}
        <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
          <div className="absolute top-[-10%] right-[-10%] w-[800px] h-[800px] liquid-accent rounded-full animate-pulse" style={{ animationDuration: '15s' }}></div>
          <div className="absolute bottom-[-20%] left-[-10%] w-[1000px] h-[1000px] liquid-accent rounded-full animate-bounce" style={{ animationDuration: '25s' }}></div>
          <div className="absolute top-[40%] left-[30%] w-[600px] h-[600px] liquid-accent rounded-full animate-pulse" style={{ animationDuration: '20s', animationDelay: '-5s', opacity: 0.15 }}></div>
        </div>

        {/* Header / Search Area */}
        <header className="fixed top-8 left-0 w-full z-40 bg-transparent flex flex-col items-center pt-8 px-[32px]">
          <div ref={searchRef} className="w-full max-w-2xl relative">
            {/* Search Input Bar */}
            <form onSubmit={handleSearch} className="flex items-center glass-island px-6 py-3 rounded-full w-full">
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

            {/* Search Results Dropdown */}
            {showResults && (searchResults.length > 0 || searchError) && (
              <div className="absolute top-full left-0 right-0 mt-3 glass-island rounded-3xl overflow-hidden z-50 max-h-[55vh] flex flex-col shadow-2xl border border-white/20">
                <div className="overflow-y-auto custom-scrollbar">
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
            )}
          </div>
        </header>

        {/* Main Canvas Content */}
        <main className="pt-32 pb-48 px-[32px] flex items-center justify-center min-h-screen relative w-full max-w-6xl mx-auto z-10" onClick={() => setShowResults(false)}>
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
