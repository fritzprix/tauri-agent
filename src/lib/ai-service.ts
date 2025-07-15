
// 실제 서비스별 SDK 임포트
// Groq: npm install groq-sdk
// OpenAI: npm install openai
// Anthropic: npm install @anthropic-ai/sdk
// Gemini: npm install @google/generative-ai
import Groq from "groq-sdk";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { MCPTool } from "./tauri-mcp-client";
import { llmConfigManager, LLMServiceConfig } from "./llm-config-manager";
import { configManager } from "./config";

// Helper to convert MCPTool to Groq/OpenAI tool format
function convertMCPToolsToGroqOpenAITools(mcpTools: MCPTool[]): any[] {
  return mcpTools.map(tool => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.input_schema, // input_schema should already be in the correct JSON schema format
    },
  }));
}

// Helper to convert MCPTool to Anthropic tool format
function convertMCPToolsToAnthropicTools(mcpTools: MCPTool[]): any[] {
  return mcpTools.map(tool => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.input_schema,
  }));
}

// Helper to convert MCPTool to Gemini tool format
function convertMCPToolsToGeminiTools(mcpTools: MCPTool[]): any[] {
  return [{
    function_declarations: mcpTools.map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.input_schema, // input_schema should already be in the correct JSON schema format
    })),
  }];
}

export interface StreamableMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  thinking?: string;
  isStreaming?: boolean;
  attachments?: { name: string; content: string; }[];
  tool_calls?: any[]; // For Groq/OpenAI
  tool_use?: any; // For Anthropic
  function_call?: any; // For Gemini
}

export interface IAIService {
  streamChat(
    messages: StreamableMessage[],
    systemPrompt?: string,
    availableTools?: MCPTool[]
  ): AsyncGenerator<string, void, unknown>;
}



export class GroqService implements IAIService {
  private groq: Groq;
  constructor(apiKey?: string) {
    this.groq = new Groq({ apiKey: apiKey || process.env.GROQ_API_KEY });
  }
  async *streamChat(messages: StreamableMessage[], systemPrompt?: string, availableTools?: MCPTool[]): AsyncGenerator<string, void, unknown> {
    // 메시지 변환
    const groqMessages = messages.map(m => {
      if (m.tool_calls) {
        return {
          role: 'assistant' as const,
          content: m.content || null,
          tool_calls: m.tool_calls,
        };
      } else if (m.role === 'tool') {
        return {
          role: 'tool' as const,
          tool_call_id: m.id,
          content: m.content,
        };
      } else {
        return {
          role: m.role as 'user' | 'assistant' | 'system',
          content: m.content,
        };
      }
    });
    if (systemPrompt) {
      groqMessages.unshift({ role: "system", content: systemPrompt });
    }
    // 실제 요청
    const chatCompletion = await this.groq.chat.completions.create({
      messages: groqMessages,
      model: "llama-3-8b", // 기본값, 필요시 변경
      temperature: 0.7,
      stream: true,
      tools: availableTools && availableTools.length > 0 ? convertMCPToolsToGroqOpenAITools(availableTools) : undefined,
      tool_choice: availableTools && availableTools.length > 0 ? "auto" : undefined,
    });
    for await (const chunk of chatCompletion) {
      if (chunk.choices[0]?.delta?.tool_calls) {
        yield JSON.stringify({ tool_calls: chunk.choices[0].delta.tool_calls });
      } else {
        yield chunk.choices[0]?.delta?.content || "";
      }
    }
  }
}

let aiServiceInstance: IAIService | null = null;

export function getAIService(provider?: string, model?: string): IAIService {
  const config = llmConfigManager.getConfig(provider, model);
  if (!config) {
    throw new Error(`Unsupported provider or model: ${provider}/${model}`);
  }

  const apiKey = configManager.getApiKey(config.provider);
  if (!apiKey) {
    throw new Error(`${config.provider} API key not found.`);
  }

  switch (config.provider) {
    case "groq":
      return new GroqService(apiKey);
    case "openai":
      return new OpenAIService(apiKey);
    case "anthropic":
      return new AnthropicService(apiKey);
    case "gemini":
      return new GeminiService(apiKey);
    default:
      throw new Error(`Unsupported provider: ${config.provider}`);
  }
}


