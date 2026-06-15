export type ViewType = "home" | "search" | "lyrics";

interface NavBarProps {
  currentView: ViewType;
  setView: (v: ViewType) => void;
}

export default function NavBar({ currentView, setView }: NavBarProps) {
  return (
    <nav className="glass-panel flex items-center justify-center space-x-6 py-4 px-8 m-4 rounded-[32px] shadow-lg sticky top-0 z-50">
      <button
        onClick={() => setView("home")}
        className={`flex items-center space-x-2 px-4 py-2 rounded-full transition-all ${
          currentView === "home" ? "bg-white/20 text-white font-bold" : "text-white/60 hover:text-white hover:bg-white/10"
        }`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
        <span className="text-sm">Home</span>
      </button>

      <button
        onClick={() => setView("search")}
        className={`flex items-center space-x-2 px-4 py-2 rounded-full transition-all ${
          currentView === "search" ? "bg-white/20 text-white font-bold" : "text-white/60 hover:text-white hover:bg-white/10"
        }`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <span className="text-sm">Search</span>
      </button>

      <button
        onClick={() => setView("lyrics")}
        className={`flex items-center space-x-2 px-4 py-2 rounded-full transition-all ${
          currentView === "lyrics" ? "bg-white/20 text-white font-bold" : "text-white/60 hover:text-white hover:bg-white/10"
        }`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
        </svg>
        <span className="text-sm">Lyrics</span>
      </button>
    </nav>
  );
}
