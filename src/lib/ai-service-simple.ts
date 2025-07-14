import { ChatGroq } from '@langchain/groq';
import { HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages';
import { configManager } from './config';
import { tauriMCPClient, MCPTool } from './tauri-mcp-client';
import { log } from './logger';

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
    const apiKey = configManager.getGroqApiKey();
    
    if (!apiKey) {
      throw new Error('Groq API key not found. Please set the VITE_GROQ_API_KEY environment variable');
    }
    
    this.llm = new ChatGroq({
      apiKey,
      model: 'qwen-qwq-32b',
      temperature: 0.7,
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
        let enhancedSystemPrompt = systemPrompt;
        
        // MCP 도구가 있으면 시스템 프롬프트에 추가
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
      
      const stream = await this.llm.stream(langchainMessages);
      let accumulatedContent = '';
      
      for await (const chunk of stream) {
        if (chunk.content) {
          const content = chunk.content as string;
          accumulatedContent += content;
          yield content;
        }
      }
      
      // 응답이 완료된 후 도구 호출이 있는지 확인
      if (availableTools && availableTools.length > 0) {
        const toolCallMatch = accumulatedContent.match(/\{[\s\S]*"tool_call"[\s\S]*\}/);
        if (toolCallMatch) {
          try {
            const toolCallData = JSON.parse(toolCallMatch[0]);
            if (toolCallData.tool_call) {
              yield '\n\n🔧 Using tool: ' + toolCallData.tool_call.name + '\n';
              
              // 도구 호출 실행
              const result = await this.executeTool(toolCallData.tool_call, availableTools);
              yield '📋 Tool result: ' + JSON.stringify(result, null, 2) + '\n\n';
            }
          } catch (error) {
            log.error('Error parsing tool call', 'AIService', error instanceof Error ? error : new Error(String(error)));
          }
        }
      }
    } catch (error) {
      log.error('AI Service error', 'AIService', error instanceof Error ? error : new Error(String(error)));
      yield `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  private async executeTool(toolCall: { name: string; arguments: Record<string, unknown> }, availableTools: MCPTool[]) {
    try {
      // 도구가 사용 가능한지 확인
      log.debug(`Tool Call: ${JSON.stringify({ availableTools: availableTools.map(t => t.name), toolCall })}`, 'AIService');
      const tool = availableTools.find(t => t.name === toolCall.name);
      if (!tool) {
        return { error: `Tool '${toolCall.name}' not found` };
      }

      // 연결된 서버 목록 가져오기
      const connectedServers = await tauriMCPClient.getConnectedServers();
      
      // 각 서버에서 도구 찾기
      for (const serverName of connectedServers) {
        const serverTools = await tauriMCPClient.listTools(serverName);
        const serverTool = serverTools.find(t => t.name === toolCall.name);
        
        if (serverTool) {
          log.info(`🔧 Calling tool '${toolCall.name}' on server '${serverName}'`, 'AIService');
          const result = await tauriMCPClient.callTool(
            serverName,
            toolCall.name,
            toolCall.arguments
          );
          return result;
        }
      }
      
      return { error: `Tool '${toolCall.name}' not found on any connected server` };
    } catch (error) {
      log.error('Tool execution error', 'AIService', error instanceof Error ? error : new Error(String(error)));
      return { error: error instanceof Error ? error.message : 'Unknown error' };
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
