import { useState, useEffect } from "react";
import TitleBar from "./TitleBar";
import NavBar, { ViewType } from "./components/NavBar";
import Player from "./components/Player";
import SearchView from "./components/SearchView";
import LyricsView from "./components/LyricsView";
import { Track } from "./utils/spotify";
import "./App.css";

export type VisualizerType = "bars" | "waves" | "orbit" | "particles";
export type ThemeType = "neon" | "sunset" | "ocean" | "midnight";

function App() {
  const [currentView, setView] = useState<ViewType>("home");
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [shuffleMode, setShuffleMode] = useState(false);
  const [repeatMode, setRepeatMode] = useState(false);
  
  // Customization state
  const [visualizerType, setVisualizerType] = useState<VisualizerType>("bars");
  const [theme, setTheme] = useState<ThemeType>("neon");

  // Audio timings
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const savedVisualizer = localStorage.getItem("aether_visualizer") as VisualizerType || "bars";
    const savedTheme = localStorage.getItem("aether_theme") as ThemeType || "neon";

    setVisualizerType(savedVisualizer);
    setTheme(savedTheme);
  }, []);

  const handlePlayTrack = (track: Track) => {
    setCurrentTrack(track);
    setIsPlaying(true);
  };

  const handleNextTrack = () => {
    // With library removed, next/prev without a playlist might just replay or do nothing
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
  };

  const handlePrevTrack = () => {
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
  };

  const getGreeting = () => {
    const hr = new Date().getHours();
    if (hr < 12) return "Good morning";
    if (hr < 18) return "Good afternoon";
    return "Good evening";
  };

  return (
    <div className={`app-container theme-${theme} bg-[#000000] text-white select-none`}>
      {/* Native-feeling Titlebar for custom frames */}
      <TitleBar />

      {/* Moving colorful ambient backdrop spheres */}
      <div className="blobs-container">
        <div className="blob blob-1" />
        <div className="blob blob-2" />
        <div className="blob blob-3" />
      </div>

      <div className="main-layout z-10 relative flex flex-col items-center">
        {/* Navbar replaces Sidebar */}
        <NavBar currentView={currentView} setView={setView} />

        {/* Dynamic Content Panel */}
        <main className="flex-1 overflow-hidden flex flex-col relative w-full h-full max-w-5xl mx-auto">
          
          {/* View: Home Screen */}
          {currentView === "home" && (
            <div className="flex-1 h-full overflow-y-auto p-8 flex flex-col space-y-8 items-center justify-center text-center">
              <div>
                <h2 className="text-4xl font-extrabold tracking-tight text-white mb-4 drop-shadow-lg">
                  {getGreeting()}
                </h2>
                <p className="text-sm text-white/60 max-w-md mx-auto">
                  Search for your favorite tracks to start listening. Experience music with liquid glass aesthetics.
                </p>
              </div>

              <div
                onClick={() => setView("search")}
                className="p-6 rounded-[32px] glass-panel glass-card-hover cursor-pointer flex flex-col gap-4 items-center max-w-sm w-full mx-auto"
              >
                <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center text-white/80">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8" />
                    <path d="m21 21-4.35-4.35" />
                  </svg>
                </div>
                <div>
                  <h4 className="font-bold text-white text-lg">Search Songs</h4>
                  <p className="text-sm text-white/50 mt-1">
                    Find and play any song instantly
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* View: Search */}
          {currentView === "search" && (
            <SearchView
              onPlayTrack={handlePlayTrack}
              onAddToPlaylist={() => {}} // Disabled since library is removed
              currentTrack={currentTrack}
              isPlaying={isPlaying}
            />
          )}

          {/* View: Lyrics */}
          {currentView === "lyrics" && (
            <LyricsView
              currentTrack={currentTrack}
              currentTime={currentTime}
              duration={duration}
            />
          )}
        </main>
      </div>

      {/* Persistent Audio Controls Footer */}
      <div className="mt-auto z-20 pb-4 px-4 w-full max-w-5xl mx-auto">
        <Player
          currentTrack={currentTrack}
          isPlaying={isPlaying}
          setIsPlaying={setIsPlaying}
          onNextTrack={handleNextTrack}
          onPrevTrack={handlePrevTrack}
          shuffleMode={shuffleMode}
          setShuffleMode={setShuffleMode}
          repeatMode={repeatMode}
          setRepeatMode={setRepeatMode}
          visualizerType={visualizerType}
          currentTime={currentTime}
          setCurrentTime={setCurrentTime}
          duration={duration}
          setDuration={setDuration}
        />
      </div>
    </div>
  );
}

export default App;
