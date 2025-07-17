import { useState, useEffect, useCallback } from 'react';
import { MCPTool, tauriMCPClient } from '../lib/tauri-mcp-client';
import { Role } from '../lib/db';
import { getLogger } from '../lib/logger';

const logger = getLogger('useMCPAgent');

interface MCPAgentHookResult {
  availableTools: MCPTool[];
  isMCPConnecting: boolean;
  mcpServerStatus: Record<string, boolean>;
  showServerDropdown: boolean;
  setShowServerDropdown: (show: boolean) => void;
  showToolsDetail: boolean;
  setShowToolsDetail: (show: boolean) => void;
  connectToMCP: (role: Role) => Promise<void>;
  executeToolCall: (toolCall: { id: string; type: 'function'; function: { name: string; arguments: string; } }) => Promise<{ role: 'tool'; content: string; tool_call_id: string }>;
  getMCPStatus: () => { color: string; status: string };
  getStatusText: () => string;
}

export const useMCPAgent = (): MCPAgentHookResult => {
  const [availableTools, setAvailableTools] = useState<MCPTool[]>([]);
  const [isMCPConnecting, setIsMCPConnecting] = useState(false);
  const [mcpServerStatus, setMcpServerStatus] = useState<Record<string, boolean>>({});
  const [showServerDropdown, setShowServerDropdown] = useState(false);
  const [showToolsDetail, setShowToolsDetail] = useState(false);

  const connectToMCP = useCallback(async (role: Role) => {
    logger.debug(`Starting MCP connection for role: ${role.name}`);
    setIsMCPConnecting(true);

    const serverStatus: Record<string, boolean> = {};

    try {
      const configForTauri = {
        mcpServers: role.mcpConfig.mcpServers || {}
      };

      Object.keys(configForTauri.mcpServers).forEach(name => {
        serverStatus[name] = false;
      });
      setMcpServerStatus(serverStatus);

      const tools = await tauriMCPClient.listToolsFromConfig(configForTauri);
      logger.debug(`Received tools from Tauri:`, {tools});

      const connectedServers = await tauriMCPClient.getConnectedServers();
      for (const serverName of connectedServers) {
        if (serverStatus.hasOwnProperty(serverName)) {
          serverStatus[serverName] = true;
        }
      }
      setMcpServerStatus({ ...serverStatus });
      setAvailableTools(tools);
      logger.debug(`Total tools loaded: ${tools.length}`);

    } catch (error) {
      logger.error('Error connecting to MCP:', {error});
      Object.keys(serverStatus).forEach(key => {
        serverStatus[key] = false;
      });
      setMcpServerStatus({ ...serverStatus });
    } finally {
      setIsMCPConnecting(false);
    }
  }, []);

  const executeToolCall = async (toolCall: { id: string; type: 'function'; function: { name: string; arguments: string; } }): Promise<{ role: 'tool'; content: string; tool_call_id: string }> => {
    logger.debug(`Executing tool call:`, {toolCall});
    const aiProvidedToolName = toolCall.function.name;
    let serverName: string | undefined;
    let toolName: string | undefined;

    const parts = aiProvidedToolName.split(':');
    if (parts.length >= 2) {
      serverName = parts[0];
      toolName = parts.slice(1).join(':');
    }

    if (!serverName || !toolName) {
      logger.error(`Could not determine serverName or toolName for AI-provided tool name: ${aiProvidedToolName}`);
      return { role: 'tool', content: `Error: Could not find tool '${aiProvidedToolName}' or determine its server.`, tool_call_id: toolCall.id };
    }

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

  return {
    availableTools,
    isMCPConnecting,
    mcpServerStatus,
    showServerDropdown,
    setShowServerDropdown,
    showToolsDetail,
    setShowToolsDetail,
    connectToMCP,
    executeToolCall,
    getMCPStatus,
    getStatusText,
  };
};
