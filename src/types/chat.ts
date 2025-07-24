import { Assistant as DbAssistant } from "../lib/db";
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

export interface Assistant extends DbAssistant {
  localServices?: string[];
}

export interface Tool extends MCPTool {
  isLocal?: boolean;
}