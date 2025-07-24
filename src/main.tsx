import React from "react";
import ReactDOM from "react-dom/client";
import { attachConsole } from "@tauri-apps/plugin-log";
import App from "./App";
import { SettingsProvider } from "./context/SettingsContext";
import { AssistantContextProvider } from "./context/AssistantContext";
import { MCPServerProvider } from "./context/MCPServerContext";

// Initialize Tauri logger
attachConsole().catch(console.error);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <SettingsProvider>
      <MCPServerProvider>
        <AssistantContextProvider>
          <App />
        </AssistantContextProvider>
      </MCPServerProvider>
    </SettingsProvider>
  </React.StrictMode>,
);
