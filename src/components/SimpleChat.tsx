import React, { useState, useRef, useEffect } from 'react';
import { AIServiceConfig, AIServiceError, AIServiceFactory, AIServiceProvider, IAIService, StreamableMessage } from '../lib/ai-service';
import { Role } from '../lib/db';
import { getLogger } from '../lib/logger';
import { useAIStream } from '../hooks/use-ai-stream';
import MessageBubble from './MessageBubble';
import {
  Button,
  Input
} from './ui';
import { useRoleManager } from '../context/RoleContext';
import { useMCPAgent } from '../hooks/use-mcp-agent';

const logger = getLogger('SimpleChat');

interface MessageWithAttachments extends StreamableMessage {
  attachments?: { name: string; content: string; }[];
}

interface SimpleChatProps {
  apiKeys: Record<AIServiceProvider, string>;
  selectedProvider?: string;
  selectedModel?: string;
  messageWindowSize: number;
  aiServiceConfig: AIServiceConfig;
}

const SimpleChat: React.FC<SimpleChatProps> = ({
  apiKeys,
  selectedProvider,
  selectedModel,
  messageWindowSize,
  aiServiceConfig,
}) => {
  const [messages, setMessages] = useState<MessageWithAttachments[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { processAIStream } = useAIStream();
  const { currentRole } = useRoleManager();
  const { availableTools, connectToMCP } = useMCPAgent();

  useEffect(() => {
    if (currentRole) {
      connectToMCP(currentRole);
    }
  }, [currentRole]);

  // Helper function to get AI service instance
  const getAIService = (): IAIService => {
    if (!selectedProvider) {
      throw new AIServiceError('No AI provider selected', AIServiceProvider.OpenAI);
    }

    const provider = selectedProvider as AIServiceProvider;
    const apiKey = apiKeys[provider];

    if (!apiKey) {
      throw new AIServiceError(`No API key configured for ${provider}`, provider);
    }

    return AIServiceFactory.getService(provider, apiKey, aiServiceConfig);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const newMessage: MessageWithAttachments = {
      id: Date.now().toString(),
      content: input,
      role: 'user',
    };

    setMessages(prev => [...prev, newMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const aiService = getAIService();

      await processAIStream({
        aiService,
        initialConversation: [...messages, newMessage].map(msg => ({
          id: msg.id,
          content: msg.content,
          role: msg.role as 'user' | 'assistant' | 'system' | 'tool'
        })),
        setMessagesState: setMessages,
        modelName: selectedModel || undefined,
        systemPrompt: currentRole?.systemPrompt,
        availableTools: availableTools.length > 0 ? availableTools : undefined, // Simple chat mode does not use tools
        aiServiceConfig,
        isAgentMode: false,
        executeToolCall: async () => { throw new Error('Tool calls not supported in simple chat mode'); }, // Placeholder
        messageWindowSize,
      });
    } catch (error) {
      logger.error('Error sending message:', { error });

      let errorMessage = 'Unknown error occurred';
      if (error instanceof AIServiceError) {
        errorMessage = `AI Service Error (${error.provider}): ${error.message}`;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      const errorResponse: MessageWithAttachments = {
        id: (Date.now() + 1).toString(),
        content: `오류가 발생했습니다: ${errorMessage}`,
        role: 'assistant',
      };
      setMessages(prev => [...prev, errorResponse]);
    } finally {
      setIsLoading(false);
    }
  };

  // 메시지 업데이트 시 자동 스크롤
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex-1 p-4 overflow-y-auto space-y-2 pb-20 terminal-scrollbar">
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

      {/* 스크롤 마커 */}
      <div ref={messagesEndRef} />

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
    </div>
  );
};

export default SimpleChat;
