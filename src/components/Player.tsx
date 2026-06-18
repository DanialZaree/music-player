import React, { useEffect, useRef, useState, useCallback } from "react";
import { Track } from "../utils/spotify";
import { searchYouTubeTrack } from "../utils/youtube";

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: (() => void) | undefined;
  }
}

interface PlayerProps {
  currentTrack: Track | null;
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
  onNextTrack: () => void;
  onPrevTrack: () => void;
  repeatMode: boolean;
  setRepeatMode: (repeat: boolean) => void;
  currentTime: number;
  setCurrentTime: (time: number) => void;
  duration: number;
  setDuration: (duration: number) => void;
}

const Player: React.FC<PlayerProps> = ({
  currentTrack,
  isPlaying,
  setIsPlaying,
  onNextTrack,
  onPrevTrack,
  repeatMode,
  setRepeatMode,
  currentTime,
  setCurrentTime,
  duration,
  setDuration
}) => {
  const [ytLoading, setYtLoading] = useState(false);
  const [ytError, setYtError] = useState("");

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ytPlayerRef = useRef<any>(null);
  const ytElementId = "hidden-youtube-player";
  const progressBarRef = useRef<HTMLDivElement>(null);

  // Stable refs for callbacks used inside event listeners
  const onNextTrackRef = useRef(onNextTrack);
  onNextTrackRef.current = onNextTrack;
  const setIsPlayingRef = useRef(setIsPlaying);
  setIsPlayingRef.current = setIsPlaying;
  const setCurrentTimeRef = useRef(setCurrentTime);
  setCurrentTimeRef.current = setCurrentTime;
  const setDurationRef = useRef(setDuration);
  setDurationRef.current = setDuration;

  // Load YouTube API — only once
  useEffect(() => {
    if (window.YT) {
      initYoutubePlayer();
      return;
    }

    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    const firstScriptTag = document.getElementsByTagName("script")[0];
    firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

    window.onYouTubeIframeAPIReady = () => {
      initYoutubePlayer();
    };
  }, []);

  const initYoutubePlayer = () => {
    try {
      if (ytPlayerRef.current) return;
      
      ytPlayerRef.current = new window.YT.Player(ytElementId, {
        height: "200",
        width: "200",
        videoId: "",
        playerVars: { 
          autoplay: 1, 
          controls: 0, 
          disablekb: 1, 
          fs: 0, 
          rel: 0, 
          showinfo: 0, 
          iv_load_policy: 3,
          origin: window.location.origin 
        },
        events: {
          onReady: () => ytPlayerRef.current.setVolume(70),
          onStateChange: (event: any) => {
            if (event.data === 0) { // ENDED
              setIsPlayingRef.current(false);
              onNextTrackRef.current();
            }
          }
        }
      });
    } catch (e) {
      console.error("[YT Player] Init failed:", e);
    }
  };

  // HTML5 Audio element — create once and never recreate
  useEffect(() => {
    const audio = new Audio();
    audio.volume = 0.7;
    audioRef.current = audio;

    const updateTime = () => setCurrentTimeRef.current(Math.round(audio.currentTime));
    const handleEnd = () => {
      setIsPlayingRef.current(false);
      onNextTrackRef.current();
    };
    const updateDuration = () => setDurationRef.current(Math.round(audio.duration || 0));

    audio.addEventListener("timeupdate", updateTime);
    audio.addEventListener("ended", handleEnd);
    audio.addEventListener("loadedmetadata", updateDuration);

    return () => {
      audio.removeEventListener("timeupdate", updateTime);
      audio.removeEventListener("ended", handleEnd);
      audio.removeEventListener("loadedmetadata", updateDuration);
      audio.pause();
    };
  }, []); // Empty deps — only run once

  const togglePlay = useCallback(() => {
    if (!currentTrack) return;
    
    if (isPlaying) {
      if (currentTrack.previewUrl) {
        audioRef.current?.pause();
      } else if (ytPlayerRef.current && typeof ytPlayerRef.current.pauseVideo === "function") {
        ytPlayerRef.current.pauseVideo();
      }
      setIsPlaying(false);
    } else {
      if (currentTrack.previewUrl) {
        audioRef.current?.play().catch(console.error);
      } else if (ytPlayerRef.current && typeof ytPlayerRef.current.playVideo === "function") {
        ytPlayerRef.current.playVideo();
      }
      setIsPlaying(true);
    }
  }, [currentTrack, isPlaying, setIsPlaying]);

  // Load new track
  useEffect(() => {
    if (!currentTrack) return;

    setIsPlaying(false);
    setCurrentTime(0);
    setYtError("");
    
    audioRef.current?.pause();
    if (audioRef.current) audioRef.current.src = "";
    if (ytPlayerRef.current && typeof ytPlayerRef.current.stopVideo === "function") {
      ytPlayerRef.current.stopVideo();
    }

    if (currentTrack.previewUrl) {
      setDuration(currentTrack.duration);
      if (audioRef.current) {
        audioRef.current.src = currentTrack.previewUrl;
        audioRef.current.load();
        audioRef.current.play()
          .then(() => setIsPlaying(true))
          .catch((e) => console.log("Audio autoplay blocked or failed", e));
      }
    } else {
      setYtLoading(true);
      searchYouTubeTrack(currentTrack.title, currentTrack.artist)
        .then((videoId) => {
          setYtLoading(false);
          if (ytPlayerRef.current && typeof ytPlayerRef.current.loadVideoById === "function") {
            ytPlayerRef.current.loadVideoById(videoId);
            ytPlayerRef.current.playVideo();
            setIsPlaying(true);
            setDuration(currentTrack.duration);
          } else {
            setYtError("Failed to init audio.");
          }
        })
        .catch((err) => {
          setYtLoading(false);
          setYtError(err.message || "Failed to find audio.");
        });
    }
  }, [currentTrack]);

  // Sync YT playback time
  useEffect(() => {
    if (!isPlaying || currentTrack?.previewUrl) return;

    const interval = setInterval(() => {
      if (ytPlayerRef.current && typeof ytPlayerRef.current.getCurrentTime === "function") {
        setCurrentTime(Math.round(ytPlayerRef.current.getCurrentTime()));
      }
    }, 500);

    return () => clearInterval(interval);
  }, [isPlaying, currentTrack, setCurrentTime]);

  const handleScrubClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!currentTrack || !progressBarRef.current || !duration) return;
    
    const rect = progressBarRef.current.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const newTime = Math.round(percent * duration);
    
    setCurrentTime(newTime);
    
    if (currentTrack.previewUrl && audioRef.current) {
      audioRef.current.currentTime = newTime;
    } else if (ytPlayerRef.current && typeof ytPlayerRef.current.seekTo === "function") {
      ytPlayerRef.current.seekTo(newTime, true);
    }
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return "0:00";
    const mins = Math.floor(secs / 60);
    const rSecs = Math.floor(secs % 60);
    return `${mins}:${rSecs < 10 ? "0" : ""}${rSecs}`;
  };

  const progressPercent = duration ? (currentTime / duration) * 100 : 0;

  return (
    <>
      {/* Hidden YouTube player — MUST always be in the same place in the tree */}
      <div className="absolute -left-[9999px] top-0 pointer-events-none opacity-0">
        <div id={ytElementId} />
      </div>

      {currentTrack && (
      <footer className="fixed bottom-8 left-1/2 -translate-x-1/2 w-full max-w-4xl px-[32px] z-50">
        <div className="glass-island rounded-[32px] p-6 shadow-2xl relative">
          
          {ytLoading && (
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] text-white/60 animate-pulse font-semibold bg-surface-container px-3 py-1 rounded-full border border-white/10 shadow-lg">
              Buffering stream...
            </div>
          )}
          {ytError && (
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] text-rose-300 font-semibold bg-rose-500/20 px-3 py-1 rounded-full border border-rose-500/20 shadow-lg truncate max-w-[80%]">
              {ytError}
            </div>
          )}
          
          <div className="flex items-center justify-between gap-8 md:gap-12">
            
            {/* Left: Track Info */}
            <div className="hidden md:flex items-center gap-4 w-1/4">
              <div className="w-14 h-14 rounded-2xl overflow-hidden glass-card p-0.5 shrink-0">
                <img 
                  className="w-full h-full object-cover rounded-[14px]" 
                  src={currentTrack.coverUrl} 
                  alt="Thumbnail"
                />
              </div>
              <div className="overflow-hidden">
                <p className="text-white font-bold truncate text-sm">{currentTrack.title}</p>
                <p className="text-secondary text-[10px] uppercase font-bold tracking-widest truncate">{currentTrack.artist}</p>
              </div>
            </div>

            {/* Middle: Controls — no shuffle, no like */}
            <div className="flex-1 flex flex-col items-center gap-4">
              <div className="flex items-center gap-6">
                <button 
                  onClick={onPrevTrack}
                  disabled={!currentTrack}
                  className="text-on-surface-variant hover:text-white transition-colors w-10 h-10 flex items-center justify-center rounded-full glass-btn disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[24px]" style={{ fontVariationSettings: "'FILL' 1" }}>skip_previous</span>
                </button>
                
                <button 
                  onClick={togglePlay}
                  disabled={!currentTrack}
                  className="w-16 h-16 rounded-full flex items-center justify-center text-white glass-btn border border-white/20 hover:scale-105 active:scale-95 disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[32px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                    {isPlaying ? "pause" : "play_arrow"}
                  </span>
                </button>
                
                <button 
                  onClick={onNextTrack}
                  disabled={!currentTrack}
                  className="text-on-surface-variant hover:text-white transition-colors w-10 h-10 flex items-center justify-center rounded-full glass-btn disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[24px]" style={{ fontVariationSettings: "'FILL' 1" }}>skip_next</span>
                </button>
              </div>
              
              {/* Progress Bar */}
              <div className="w-full flex items-center gap-4 px-4">
                <span className="text-[11px] text-on-surface-variant/80 font-label-sm w-10 text-right">{formatTime(currentTime)}</span>
                
                <div 
                  ref={progressBarRef}
                  onClick={handleScrubClick}
                  className="flex-1 h-1.5 bg-white/10 rounded-full relative group cursor-pointer overflow-visible transition-all hover:h-2"
                >
                  {/* Buffer bar */}
                  <div className="absolute inset-y-0 left-0 bg-white/15 rounded-full transition-all" style={{ width: `${Math.min(100, progressPercent + 10)}%` }}></div>
                  
                  {/* Fill */}
                  <div className="absolute inset-y-0 left-0 bg-white rounded-full transition-[width] duration-300 ease-linear" style={{ width: `${progressPercent}%`, boxShadow: '0 0 10px rgba(255,255,255,0.5)' }}></div>
                  
                  {/* Playhead Dot */}
                  <div className="absolute top-1/2 -translate-y-1/2 -ml-1.5 w-3 h-3 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-[0_0_10px_rgba(255,255,255,0.8)]" style={{ left: `${progressPercent}%` }}></div>
                </div>
                
                <span className="text-[11px] text-on-surface-variant/80 font-label-sm w-10">-{formatTime(duration - currentTime)}</span>
              </div>
            </div>

            {/* Right: Volume only — no like button */}
            <div className="hidden md:flex items-center justify-end gap-3 w-1/4">
              <button 
                onClick={() => setRepeatMode(!repeatMode)}
                className={`transition-colors w-9 h-9 flex items-center justify-center rounded-full glass-btn ${repeatMode ? "text-primary border-primary/30 bg-primary/10" : "text-on-surface-variant hover:text-white"}`}
              >
                <span className="material-symbols-outlined text-[18px]">repeat</span>
              </button>
              <div className="flex items-center gap-3 w-24">
                <span className="material-symbols-outlined text-on-surface-variant text-[20px]">volume_up</span>
                <div className="flex-1 h-1 bg-white/10 rounded-full relative group cursor-pointer">
                  <div className="absolute inset-y-0 left-0 bg-white/60 rounded-full" style={{ width: '70%' }}></div>
                  <div className="absolute top-1/2 left-[70%] -translate-y-1/2 -ml-1 w-2 h-2 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </footer>
      )}
    </>
  );
};

export default Player;
