import { useState, useEffect, useRef } from 'react';
import { mcpDB, Role } from '../lib/db';
import { tauriMCPClient, MCPTool } from '../lib/tauri-mcp-client';
import { getAIService, StreamableMessage } from '../lib/ai-service-simple';
import RoleManager from './RoleManager';

interface MessageWithAttachments {
  id: string;
  content: string;
  role: string;
  thinking?: string;
  isStreaming?: boolean;
  attachments?: { name: string; content: string; }[];
}

export default function Chat() {
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
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Chat messages for simple chat mode (without AI integration for now)
  const [messages, setMessages] = useState<MessageWithAttachments[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

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
      const conversationHistory: StreamableMessage[] = [...messages, newMessage].map(msg => ({
        id: msg.id,
        content: msg.content,
        role: msg.role as 'user' | 'assistant'
      }));

      const responseId = (Date.now() + 1).toString();
      let fullResponse = '';

      // 빈 응답 메시지 추가
      const initialResponse: MessageWithAttachments = {
        id: responseId,
        content: '',
        role: 'assistant',
        isStreaming: true
      };
      setMessages(prev => [...prev, initialResponse]);

      // 스트리밍 응답 처리
      for await (const chunk of aiService.streamChat(conversationHistory)) {
        fullResponse += chunk;
        setMessages(prev => 
          prev.map(msg => 
            msg.id === responseId 
              ? { ...msg, content: fullResponse, isStreaming: true }
              : msg
          )
        );
      }

      // 스트리밍 완료
      setMessages(prev => 
        prev.map(msg => 
          msg.id === responseId 
            ? { ...msg, isStreaming: false }
            : msg
        )
      );
    } catch (error) {
      console.error('Error sending message:', error);
      const errorResponse: MessageWithAttachments = {
        id: (Date.now() + 1).toString(),
        content: `오류가 발생했습니다: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
        console.error('Error initializing app:', error);
        setIsInitialized(true);
      }
    };

    init();
  }, []);

  // 메시지 업데이트 시 자동 스크롤
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, agentMessages]);

  const connectToMCP = async (role: Role) => {
    console.log(`[DEBUG] Starting MCP connection for role: ${role.name}`);
    setIsMCPConnecting(true);
    
    // 서버 상태 초기화
    const serverStatus: Record<string, boolean> = {};
    
    try {
      console.log(`[DEBUG] Role MCP Config:`, JSON.stringify(role.mcpConfig, null, 2));
      console.log(`[DEBUG] Number of servers in config: ${role.mcpConfig.servers?.length || 0}`);
      
      // 각 서버의 연결 상태 추적
      if (role.mcpConfig.servers) {
        for (const server of role.mcpConfig.servers) {
          serverStatus[server.name] = false;
        }
        setMcpServerStatus(serverStatus);
      }
      
      // Tauri MCP 클라이언트로 연결
      console.log(`[DEBUG] Calling tauriMCPClient.listToolsFromConfig...`);
      const tools = await tauriMCPClient.listToolsFromConfig(role.mcpConfig);
      console.log(`[DEBUG] Received tools from Tauri:`, tools);
      
      // 연결된 서버들 확인하고 상태 업데이트
      const connectedServers = await tauriMCPClient.getConnectedServers();
      for (const serverName of connectedServers) {
        if (serverStatus.hasOwnProperty(serverName)) {
          serverStatus[serverName] = true;
        }
      }
      setMcpServerStatus({ ...serverStatus });
      
      setAvailableTools(tools);
      console.log(`[DEBUG] Total tools loaded: ${tools.length}`);
      console.log(`[DEBUG] Connected servers:`, connectedServers);
      
      if (tools.length > 0) {
        tools.forEach((tool, index) => {
          console.log(`[DEBUG] Tool ${index + 1}: ${tool.name} - ${tool.description}`);
        });
      } else {
        console.log(`[DEBUG] No tools found!`);
      }
    } catch (error) {
      console.error('[ERROR] Error connecting to MCP:', error);
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
    console.log(`[DEBUG] Role selected: ${role.name}`);
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
        console.error(`Error reading file ${file.name}:`, error);
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
        systemPrompt += `\n\nAvailable tools: ${availableTools.map(t => `${t.name}: ${t.description}`).join(', ')}`;
      }

      const conversationHistory: StreamableMessage[] = [...agentMessages, userMessage].map(msg => ({
        id: msg.id,
        content: msg.content,
        role: msg.role as 'user' | 'assistant'
      }));

      const responseId = (Date.now() + 1).toString();
      let fullResponse = '';

      // 빈 응답 메시지 추가
      const initialResponse: MessageWithAttachments = {
        id: responseId,
        content: '',
        role: 'assistant',
        isStreaming: true
      };
      setAgentMessages(prev => [...prev, initialResponse]);

      // 스트리밍 응답 처리
      for await (const chunk of aiService.streamChat(conversationHistory, systemPrompt, availableTools)) {
        fullResponse += chunk;
        setAgentMessages(prev => 
          prev.map(msg => 
            msg.id === responseId 
              ? { ...msg, content: fullResponse, isStreaming: true }
              : msg
          )
        );
      }

      // 스트리밍 완료
      setAgentMessages(prev => 
        prev.map(msg => 
          msg.id === responseId 
            ? { ...msg, isStreaming: false }
            : msg
        )
      );

    } catch (error) {
      console.error('Error sending agent message:', error);
      const errorResponse: MessageWithAttachments = {
        id: (Date.now() + 1).toString(),
        content: `오류가 발생했습니다: ${error instanceof Error ? error.message : 'Unknown error'}`,
        role: 'assistant',
      };
      setAgentMessages(prev => [...prev, errorResponse]);
    } finally {
      setIsAgentLoading(false);
    }
  };

  if (!isInitialized) {
    return (
      <div className="h-screen w-screen bg-black text-green-400 font-mono flex items-center justify-center">
        <div className="text-xl">Initializing MCP Agent...</div>
      </div>
    );
  }

  return (
    <div className="h-[100vh] w-screen bg-black text-green-400 font-mono flex flex-col rounded-lg overflow-hidden shadow-2xl shadow-green-400/30 relative">
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
              <div className="flex items-center gap-1 ml-2">
                {Object.entries(mcpServerStatus).map(([serverName, isConnected]) => (
                  <div
                    key={serverName}
                    className={`w-2 h-2 rounded-full ${
                      isConnected ? 'bg-green-400' : 'bg-red-400'
                    }`}
                    title={`${serverName}: ${isConnected ? 'Connected' : 'Disconnected'}`}
                  />
                ))}
              </div>
            )}
            
            {!isInitialized && (
              <span className="text-xs text-yellow-400">initializing...</span>
            )}
          </div>
        )}
      </div>

      {/* Mode Switcher */}
      <div className="bg-gray-950 px-4 py-2 border-b border-gray-700 flex gap-3">
        <button 
          onClick={() => setMode('chat')} 
          className={`px-2 py-1 text-sm transition-colors ${
            mode === 'chat' ? 'text-green-400' : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          [chat]
        </button>
        <button 
          onClick={() => setMode('agent')} 
          className={`px-2 py-1 text-sm transition-colors ${
            mode === 'agent' ? 'text-green-400' : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          [agent]
        </button>
        {mode === 'agent' && (
          <button 
            onClick={() => setShowRoleManager(true)}
            className="px-2 py-1 text-sm text-blue-400 hover:text-blue-300 transition-colors"
          >
            [manage-roles]
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 p-4 overflow-y-auto space-y-2 pb-20 terminal-scrollbar">
        {mode === 'chat' ? (
          messages.map(m => (
            <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-xs lg:max-w-md px-3 py-2 rounded ${
                m.role === 'user' ? 'bg-blue-900/50 text-blue-200' : 'bg-gray-800/50 text-gray-200'
              }`}>
                <div className="text-xs text-gray-400 mb-1">
                  {m.role === 'user' ? 'You' : 'Assistant'}
                </div>
                <div className="whitespace-pre-wrap text-sm">{m.content}</div>
              </div>
            </div>
          ))
        ) : (
          agentMessages.map(m => (
            <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-full lg:max-w-3xl px-3 py-2 rounded ${
                m.role === 'user' ? 'bg-blue-900/50 text-blue-200' : 'bg-gray-800/50 text-gray-200'
              }`}>
                <div className="text-xs text-gray-400 mb-1">
                  {m.role === 'user' ? 'You' : `Agent (${currentRole?.name})`}
                </div>
                <div className="whitespace-pre-wrap text-sm">{m.content}</div>
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

      {/* Attached Files Display */}
      {mode === 'agent' && attachedFiles.length > 0 && (
        <div className="bg-gray-950 px-4 py-2 border-t border-gray-700">
          <div className="text-xs text-gray-500 mb-2">📎 Attached Files:</div>
          {attachedFiles.map((file, index) => (
            <div key={index} className="flex items-center justify-between bg-gray-900 px-2 py-1 rounded border border-gray-700 mb-1">
              <span className="text-xs text-gray-300">📄 {file.name}</span>
              <button
                onClick={() => removeAttachedFile(index)}
                className="text-red-400 hover:text-red-300 text-xs px-1"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

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

      {/* Input Area */}
      <form 
        onSubmit={mode === 'chat' ? handleSubmit : handleAgentSubmit} 
        className="bg-gray-950 px-4 py-4 border-t border-gray-700 flex items-center gap-2"
      >
        <span className="text-green-400 font-bold">$ </span>
        <input
          value={mode === 'chat' ? input : agentInput}
          onChange={mode === 'chat' ? handleInputChange : handleAgentInputChange}
          placeholder={mode === 'chat' ? 
            (isLoading ? "processing..." : "enter command...") : 
            (isAgentLoading ? "agent busy..." : "query agent...")
          }
          disabled={mode === 'chat' ? isLoading : isAgentLoading}
          className="flex-1 bg-gray-800 border border-gray-600 rounded px-3 py-2 outline-none text-green-400 placeholder-gray-600 caret-green-400 focus:border-green-400"
          autoComplete="off"
          spellCheck="false"
        />
        
        {mode === 'agent' && (
          <label className="cursor-pointer px-2 text-gray-500 hover:text-green-400 transition-colors">
            📎
            <input
              type="file"
              multiple
              onChange={handleFileAttachment}
              className="hidden"
              accept=".txt,.md,.json,.js,.ts,.tsx,.jsx,.py,.java,.cpp,.c,.h,.css,.html,.xml,.yaml,.yml,.csv"
            />
          </label>
        )}
        
        <button 
          type="submit" 
          disabled={mode === 'chat' ? isLoading : isAgentLoading}
          className="text-gray-500 hover:text-green-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed px-1"
        >
          ⏎
        </button>
      </form>
    </div>
  );
}
