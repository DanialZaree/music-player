import React, { useState, useCallback } from "react";
import { Track } from "../utils/spotify";
import { searchYouTubeSongs } from "../utils/youtube";

interface SearchViewProps {
  onPlayTrack: (track: Track) => void;
  onAddToPlaylist: (track: Track) => void;
  currentTrack: Track | null;
  isPlaying: boolean;
}

const SearchView: React.FC<SearchViewProps> = ({
  onPlayTrack,
  onAddToPlaylist,
  currentTrack,
  isPlaying,
}) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Track[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [addedTrackIds, setAddedTrackIds] = useState<Set<string>>(new Set());

  const handleSearch = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setSearching(true);
    setError("");
    setResults([]);
    setAddedTrackIds(new Set());

    try {
      const tracks = await searchYouTubeSongs(query.trim());
      setResults(tracks);
    } catch (err: any) {
      setError(err.message || "Search failed. Please try again.");
    } finally {
      setSearching(false);
    }
  }, [query]);

  const formatDuration = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const rSecs = secs % 60;
    return `${mins}:${rSecs < 10 ? "0" : ""}${rSecs}`;
  };

  const handleAddToPlaylist = (track: Track) => {
    onAddToPlaylist(track);
    setAddedTrackIds(prev => new Set(prev).add(track.id));
  };

  return (
    <div className="flex-1 h-full overflow-y-auto p-8 select-none flex flex-col space-y-6">
      {/* Search Header */}
      <div>
        <h2 className="text-3xl font-extrabold tracking-tight text-white mb-1">
          Search Music
        </h2>
        <p className="text-xs text-white/40">
          Find any song instantly. Results are powered by YouTube — completely free, no subscription required.
        </p>
      </div>

      {/* Search Input */}
      <form onSubmit={handleSearch} className="flex gap-3 max-w-2xl">
        <div className="flex-1 relative">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-white/30 absolute left-4 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search for songs, artists, or albums..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={searching}
            className="w-full pl-11 pr-4 py-3.5 rounded-xl glass-input text-sm text-white placeholder-white/20 disabled:opacity-50"
          />
        </div>
        <button
          type="submit"
          disabled={searching || !query.trim()}
          className="px-6 py-3.5 bg-blue-500 hover:bg-blue-400 disabled:bg-blue-500/40 text-white rounded-2xl text-sm font-bold tracking-wide shadow-[0_4px_14px_0_rgba(10,132,255,0.39)] hover:shadow-[0_6px_20px_rgba(10,132,255,0.23)] hover:-translate-y-0.5 transition-all duration-300 shrink-0"
        >
          {searching ? (
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-white animate-ping" />
              Searching...
            </span>
          ) : "Search"}
        </button>
      </form>

      {/* Error message */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-semibold">
          {error}
        </div>
      )}

      {/* Results Grid */}
      {results.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-white/40">
            Results — {results.length} songs found
          </h3>

          <div className="rounded-[24px] glass-panel overflow-hidden border border-white/10 backdrop-blur-3xl bg-white/5">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-white/5 text-white/40 uppercase font-bold tracking-wider select-none bg-white/5">
                    <th className="py-4 px-6 text-center w-16 rounded-tl-2xl">#</th>
                    <th className="py-4 px-6">Title</th>
                    <th className="py-4 px-6 hidden md:table-cell">Channel</th>
                    <th className="py-4 px-6 text-center w-24">Duration</th>
                    <th className="py-4 px-6 text-center w-28 rounded-tr-2xl">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {results.map((track, index) => {
                    const isCurrent = currentTrack?.id === track.id;
                    const isAdded = addedTrackIds.has(track.id);

                    return (
                      <tr
                        key={track.id}
                        className={`hover:bg-white/10 cursor-pointer group transition-colors duration-200 ${
                          isCurrent ? "bg-white/10 text-blue-400 font-semibold" : "text-white/80"
                        }`}
                      >
                        {/* Index */}
                        <td className="py-3 px-6 text-center text-white/30">
                          <span className="group-hover:hidden">{index + 1}</span>
                          <span
                            className="hidden group-hover:inline-block text-indigo-400 scale-110 cursor-pointer"
                            onClick={() => onPlayTrack(track)}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 mx-auto fill-current" viewBox="0 0 24 24">
                              <path d="M8 5v14l11-7z" />
                            </svg>
                          </span>
                        </td>

                        {/* Title and thumbnail */}
                        <td className="py-3 px-6" onClick={() => onPlayTrack(track)}>
                          <div className="flex items-center gap-3">
                            <img
                              src={track.coverUrl}
                              alt={track.title}
                              className="w-10 h-10 rounded-lg object-cover shadow-md border border-white/10 shrink-0"
                            />
                            <div className="truncate">
                              <p className={`truncate text-sm ${isCurrent ? "text-indigo-400" : "text-white font-medium"}`}>
                                {track.title}
                              </p>
                              {/* Playing animation */}
                              {isCurrent && isPlaying && (
                                <div className="flex items-end gap-[3px] h-3 mt-1">
                                  <div className="w-[3px] bg-indigo-400 rounded-full animate-bounce [animation-duration:0.6s]" />
                                  <div className="w-[3px] bg-indigo-400 rounded-full animate-bounce [animation-duration:0.8s] [animation-delay:0.15s]" />
                                  <div className="w-[3px] bg-indigo-400 rounded-full animate-bounce [animation-duration:0.5s] [animation-delay:0.3s]" />
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Channel */}
                        <td className="py-3 px-6 hidden md:table-cell text-white/50 truncate max-w-[180px]">
                          {track.artist}
                        </td>

                        {/* Duration */}
                        <td className="py-3 px-6 text-center text-white/40 font-mono">
                          {formatDuration(track.duration)}
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-6 text-center">
                          <div className="flex items-center justify-center gap-2">
                            {/* Play button */}
                            <button
                              onClick={(e) => { e.stopPropagation(); onPlayTrack(track); }}
                              className="w-8 h-8 rounded-full flex items-center justify-center bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white transition-all shadow-[0_0_10px_rgba(10,132,255,0)] hover:shadow-[0_4px_12px_rgba(10,132,255,0.4)]"
                              title="Play Now"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 fill-current ml-[2px]" viewBox="0 0 24 24">
                                <path d="M8 5v14l11-7z" />
                              </svg>
                            </button>
                            {/* Add to playlist button */}
                            <button
                              onClick={(e) => { e.stopPropagation(); handleAddToPlaylist(track); }}
                              disabled={isAdded}
                              className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                                isAdded
                                  ? "bg-teal-500 text-white shadow-[0_4px_12px_rgba(45,212,191,0.4)] cursor-default"
                                  : "bg-white/10 text-white hover:bg-teal-500 hover:text-white hover:shadow-[0_4px_12px_rgba(45,212,191,0.4)]"
                              }`}
                              title={isAdded ? "Added to My Playlist" : "Add to My Playlist"}
                            >
                              {isAdded ? (
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                                </svg>
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Empty state when no results and not searching */}
      {results.length === 0 && !searching && !error && (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-12 glass-panel rounded-[32px] relative overflow-hidden border border-white/10 bg-white/5 backdrop-blur-[40px]">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] bg-blue-500/10 blur-[100px] rounded-full pointer-events-none" />
          
          <div className="w-20 h-20 rounded-full bg-white/10 backdrop-blur-xl border border-white/20 flex items-center justify-center mb-6 shadow-[0_8px_32px_rgba(0,0,0,0.12)] relative text-blue-400">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <h3 className="text-xl font-extrabold text-white mb-2">Search for any song</h3>
          <p className="text-xs text-white/40 max-w-sm leading-relaxed">
            Type a song name, artist, or album above and hit Search. Results stream for free via YouTube — no Premium subscription required!
          </p>
        </div>
      )}
    </div>
  );
};

export default SearchView;
