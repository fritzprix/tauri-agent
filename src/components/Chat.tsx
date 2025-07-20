import { useState } from "react";
import { ChatContextProvider } from "../context/ChatContext";
import { useRoleContext } from "../context/RoleContext";
import AgentChat from "./AgentChat";
import RoleManager from "./RoleManager";
import SimpleChat from "./SimpleChat";
import { CompactModelPicker } from "./ui";

export default function Chat() {
  const [mode, setMode] = useState<'chat' | 'agent'>('agent');
  const [showRoleManager, setShowRoleManager] = useState(false);
  const { currentRole } = useRoleContext();

  return (
    <div className="h-full w-screen bg-black text-green-400 font-mono flex flex-col rounded-lg overflow-hidden shadow-2xl shadow-green-400/30 relative">
      {/* Terminal Header */}
      <div className="bg-gray-900 px-4 py-3 flex items-center justify-between border-b border-gray-700">
        <div className="flex items-center gap-4">
          <div className="flex gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
          </div>
          <div className="text-sm text-gray-500">mcp-agent@terminal ~ %</div>
        </div>
        {currentRole && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Role:</span>
            <span className="text-sm text-green-400">{currentRole.name}</span>
          </div>
        )}
      </div>
      {/* Mode Switcher */}
      <div className="bg-gray-950 px-4 py-2 border-b border-gray-700">
        <div className="flex justify-between items-center">
          <div className="flex gap-2">
            <button
              className={`text-xs px-2 py-1 rounded ${mode === 'chat' ? 'bg-green-700 text-white' : 'bg-gray-800 text-green-400'}`}
              onClick={() => setMode('chat')}
            >
              [chat]
            </button>
            <button
              className={`text-xs px-2 py-1 rounded ${mode === 'agent' ? 'bg-green-700 text-white' : 'bg-gray-800 text-green-400'}`}
              onClick={() => setMode('agent')}
            >
              [agent]
            </button>
          </div>
          <button
            className="text-xs px-2 py-1 rounded bg-gray-800 text-green-400 hover:bg-green-700 hover:text-white"
            onClick={() => setShowRoleManager(true)}
          >
            [manage-roles]
          </button>
        </div>
      </div>
      {/* ModelPicker를 input 위에 항상 inline으로 배치 */}
      <div className="bg-gray-950 px-4 py-3 border-b border-gray-700">
        <CompactModelPicker
          className=""
        />
      </div>
      {/* Messages */}
      <ChatContextProvider>
        <div className="flex-1 p-4 overflow-y-auto space-y-2 pb-20 terminal-scrollbar">
          {mode === 'chat' ? (
            <SimpleChat
            />
          ) : (
            <AgentChat />
          )}
        </div>
      </ChatContextProvider>
      {/* Role Manager Modal */}
      {showRoleManager && (
        <RoleManager
          onClose={() => setShowRoleManager(false)}
        />
      )}
    </div>
  );
}

