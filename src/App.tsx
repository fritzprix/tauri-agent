import Chat from "./components/Chat";
import "./globals.css";
import { useSettings } from "./hooks/use-settings";
import SettingsModal from "./components/SettingsModal";
import Button from "./components/ui/Button";

function App() {
  const { isSettingsOpen, openSettings, closeSettings } = useSettings();

  return (
    <div className="h-screen bg-gray-900 text-white flex flex-col">
      <header className="flex justify-between items-center p-4 border-b border-gray-700">
        <h1 className="text-xl font-bold text-green-400">MCP Agent</h1>
        <Button onClick={openSettings}>Settings</Button>
      </header>
      <main className="flex-1 overflow-hidden">
        <Chat />
      </main>
      <SettingsModal isOpen={isSettingsOpen} onClose={closeSettings} />
    </div>
  );
}

export default App;
