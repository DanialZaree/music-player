import { useState, useEffect } from "react";
import TitleBar from "./TitleBar";
import Sidebar, { ViewType } from "./components/Sidebar";
import Player from "./components/Player";
import PlaylistView from "./components/PlaylistView";
import SearchView from "./components/SearchView";
import SettingsView, { VisualizerType, ThemeType } from "./components/SettingsView";
import LyricsView from "./components/LyricsView";
import { Track, Playlist } from "./utils/spotify";
import "./App.css";

// Out-of-the-box high quality demo playlist (uses public SoundHelix MP3 files for instant playback)
const DEMO_PLAYLIST: Playlist = {
  id: "demo-aether-chill",
  name: "Aether Ambient Chill",
  description: "A gorgeous, hand-curated compilation of retro-synthesizers, organic lo-fi beats, and warm atmospheric swells. Available immediately.",
  coverUrl: "https://images.unsplash.com/photo-1614149162883-504ce4d13909?q=80&w=400&auto=format&fit=crop",
  tracks: [
    {
      id: "lofi-1",
      title: "Lofi Raindrops",
      artist: "Sleepy Fish",
      album: "Velvet Horizons",
      duration: 372,
      coverUrl: "https://images.unsplash.com/photo-1515694346937-94d85e41e6f0?q=80&w=300&auto=format&fit=crop",
      previewUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3"
    },
    {
      id: "synth-2",
      title: "Neon Horizon",
      artist: "Vector Highway",
      album: "Retro Grid 88",
      duration: 423,
      coverUrl: "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?q=80&w=300&auto=format&fit=crop",
      previewUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3"
    },
    {
      id: "aurora-3",
      title: "Solaris Ambient Swell",
      artist: "Solaris Glare",
      album: "Celestial Orbit",
      duration: 502,
      coverUrl: "https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?q=80&w=300&auto=format&fit=crop",
      previewUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3"
    },
    {
      id: "cyber-4",
      title: "Glitch Protocol",
      artist: "Glitch Code",
      album: "Underground Network",
      duration: 341,
      coverUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=300&auto=format&fit=crop",
      previewUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3"
    }
  ]
};

