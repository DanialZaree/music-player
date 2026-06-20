import { getCurrentWindow } from '@tauri-apps/api/window';

const appWindow = getCurrentWindow();

export default function TitleBar() {
  return (
    <div
      data-tauri-drag-region
      className="relative shrink-0 h-8 flex justify-between items-center z-50 bg-white/5 backdrop-blur-md border-b border-white/10 select-none"
    >
      <div 
        data-tauri-drag-region 
        className="text-[10px] font-bold text-white/50 tracking-widest uppercase px-4 h-full flex items-center w-full"
      >
        Music Player
      </div>
      <div className="flex h-full shrink-0">
        <button
          onClick={() => appWindow.minimize()}
          className="w-12 h-full flex items-center justify-center hover:bg-white/10 text-white/60 hover:text-white transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
          </svg>
        </button>
        <button
          onClick={() => appWindow.toggleMaximize()}
          className="w-12 h-full flex items-center justify-center hover:bg-white/10 text-white/60 hover:text-white transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          </svg>
        </button>
        <button
          onClick={() => appWindow.close()}
          className="w-12 h-full flex items-center justify-center hover:bg-red-500 text-white/60 hover:text-white transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
