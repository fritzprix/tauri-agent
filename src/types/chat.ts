import { MCPTool } from "../lib/tauri-mcp-client";

export interface Message {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  isStreaming?: boolean;
  thinking?: string;
}

export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface StreamableMessage extends Message {}

export interface Assistant {
  id: string;
  name: string;
  systemPrompt: string;
  mcpConfig: {
    mcpServers?: Record<
      string,
      {
        command: string;
        args?: string[];
        env?: Record<string, string>;
      }
    >;
  };
  localServices?: string[];
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Tool extends MCPTool {
  isLocal?: boolean;
}