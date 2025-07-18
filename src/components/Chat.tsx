import { useEffect, useRef, useState } from 'react';
import {
  AIServiceConfig,
  AIServiceError,
  AIServiceFactory,
  AIServiceProvider,
  IAIService,
  StreamableMessage
} from '../lib/ai-service';
import { mcpDB, Role } from '../lib/db';
import { useSettings } from '../hooks/use-settings';
import { getLogger } from '../lib/logger';
import { MCPTool, tauriMCPClient } from '../lib/tauri-mcp-client';
import RoleManager from './RoleManager';
import {
  Badge,
  Button,
  CompactModelPicker,
  FileAttachment,
  Input,
  LoadingSpinner,
  StatusIndicator,
  Tabs,
  TabsList,
  TabsTrigger,
} from './ui';

const logger = getLogger('Chat');

interface MessageWithAttachments {
  id: string;
  content: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  thinking?: string; // Added for displaying thinking state (e.g., tool use)
  isStreaming?: boolean;
  attachments?: { name: string; content: string; }[];
}



export default function Chat() {
  const { apiKeys, selectedProvider, setSelectedProvider, selectedModel, setSelectedModel, messageWindowSize } = useSettings();

  const [mode, setMode] = useState('agent');
  const [currentRole, setCurrentRole] = useState<Role | null>(null);
  const [showRoleManager, setShowRoleManager] = useState(false);
  const [showToolsDetail, setShowToolsDetail] = useState(false);

  const [agentMessages, setAgentMessages] = useState<MessageWithAttachments[]>([]);
  const [agentInput, setAgentInput] = useState('');
  const [isAgentLoading, setIsAgentLoading] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<{ name: string; content: string; }[]>([]);
  const [availableTools, setAvailableTools] = useState<MCPTool[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isMCPConnecting, setIsMCPConnecting] = useState(false);
  const [mcpServerStatus, setMcpServerStatus] = useState<Record<string, boolean>>({});
  const [showServerDropdown, setShowServerDropdown] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Chat messages for simple chat mode
  const [messages, setMessages] = useState<MessageWithAttachments[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // AI Service configuration
  const aiServiceConfig: AIServiceConfig = {
    timeout: 30000,
    maxRetries: 3,
    retryDelay: 1000,
    maxTokens: 4096,
    temperature: 0.7,
  };

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

  

  // MCP 서버 전체 상태 계산
  const getMCPStatus = () => {
    const servers = Object.entries(mcpServerStatus);
    if (servers.length === 0) return { color: 'bg-gray-400', status: 'none' };

    const connectedCount = servers.filter(([_, isConnected]) => isConnected).length;
    const totalCount = servers.length;

    if (connectedCount === totalCount) {
      return { color: 'bg-green-400', status: 'all' };
    } else if (connectedCount > 0) {
      return { color: 'bg-yellow-400', status: 'partial' };
    } else {
      return { color: 'bg-red-400', status: 'none' };
    }
  };

  const getStatusText = () => {
    const { status } = getMCPStatus();
    const servers = Object.entries(mcpServerStatus);
    const connectedCount = servers.filter(([_, isConnected]) => isConnected).length;
    const totalCount = servers.length;

    switch (status) {
      case 'all': return `All ${totalCount} servers connected`;
      case 'partial': return `${connectedCount}/${totalCount} servers connected`;
      case 'none': return totalCount > 0 ? `All ${totalCount} servers disconnected` : 'No servers configured';
      default: return 'Unknown status';
    }
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
        aiServiceConfig,
      });
    } catch (error) {
      logger.error('Error sending message:', {error});

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

  useEffect(() => {
    const init = async () => {
      try {
        await mcpDB.init();
        const roles = await mcpDB.getRoles();

        if (roles.length === 0) {
          const defaultRole = await mcpDB.createDefaultRole();
          setCurrentRole(defaultRole);
          await connectToMCP(defaultRole);
        } else {
          const defaultRole = roles.find(r => r.isDefault) || roles[0];
          setCurrentRole(defaultRole);
          await connectToMCP(defaultRole);
        }

        setIsInitialized(true);
      } catch (error) {
        logger.error('Error initializing app:', {error});
        setIsInitialized(true);
      }
    };

    init();
  }, []);

  // 메시지 업데이트 시 자동 스크롤
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, agentMessages]);

  // 드롭다운 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showServerDropdown && !(event.target as Element).closest('.server-dropdown')) {
        setShowServerDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showServerDropdown]);

  const connectToMCP = async (role: Role) => {
    logger.debug(`Starting MCP connection for role: ${role.name}`);
    setIsMCPConnecting(true);

    // 서버 상태 초기화
    const serverStatus: Record<string, boolean> = {};

    try {
      logger.debug(`Role MCP Config:`, {config: role.mcpConfig});

      // 서버 개수 계산 (Claude 형식만 지원)
      const claudeServersCount = role.mcpConfig.mcpServers ? Object.keys(role.mcpConfig.mcpServers).length : 0;
      logger.debug(`Number of servers in config: ${claudeServersCount}`);

      // 각 서버의 연결 상태 추적
      const allServerNames = new Set<string>();

      if (role.mcpConfig.mcpServers) {
        Object.keys(role.mcpConfig.mcpServers).forEach(name => allServerNames.add(name));
      }

      // 모든 서버를 false로 초기화
      allServerNames.forEach(name => {
        serverStatus[name] = false;
      });
      setMcpServerStatus(serverStatus);

      // Tauri MCP 클라이언트로 연결
      logger.debug(`Calling tauriMCPClient.listToolsFromConfig...`);

      // 설정을 Claude 형식으로 Tauri 클라이언트에 전달
      const configForTauri = {
        mcpServers: role.mcpConfig.mcpServers || {}
      };

      logger.debug(`Final config for Tauri (Claude format):`, {config: configForTauri});

      const tools = await tauriMCPClient.listToolsFromConfig(configForTauri);
      logger.debug(`Received tools from Tauri:`, {tools});

      // 연결된 서버들 확인하고 상태 업데이트
      const connectedServers = await tauriMCPClient.getConnectedServers();
      for (const serverName of connectedServers) {
        if (serverStatus.hasOwnProperty(serverName)) {
          serverStatus[serverName] = true;
        }
      }
      setMcpServerStatus({ ...serverStatus });

      setAvailableTools(tools);
      logger.debug(`Total tools loaded: ${tools.length}`);
      logger.debug(`Available tools details:`, {tools});
      logger.debug(`Connected servers:`, {connectedServers});

      if (tools.length > 0) {
        tools.forEach((tool, index) => {
          logger.debug(`Tool ${index + 1}: ${tool.name} - ${tool.description}`);
        });
      } else {
        logger.debug(`No tools found!`);
      }
    } catch (error) {
      logger.error('Error connecting to MCP:', {error});
      // 에러 발생 시 모든 서버를 연결 실패로 표시
      Object.keys(serverStatus).forEach(key => {
        serverStatus[key] = false;
      });
      setMcpServerStatus({ ...serverStatus });
    } finally {
      setIsMCPConnecting(false);
    }
  };

  const handleRoleSelect = async (role: Role) => {
    logger.debug(`Role selected: ${role.name}`);
    setCurrentRole(role);
    await connectToMCP(role);
    setShowRoleManager(false);
    setAgentMessages([]); // Clear messages when switching roles
  };

  const handleRoleUpdate = async (updatedRole: Role) => {
    // 현재 선택된 Role이 업데이트되었을 때
    if (currentRole && currentRole.id === updatedRole.id) {
      setCurrentRole(updatedRole);
      await connectToMCP(updatedRole);
    }
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

  const executeToolCall = async (toolCall: { id: string; type: 'function'; function: { name: string; arguments: string; } }): Promise<{ role: 'tool'; content: string; tool_call_id: string }> => {
    logger.debug(`Executing tool call:`, {toolCall});
    const aiProvidedToolName = toolCall.function.name;
    let serverName: string | undefined;
    let toolName: string | undefined;

    const parts = aiProvidedToolName.split(':');
    if (parts.length >= 2) {
      serverName = parts[0];
      toolName = parts.slice(1).join(':'); // Rejoin in case toolName itself contains colons
    }

    if (!serverName || !toolName) {
      logger.error(`Could not determine serverName or toolName for AI-provided tool name: ${aiProvidedToolName}`);
      return { role: 'tool', content: `Error: Could not find tool '${aiProvidedToolName}' or determine its server.`, tool_call_id: toolCall.id };
    }

    logger.debug(`Parsed tool call - serverName: ${serverName}, toolName: ${toolName}`);
    let toolArguments: Record<string, unknown> = {};

    try {
      toolArguments = JSON.parse(toolCall.function.arguments);
    } catch (parseError) {
      logger.error(`Failed to parse tool arguments for ${toolCall.function.name}:`, {parseError});
      return { role: 'tool', content: `Error: Invalid tool arguments JSON: ${parseError instanceof Error ? parseError.message : String(parseError)}`, tool_call_id: toolCall.id };
    }

    try {
      const result = await tauriMCPClient.callTool(serverName, toolName, toolArguments);
      logger.debug(`Tool execution result for ${toolCall.function.name}:`, {result});
      return { role: 'tool', content: JSON.stringify(result), tool_call_id: toolCall.id };
    } catch (execError) {
      logger.error(`Tool execution failed for ${toolCall.function.name}:`, {execError});
      return { role: 'tool', content: `Error: Tool '${toolCall.function.name}' failed: ${execError instanceof Error ? execError.message : String(execError)}`, tool_call_id: toolCall.id };
    }
  };

  // New helper function to process AI stream and handle tool calls
  const processAIStream = async ({
    aiService,
    initialConversation,
    setMessagesState,
    modelName,
    systemPrompt,
    availableTools,
    aiServiceConfig,
    isAgentMode = false,
  }: {
    aiService: IAIService;
    initialConversation: StreamableMessage[];
    setMessagesState: React.Dispatch<React.SetStateAction<MessageWithAttachments[]>>;
    modelName?: string;
    systemPrompt?: string;
    availableTools?: MCPTool[];
    aiServiceConfig: AIServiceConfig;
    isAgentMode?: boolean;
  }) => {
    let currentConversation: StreamableMessage[] = initialConversation.slice(-messageWindowSize);
    let responseId = (Date.now() + 1).toString();
    let fullResponse = '';
    let toolCallsDetected = false;

    // 빈 응답 메시지 추가
    let initialResponse: MessageWithAttachments = {
      id: responseId,
      content: '',
      role: 'assistant',
      isStreaming: true
    };
    setMessagesState(prev => [...prev, initialResponse]);

    do {
      toolCallsDetected = false;
      let currentChunk = '';
      let isFirstChunk = true;

      for await (const chunk of aiService.streamChat(currentConversation, {
        modelName,
        systemPrompt,
        availableTools,
        config: aiServiceConfig
      })) {
        currentChunk += chunk;

        try {
          const parsedChunk = JSON.parse(currentChunk);
          if (parsedChunk.tool_calls && parsedChunk.tool_calls.length > 0) {
            toolCallsDetected = true;
            // Update the AI's current streaming message to indicate tool use
            setMessagesState(prev => prev.map(msg => msg.id === responseId ? { ...msg, content: fullResponse, thinking: `${isAgentMode ? 'Agent' : 'Assistant'} is using tools...` } : msg));

            for (const toolCall of parsedChunk.tool_calls) {
              const toolResult = await executeToolCall(toolCall);
              // Add tool result to both UI and conversation history
              setMessagesState(prev => [...prev, { id: toolResult.tool_call_id, content: toolResult.content, role: toolResult.role as any }]);
              currentConversation.push({ id: toolResult.tool_call_id, content: toolResult.content, role: toolResult.role as any });
            }
            currentChunk = ''; // Reset chunk after processing tool calls
            break; // Break from inner for-await loop to re-call aiService.streamChat
          } else {
            // Regular content chunk
            if (isFirstChunk) {
              fullResponse = currentChunk;
              isFirstChunk = false;
            } else {
              fullResponse += chunk;
            }
            setMessagesState(prev =>
              prev.map(msg =>
                msg.id === responseId
                  ? { ...msg, content: fullResponse, isStreaming: true }
                  : msg
              )
            );
          }
        } catch (parseError) {
          // If chunk is not JSON (i.e., regular text content or incomplete JSON)
          if (isFirstChunk) {
            fullResponse = currentChunk;
            isFirstChunk = false;
          } else {
            fullResponse += chunk;
          }
          setMessagesState(prev =>
            prev.map(msg =>
              msg.id === responseId
                ? { ...msg, content: fullResponse, isStreaming: true }
                : msg
            )
          );
        }
      }

      // After the inner loop, if no tool calls were detected, the AI's turn is over.
      // If tool calls were detected, the loop will continue, and a new AI message will be created.
      if (!toolCallsDetected) {
        // Finalize the AI's message for this turn
        setMessagesState(prev =>
          prev.map(msg =>
            msg.id === responseId
              ? { ...msg, isStreaming: false }
              : msg
          )
        );
        // Add the AI's final text response to the conversation history
        currentConversation.push({ id: responseId, content: fullResponse, role: 'assistant' });
      } else {
        // If tool calls were detected, prepare for the next turn by creating a new AI message ID
        responseId = (Date.now() + 1).toString();
        fullResponse = '';
        setMessagesState(prev => [...prev, { id: responseId, content: '', role: 'assistant', isStreaming: true }]);
      }

    } while (toolCallsDetected);
  };

  const handleAgentSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
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
      let systemPrompt = currentRole.systemPrompt || "You are a helpful AI assistant.";      if (availableTools.length > 0) {        systemPrompt += `\n\nAvailable tools: ${availableTools.map(t => `${t.name}: ${t.description}`).join(', ')}\nIf a tool call fails, analyze the error message and try to correct your approach.`;      }

      let currentConversation: StreamableMessage[] = [...agentMessages, userMessage].slice(-messageWindowSize).map(msg => ({
        id: msg.id,
        content: msg.content,
        role: msg.role as 'user' | 'assistant' | 'system' | 'tool'
      }));

      let responseId = (Date.now() + 1).toString();
      let fullResponse = '';
      let toolCallsDetected = false;

      // 빈 응답 메시지 추가
      let initialResponse: MessageWithAttachments = {
        id: responseId,
        content: '',
        role: 'assistant',
        isStreaming: true
      };
      setAgentMessages(prev => [...prev, initialResponse]);

      do {
        toolCallsDetected = false;
        let currentChunk = '';
        let isFirstChunk = true;

        for await (const chunk of aiService.streamChat(currentConversation, {
          modelName: selectedModel || undefined,
          systemPrompt,
          availableTools: availableTools.length > 0 ? availableTools : undefined,
          config: aiServiceConfig
        })) {
          currentChunk += chunk;

          try {
            const parsedChunk = JSON.parse(currentChunk);
            if (parsedChunk.tool_calls && parsedChunk.tool_calls.length > 0) {
              toolCallsDetected = true;
              // Process tool calls
              for (const toolCall of parsedChunk.tool_calls) {
                const toolResult = await executeToolCall(toolCall);
                // Add tool result to messages for context
                setAgentMessages(prev => [...prev, { id: toolResult.tool_call_id, content: toolResult.content, role: toolResult.role }]);
                currentConversation.push({ id: toolResult.tool_call_id, content: toolResult.content, role: toolResult.role });
              }
              currentChunk = ''; // Reset chunk after processing tool calls
            } else {
              // Regular content chunk
              if (isFirstChunk) {
                fullResponse = currentChunk;
                isFirstChunk = false;
              } else {
                fullResponse += chunk;
              }
              setAgentMessages(prev =>
                prev.map(msg =>
                  msg.id === responseId
                    ? { ...msg, content: fullResponse, isStreaming: true }
                    : msg
                )
              );
            }
          } catch (parseError) {
            // If chunk is not JSON (i.e., regular text content)
            if (isFirstChunk) {
              fullResponse = currentChunk;
              isFirstChunk = false;
            } else {
              fullResponse += chunk;
            }
            setAgentMessages(prev =>
              prev.map(msg =>
                msg.id === responseId
                  ? { ...msg, content: fullResponse, isStreaming: true }
                  : msg
              )
            );
          }
        }

        // If tool calls were detected, the loop will continue with the updated conversation
        // Otherwise, the AI has finished its response.
      } while (toolCallsDetected);

      // 스트리밍 완료
      setAgentMessages(prev =>
        prev.map(msg =>
          msg.id === responseId
            ? { ...msg, isStreaming: false }
            : msg
        )
      );

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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      AIServiceFactory.disposeAll();
    };
  }, []);

  if (!isInitialized) {
    return (
      <div className="h-screen w-screen bg-black text-green-400 font-mono flex items-center justify-center">
        <div className="flex items-center gap-3">
          <LoadingSpinner size="lg" />
          <div className="text-xl">Initializing MCP Agent...</div>
        </div>
      </div>
    );
  }

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

        {/* Current Role Display */}
        {currentRole && mode === 'agent' && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Role:</span>
            <span className="text-sm text-green-400">{currentRole.name}</span>
            {isMCPConnecting ? (
              <span className="text-xs text-yellow-400">connecting MCP...</span>
            ) : availableTools.length > 0 ? (
              <button
                onClick={() => setShowToolsDetail(true)}
                className="text-xs text-blue-400 hover:text-blue-300 transition-colors cursor-pointer"
              >
                ({availableTools.length} tools)
              </button>
            ) : (
              <span className="text-xs text-gray-500">(no tools)</span>
            )}

            {/* MCP Server Status */}
            {Object.keys(mcpServerStatus).length > 0 && (
              <div className="relative server-dropdown">
                <StatusIndicator
                  status={(() => {
                    const { status } = getMCPStatus();
                    switch (status) {
                      case 'all': return 'connected';
                      case 'partial': return 'unknown';
                      case 'none': return 'disconnected';
                      default: return 'unknown';
                    }
                  })()}
                  label={getStatusText()}
                  showLabel={false}
                />
                <button
                  onClick={() => setShowServerDropdown(!showServerDropdown)}
                  className="absolute inset-0 cursor-pointer"
                  title={getStatusText()}
                />

                {/* Server Status Dropdown */}
                {showServerDropdown && (
                  <div className="absolute top-full right-0 mt-2 bg-gray-800 border border-gray-600 rounded-lg shadow-lg p-3 min-w-[250px] z-50">
                    <div className="text-xs text-gray-400 mb-2 font-medium">MCP Server Status</div>
                    <div className="space-y-2">
                      {Object.entries(mcpServerStatus).map(([serverName, isConnected]) => (
                        <div key={serverName} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <StatusIndicator
                              status={isConnected ? 'connected' : 'disconnected'}
                              size="sm"
                            />
                            <span className="text-xs text-gray-300">{serverName}</span>
                          </div>
                          <Badge variant={isConnected ? 'success' : 'error'} size="sm">
                            {isConnected ? 'OK' : 'NOK'}
                          </Badge>
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 pt-2 border-t border-gray-700">
                      <div className="text-xs text-gray-500">{getStatusText()}</div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {!isInitialized && (
              <span className="text-xs text-yellow-400">initializing...</span>
            )}
          </div>
        )}
      </div>

      {/* Mode Switcher */}
      <div className="bg-gray-950 px-4 py-2 border-b border-gray-700">
        <Tabs value={mode} onValueChange={setMode}>
          <div className="flex justify-between items-center">
            <TabsList>
              <TabsTrigger
                onClick={() => setMode('chat')}
                isActive={mode === 'chat'}
              >
                [chat]
              </TabsTrigger>
              <TabsTrigger
                onClick={() => setMode('agent')}
                isActive={mode === 'agent'}
              >
                [agent]
              </TabsTrigger>
            </TabsList>
            <div className="flex items-center gap-2">
              {mode === 'agent' && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowRoleManager(true)}
                >
                  [manage-roles]
                </Button>
              )}
            </div>
          </div>
        </Tabs>
      </div>

      {/* ModelPicker를 input 위에 항상 inline으로 배치 */}
      <div className="bg-gray-950 px-4 py-3 border-b border-gray-700">
        <CompactModelPicker
          selectedProvider={selectedProvider}
          selectedModel={selectedModel}
          onProviderChange={setSelectedProvider}
          onModelChange={setSelectedModel}
          className=""
        />
      </div>

      {/* Messages */}
      <div className="flex-1 p-4 overflow-y-auto space-y-2 pb-20 terminal-scrollbar">
        {mode === 'chat' ? (
          messages.map(m => (
            <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-xs lg:max-w-md px-3 py-2 rounded ${m.role === 'user' ? 'bg-blue-900/50 text-blue-200' : 'bg-gray-800/50 text-gray-200'
                }`}>
                <div className="text-xs text-gray-400 mb-1">
                  {m.role === 'user' ? 'You' : 'Assistant'}
                </div>
                <div className="whitespace-pre-wrap text-sm">{m.content}</div>
                {m.thinking && (
                  <div className="flex items-center gap-2 mt-2 text-sm text-gray-400 bg-gray-900/70 h-8 overflow-hidden px-2 rounded">
                    <LoadingSpinner size="sm" /> {m.thinking}
                  </div>
                )}
              </div>
            </div>
          ))
        ) : (
          agentMessages.map(m => (
            <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-full lg:max-w-3xl px-3 py-2 rounded ${m.role === 'user' ? 'bg-blue-900/50 text-blue-200' : 'bg-gray-800/50 text-gray-200'
                }`}>
                <div className="text-xs text-gray-400 mb-1">
                  {m.role === 'user' ? 'You' : `Agent (${currentRole?.name})`}
                </div>
                <div className="whitespace-pre-wrap text-sm">{m.content}</div>
                {m.thinking && (
                  <div className="flex items-center gap-2 mt-2 text-sm text-gray-400 bg-gray-900/70 h-8 overflow-hidden px-2 rounded">
                    <LoadingSpinner size="sm" /> {m.thinking}
                  </div>
                )}
                {m.attachments && m.attachments.length > 0 && (
                  <div className="mt-2 text-xs text-gray-400">
                    📎 {m.attachments.length} file(s) attached
                  </div>
                )}
              </div>
            </div>
          ))
        )}

        {mode === 'chat' && isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
          <div className="flex justify-start">
            <div className="bg-gray-800/50 text-gray-200 rounded px-3 py-2">
              <div className="text-xs text-gray-400 mb-1">Assistant</div>
              <div className="text-sm">typing...</div>
            </div>
          </div>
        )}
        {mode === 'agent' && isAgentLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-800/50 text-gray-200 rounded px-3 py-2">
              <div className="text-xs text-gray-400 mb-1">Agent ({currentRole?.name})</div>
              <div className="text-sm">thinking...</div>
            </div>
          </div>
        )}

        {/* 스크롤 마커 */}
        <div ref={messagesEndRef} />
      </div>

      {/* Role Manager Modal */}
      {showRoleManager && (
        <RoleManager
          onClose={() => setShowRoleManager(false)}
          onRoleSelect={handleRoleSelect}
          onRoleUpdate={handleRoleUpdate}
          currentRole={currentRole}
        />
      )}

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
      {mode === 'agent' && attachedFiles.length > 0 && (
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
        onSubmit={mode === 'chat' ? handleSubmit : handleAgentSubmit}
        className="bg-gray-950 px-4 py-4 border-t border-gray-700 flex items-center gap-2"
      >
        <span className="text-green-400 font-bold flex-shrink-0">$</span>
        <div className="flex-1 flex items-center gap-2 min-w-0">
          <Input
            variant="terminal"
            value={mode === 'chat' ? input : agentInput}
            onChange={mode === 'chat' ? handleInputChange : handleAgentInputChange}
            placeholder={mode === 'chat' ?
              (isLoading ? "processing..." : "enter command...") :
              (isAgentLoading ? "agent busy..." : "query agent...")
            }
            disabled={mode === 'chat' ? isLoading : isAgentLoading}
            className="flex-1 caret-green-400 min-w-0"
            autoComplete="off"
            spellCheck="false"
          />

          {mode === 'agent' && (
            <FileAttachment
              files={attachedFiles}
              onRemove={removeAttachedFile}
              onAdd={handleFileAttachment}
              compact={true}
            />
          )}
        </div>

        <Button
          type="submit"
          disabled={mode === 'chat' ? isLoading : isAgentLoading}
          variant="ghost"
          size="sm"
          className="px-1"
        >
          ⏎
        </Button>
      </form>
    </div>
  );
}