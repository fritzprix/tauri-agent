import { createId } from "@paralleldrive/cuid2";
import React, { useEffect, useRef, useState } from "react";
import { ChatContextProvider } from "../context/ChatContext";
import { useRoleContext } from "../context/RoleContext";
import { useChatContext } from "../hooks/use-chat";
import { useMCPServer } from "../hooks/use-mcp-server";
import { StreamableMessage } from "../lib/ai-service";
import { getLogger } from "../lib/logger";
import RoleManager from "./RoleManager";
import { Button, CompactModelPicker, FileAttachment, Input } from "./ui";
import ToolsModal from "./ToolsModal";
import MessageBubble from "./MessageBubble";
import { ToolCaller } from "./orchestrators/ToolCaller";

const logger = getLogger("Chat");

interface ChatProps {
  children?: React.ReactNode;
}

export default function Chat({ children }: ChatProps) {
  const [mode, setMode] = useState<'chat' | 'agent'>('agent');
  const [showRoleManager, setShowRoleManager] = useState(false);
  const { currentRole } = useRoleContext();
  const [showToolsDetail, setShowToolsDetail] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<{ name: string; content: string; }[]>([]);
  const { availableTools } = useMCPServer();
  const [input, setInput] = useState("");
  const { submit, isLoading, messages } = useChatContext();
  const messagesEndRef = useRef<HTMLDivElement>(null);


  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleAgentInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  };

  const handleFileAttachment = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newAttachedFiles: { name: string; content: string; }[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith('text/') && !file.name.match(/\.(txt|md|json|js|ts|tsx|jsx|py|java|cpp|c|h|css|html|xml|yaml|yml|csv)$/i)) {
        alert(`File "${file.name}" is not a supported text file format.`);
        continue;
      }

      if (file.size > 1024 * 1024) {
        alert(`File "${file.name}" is too large. Maximum size is 1MB.`);
        continue;
      }

      try {
        const content = await file.text();
        newAttachedFiles.push({ name: file.name, content });
      } catch (error) {
        logger.error(`Error reading file ${file.name}:`, { error });
        alert(`Error reading file "${file.name}".`);
      }
    }

    setAttachedFiles(prev => [...prev, ...newAttachedFiles]);
    e.target.value = '';
  };

  const removeAttachedFile = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    logger.info("submit!!", currentRole);
    e.preventDefault();
    if (!input.trim() && attachedFiles.length === 0) return;
    if (!currentRole) return;

    let messageContent = input.trim();
    if (attachedFiles.length > 0) {
      messageContent += '\n\n--- Attached Files ---\n';
      attachedFiles.forEach(file => {
        messageContent += `\n[File: ${file.name}]\n${file.content}\n`;
      });
    }

    const userMessage: StreamableMessage = {
      id: createId(),
      content: messageContent,
      role: 'user',
    };

    setInput('');
    setAttachedFiles([]);

    try {
      await submit(userMessage);
    } catch (err) {
      logger.error('Error submitting message:', err);
    }
  };

  return (
    <div className="h-full w-screen bg-black text-green-400 font-mono flex flex-col rounded-lg overflow-hidden shadow-2xl shadow-green-400/30">
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
        {currentRole && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Role:</span>
            <span className="text-sm text-green-400">{currentRole.name}</span>
          </div>
        )}
      </div>

      {/* Mode Switcher */}
      <div className="bg-gray-950 px-4 py-2 border-b border-gray-700 flex-shrink-0">
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

      {/* Model Picker */}
      <div className="bg-gray-950 px-4 py-3 border-b border-gray-700 flex-shrink-0">
        <CompactModelPicker className="" />
      </div>

      {/* Messages Area - Fills space between model picker and bottom UI */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-6 terminal-scrollbar">
          {messages.map(m => (
            <MessageBubble key={m.id} message={m} currentRoleName={currentRole?.name} />
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-gray-800/50 text-gray-200 rounded px-3 py-2">
                <div className="text-xs text-gray-400 mb-1">Agent ({currentRole?.name})</div>
                <div className="text-sm">thinking...</div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Bottom UI Stack - Fixed at bottom */}
      <div className="flex-shrink-0">
        {/* Status bar */}
        <div className="bg-gray-900/90 px-4 py-2 border-t border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Role:</span>
            <span className="text-xs text-green-400">{currentRole?.name || 'None'}</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Tools:</span>
            <button
              onClick={() => setShowToolsDetail(true)}
              className="text-xs text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
            >
              🔧 {availableTools.length} available
            </button>
          </div>
        </div>

        {/* Attached files section */}
        {attachedFiles.length > 0 && (
          <div className="bg-gray-950 px-4 py-2 border-t border-gray-700">
            <div className="text-xs text-gray-500 mb-2">📎 Attached Files:</div>
            <div className="flex flex-wrap gap-2">
              {attachedFiles.map((file, index) => (
                <div key={index} className="flex items-center bg-gray-900 px-2 py-1 rounded border border-gray-700">
                  <span className="text-xs text-green-400 truncate max-w-[150px]">{file.name}</span>
                  <button
                    type="button"
                    onClick={() => removeAttachedFile(index)}
                    className="text-red-400 hover:text-red-300 ml-2 text-xs"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Input form */}
        <form
          onSubmit={handleSubmit}
          className="bg-gray-950 px-4 py-4 border-t border-gray-700 flex items-center gap-2"
        >
          <span className="text-green-400 font-bold flex-shrink-0">$</span>
          <div className="flex-1 flex items-center gap-2 min-w-0">
            <Input
              variant="terminal"
              value={input}
              onChange={handleAgentInputChange}
              placeholder={isLoading ? "agent busy..." : "query agent..."}
              disabled={isLoading}
              className="flex-1 caret-green-400 min-w-0"
              autoComplete="off"
              spellCheck="false"
            />

            <FileAttachment
              files={attachedFiles}
              onRemove={removeAttachedFile}
              onAdd={handleFileAttachment}
              compact={true}
            />
          </div>

          <Button
            type="submit"
            disabled={isLoading}
            variant="ghost"
            size="sm"
            className="px-1"
          >
            ⏎
          </Button>
        </form>
      </div>

      {/* Modals */}
      {showRoleManager && (
        <RoleManager onClose={() => setShowRoleManager(false)} />
      )}
      <ToolsModal
        isOpen={showToolsDetail}
        onClose={() => setShowToolsDetail(false)}
      />
      <ToolCaller />
      {children}
    </div>
  );
}