import { HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { ChatGroq } from '@langchain/groq';
import { configManager } from './config';
import { tauriMCPClient, MCPTool } from './tauri-mcp-client';
import { log } from './logger';
import { llmConfigManager, ServiceConfig } from './llm-config-manager';

interface ModelConfig {
  serviceId?: string; // 서비스 ID로 설정을 가져옴
  provider?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  apiKey?: string;
}

export interface StreamableMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant' | 'system';
  thinking?: string;
  isStreaming?: boolean;
  attachments?: { name: string; content: string; }[];
}

export type ChatMode = 'chat' | 'agent';

export class AIService {
  private model?: BaseChatModel;
  private modelConfig: ModelConfig;
  private serviceConfig: ServiceConfig;

  constructor(config: Partial<ModelConfig> = {}) {
    // 서비스 ID가 제공된 경우 해당 설정을 사용
    if (config.serviceId) {
      this.serviceConfig = llmConfigManager.getServiceConfig(config.serviceId) || llmConfigManager.getDefaultServiceConfig();
    } else {
      this.serviceConfig = llmConfigManager.getDefaultServiceConfig();
    }

    // 개별 설정이 제공된 경우 덮어쓰기
    this.modelConfig = {
      serviceId: config.serviceId,
      provider: config.provider || this.serviceConfig.provider,
      model: config.model || this.serviceConfig.model,
      temperature: config.temperature ?? this.serviceConfig.temperature,
      maxTokens: config.maxTokens ?? this.serviceConfig.maxTokens,
      apiKey: config.apiKey || this.getApiKeyForProvider(config.provider || this.serviceConfig.provider),
    };

    if (!this.modelConfig.apiKey) {
      throw new Error(`API key not found for provider ${this.modelConfig.provider}. Please set the appropriate environment variable.`);
    }
  }

  private getApiKeyForProvider(providerId: string): string | undefined {
    const provider = llmConfigManager.getProvider(providerId);
    if (!provider) return undefined;
    
    // 환경변수에서 API 키 가져오기
    const envVar = provider.apiKeyEnvVar;
    return process.env[envVar] || configManager.getGroqApiKey() || undefined;
  }

