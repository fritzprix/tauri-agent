import { ChatGroq } from "@langchain/groq";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import { MCPTool } from "./tauri-mcp-client";
import { Role } from "./db";
import { getGroqApiKey } from "./env";

export interface StreamableMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  thinking?: string;
  attachments?: { name: string; content: string; }[];
}

export interface AIServiceConfig {
  apiKey: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export class AIService {
  private llm: ChatGroq;
  private config: AIServiceConfig;

  constructor(config: AIServiceConfig) {
    this.config = {
      model: "llama-3.1-8b-instant",
      temperature: 0.7,
      maxTokens: 4096,
      ...config
    };

    this.llm = new ChatGroq({
      apiKey: this.config.apiKey,
      model: this.config.model!,
      temperature: this.config.temperature,
      maxTokens: this.config.maxTokens,
      streaming: true,
    });
  }

  // Chat 모드: 단순한 대화
  async streamChat(
    messages: StreamableMessage[],
    role?: Role,
    onChunk?: (chunk: string) => void
  ): Promise<string> {
    const systemPrompt = role?.systemPrompt || "You are a helpful AI assistant.";
    
    const prompt = ChatPromptTemplate.fromMessages([
      ["system", systemPrompt],
      new MessagesPlaceholder("messages"),
    ]);

    const langchainMessages = messages.map(msg => {
      if (msg.role === 'user') {
        return new HumanMessage(msg.content);
      } else {
        return new AIMessage(msg.content);
      }
    });

    const chain = prompt.pipe(this.llm);
    
    let fullResponse = "";
    const stream = await chain.stream({
      messages: langchainMessages
    });

    for await (const chunk of stream) {
      const content = chunk.content as string;
      if (content) {
        fullResponse += content;
        onChunk?.(content);
      }
    }

    return fullResponse;
  }

  // Agent 모드: ReAct 패턴을 사용한 복잡한 작업 수행
  async streamAgent(
    query: string,
    messages: StreamableMessage[],
    role: Role,
    availableTools: MCPTool[],
    onChunk?: (chunk: string) => void,
    onThinking?: (thinking: string) => void,
    onToolCall?: (toolName: string, args: Record<string, unknown>) => Promise<unknown>
  ): Promise<string> {
    const systemPrompt = this.buildAgentSystemPrompt(role, availableTools);
    
    // ReAct 패턴 구현
    let thoughts = "";
    let finalAnswer = "";
    let iterations = 0;
    const maxIterations = 5;

    while (iterations < maxIterations) {
      iterations++;
      
      // Thinking phase
      const thinkingPrompt = this.buildThinkingPrompt(
        query, 
        messages, 
        thoughts, 
        availableTools, 
        iterations
      );

      onThinking?.(`Iteration ${iterations}: Analyzing the problem...`);
      
      const thinkingResponse = await this.generateThinking(
        thinkingPrompt,
        systemPrompt,
        onThinking
      );

      thoughts += `\n\nIteration ${iterations}:\n${thinkingResponse}`;

      // Action decision
      const shouldUseTool = this.shouldUseTool(thinkingResponse, availableTools);
      
      if (shouldUseTool.use && onToolCall) {
        try {
          onThinking?.(`Using tool: ${shouldUseTool.tool?.name}`);
          const toolResult = await onToolCall(shouldUseTool.tool!.name, shouldUseTool.args || {});
          thoughts += `\nTool Result: ${JSON.stringify(toolResult)}`;
          continue;
        } catch (error) {
          thoughts += `\nTool Error: ${error}`;
        }
      }

      // Final answer generation
      const answerPrompt = this.buildAnswerPrompt(query, thoughts, messages);
      finalAnswer = await this.generateFinalAnswer(
        answerPrompt,
        systemPrompt,
        onChunk
      );

      break;
    }

    return finalAnswer;
  }

  private buildAgentSystemPrompt(role: Role, tools: MCPTool[]): string {
    const toolDescriptions = tools.map(tool => 
      `- ${tool.name}: ${tool.description}`
    ).join('\n');

    return `${role.systemPrompt}

You are an intelligent agent that can use tools to help users accomplish tasks.

Available Tools:
${toolDescriptions}

Instructions:
1. Think step by step about the user's request
2. Determine if you need to use any tools
3. Use tools when necessary to gather information or perform actions
4. Provide a helpful and comprehensive response

Use the ReAct (Reasoning and Acting) pattern:
- Think: Analyze the problem
- Act: Use tools if needed
- Observe: Review tool results
- Repeat if necessary
- Respond: Provide final answer`;
  }

  private buildThinkingPrompt(
    query: string,
    messages: StreamableMessage[],
    previousThoughts: string,
    tools: MCPTool[],
    iteration: number
  ): string {
    const context = messages.map(msg => `${msg.role}: ${msg.content}`).join('\n');
    const toolList = tools.map(t => t.name).join(', ');

    return `Context:
${context}

Current Query: ${query}

Previous Thoughts:
${previousThoughts}

Available Tools: ${toolList}

This is iteration ${iteration}. Think about:
1. What is the user asking for?
2. What information do I need to answer this?
3. Do I need to use any tools?
4. What's my plan to solve this?

Provide your reasoning:`;
  }

  private buildAnswerPrompt(
    query: string,
    thoughts: string,
    messages: StreamableMessage[]
  ): string {
    const context = messages.map(msg => `${msg.role}: ${msg.content}`).join('\n');

    return `Context:
${context}

Query: ${query}

Analysis and Tool Results:
${thoughts}

Based on your analysis and any tool results, provide a comprehensive answer to the user's query:`;
  }

  private async generateThinking(
    prompt: string,
    systemPrompt: string,
    onThinking?: (thinking: string) => void
  ): Promise<string> {
    const messages = [
      new SystemMessage(systemPrompt),
      new HumanMessage(prompt)
    ];

    let response = "";
    const stream = await this.llm.stream(messages);

    for await (const chunk of stream) {
      const content = chunk.content as string;
      if (content) {
        response += content;
        onThinking?.(response);
      }
    }

    return response;
  }

  private async generateFinalAnswer(
    prompt: string,
    systemPrompt: string,
    onChunk?: (chunk: string) => void
  ): Promise<string> {
    const messages = [
      new SystemMessage(systemPrompt),
      new HumanMessage(prompt)
    ];

    let response = "";
    const stream = await this.llm.stream(messages);

    for await (const chunk of stream) {
      const content = chunk.content as string;
      if (content) {
        response += content;
        onChunk?.(content);
      }
    }

    return response;
  }

  private shouldUseTool(thinkingResponse: string, tools: MCPTool[]): {
    use: boolean;
    tool?: MCPTool;
    args?: Record<string, unknown>;
  } {
    // 간단한 도구 사용 결정 로직
    // 실제로는 더 정교한 파싱이 필요할 수 있습니다
    const lowerResponse = thinkingResponse.toLowerCase();
    
    for (const tool of tools) {
      if (lowerResponse.includes(tool.name.toLowerCase()) || 
          lowerResponse.includes('use tool') || 
          lowerResponse.includes('need to')) {
        return {
          use: true,
          tool,
          args: {} // 기본 인수, 실제로는 더 정교한 파싱 필요
        };
      }
    }

    return { use: false };
  }

  // 환경변수에서 API 키 가져오기
  static getApiKey(): string {
    return getGroqApiKey();
  }
}

// 싱글톤 인스턴스
let aiServiceInstance: AIService | null = null;

export function getAIService(): AIService {
  if (!aiServiceInstance) {
    const apiKey = AIService.getApiKey();
    if (!apiKey) {
      throw new Error('GROQ_API_KEY environment variable is not set');
    }
    aiServiceInstance = new AIService({ apiKey });
  }
  return aiServiceInstance;
}
