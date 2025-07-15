import Groq from "groq-sdk";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { MCPTool } from "./tauri-mcp-client";

// Helper to convert MCPTool to Groq/OpenAI tool format
function convertMCPToolsToGroqOpenAITools(mcpTools: MCPTool[]): any[] {
  return mcpTools.map(tool => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.input_schema,
      strict: true, // Added for OpenAI compatibility
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
      parameters: tool.input_schema,
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
  tool_calls?: {
    id: string;
    type: 'function';
    function: { name: string; arguments: string; };
  }[];
  tool_use?: {
    id: string;
    name: string;
    input: Record<string, any>;
  };
  function_calls?: {
    name: string;
    args: Record<string, any>;
  }[];
}

export interface IAIService {
  streamChat(
    messages: StreamableMessage[],
    systemPrompt?: string,
    availableTools?: MCPTool[],
    model?: string
  ): AsyncGenerator<string, void, unknown>;
}

export class GroqService implements IAIService {
  private groq: Groq;
  
  constructor(apiKey?: string) {
    const key = apiKey || process.env.GROQ_API_KEY;
    if (!key) throw new Error('Groq API key is required');
    this.groq = new Groq({ apiKey: key });
  }

  async *streamChat(messages: StreamableMessage[], systemPrompt?: string, availableTools?: MCPTool[], model?: string): AsyncGenerator<string, void, unknown> {
    try {
      const groqMessages = messages.map(m => {
        if (m.tool_calls) {
          return {
            role: 'assistant' as const,
            content: m.content || null,
            tool_calls: m.tool_calls.map(tc => ({
              id: tc.id,
              type: 'function' as const,
              function: tc.function,
            })),
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

      const chatCompletion = await this.groq.chat.completions.create({
        messages: groqMessages,
        model: model || "qwen/qwen3-32b", // Use provided model or default
        temperature: 0.7,
        max_completion_tokens: 4096,
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
    } catch (error) {
      yield `Error: ${(error as Error).message}`;
    }
  }
}

export class OpenAIService implements IAIService {
  private openai: OpenAI;

  constructor(apiKey?: string) {
    const key = apiKey || process.env.OPENAI_API_KEY;
    if (!key) throw new Error('OpenAI API key is required');
    this.openai = new OpenAI({ apiKey: key });
  }

  async *streamChat(
    messages: StreamableMessage[],
    systemPrompt?: string,
    availableTools?: MCPTool[],
    model?: string
  ): AsyncGenerator<string, void, unknown> {
    try {
      const openaiMessages = messages.map(m => {
        if (m.tool_calls) {
          return {
            role: 'assistant' as const,
            content: m.content || null,
            tool_calls: m.tool_calls.map(tc => ({
              id: tc.id,
              type: 'function' as const,
              function: tc.function,
            })),
          };
        } else if (m.role === 'tool') {
          return {
            role: 'tool' as const,
            content: m.content,
            tool_call_id: m.id,
          };
        }
        return { role: m.role as 'user' | 'assistant' | 'system', content: m.content };
      });

      if (systemPrompt) {
        openaiMessages.unshift({ role: "system", content: systemPrompt });
      }

      const tools = availableTools && availableTools.length > 0
        ? convertMCPToolsToGroqOpenAITools(availableTools)
        : undefined;

      const completion = await this.openai.chat.completions.create({
        model: model || "gpt-4o", // Use provided model or default
        messages: openaiMessages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
        stream: true,
        max_completion_tokens: 4096,
        tools: tools,
        tool_choice: tools ? "auto" : undefined,
        store: true,
      });

      for await (const chunk of completion) {
        const delta = chunk.choices[0]?.delta;
        if (delta?.tool_calls) {
          yield JSON.stringify({ tool_calls: delta.tool_calls });
        } else if (delta?.content) {
          yield delta.content;
        }
      }
    } catch (error) {
      yield `Error: ${(error as Error).message}`;
    }
  }
}

export class AnthropicService implements IAIService {
  private anthropic: Anthropic;
  
  constructor(apiKey?: string) {
    const key = apiKey || process.env.ANTHROPIC_API_KEY;
    if (!key) throw new Error('Anthropic API key is required');
    this.anthropic = new Anthropic({ apiKey: key });
  }

  async *streamChat(messages: StreamableMessage[], systemPrompt?: string, availableTools?: MCPTool[], model?: string): AsyncGenerator<string, void, unknown> {
    try {
      const anthropicMessages = messages.map(m => {
        if (m.role === 'user') {
          return { role: 'user' as const, content: m.content };
        } else if (m.role === 'assistant') {
          if (m.tool_calls && m.tool_calls.length > 0) {
            return {
              role: 'assistant' as const,
              content: m.tool_calls.map(tc => ({
                type: 'tool_use' as const,
                id: tc.id,
                name: tc.function.name,
                input: JSON.parse(tc.function.arguments),
              })),
            };
          } else if (m.tool_use) {
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
          return {
            role: 'user' as const,
            content: [{
              type: 'tool_result' as const,
              tool_use_id: m.id,
              content: m.content,
            }],
          };
        }
        return null;
      }).filter(Boolean) as Anthropic.Messages.MessageParam[];

      const completion = await this.anthropic.messages.create({
        system: systemPrompt,
        model: model || "claude-sonnet-4-20250514", // Use provided model or default
        max_tokens: 1024,
        messages: anthropicMessages,
        stream: true,
        tools: availableTools && availableTools.length > 0 ? convertMCPToolsToAnthropicTools(availableTools) : undefined,
      });
      
      for await (const chunk of completion) {
        if (chunk.type === "content_block_delta" && chunk.delta.type === 'text_delta') {
          yield chunk.delta.text;
        } else if (chunk.type === "content_block_start" && chunk.content_block.type === "tool_use") {
          // Fixed tool use handling
          yield JSON.stringify({ tool_use: chunk.content_block });
        }
      }
    } catch (error) {
      yield `Error: ${(error as Error).message}`;
    }
  }
}

export class GeminiService implements IAIService {
  private genAI: GoogleGenerativeAI;
  
  constructor(apiKey?: string) {
    const key = apiKey || process.env.GEMINI_API_KEY;
    if (!key) throw new Error('Gemini API key is required');
    this.genAI = new GoogleGenerativeAI(key);
  }

  async *streamChat(messages: StreamableMessage[], systemPrompt?: string, availableTools?: MCPTool[], model?: string): AsyncGenerator<string, void, unknown> {
    try {
      const model_name = model || "gemini-1.5-pro"; // Use provided model or default
      const model_instance = this.genAI.getGenerativeModel({ model: model_name }); 
      
      const geminiMessages = messages.map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }],
      }));

      if (systemPrompt) {
        geminiMessages.unshift({ role: "user", parts: [{ text: systemPrompt }] });
      }

      const result = await model_instance.generateContentStream({
        contents: geminiMessages,
        tools: availableTools && availableTools.length > 0 ? convertMCPToolsToGeminiTools(availableTools) : undefined,
      });

      for await (const chunk of result.stream) {
        // Fixed tool call handling
        if (chunk.functionCalls && chunk.functionCalls.length > 0) {
          yield JSON.stringify({ function_calls: chunk.functionCalls });
        } else {
          const chunkText = chunk.text();
          yield chunkText || "";
        }
      }
    } catch (error) {
      yield `Error: ${(error as Error).message}`;
    }
  }
}