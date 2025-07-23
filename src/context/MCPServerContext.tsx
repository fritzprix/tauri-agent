import React, { createContext, ReactNode, useCallback, useState } from 'react';
import { useAsyncFn } from 'react-use';
import { Role } from '../lib/db';
import { getLogger } from '../lib/logger';
import { MCPTool, tauriMCPClient } from '../lib/tauri-mcp-client';

const logger = getLogger('MCPServerContext');

interface MCPServerContextType {
  availableTools: MCPTool[];
  isConnecting: boolean;
  status: Record<string, boolean>;
  connectServers: (role: Role) => Promise<void>;
  executeToolCall: (toolCall: { id: string; type: 'function'; function: { name: string; arguments: string; } }) => Promise<{ role: 'tool'; content: string; tool_call_id: string }>;
}

export const MCPServerContext = createContext<MCPServerContextType | undefined>(undefined);

export const MCPServerProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [availableTools, setAvailableTools] = useState<MCPTool[]>([]);
  const [serverStatus, setServerStatus] = useState<Record<string, boolean>>({});
  const [{ loading: isConnecting }, connectServers] = useAsyncFn(async (role: Role) => {
    const serverStatus: Record<string, boolean> = {};
    try {
      const configForTauri = {
        mcpServers: role.mcpConfig.mcpServers || {}
      };

      const servers = Object.keys(configForTauri.mcpServers)
      
      if (servers.length === 0) {
        setServerStatus({});
        setAvailableTools([]);
        return;
      }

      Object.keys(configForTauri.mcpServers).forEach(name => {
        serverStatus[name] = false;
      });



      setServerStatus(serverStatus);
      const tools = await tauriMCPClient.listToolsFromConfig(configForTauri);
      logger.debug(`Received tools from Tauri:`, { tools });


      const connectedServers = await tauriMCPClient.getConnectedServers();
      for (const serverName of connectedServers) {
        if (serverStatus.hasOwnProperty(serverName)) {
          serverStatus[serverName] = true;
        }
      }
      setServerStatus({ ...serverStatus });
      setAvailableTools(tools);
      logger.debug(`Total tools loaded: ${tools.length}`);

    } catch (error) {
      logger.error('Error connecting to MCP:', { error });
      Object.keys(serverStatus).forEach(key => {
        serverStatus[key] = false;
      });
      setServerStatus({ ...serverStatus });
    }
  }, []);


  const executeToolCall = useCallback(async (toolCall: { id: string; type: 'function'; function: { name: string; arguments: string; } }): Promise<{ role: 'tool'; content: string; tool_call_id: string }> => {
    logger.debug(`Executing tool call:`, { toolCall });
    const aiProvidedToolName = toolCall.function.name;
    let serverName: string | undefined;
    let toolName: string | undefined;

    // Use '__' as delimiter for URL and JSON safety
    const delimiter = '__';
    const parts = aiProvidedToolName.split(delimiter);
    if (parts.length >= 2) {
      serverName = parts[0];
      toolName = parts.slice(1).join(delimiter);
    }

    if (!serverName || !toolName) {
      logger.error(`Could not determine serverName or toolName for AI-provided tool name: ${aiProvidedToolName}`);
      return { role: 'tool', content: `Error: Could not find tool '${aiProvidedToolName}' or determine its server.`, tool_call_id: toolCall.id };
    }

    let toolArguments: Record<string, unknown> = {};
    try {
      toolArguments = JSON.parse(toolCall.function.arguments);
    } catch (parseError) {
      logger.error(`Failed to parse tool arguments for ${toolCall.function.name}:`, { parseError });
      return { role: 'tool', content: `Error: Invalid tool arguments JSON: ${parseError instanceof Error ? parseError.message : String(parseError)}`, tool_call_id: toolCall.id };
    }

    try {
      const result = await tauriMCPClient.callTool(serverName, toolName, toolArguments);
      logger.debug(`Tool execution result for ${toolCall.function.name}:`, { result });
      return { role: 'tool', content: JSON.stringify(result), tool_call_id: toolCall.id };
    } catch (execError) {
      logger.error(`Tool execution failed for ${toolCall.function.name}:`, { execError });
      return { role: 'tool', content: `Error: Tool '${toolCall.function.name}' failed: ${execError instanceof Error ? execError.message : String(execError)}`, tool_call_id: toolCall.id };
    }
  }, []);



  const value = {
    availableTools,
    isConnecting,
    status: serverStatus,
    connectServers,
    executeToolCall,
  };

  return (
    <MCPServerContext.Provider value={value}>
      {children}
    </MCPServerContext.Provider>
  );
};

