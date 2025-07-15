import { ChatGroq } from '@langchain/groq';
import { HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { configManager } from './config';
import { tauriMCPClient, MCPTool } from './tauri-mcp-client';
import { log } from './logger';
import { llmConfigManager } from './llm-config-manager';

export interface StreamableMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant' | 'system';
  thinking?: string;
  isStreaming?: boolean;
  attachments?: { name: string; content: string; }[];
}

export class AIService {
  private llm: ChatGroq;

  constructor() {
    // 기본 설정 사용
    const defaultConfig = llmConfigManager.getDefaultServiceConfig();
    const apiKey = configManager.getGroqApiKey();
    
    if (!apiKey) {
      throw new Error('Groq API key not found. Please set the VITE_GROQ_API_KEY environment variable');
    }
    
    this.llm = new ChatGroq({
      apiKey,
      model: defaultConfig.model || 'llama-3.1-8b-instant',
      temperature: defaultConfig.temperature || 0.7,
      streaming: true,
    });
  }

  async *streamChat(
    messages: StreamableMessage[],
    systemPrompt?: string,
    availableTools?: MCPTool[]
  ): AsyncGenerator<string, void, unknown> {
    try {
      const langchainMessages = [];

      if (systemPrompt) {
        langchainMessages.push(new SystemMessage(systemPrompt));
      }

      for (const msg of messages) {
        if (msg.role === 'user') {
          langchainMessages.push(new HumanMessage(msg.content));
        } else if (msg.role === 'assistant') {
          langchainMessages.push(new AIMessage(msg.content));
        }
      }

      // 도구가 있으면 bindTools 사용
      if (availableTools && availableTools.length > 0) {
        const langchainTools = this.createLangChainTools(availableTools);
        const modelWithTools = this.llm.bindTools(langchainTools);
        
        const stream = await modelWithTools.stream(langchainMessages);
        
        let thinkingMessageSent = false;
        for await (const chunk of stream) {
          if (chunk.tool_calls && chunk.tool_calls.length > 0) {
            if (!thinkingMessageSent) {
              const toolNames = (chunk.tool_calls).map(tc => tc.name).join(', ');
              yield `Thinking about using tools: ${toolNames}...`;
              thinkingMessageSent = true;
            }
          } else if (chunk.content) {
            const content = chunk.content as string;
            yield content;
          }
        }

        // 도구 호출 확인을 위해 invoke 사용
        const response = await modelWithTools.invoke(langchainMessages);
        if (response.tool_calls && response.tool_calls.length > 0) {
          for (const toolCall of response.tool_calls) {
            yield `\n\n🔧 Using tool: ${toolCall.name}\n`;
            try {
              const result = await this.executeMCPTool(toolCall.name, toolCall.args || {});
              yield `📋 Tool result: ${result}\n\n`;
            } catch (error) {
              yield `❌ Tool error: ${error instanceof Error ? error.message : 'Unknown error'}\n\n`;
            }
          }
        }
      } else {
        // 도구가 없으면 일반 스트리밍
        const stream = await this.llm.stream(langchainMessages);
        
        for await (const chunk of stream) {
          if (chunk.content) {
            const content = chunk.content as string;
            yield content;
          }
        }
      }
      
    } catch (error) {
      await log.error('AI Service error', 'AIService', error instanceof Error ? error : new Error(String(error)));
      yield `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  // MCP 도구를 LangChain 도구로 변환
  private createLangChainTools(mcpTools: MCPTool[]) {
    return mcpTools.map(mcpTool => {
      // MCP 스키마를 Zod 스키마로 변환
      const zodSchema = this.convertMCPSchemaToZod(mcpTool.input_schema);
      
      return tool(
        async (input: Record<string, unknown>) => {
          return await this.executeMCPTool(mcpTool.name, input);
        },
        {
          name: mcpTool.name,
          description: mcpTool.description,
          schema: zodSchema,
        }
      );
    });
  }

  // MCP 스키마를 Zod 스키마로 변환
  private convertMCPSchemaToZod(schema: any): z.ZodType<any> {
    if (!schema || !schema.properties) {
      return z.object({});
    }

    const zodObj: Record<string, z.ZodType<any>> = {};
    
    for (const [key, value] of Object.entries(schema.properties)) {
      const prop = value as any;
      
      switch (prop.type) {
        case 'string':
          zodObj[key] = z.string().describe(prop.description || '');
          break;
        case 'number':
          zodObj[key] = z.number().describe(prop.description || '');
          break;
        case 'boolean':
          zodObj[key] = z.boolean().describe(prop.description || '');
          break;
        case 'array':
          zodObj[key] = z.array(z.any()).describe(prop.description || '');
          break;
        default:
          zodObj[key] = z.any().describe(prop.description || '');
      }
      
      // 필수 필드가 아닌 경우 optional로 설정
      if (!schema.required || !schema.required.includes(key)) {
        zodObj[key] = zodObj[key].optional();
      }
    }
    
    return z.object(zodObj);
  }

  // MCP 도구 실행
  private async executeMCPTool(toolName: string, arguments_: Record<string, unknown>): Promise<string> {
    try {
      const connectedServers = await tauriMCPClient.getConnectedServers();
      
      for (const serverName of connectedServers) {
        const serverTools = await tauriMCPClient.listTools(serverName);
        const serverTool = serverTools.find(t => t.name === toolName);
        
        if (serverTool) {
          await log.info(`🔧 Executing MCP tool '${toolName}' on server '${serverName}'`, 'AIService');
          const result = await tauriMCPClient.callTool(serverName, toolName, arguments_);
          return JSON.stringify(result, null, 2);
        }
      }
      
      throw new Error(`Tool '${toolName}' not found on any connected server`);
    } catch (error) {
      await log.error('MCP tool execution error', 'AIService', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }
}

let aiService: AIService | null = null;

export function getAIService(): AIService {
  if (!aiService) {
    aiService = new AIService();
  }
  return aiService;
}
