import React from "react";
import ReactDOM from "react-dom/client";
import { attachConsole } from '@tauri-apps/plugin-log';
import App from "./App";
import { SettingsProvider } from "./context/SettingsContext";

// Initialize Tauri logger
attachConsole().catch(console.error);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <SettingsProvider>
      <App />
    </SettingsProvider>
  </React.StrictMode>,
);