function App() {
  const [currentView, setView] = useState<ViewType>("home");
  const [activePlaylist, setActivePlaylist] = useState<Playlist | null>(DEMO_PLAYLIST);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [shuffleMode, setShuffleMode] = useState(false);
  const [repeatMode, setRepeatMode] = useState(false);
  
  // Customization state
  const [visualizerType, setVisualizerType] = useState<VisualizerType>("bars");
  const [theme, setTheme] = useState<ThemeType>("neon");

  // Custom playlists (user-created)
  const [myPlaylists, setMyPlaylists] = useState<Record<string, Playlist>>({});

  // The "My Playlist" — a single default playlist users can add search results to
  const MY_PLAYLIST_ID = "user-my-playlist";

  // Audio timings
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Load configuration and cached playlists on mount
  useEffect(() => {
    const savedVisualizer = localStorage.getItem("aether_visualizer") as VisualizerType || "bars";
    const savedTheme = localStorage.getItem("aether_theme") as ThemeType || "neon";
    const savedPlaylists = localStorage.getItem("aether_my_playlists");

    setVisualizerType(savedVisualizer);
    setTheme(savedTheme);

    if (savedPlaylists) {
      try {
        const parsed = JSON.parse(savedPlaylists);
        setMyPlaylists(parsed);
      } catch (e) {
        console.error("Failed to parse cached playlists", e);
      }
    }
  }, []);

  // Save playlists whenever they change
  useEffect(() => {
    if (Object.keys(myPlaylists).length > 0) {
      localStorage.setItem("aether_my_playlists", JSON.stringify(myPlaylists));
    }
  }, [myPlaylists]);

  const handleSetVisualizer = (type: VisualizerType) => {
    setVisualizerType(type);
    localStorage.setItem("aether_visualizer", type);
  };

  const handleSetTheme = (newTheme: ThemeType) => {
    setTheme(newTheme);
    localStorage.setItem("aether_theme", newTheme);
  };

  // Add a track from search results to "My Playlist"
  const handleAddToPlaylist = (track: Track) => {
    setMyPlaylists(prev => {
      const existing = prev[MY_PLAYLIST_ID] || {
        id: MY_PLAYLIST_ID,
        name: "My Playlist",
        description: "Your personal collection of songs added from search.",
        coverUrl: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?q=80&w=400&auto=format&fit=crop",
        tracks: [],
      };

      // Don't add duplicates
      if (existing.tracks.find(t => t.id === track.id)) {
        return prev;
      }

      const updated = {
        ...existing,
        tracks: [...existing.tracks, track],
        // Update cover to the latest added track's cover
        coverUrl: track.coverUrl || existing.coverUrl,
      };

      return { ...prev, [MY_PLAYLIST_ID]: updated };
    });
  };

  const handlePlayTrack = (track: Track) => {
    setCurrentTrack(track);
    setIsPlaying(true);
  };

  const handleNextTrack = () => {
    if (!activePlaylist || !currentTrack) return;
    const tracks = activePlaylist.tracks;
    if (tracks.length === 0) return;

    if (repeatMode) {
      const prevTrack = currentTrack;
      setCurrentTrack(null);
      setTimeout(() => {
        setCurrentTrack(prevTrack);
        setIsPlaying(true);
      }, 50);
      return;
    }

    let nextIndex = 0;
    if (shuffleMode && tracks.length > 1) {
      const remainingTracks = tracks.filter((t) => t.id !== currentTrack.id);
      const randomIdx = Math.floor(Math.random() * remainingTracks.length);
      const chosen = remainingTracks[randomIdx];
      nextIndex = tracks.findIndex((t) => t.id === chosen.id);
    } else {
      const currentIdx = tracks.findIndex((t) => t.id === currentTrack.id);
      nextIndex = (currentIdx + 1) % tracks.length;
    }

    setCurrentTrack(tracks[nextIndex]);
    setIsPlaying(true);
  };

  const handlePrevTrack = () => {
    if (!activePlaylist || !currentTrack) return;
    const tracks = activePlaylist.tracks;
    if (tracks.length === 0) return;

    // If more than 3 seconds has passed, restart the song
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
      return;
    }

    let prevIndex = 0;
    const currentIdx = tracks.findIndex((t) => t.id === currentTrack.id);
    if (shuffleMode && tracks.length > 1) {
      const remainingTracks = tracks.filter((t) => t.id !== currentTrack.id);
      const randomIdx = Math.floor(Math.random() * remainingTracks.length);
      const chosen = remainingTracks[randomIdx];
      prevIndex = tracks.findIndex((t) => t.id === chosen.id);
    } else {
      prevIndex = (currentIdx - 1 + tracks.length) % tracks.length;
    }

    setCurrentTrack(tracks[prevIndex]);
    setIsPlaying(true);
  };

  const getGreeting = () => {
    const hr = new Date().getHours();
    if (hr < 12) return "Good morning";
    if (hr < 18) return "Good afternoon";
    return "Good evening";
  };

  return (
    <div className={`app-container theme-${theme} bg-[#03000a] text-white select-none`}>
      {/* Native-feeling Titlebar for custom frames */}
      <TitleBar />

      {/* Moving colorful ambient backdrop spheres */}
      <div className="blobs-container">
        <div className="blob blob-1" />
        <div className="blob blob-2" />
        <div className="blob blob-3" />
      </div>

      <div className="main-layout z-10 relative">
        {/* Sidebar Nav */}
        <Sidebar
          currentView={currentView}
          setView={setView}
          myPlaylistCount={Object.keys(myPlaylists).length}
        />

        {/* Dynamic Content Panel */}
        <main className="flex-1 h-full overflow-hidden flex flex-col relative">
          
          {/* View: Home Screen */}
          {currentView === "home" && (
            <div className="flex-1 h-full overflow-y-auto p-8 flex flex-col space-y-8">
              {/* Welcome Headline */}
              <div>
                <h2 className="text-3xl font-extrabold tracking-tight text-white mb-1">
                  {getGreeting()}, Listener
                </h2>
                <p className="text-xs text-white/40">Select a collection or search for any song to start listening. All music streams free via YouTube.</p>
              </div>

              {/* Collections Grid */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-white/40">Your Collections</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Demo Playlist Box */}
                  <div
                    onClick={() => {
                      setActivePlaylist(DEMO_PLAYLIST);
                      setView("playlists");
                    }}
                    className="p-5 rounded-[32px] glass-panel glass-card-hover cursor-pointer flex gap-5 items-center relative overflow-hidden bg-white/5 backdrop-blur-[40px] border border-white/10"
                  >
                    <img
                      src={DEMO_PLAYLIST.coverUrl}
                      alt={DEMO_PLAYLIST.name}
                      className="w-20 h-20 rounded-[20px] object-cover border border-white/20 shrink-0 shadow-[0_8px_24px_rgba(0,0,0,0.2)]"
                    />
                    <div className="truncate">
                      <span className="text-[10px] px-2.5 py-1 rounded-full font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 uppercase tracking-widest shadow-sm">
                        Built-in
                      </span>
                      <h4 className="font-extrabold text-white text-base mt-2.5 truncate text-glow">
                        {DEMO_PLAYLIST.name}
                      </h4>
                      <p className="text-xs text-white/40 truncate mt-1 leading-snug">
                        {DEMO_PLAYLIST.description}
                      </p>
                    </div>
                  </div>

                  {/* Search CTA Box */}
                  <div
                    onClick={() => setView("search")}
                    className="p-5 rounded-[32px] glass-panel glass-card-hover cursor-pointer flex gap-5 items-center border border-dashed border-white/20 bg-white/5 backdrop-blur-[40px] relative"
                  >
                    <div className="w-20 h-20 rounded-[20px] bg-gradient-to-br from-blue-500/20 to-teal-500/20 border border-white/20 flex items-center justify-center text-blue-400 shrink-0 shadow-inner">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <circle cx="11" cy="11" r="8" />
                        <path d="m21 21-4.35-4.35" />
                      </svg>
                    </div>
                    <div className="truncate">
                      <h4 className="font-bold text-white/80 text-sm truncate">Search & Add Songs</h4>
                      <p className="text-xs text-white/30 truncate mt-1 leading-snug">
                        Find any song, play it instantly, and build your own playlists for free.
                      </p>
                    </div>
                  </div>

                  {/* User-created Playlists */}
                  {Object.values(myPlaylists).map((pl) => (
                    <div
                      key={pl.id}
                      onClick={() => {
                        setActivePlaylist(pl);
                        setView("playlists");
                      }}
                      className="p-5 rounded-[32px] glass-panel glass-card-hover cursor-pointer flex gap-5 items-center bg-white/5 backdrop-blur-[40px] border border-white/10 relative"
                    >
                      <img
                        src={pl.coverUrl}
                        alt={pl.name}
                        className="w-20 h-20 rounded-[20px] object-cover border border-white/20 shrink-0 shadow-[0_8px_24px_rgba(0,0,0,0.2)]"
                      />
                      <div className="truncate">
                        <span className="text-[10px] px-2.5 py-1 rounded-full font-bold bg-teal-500/10 text-teal-400 border border-teal-500/20 uppercase tracking-widest shadow-sm">
                          My Playlist
                        </span>
                        <h4 className="font-extrabold text-white text-base mt-2.5 truncate text-glow">
                          {pl.name}
                        </h4>
                        <p className="text-xs text-white/40 truncate mt-1 leading-snug">
                          {pl.tracks.length} tracks • {pl.description || "Custom playlist"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick Play Section */}
              <div className="space-y-4 flex-1">
                <h3 className="text-xs font-bold uppercase tracking-wider text-white/40">Quick Play</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {DEMO_PLAYLIST.tracks.map((track) => (
                    <div
                      key={track.id}
                      onClick={() => handlePlayTrack(track)}
                      className="p-4 rounded-[24px] glass-panel glass-card-hover cursor-pointer flex flex-col items-center text-center space-y-3 relative group bg-white/5 backdrop-blur-[40px] border border-white/10"
                    >
                      <div className="w-full aspect-square rounded-[16px] overflow-hidden shadow-[0_8px_20px_rgba(0,0,0,0.2)] border border-white/20 relative">
                        <img
                          src={track.coverUrl}
                          alt={track.title}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                          <button className="w-12 h-12 flex items-center justify-center bg-white/20 backdrop-blur-md rounded-full text-white shadow-lg translate-y-2 group-hover:translate-y-0 transition-all border border-white/40">
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 fill-current ml-[2px]" viewBox="0 0 24 24">
                              <path d="M8 5v14l11-7z" />
                            </svg>
                          </button>
                        </div>
                      </div>
                      <div className="w-full truncate px-1">
                        <p className="text-sm font-bold text-white truncate leading-none mb-1 group-hover:text-blue-400 transition-colors">
                          {track.title}
                        </p>
                        <p className="text-[11px] text-white/50 truncate font-medium">{track.artist}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* View: Search */}
          {currentView === "search" && (
            <SearchView
              onPlayTrack={handlePlayTrack}
              onAddToPlaylist={handleAddToPlaylist}
              currentTrack={currentTrack}
              isPlaying={isPlaying}
            />
          )}

          {/* View: Playlist/Track Table Library */}
          {currentView === "playlists" && (
            <PlaylistView
              activePlaylist={activePlaylist}
              currentTrack={currentTrack}
              isPlaying={isPlaying}
              onPlayTrack={handlePlayTrack}
              onNavigateToSettings={() => setView("search")}
            />
          )}

          {/* View: Lyrics Scrolling Screen */}
          {currentView === "lyrics" && (
            <LyricsView
              currentTrack={currentTrack}
              currentTime={currentTime}
              duration={duration}
            />
          )}

          {/* View: Config Panel Settings */}
          {currentView === "settings" && (
            <SettingsView
              visualizerType={visualizerType}
              setVisualizerType={handleSetVisualizer}
              theme={theme}
              setTheme={handleSetTheme}
            />
          )}
        </main>
      </div>

      {/* Persistent Audio Controls Footer */}
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
  );
}

export default App;
