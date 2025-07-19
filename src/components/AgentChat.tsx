import React, { useEffect, useRef, useState } from 'react';
import { useAIStream } from '../hooks/use-ai-stream';
import { useMCPAgent } from '../hooks/use-mcp-agent';
import {
  AIServiceConfig,
  AIServiceError,
  AIServiceFactory,
  AIServiceProvider,
  IAIService,
  StreamableMessage
} from '../lib/ai-service';
import { Role } from '../lib/db';
import { getLogger } from '../lib/logger';
import MessageBubble from './MessageBubble';
import {
  Button,
  FileAttachment,
  Input
} from './ui';
import { useRoleManager } from '../context/RoleContext';

const logger = getLogger('AgentChat');

interface MessageWithAttachments extends StreamableMessage {
  attachments?: { name: string; content: string; }[];
}

interface AgentChatProps {
  apiKeys: Record<AIServiceProvider, string>;
  selectedProvider?: string;
  selectedModel?: string;
  messageWindowSize: number;
  currentRole: Role | null;
  aiServiceConfig: AIServiceConfig;
}

const AgentChat: React.FC<AgentChatProps> = ({
  apiKeys,
  selectedProvider,
  selectedModel,
  messageWindowSize,
  aiServiceConfig,
}) => {
  const [agentMessages, setAgentMessages] = useState<MessageWithAttachments[]>([]);
  const [agentInput, setAgentInput] = useState('');
  const [isAgentLoading, setIsAgentLoading] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<{ name: string; content: string; }[]>([]);
  const { currentRole } = useRoleManager();

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { availableTools, showToolsDetail, setShowToolsDetail, executeToolCall, connectToMCP } = useMCPAgent();
  const { processAIStream } = useAIStream();

  // currentRole이 바뀔 때마다 MCP 서버에 연결하여 availableTools를 갱신
  useEffect(() => {
    if (currentRole) {
      connectToMCP(currentRole);
    }
  }, [currentRole, connectToMCP]);

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

  const handleAgentInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAgentInput(e.target.value);
  };

  const handleFileAttachment = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newAttachedFiles: { name: string; content: string; }[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Only allow text files
      if (!file.type.startsWith('text/') && !file.name.match(/\.(txt|md|json|js|ts|tsx|jsx|py|java|cpp|c|h|css|html|xml|yaml|yml|csv)$/i)) {
        alert(`File "${file.name}" is not a supported text file format.`);
        continue;
      }

      // Check file size (max 1MB)
      if (file.size > 1024 * 1024) {
        alert(`File "${file.name}" is too large. Maximum size is 1MB.`);
        continue;
      }

      try {
        const content = await file.text();
        newAttachedFiles.push({ name: file.name, content });
      } catch (error) {
        logger.error(`Error reading file ${file.name}:`, {error});
        alert(`Error reading file "${file.name}".`);
      }
    }

    setAttachedFiles(prev => [...prev, ...newAttachedFiles]);
    // Reset the input to allow selecting the same file again
    e.target.value = '';
  };

  const removeAttachedFile = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleAgentSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    logger.debug("submit!!!", {currentRole, agentInput});
    e.preventDefault();
    if (!agentInput.trim() && attachedFiles.length === 0) return;
    if (!currentRole) return;

    let messageContent = agentInput;
    if (attachedFiles.length > 0) {
      messageContent += '\n\n--- Attached Files ---\n';
      attachedFiles.forEach(file => {
        messageContent += `\n[File: ${file.name}]\n${file.content}\n`;
      });
    }

    const userMessage: MessageWithAttachments = {
      id: Date.now().toString(),
      content: messageContent,
      role: 'user',
      attachments: attachedFiles.length > 0 ? [...attachedFiles] : undefined
    };

    setAgentMessages((prev) => [...prev, userMessage]);
    setAgentInput('');
    setAttachedFiles([]);
    setIsAgentLoading(true);

    try {
      const aiService = getAIService();

      // System prompt 생성
      let systemPrompt = currentRole.systemPrompt || "You are a helpful AI assistant.";
      if (availableTools.length > 0) {
        systemPrompt += `\n\nAvailable tools: ${availableTools.map(t => `${t.name}: ${t.description}`).join(', ')}\nIf a tool call fails, analyze the error message and try to correct your approach.`;
      }

      logger.info("tools: ", {availableTools});

      await processAIStream({
        aiService,
        initialConversation: [...agentMessages, userMessage].map(msg => ({
          id: msg.id,
          content: msg.content,
          role: msg.role as 'user' | 'assistant' | 'system' | 'tool'
        })),
        setMessagesState: setAgentMessages,
        modelName: selectedModel || undefined,
        systemPrompt,
        availableTools: availableTools.length > 0 ? availableTools : undefined,
        aiServiceConfig,
        isAgentMode: true,
        executeToolCall,
        messageWindowSize,
      });

    } catch (error) {
      logger.error('Error sending agent message:', {error});

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
      setAgentMessages(prev => [...prev, errorResponse]);
    } finally {
      setIsAgentLoading(false);
    }
  };

  // 메시지 업데이트 시 자동 스크롤
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [agentMessages]);


  return (
    <div className="flex-1 p-4 overflow-y-auto space-y-2 pb-20 terminal-scrollbar">
      {agentMessages.map(m => (
        <MessageBubble key={m.id} message={m} currentRoleName={currentRole?.name} />
      ))}

      {isAgentLoading && (
        <div className="flex justify-start">
          <div className="bg-gray-800/50 text-gray-200 rounded px-3 py-2">
            <div className="text-xs text-gray-400 mb-1">Agent ({currentRole?.name})</div>
            <div className="text-sm">thinking...</div>
          </div>
        </div>
      )}

      {/* 스크롤 마커 */}
      <div ref={messagesEndRef} />

      {/* Tools Detail Modal */}
      {showToolsDetail && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-green-400 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-green-400">
                Available MCP Tools ({availableTools.length})
              </h2>
              <button
                onClick={() => setShowToolsDetail(false)}
                className="text-gray-400 hover:text-red-400 transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="overflow-y-auto terminal-scrollbar max-h-[60vh]">
              {availableTools.length === 0 ? (
                <div className="text-gray-400 text-center py-8">
                  No MCP tools available. Configure MCP servers in Role Manager.
                </div>
              ) : (
                <div className="space-y-3">
                  {availableTools.map((tool, index) => (
                    <div key={index} className="bg-gray-800 border border-gray-700 rounded p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-blue-400 font-mono text-sm">🔧 {tool.name}</span>
                      </div>
                      {tool.description && (
                        <p className="text-gray-300 text-sm">{tool.description}</p>
                      )}
                      {tool.input_schema && (
                        <details className="mt-2">
                          <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-300">
                            Input Schema
                          </summary>
                          <pre className="text-xs text-gray-500 mt-1 bg-gray-900 p-2 rounded overflow-x-auto">
                            {JSON.stringify(tool.input_schema, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-4 pt-4 border-t border-gray-700">
              <button
                onClick={() => setShowToolsDetail(false)}
                className="w-full bg-green-600 hover:bg-green-500 text-white py-2 rounded transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Attached Files Display */}
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

      {/* Input Area */}
      <form
        onSubmit={handleAgentSubmit}
        className="absolute bottom-0 left-0 right-0 bg-gray-950 px-4 py-4 border-t border-gray-700 flex items-center gap-2"
      >
        <span className="text-green-400 font-bold flex-shrink-0">$</span>
        <div className="flex-1 flex items-center gap-2 min-w-0">
          <Input
            variant="terminal"
            value={agentInput}
            onChange={handleAgentInputChange}
            placeholder={isAgentLoading ? "agent busy..." : "query agent..."}
            disabled={isAgentLoading}
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
          disabled={isAgentLoading}
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

export default AgentChat;