  async initializeModel(): Promise<void> {
    try {
      // 현재는 Groq만 지원
      if (this.modelConfig.provider === 'groq') {
        this.model = new ChatGroq({
          apiKey: this.modelConfig.apiKey!,
          model: this.modelConfig.model!,
          temperature: this.modelConfig.temperature,
          maxTokens: this.modelConfig.maxTokens,
        });
      } else {
        throw new Error(`Unsupported provider: ${this.modelConfig.provider}`);
      }
      
      log.info(`Initialized model: ${this.modelConfig.provider}:${this.modelConfig.model}`, 'AIService');
    } catch (error) {
      log.error('Failed to initialize model', 'AIService', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  private async createMCPTools(availableTools: MCPTool[]): Promise<Array<any>> {
    const tools = [];
    
    for (const mcpTool of availableTools) {
      try {
        // MCP 도구의 스키마를 Zod 스키마로 변환
        const zodSchema = this.convertMCPSchemaToZod(mcpTool.input_schema);
        
        const langchainTool = tool(
          async (input: Record<string, unknown>) => {
            return await this.executeMCPTool(mcpTool.name, input);
          },
          {
            name: mcpTool.name,
            description: mcpTool.description,
            schema: zodSchema,
          }
        );
        
        tools.push(langchainTool);
        log.debug(`Created Langchain tool for: ${mcpTool.name}`, 'AIService');
      } catch (error) {
        log.error(`Failed to create tool for ${mcpTool.name}`, 'AIService', error instanceof Error ? error : new Error(String(error)));
      }
    }
    
    return tools;
  }

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

  private async executeMCPTool(toolName: string, arguments_: Record<string, unknown>): Promise<string> {
    try {
      const connectedServers = await tauriMCPClient.getConnectedServers();
      
      for (const serverName of connectedServers) {
        const serverTools = await tauriMCPClient.listTools(serverName);
        const serverTool = serverTools.find(t => t.name === toolName);
        
        if (serverTool) {
          log.info(`🔧 Executing MCP tool '${toolName}' on server '${serverName}'`, 'AIService');
          const result = await tauriMCPClient.callTool(serverName, toolName, arguments_);
          return JSON.stringify(result, null, 2);
        }
      }
      
      throw new Error(`Tool '${toolName}' not found on any connected server`);
    } catch (error) {
      log.error('MCP tool execution error', 'AIService', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  async *streamChat(
    messages: StreamableMessage[],
    systemPrompt?: string,
    availableTools?: MCPTool[],
    mode: ChatMode = 'chat'
  ): AsyncGenerator<string, void, unknown> {
    try {
      await this.initializeModel();
      
      if (mode === 'agent' && availableTools && availableTools.length > 0) {
        yield* this.streamAgentMode(messages, systemPrompt, availableTools);
      } else {
        yield* this.streamChatMode(messages, systemPrompt, availableTools);
      }
    } catch (error) {
      log.error('AI Service error', 'AIService', error instanceof Error ? error : new Error(String(error)));
      yield `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  private async *streamChatMode(
    messages: StreamableMessage[],
    systemPrompt?: string,
    availableTools?: MCPTool[]
  ): AsyncGenerator<string, void, unknown> {
    if (!this.model) {
      throw new Error('Model not initialized');
    }

    const langchainMessages = [];

    if (systemPrompt) {
      let enhancedSystemPrompt = systemPrompt;
      
      if (availableTools && availableTools.length > 0) {
        enhancedSystemPrompt += `\n\nYou have access to the following tools:\n`;
        for (const tool of availableTools) {
          enhancedSystemPrompt += `- ${tool.name}: ${tool.description}\n`;
          if (tool.input_schema) {
            enhancedSystemPrompt += `  Input schema: ${JSON.stringify(tool.input_schema, null, 2)}\n`;
          }
        }
        enhancedSystemPrompt += `\nTo use a tool, respond with a JSON object in this format:
{
  "tool_call": {
    "name": "tool_name",
    "arguments": {
      "parameter": "value"
    }
  },
  "explanation": "Why you're using this tool"
}

After using a tool, you will receive the result and can continue the conversation.`;
      }
      
      langchainMessages.push(new SystemMessage(enhancedSystemPrompt));
    }

    for (const msg of messages) {
      if (msg.role === 'user') {
        langchainMessages.push(new HumanMessage(msg.content));
      } else if (msg.role === 'assistant') {
        langchainMessages.push(new AIMessage(msg.content));
      }
    }
    
    const stream = await this.model.stream(langchainMessages, {
      configurable: {
        apiKey: this.modelConfig.apiKey,
        model: this.modelConfig.model,
      },
    });
    
    let accumulatedContent = '';
    
    for await (const chunk of stream) {
      if (chunk.content) {
        const content = chunk.content as string;
        accumulatedContent += content;
        yield content;
      }
    }
    
    // 도구 호출 처리 (Chat 모드에서)
    if (availableTools && availableTools.length > 0) {
      const toolCallMatch = accumulatedContent.match(/\{[\s\S]*"tool_call"[\s\S]*\}/);
      if (toolCallMatch) {
        try {
          const toolCallData = JSON.parse(toolCallMatch[0]);
          if (toolCallData.tool_call) {
            yield '\n\n🔧 Using tool: ' + toolCallData.tool_call.name + '\n';
            
            const result = await this.executeMCPTool(toolCallData.tool_call.name, toolCallData.tool_call.arguments);
            yield '📋 Tool result: ' + result + '\n\n';
          }
        } catch (error) {
          log.error('Error parsing tool call', 'AIService', error instanceof Error ? error : new Error(String(error)));
        }
      }
    }
  }

  private async *streamAgentMode(
    messages: StreamableMessage[],
    systemPrompt?: string,
    availableTools?: MCPTool[]
  ): AsyncGenerator<string, void, unknown> {
    if (!availableTools || availableTools.length === 0) {
      yield* this.streamChatMode(messages, systemPrompt);
      return;
    }

    if (!this.model) {
      throw new Error('Model not initialized');
    }

    try {
      // MCP 도구를 Langchain 도구로 변환
      const tools = await this.createMCPTools(availableTools);
      
      if (tools.length === 0) {
        yield 'No valid tools available for agent mode. Falling back to chat mode.\n\n';
        yield* this.streamChatMode(messages, systemPrompt, availableTools);
        return;
      }

      // 모델에 도구 바인딩
      if (!('bindTools' in this.model) || typeof this.model.bindTools !== 'function') {
        yield 'Current model does not support tool binding. Falling back to chat mode.\n\n';
        yield* this.streamChatMode(messages, systemPrompt, availableTools);
        return;
      }
      
      const modelWithTools = this.model.bindTools(tools);
      
      // 마지막 사용자 메시지 가져오기
      const lastUserMessage = messages.filter(m => m.role === 'user').pop()?.content || '';
      
      yield '🤖 Agent mode activated with tools: ' + tools.map(t => t.name).join(', ') + '\n\n';
      
      // 도구가 바인딩된 모델로 호출
      const response = await modelWithTools.invoke(lastUserMessage, {
        configurable: {
          apiKey: this.modelConfig.apiKey,
          model: this.modelConfig.model,
        },
      });
      
      // 응답이 도구 호출을 포함하는지 확인
      if (response.tool_calls && response.tool_calls.length > 0) {
        yield '🔧 Executing tools...\n\n';
        
        for (const toolCall of response.tool_calls) {
          try {
            yield `Calling ${toolCall.name}...\n`;
            const result = await this.executeMCPTool(toolCall.name, toolCall.args);
            yield `Tool result: ${result}\n\n`;
          } catch (error) {
            yield `Error executing ${toolCall.name}: ${error instanceof Error ? error.message : 'Unknown error'}\n\n`;
          }
        }
      }
      
      if (response.content) {
        yield response.content as string;
      }
      
    } catch (error) {
      log.error('Agent mode error', 'AIService', error instanceof Error ? error : new Error(String(error)));
      yield `Agent mode error: ${error instanceof Error ? error.message : 'Unknown error'}\n\nFalling back to chat mode...\n\n`;
      yield* this.streamChatMode(messages, systemPrompt, availableTools);
    }
  }

  // 모델 설정 업데이트
  async updateModelConfig(config: Partial<ModelConfig>): Promise<void> {
    this.modelConfig = { ...this.modelConfig, ...config };
    await this.initializeModel();
  }

  // 현재 모델 설정 가져오기
  getModelConfig(): ModelConfig {
    return { ...this.modelConfig };
  }

  // 현재 서비스 설정 가져오기
  getServiceConfig(): ServiceConfig {
    return { ...this.serviceConfig };
  }

  // 현재 모델 정보 가져오기
  getCurrentModelInfo() {
    if (!this.modelConfig.provider || !this.modelConfig.model) {
      return null;
    }
    
    return llmConfigManager.getModel(this.modelConfig.provider, this.modelConfig.model);
  }

  // 도구 지원 여부 확인
  supportsTools(): boolean {
    const modelInfo = this.getCurrentModelInfo();
    return modelInfo?.supportTools || false;
  }

  // 추론 지원 여부 확인
  supportsReasoning(): boolean {
    const modelInfo = this.getCurrentModelInfo();
    return modelInfo?.supportReasoning || false;
  }

  // 스트리밍 지원 여부 확인
  supportsStreaming(): boolean {
    const modelInfo = this.getCurrentModelInfo();
    return modelInfo?.supportStreaming || false;
  }

  // 컨텍스트 윈도우 크기 가져오기
  getContextWindow(): number {
    const modelInfo = this.getCurrentModelInfo();
    return modelInfo?.contextWindow || 0;
  }
}

let aiService: AIService | null = null;

export function getAIService(config?: Partial<ModelConfig>): AIService {
  if (!aiService || config) {
    aiService = new AIService(config);
  }
  return aiService;
}

// 편의 함수들
export function createAIService(config: Partial<ModelConfig>): AIService {
  return new AIService(config);
}

export async function initializeAIService(config?: Partial<ModelConfig>): Promise<AIService> {
  const service = getAIService(config);
  await service.initializeModel();
  return service;
}

// 서비스 ID로 AI 서비스 생성
export function createAIServiceFromServiceId(serviceId: string): AIService {
  return new AIService({ serviceId });
}

// 모델 추천을 통한 AI 서비스 생성
export function createRecommendedAIService(requirements: {
  needsTools?: boolean;
  needsReasoning?: boolean;
  maxCost?: number;
  preferSpeed?: boolean;
  contextWindow?: number;
}): AIService {
  const recommendation = llmConfigManager.recommendModel(requirements);
  
  if (!recommendation) {
    throw new Error('No suitable model found for the given requirements');
  }

  return new AIService({
    provider: recommendation.providerId,
    model: recommendation.modelId,
  });
}

// 사용 가능한 서비스 목록 가져오기
export function getAvailableServices(): Record<string, ServiceConfig> {
  return llmConfigManager.getServiceConfigs();
}

// 사용 가능한 모델 목록 가져오기
export function getAvailableModels() {
  return llmConfigManager.getAllModels();
}
