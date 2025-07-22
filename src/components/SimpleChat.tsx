import React, { useState, useRef, useEffect } from 'react';
import { StreamableMessage } from '../lib/ai-service';
import { getLogger } from '../lib/logger';
import MessageBubble from './MessageBubble';
import {
  Button,
  Input
} from './ui';
import { useMCPServer } from '../hooks/use-mcp-server';
import ToolsModal from './ToolsModal';
import { useChatContext } from '../hooks/use-chat';
import { ToolCaller } from './orchestrators/ToolCaller';
import { createId } from '@paralleldrive/cuid2';

const logger = getLogger('SimpleChat');

interface SimpleChatProps { }

const SimpleChat: React.FC<SimpleChatProps> = () => {
  const { messages, submit, isLoading } = useChatContext();
  const [input, setInput] = useState('');
  const [showToolsDetail, setShowToolsDetail] = useState(false);
  const { availableTools } = useMCPServer();

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const newMessage: StreamableMessage = {
      id: createId(),
      content: input,
      role: 'user',
    };

    setInput('');

    try {
      await submit(newMessage);
    } catch (error) {
      logger.error('Error sending message:', { error });
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex-1 p-4 overflow-y-auto space-y-2 pb-32 terminal-scrollbar">
      {messages.map(m => (
        <MessageBubble key={m.id} message={m} />
      ))}

      {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
        <div className="flex justify-start">
          <div className="bg-gray-800/50 text-gray-200 rounded px-3 py-2">
            <div className="text-xs text-gray-400 mb-1">Assistant</div>
            <div className="text-sm">typing...</div>
          </div>
        </div>
      )}


      <div ref={messagesEndRef} />


      <div className="absolute bottom-16 left-0 right-0 bg-gray-900/90 px-4 py-2 border-t border-gray-700 flex items-center justify-center">
        <button
          onClick={() => setShowToolsDetail(true)}
          className="text-xs text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
        >
          🔧 {availableTools.length} tools available (click to view)
        </button>
      </div>

      <ToolsModal
        isOpen={showToolsDetail}
        onClose={() => setShowToolsDetail(false)}
      />

      <form
        onSubmit={handleSubmit}
        className="absolute bottom-0 left-0 right-0 bg-gray-950 px-4 py-4 border-t border-gray-700 flex items-center gap-2"
      >
        <span className="text-green-400 font-bold flex-shrink-0">$</span>
        <div className="flex-1 flex items-center gap-2 min-w-0">
          <Input
            variant="terminal"
            value={input}
            onChange={handleInputChange}
            placeholder={isLoading ? "processing..." : "enter command..."}
            disabled={isLoading}
            className="flex-1 caret-green-400 min-w-0"
            autoComplete="off"
            spellCheck="false"
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
      <ToolCaller />
    </div>
  );
};

export default SimpleChat;