export class OpenAIService implements IAIService {
  private openai: OpenAI;
  constructor(apiKey?: string) {
    this.openai = new OpenAI({ apiKey: apiKey || process.env.OPENAI_API_KEY });
  }
  async *streamChat(messages: StreamableMessage[], systemPrompt?: string, availableTools?: MCPTool[]): AsyncGenerator<string, void, unknown> {
    const openaiMessages = messages.map(m => {
      if (m.tool_calls) {
        return {
          role: 'assistant',
          content: m.content || null,
          tool_calls: m.tool_calls,
        };
      } else if (m.role === 'tool') {
        return {
          role: 'tool',
          content: m.content,
          tool_call_id: m.id,
        };
      }
      return { role: m.role, content: m.content };
    });
    if (systemPrompt) {
      openaiMessages.unshift({ role: "system", content: systemPrompt });
    }
    const completion = await this.openai.chat.completions.create({
      model: "gpt-4.0", // 기본값, 필요시 변경
      messages: openaiMessages,
      stream: true,
      tools: availableTools && availableTools.length > 0 ? convertMCPToolsToGroqOpenAITools(availableTools) : undefined,
      tool_choice: availableTools && availableTools.length > 0 ? "auto" : undefined,
    });
    for await (const chunk of completion) {
      if (chunk.choices[0]?.delta?.tool_calls) {
        yield JSON.stringify({ tool_calls: chunk.choices[0].delta.tool_calls });
      } else {
        yield chunk.choices[0]?.delta?.content || "";
      }
    }
  }
}


// Anthropic, Gemini는 실제 SDK 사용 시 구조만 유지
export class AnthropicService implements IAIService {
  private anthropic: Anthropic;
  constructor(apiKey?: string) {
    this.anthropic = new Anthropic({ apiKey: apiKey || process.env.ANTHROPIC_API_KEY });
  }
  async *streamChat(messages: StreamableMessage[], systemPrompt?: string, availableTools?: MCPTool[]): AsyncGenerator<string, void, unknown> {
    const anthropicMessages = messages.map(m => {
      if (m.role === 'user') {
        return { role: 'user' as const, content: m.content };
      } else if (m.role === 'assistant') {
        if (m.tool_calls && m.tool_calls.length > 0) {
          // Convert Groq/OpenAI tool_calls to Anthropic tool_use
          return {
            role: 'assistant' as const,
            content: m.tool_calls.map(tc => ({
              type: 'tool_use' as const,
              id: tc.id,
              name: tc.function.name,
              input: tc.function.arguments,
            })),
          };
        } else if (m.tool_use) {
          // Anthropic tool_use directly
          return {
            role: 'assistant' as const,
            content: [{
              type: 'tool_use' as const,
              id: m.tool_use.id,
              name: m.tool_use.name,
              input: m.tool_use.input,
            }],
          };
        } else {
          return { role: 'assistant' as const, content: m.content };
        }
      } else if (m.role === 'tool') {
        // Tool result message
        return {
          role: 'user' as const, // Tool results are sent by the user
          content: [{
            type: 'tool_result' as const,
            tool_use_id: m.id, // Assuming m.id is the tool_use_id from the assistant's tool_use
            content: m.content,
          }],
        };
      }
      return null; // System messages are handled by systemPrompt
    }).filter(Boolean) as Anthropic.Messages.MessageParam[];
    
    const completion = await this.anthropic.messages.create({
      model: "claude-3-opus-20240229", // 기본값, 필요시 변경
      max_tokens: 1024,
      messages: anthropicMessages,
      stream: true,
      tools: availableTools && availableTools.length > 0 ? convertMCPToolsToAnthropicTools(availableTools) : undefined,
    });
    for await (const chunk of completion) {
      if (chunk.type === "content_block_delta") {
        yield chunk.delta.type === 'text_delta'? chunk.delta.text : "";
      }
    }
  }
}


export class GeminiService implements IAIService {
  private genAI: GoogleGenerativeAI;
  constructor(apiKey?: string) {
    const nonNullApiKey = apiKey || process.env.GEMINI_API_KEY || "";
    this.genAI = new GoogleGenerativeAI(nonNullApiKey);
  }
  async *streamChat(messages: StreamableMessage[], systemPrompt?: string, availableTools?: MCPTool[]): AsyncGenerator<string, void, unknown> {
    const model = this.genAI.getGenerativeModel({ model: "gemini-pro" });
    const geminiMessages = messages.map(m => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }],
    }));
    if (systemPrompt) {
      geminiMessages.unshift({ role: "user", parts: [{ text: systemPrompt }] });
    }
    const result = await model.generateContentStream({
      contents: geminiMessages,
      tools: availableTools && availableTools.length > 0 ? convertMCPToolsToGeminiTools(availableTools) : undefined,
    });
    for await (const chunk of result.stream) {
      const chunkText = chunk.text();
      yield chunkText || "";
    }
  }
}

