
import { createContext, useContext, useState, ReactNode } from 'react';
import { CompactModelPicker } from './ui';

interface TerminalHeaderContextType {
  isAgentMode: boolean;
  toggleMode: () => void;
}

const TerminalHeaderContext = createContext<TerminalHeaderContextType | undefined>(undefined);

export const useTerminalHeaderContext = () => {
  const context = useContext(TerminalHeaderContext);
  if (!context) {
    throw new Error('useTerminalHeaderContext must be used within a TerminalHeaderProvider');
  }
  return context;
};

interface TerminalHeaderProps {
  children?: ReactNode;
  currentSessionName: string;
  currentSessionType: string;
}

export default function TerminalHeader({
  children,
  currentSessionName,
  currentSessionType,
}: TerminalHeaderProps) {
  const [isAgentMode, setIsAgentMode] = useState(true); // Default to agent mode as per plan

  const toggleMode = () => {
    setIsAgentMode((prev) => !prev);
  };

  return (
    <TerminalHeaderContext.Provider value={{ isAgentMode, toggleMode }}>
      {/* Terminal Header */}
      <div className="bg-gray-900 px-4 py-3 flex items-center justify-between border-b border-gray-700 flex-shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
          </div>
          <div className="text-sm text-gray-500">mcp-agent@terminal ~ %</div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Session:</span>
          <span className="text-sm text-green-400">
            {currentSessionName} ({currentSessionType})
          </span>
        </div>
      </div>

      {/* Mode Switcher */}
      <div className="bg-gray-950 px-4 py-2 border-b border-gray-700 flex-shrink-0">
        <div className="flex justify-between items-center">
          <div className="flex gap-2">
            <button
              className={`text-xs px-2 py-1 rounded ${!isAgentMode ? "bg-green-700 text-white" : "bg-gray-800 text-green-400"}`}
              onClick={() => setIsAgentMode(false)}
            >
              [chat]
            </button>
            <button
              className={`text-xs px-2 py-1 rounded ${isAgentMode ? "bg-green-700 text-white" : "bg-gray-800 text-green-400"}`}
              onClick={() => setIsAgentMode(true)}
            >
              [agent]
            </button>
          </div>
          {children}
        </div>
      </div>

      {/* Model Picker */}
      <div className="bg-gray-950 px-4 py-3 border-b border-gray-700 flex-shrink-0">
        <CompactModelPicker className="" />
      </div>
    </TerminalHeaderContext.Provider>
  );
}
