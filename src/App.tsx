import { useState } from "react";
import ChatContainer from "./components/ChatContainer";
import SettingsModal from "./components/SettingsModal";
import "./globals.css";
import { ModelOptionsProvider } from "./context/ModelProvider";
import { LocalToolProvider } from "./context/LocalToolContext";
import { WeatherTool } from "./components/WeatherTool";
import { AssistantContextProvider } from "./context/AssistantContext";
import { MCPServerProvider } from "./context/MCPServerContext";
import { SettingsProvider } from "./context/SettingsContext";
import Sidebar from "./components/Sidebar";
import Group from "./components/Group"; // New import
import History from "./components/History"; // New import
import GroupCreationModal from "./components/GroupCreationModal"; // New import
import { ChatContextProvider } from "./context/ChatContext";
import { SessionContextProvider } from "./context/SessionContext";

type CurrentView = "chat" | "group" | "history";

function App() {
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [currentView, setCurrentView] = useState<CurrentView>("chat");
  const [isGroupCreationModalOpen, setIsGroupCreationModalOpen] =
    useState(false); // New state

  const renderMainContent = () => {
    switch (currentView) {
      case "chat":
        return <ChatContainer />;
      case "group":
        return <Group />;
      case "history":
        return <History />;
      default:
        return <ChatContainer />;
    }
  };

  return (
    <div className="h-screen bg-gray-900 text-white flex">
      <SettingsProvider>
        <AssistantContextProvider>
          <SessionContextProvider>
            <ModelOptionsProvider>
              <MCPServerProvider>
                <LocalToolProvider>
                  <ChatContextProvider>
                    <WeatherTool />
                    {/* Sidebar */}
                    <Sidebar
                      isCollapsed={isSidebarCollapsed}
                      onToggleCollapse={() =>
                        setIsSidebarCollapsed(!isSidebarCollapsed)
                      }
                      onOpenSettings={() => setIsSettingsModalOpen(true)}
                      onViewChange={setCurrentView}
                      currentView={currentView}
                      onOpenGroupCreationModal={() =>
                        setIsGroupCreationModalOpen(true)
                      } // Pass new prop
                    />

                    {/* Main Content Area */}
                    <main
                      className={`flex-1 flex flex-col overflow-hidden ${isSidebarCollapsed ? "ml-0" : "ml-64"}`}
                    >
                      <header className="flex justify-between items-center p-4 border-b border-gray-700 flex-shrink-0">
                        <h1 className="text-xl font-bold text-green-400">
                          MCP Agent
                        </h1>
                      </header>
                      <div className="flex-1 overflow-auto">
                        {renderMainContent()}
                      </div>
                    </main>
                    <SettingsModal
                      isOpen={isSettingsModalOpen}
                      onClose={() => setIsSettingsModalOpen(false)}
                    />
                    <GroupCreationModal
                      isOpen={isGroupCreationModalOpen}
                      onClose={() => setIsGroupCreationModalOpen(false)}
                    />
                  </ChatContextProvider>
                </LocalToolProvider>
              </MCPServerProvider>
            </ModelOptionsProvider>
          </SessionContextProvider>
        </AssistantContextProvider>
      </SettingsProvider>
    </div>
  );
}

export default App;
