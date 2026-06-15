import React, { useEffect, useRef, useState } from "react";
import { Track } from "../utils/spotify";
import { searchYouTubeTrack } from "../utils/youtube";
import { VisualizerType } from "../App";

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
  shuffleMode: boolean;
  setShuffleMode: (shuffle: boolean) => void;
  repeatMode: boolean;
  setRepeatMode: (repeat: boolean) => void;
  visualizerType: VisualizerType;
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
  shuffleMode,
  setShuffleMode,
  repeatMode,
  setRepeatMode,
  visualizerType,
  currentTime,
  setCurrentTime,
  duration,
  setDuration
}) => {
  const [volume, setVolume] = useState(70); // 0-100
  const [isMuted, setIsMuted] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [ytLoading, setYtLoading] = useState(false);
  const [ytError, setYtError] = useState("");

  // Refs for audio engines
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ytPlayerRef = useRef<any>(null);
  const ytElementId = "hidden-youtube-player";

  // Canvas visualizer refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);

  // Load YouTube Player IFrame API
  useEffect(() => {
    if (window.YT) {
      initYoutubePlayer();
      return;
    }

    // Load the IFrame API script asynchronously
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
        height: "0",
        width: "0",
        videoId: "",
        playerVars: {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          fs: 0,
          rel: 0,
          showinfo: 0,
          iv_load_policy: 3
        },
        events: {
          onReady: () => {
            console.log("[YT Player] Ready");
            ytPlayerRef.current.setVolume(volume);
          },
          onStateChange: (event: any) => {
            // YT.PlayerState.ENDED is 0
            if (event.data === 0) {
              setIsPlaying(false);
              onNextTrack();
            }
          }
        }
      });
    } catch (e) {
      console.error("[YT Player] Init failed:", e);
    }
  };

  // HTML5 Audio element setup
  useEffect(() => {
    audioRef.current = new Audio();
    audioRef.current.volume = volume / 100;

    const audio = audioRef.current;

    const updateTime = () => setCurrentTime(Math.round(audio.currentTime));
    const handleEnd = () => {
      setIsPlaying(false);
      onNextTrack();
    };
    const updateDuration = () => setDuration(Math.round(audio.duration || 0));

    audio.addEventListener("timeupdate", updateTime);
    audio.addEventListener("ended", handleEnd);
    audio.addEventListener("loadedmetadata", updateDuration);

    return () => {
      audio.removeEventListener("timeupdate", updateTime);
      audio.removeEventListener("ended", handleEnd);
      audio.removeEventListener("loadedmetadata", updateDuration);
      audio.pause();
    };
  }, [onNextTrack]);

  // Handle Play/Pause actions
  const togglePlay = () => {
    if (!currentTrack) return;
    
    if (isPlaying) {
      // Pause active engine
      if (currentTrack.previewUrl) {
        audioRef.current?.pause();
      } else if (ytPlayerRef.current && typeof ytPlayerRef.current.pauseVideo === "function") {
        ytPlayerRef.current.pauseVideo();
      }
      setIsPlaying(false);
    } else {
      // Play active engine
      if (currentTrack.previewUrl) {
        audioRef.current?.play().catch(console.error);
      } else if (ytPlayerRef.current && typeof ytPlayerRef.current.playVideo === "function") {
        ytPlayerRef.current.playVideo();
      }
      setIsPlaying(true);
    }
  };

  // Load new track
  useEffect(() => {
    if (!currentTrack) return;

    // Reset state
    setIsPlaying(false);
    setCurrentTime(0);
    setYtError("");
    
    // Stop both engines first
    audioRef.current?.pause();
    if (audioRef.current) audioRef.current.src = "";
    if (ytPlayerRef.current && typeof ytPlayerRef.current.stopVideo === "function") {
      ytPlayerRef.current.stopVideo();
    }

    if (currentTrack.previewUrl) {
      // Direct stream available
      setDuration(currentTrack.duration);
      if (audioRef.current) {
        audioRef.current.src = currentTrack.previewUrl;
        audioRef.current.load();
        audioRef.current.play()
          .then(() => setIsPlaying(true))
          .catch((e) => console.log("Audio autoplay blocked or failed", e));
      }
    } else {
      // Streaming from YouTube required
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
            setYtError("YouTube Engine failed to initialize. Try again.");
          }
        })
        .catch((err) => {
          setYtLoading(false);
          setYtError(err.message || "Failed to find audio source.");
        });
    }
  }, [currentTrack]);

  // Sync YT current play time
  useEffect(() => {
    if (!isPlaying || currentTrack?.previewUrl) return;

    const interval = setInterval(() => {
      if (ytPlayerRef.current && typeof ytPlayerRef.current.getCurrentTime === "function") {
        const time = Math.round(ytPlayerRef.current.getCurrentTime());
        setCurrentTime(time);
      }
    }, 500);

    return () => clearInterval(interval);
  }, [isPlaying, currentTrack]);

  // Handle Scrubbing
  const handleScrubChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseInt(e.target.value);
    setCurrentTime(newTime);
    
    if (currentTrack?.previewUrl && audioRef.current) {
      audioRef.current.currentTime = newTime;
    } else if (ytPlayerRef.current && typeof ytPlayerRef.current.seekTo === "function") {
      ytPlayerRef.current.seekTo(newTime, true);
    }
  };

  // Sync Volume Changes
  useEffect(() => {
    const vol = isMuted ? 0 : volume;
    if (audioRef.current) {
      audioRef.current.volume = vol / 100;
    }
    if (ytPlayerRef.current && typeof ytPlayerRef.current.setVolume === "function") {
      ytPlayerRef.current.setVolume(vol);
    }
  }, [volume, isMuted]);

  // Canvas visualizer loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Resize listener
    const handleResize = () => {
      const parent = canvas.parentElement;
      if (parent) {
        canvas.width = parent.clientWidth;
        canvas.height = parent.clientHeight;
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);

    // Particles setup for the particle visualizer
    const particles: Array<{ x: number; y: number; r: number; vx: number; vy: number; color: string }> = [];
    const colorTheme = visualizerType === "bars" ? "rgba(99, 102, 241, " : "rgba(20, 184, 166, ";
    for (let i = 0; i < 60; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 2 + 1,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        color: colorTheme + (Math.random() * 0.3 + 0.1) + ")"
      });
    }

    let angle = 0;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const w = canvas.width;
      const h = canvas.height;
      
      // Amplitude modifier based on play state and mock waves
      const amp = isPlaying ? (isMuted ? 0.1 : 0.4 + (volume / 200)) : 0.02;
      const t = Date.now() * 0.003;

      if (visualizerType === "waves") {
        // Draw oscillating sine waves
        ctx.strokeStyle = "rgba(99, 102, 241, 0.4)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i < w; i += 2) {
          const y = h / 2 + Math.sin(i * 0.01 + t) * 35 * amp * Math.sin(i * 0.005 + t * 0.5);
          if (i === 0) ctx.moveTo(i, y);
          else ctx.lineTo(i, y);
        }
        ctx.stroke();

        ctx.strokeStyle = "rgba(20, 184, 166, 0.4)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let i = 0; i < w; i += 2) {
          const y = h / 2 + Math.cos(i * 0.015 - t * 0.8) * 20 * amp * Math.sin(i * 0.008 + t);
          if (i === 0) ctx.moveTo(i, y);
          else ctx.lineTo(i, y);
        }
        ctx.stroke();

        ctx.strokeStyle = "rgba(244, 63, 94, 0.3)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 0; i < w; i += 3) {
          const y = h / 2 + Math.sin(i * 0.02 + t * 1.5) * 15 * amp;
          if (i === 0) ctx.moveTo(i, y);
          else ctx.lineTo(i, y);
        }
        ctx.stroke();
      } else if (visualizerType === "bars") {
        // Draw bouncing frequency bars
        const barWidth = 6;
        const gap = 3;
        const totalBars = Math.floor(w / (barWidth + gap));
        
        ctx.fillStyle = "rgba(99, 102, 241, 0.5)";
        for (let i = 0; i < totalBars; i++) {
          const factor = Math.sin(i * 0.15 + t) * Math.cos(i * 0.05 + t);
          const barHeight = Math.abs(factor) * (h * 0.65) * amp + 2;
          const x = i * (barWidth + gap);
          const y = h - barHeight;
          
          // Draw gradient color bar
          const grad = ctx.createLinearGradient(x, y, x, h);
          grad.addColorStop(0, "rgba(99, 102, 241, 0.8)");
          grad.addColorStop(0.5, "rgba(20, 184, 166, 0.6)");
          grad.addColorStop(1, "rgba(15, 12, 28, 0)");
          
          ctx.fillStyle = grad;
          ctx.fillRect(x, y, barWidth, barHeight);
        }
      } else if (visualizerType === "orbit") {
        // Draw pulsing orbital visualizer
        const radius = Math.min(w, h) * 0.2 + (Math.sin(t * 3) * 8 * amp);
        const cx = w / 2;
        const cy = h / 2;

        // Glowing rays
        const rayCount = 80;
        ctx.strokeStyle = "rgba(20, 184, 166, 0.3)";
        ctx.lineWidth = 1.5;
        for (let i = 0; i < rayCount; i++) {
          const rayAngle = (i / rayCount) * Math.PI * 2 + angle;
          const rayFactor = Math.abs(Math.sin(i * 0.5 + t * 2) * Math.cos(i * 0.2 - t));
          const rayLen = radius + (rayFactor * 40 * amp);
          
          const x1 = cx + Math.cos(rayAngle) * radius;
          const y1 = cy + Math.sin(rayAngle) * radius;
          const x2 = cx + Math.cos(rayAngle) * rayLen;
          const y2 = cy + Math.sin(rayAngle) * rayLen;

          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        }

        // Inner glowing ring
        ctx.fillStyle = "rgba(10, 8, 20, 0.4)";
        ctx.strokeStyle = "rgba(99, 102, 241, 0.8)";
        ctx.lineWidth = 3;
        ctx.shadowColor = "rgba(99, 102, 241, 0.5)";
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.shadowBlur = 0; // reset shadow

        angle += 0.002;
      } else if (visualizerType === "particles") {
        // Draw floating space particles
        for (const p of particles) {
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r + (amp * 2), 0, Math.PI * 2);
          ctx.fill();

          // Connect nearby particles
          for (const other of particles) {
            const dist = Math.hypot(p.x - other.x, p.y - other.y);
            if (dist < 80) {
              ctx.strokeStyle = `rgba(255, 255, 255, ${(1 - dist / 80) * 0.05 * amp})`;
              ctx.lineWidth = 0.5;
              ctx.beginPath();
              ctx.moveTo(p.x, p.y);
              ctx.lineTo(other.x, other.y);
              ctx.stroke();
            }
          }

          // Move
          p.x += p.vx * (1 + amp * 5);
          p.y += p.vy * (1 + amp * 5);

          // Wrap boundaries
          if (p.x < 0) p.x = w;
          if (p.x > w) p.x = 0;
          if (p.y < 0) p.y = h;
          if (p.y > h) p.y = 0;
        }
      }

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      window.removeEventListener("resize", handleResize);
    };
  }, [visualizerType, isPlaying, volume, isMuted]);

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const rSecs = secs % 60;
    return `${mins}:${rSecs < 10 ? "0" : ""}${rSecs}`;
  };

  return (
    <>
      {/* Hidden YouTube Iframe Container */}
      <div className="absolute opacity-0 pointer-events-none w-0 h-0 overflow-hidden">
        <div id={ytElementId} />
      </div>

      {/* Expanded Player overlay card */}
      {isExpanded && currentTrack && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-8 bg-black/60 backdrop-blur-md transition-all duration-300">
          <div className="w-full max-w-4xl h-[550px] rounded-[2.5rem] glass-panel relative overflow-hidden flex flex-col md:flex-row border border-white/10 shadow-2xl">
            {/* Close button */}
            <button
              onClick={() => setIsExpanded(false)}
              className="absolute top-6 right-6 p-2 rounded-full hover:bg-white/10 text-white/50 hover:text-white transition-all z-20"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Left Box: Rotating Vinyl + Title info */}
            <div className="w-full md:w-[45%] p-8 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-white/5 relative z-10 shrink-0">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-blue-500/5 blur-[90px] rounded-full pointer-events-none" />
              
              {/* Spinning Vinyl Vinyl record container */}
              <div className="w-56 h-56 rounded-full bg-neutral-900 border-4 border-neutral-800 relative flex items-center justify-center shadow-2xl shadow-black relative group">
                {/* Vinyl Grooves */}
                <div className="absolute inset-4 rounded-full border border-white/5" />
                <div className="absolute inset-8 rounded-full border border-white/5" />
                <div className="absolute inset-12 rounded-full border border-white/5" />
                <div className="absolute inset-16 rounded-full border border-white/5" />
                
                {/* Album Cover Center */}
                <div className={`w-24 h-24 rounded-full overflow-hidden border border-black shadow-inner absolute z-10 ${isPlaying ? "animate-spin-slow" : ""}`}>
                  <img
                    src={currentTrack.coverUrl}
                    alt={currentTrack.title}
                    className="w-full h-full object-cover"
                  />
                </div>
                {/* Center hole pin */}
                <div className="w-3 h-3 rounded-full bg-[#03000a] border border-white/20 absolute z-20" />
              </div>

              <div className="text-center w-full mt-8 space-y-1.5">
                <h3 className="text-2xl font-black text-white truncate text-glow-primary px-4">
                  {currentTrack.title}
                </h3>
                <p className="text-xs text-white/50 truncate font-semibold uppercase tracking-wider">{currentTrack.artist}</p>
                <p className="text-[10px] text-white/30 truncate font-medium">{currentTrack.album}</p>
              </div>
            </div>

            {/* Right Box: Large Visualizer Area */}
            <div className="flex-1 h-full relative p-8 flex flex-col justify-end">
              <div className="absolute inset-0 z-0">
                <canvas ref={canvasRef} className="w-full h-full" />
              </div>

              {/* Player controllers overlaying the visualizer at the bottom */}
              <div className="relative z-10 w-full space-y-6 bg-black/40 backdrop-blur-md border border-white/5 p-6 rounded-2xl">
                {/* Loader status */}
                {ytLoading && (
                  <div className="text-xs text-blue-300 font-semibold flex items-center gap-2 animate-pulse">
                    <div className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-ping" />
                    Searching & Buffering YouTube Audio Stream...
                  </div>
                )}
                {ytError && (
                  <div className="text-xs text-rose-400 font-semibold flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-rose-500" />
                    {ytError}
                  </div>
                )}

                {/* Progress bar timeline */}
                <div className="space-y-1">
                  <input
                    type="range"
                    min="0"
                    max={duration || 100}
                    value={currentTime}
                    onChange={handleScrubChange}
                    className="w-full accent-blue-400 h-1.5 rounded-lg appearance-none cursor-pointer bg-white/10"
                  />
                  <div className="flex justify-between text-[10px] font-semibold font-mono text-white/40">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                </div>
                {/* Main controls row */}
                <div className="flex items-center justify-between">
                  {/* Shuffle button */}
                  <button
                    onClick={() => setShuffleMode(!shuffleMode)}
                    className={`p-2 rounded-lg transition-colors ${
                      shuffleMode ? "text-indigo-400 shadow-[0_0_8px_rgba(99,102,241,0.4)]" : "text-white/30 hover:text-white/60"
                    }`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                    </svg>
                  </button>

                  <div className="flex items-center gap-6">
                    {/* Previous button */}
                    <button
                      onClick={onPrevTrack}
                      className="p-3 rounded-full bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-all scale-100 hover:scale-105 active:scale-95 border border-white/5"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                        <path d="M6 6h2v12H6zm3.5 6 8.5 6V6z" />
                      </svg>
                    </button>

                    {/* Play/Pause Button */}
                    <button
                      onClick={togglePlay}
                      className="p-5 rounded-full bg-gradient-to-tr from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-750 text-white shadow-xl shadow-indigo-500/20 hover:scale-105 active:scale-95 transition-all"
                    >
                      {isPlaying ? (
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 fill-current" viewBox="0 0 24 24">
                          <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 fill-current ml-0.5" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      )}
                    </button>

                    {/* Next button */}
                    <button
                      onClick={onNextTrack}
                      className="p-3 rounded-full bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-all scale-100 hover:scale-105 active:scale-95 border border-white/5"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                        <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
                      </svg>
                    </button>
                  </div>

                  {/* Repeat button */}
                  <button
                    onClick={() => setRepeatMode(!repeatMode)}
                    className={`p-2 rounded-lg transition-colors ${
                      repeatMode ? "text-indigo-400 shadow-[0_0_8px_rgba(99,102,241,0.4)]" : "text-white/30 hover:text-white/60"
                    }`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 15.07M9 11l-.5-2.5L6 9" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main bottom playback bar - iOS Floating Widget Style */}
      <div className="px-6 pb-6 pt-2">
        <footer className="h-24 bg-white/5 backdrop-blur-[80px] border border-white/10 rounded-[32px] shadow-[0_20px_40px_-10px_rgba(0,0,0,0.3)] flex items-center justify-between px-6 select-none relative z-30">
          
          {/* Left: Track Album Info */}
          <div className="flex items-center gap-4 w-1/4 min-w-[200px]">
            {currentTrack ? (
            <>
              {/* Image with click to expand hover effect */}
              <div
                onClick={() => setIsExpanded(true)}
                className="w-14 h-14 rounded-xl overflow-hidden shadow-lg border border-white/10 relative cursor-pointer group shrink-0"
              >
                <img
                  src={currentTrack.coverUrl}
                  alt={currentTrack.title}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                  </svg>
                </div>
              </div>
              <div className="truncate">
                <p
                  onClick={() => setIsExpanded(true)}
                  className="text-sm font-bold text-white hover:text-indigo-400 cursor-pointer truncate text-glow"
                >
                  {currentTrack.title}
                </p>
                <p className="text-xs text-white/40 truncate">{currentTrack.artist}</p>
              </div>
            </>
          ) : (
            <div className="text-xs text-white/35 font-semibold">Select a song to start listening</div>
          )}
        </div>

        {/* Center: Playback controller */}
        <div className="flex-1 max-w-xl flex flex-col items-center justify-center space-y-2">
          {/* Controls Row */}
          <div className="flex items-center gap-4 sm:gap-6">
            {/* Shuffle Toggle */}
            <button
              onClick={() => setShuffleMode(!shuffleMode)}
              className={`p-1.5 rounded-lg transition-colors ${
                shuffleMode ? "text-indigo-400" : "text-white/30 hover:text-white/60"
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
            </button>

            {/* Back Button */}
            <button
              onClick={onPrevTrack}
              disabled={!currentTrack}
              className="text-white/40 hover:text-white disabled:opacity-30 scale-100 hover:scale-105 active:scale-95 transition-all"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path d="M6 6h2v12H6zm3.5 6 8.5 6V6z" />
              </svg>
            </button>

            {/* Play Button */}
            <button
              onClick={togglePlay}
              disabled={!currentTrack}
              className="p-3.5 rounded-full bg-gradient-to-tr from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-750 text-white disabled:from-indigo-500/50 disabled:to-indigo-600/50 hover:scale-105 active:scale-95 transition-all shadow-lg shadow-indigo-500/10"
            >
              {isPlaying ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                  <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 fill-current ml-0.5" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>

            {/* Skip Button */}
            <button
              onClick={onNextTrack}
              disabled={!currentTrack}
              className="text-white/40 hover:text-white disabled:opacity-30 scale-100 hover:scale-105 active:scale-95 transition-all"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
              </svg>
            </button>

            {/* Repeat Toggle */}
            <button
              onClick={() => setRepeatMode(!repeatMode)}
              className={`p-1.5 rounded-lg transition-colors ${
                repeatMode ? "text-indigo-400" : "text-white/30 hover:text-white/60"
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 15.07M9 11l-.5-2.5L6 9" />
              </svg>
            </button>
          </div>

          {/* Timeline Slider */}
          <div className="w-full flex items-center gap-3">
            <span className="text-[10px] font-semibold font-mono text-white/30 w-8 text-right">
              {formatTime(currentTime)}
            </span>
            <input
              type="range"
              min="0"
              max={duration || 100}
              value={currentTime}
              onChange={handleScrubChange}
              disabled={!currentTrack}
              className="flex-1 accent-indigo-400 h-1 rounded-lg appearance-none cursor-pointer bg-white/10 disabled:opacity-40"
            />
            <span className="text-[10px] font-semibold font-mono text-white/30 w-8">
              {formatTime(duration)}
            </span>
          </div>

          {/* YT Search Loading text underneath the bar */}
          {ytLoading && (
            <span className="text-[10px] text-indigo-400/80 animate-pulse font-semibold flex items-center gap-1.5 leading-none">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-ping inline-block" />
              Streaming YouTube audio stream...
            </span>
          )}
          {ytError && (
            <span className="text-[10px] text-rose-400 font-semibold leading-none truncate max-w-xs">{ytError}</span>
          )}
        </div>

        {/* Right: Audio Volume & Fullscreen Toggle */}
        <div className="w-1/4 min-w-[150px] flex items-center justify-end gap-3.5">
          {/* Visualizer Expand toggle button */}
          {currentTrack && (
            <button
              onClick={() => setIsExpanded(true)}
              title="Expand Visualizer"
              className="p-2 rounded-xl bg-white/5 border border-white/5 text-white/50 hover:text-indigo-400 hover:bg-white/8 transition-all"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </button>
          )}

          {/* Volume control */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsMuted(!isMuted)}
              disabled={!currentTrack}
              className="text-white/40 hover:text-white disabled:opacity-30"
            >
              {isMuted || volume === 0 ? (
                // Mute Icon
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77zM4.27 3 3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.03c1.37-.33 2.61-.98 3.65-1.85L19.73 21 21 19.73 4.27 3zM12 4 9.91 6.09 12 8.18V4z" />
                </svg>
              ) : volume < 50 ? (
                // Volume Low
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z" />
                </svg>
              ) : (
                // Volume High
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                </svg>
              )}
            </button>
            <input
              type="range"
              min="0"
              max="100"
              value={volume}
              onChange={(e) => setVolume(parseInt(e.target.value))}
              disabled={!currentTrack}
              className="w-20 accent-indigo-400 h-1 rounded-lg appearance-none cursor-pointer bg-white/10 disabled:opacity-40"
            />
          </div>
        </div>
      </footer>
      </div>
    </>
  );
};

export default Player;
