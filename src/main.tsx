import React from "react";
import ReactDOM from "react-dom/client";
import { attachConsole } from '@tauri-apps/plugin-log';
import App from "./App";
import { SettingsProvider } from "./context/SettingsContext";
import { RoleContextProvider } from "./context/RoleContext";
import { MCPServerProvider } from "./context/MCPServerContext";

// Initialize Tauri logger
attachConsole().catch(console.error);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <SettingsProvider>
      <MCPServerProvider>
        <RoleContextProvider>
          <App />
        </RoleContextProvider>
      </MCPServerProvider>
    </SettingsProvider>
  </React.StrictMode>,
);
