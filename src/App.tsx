import { useState } from "react";
import Chat from "./components/Chat";
import SettingsModal from "./components/SettingsModal";
import Button from "./components/ui/Button";
import { ChatContextProvider } from "./context/ChatContext";
import "./globals.css";
import { ModelOptionsProvider } from "./context/ModelProvider";
import { LocalToolProvider } from "./context/LocalToolContext";
import { WeatherTool } from "./components/WeatherTool";
import { AssistantContextProvider } from "./context/AssistantContext";
import { MCPServerProvider } from "./context/MCPServerContext";
import { SettingsProvider } from "./context/SettingsContext";

function App() {
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  return (
    <div className="h-screen bg-gray-900 text-white flex flex-col">
      <header className="flex justify-between items-center p-4 border-b border-gray-700">
        <h1 className="text-xl font-bold text-green-400">MCP Agent</h1>
        <Button onClick={() => setIsSettingsModalOpen(true)}>Settings</Button>
      </header>
      <main className="flex-1 overflow-hidden">
        <SettingsProvider>
          <AssistantContextProvider>
            <ModelOptionsProvider>
              <MCPServerProvider>
                <LocalToolProvider>
                  <WeatherTool />
                  <ChatContextProvider>
                    <Chat />
                  </ChatContextProvider>
                </LocalToolProvider>
              </MCPServerProvider>
              <SettingsModal
                isOpen={isSettingsModalOpen}
                onClose={() => setIsSettingsModalOpen(false)}
              />
            </ModelOptionsProvider>
          </AssistantContextProvider>
        </SettingsProvider>
      </main>
    </div>
  );
}

export default App;
