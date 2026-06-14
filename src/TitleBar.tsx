import { getCurrentWindow } from "@tauri-apps/api/window";
import "./TitleBar.css";

const appWindow = getCurrentWindow();

function TitleBar() {
  return (
    <div data-tauri-drag-region className="titlebar">
      <div className="titlebar-logo">
        <img src="/tauri.svg" alt="Tauri" />
        <span>tauri-app</span>
      </div>
      <div className="titlebar-controls">
        <div
          className="titlebar-button"
          id="titlebar-minimize"
          onClick={() => appWindow.minimize()}
        >
          <img
            src="https://api.iconify.design/mdi:minus.svg"
            alt="minimize"
          />
        </div>
        <div
          className="titlebar-button"
          id="titlebar-maximize"
          onClick={() => appWindow.toggleMaximize()}
        >
          <img
            src="https://api.iconify.design/mdi:window-maximize.svg"
            alt="maximize"
          />
        </div>
        <div
          className="titlebar-button titlebar-close"
          id="titlebar-close"
          onClick={() => appWindow.close()}
        >
          <img
            src="https://api.iconify.design/mdi:close.svg"
            alt="close"
          />
        </div>
      </div>
    </div>
  );
}

export default TitleBar;
