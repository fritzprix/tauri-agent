import { StreamableMessage } from '../lib/ai-service';
import { MCPTool } from '../lib/tauri-mcp-client';
import { getLogger } from '../lib/logger';

const logger = getLogger("ai-orchestrator");

export interface AgentAction {
  action: 'continue' | 'finish' | 'tool_call';
  parameters?: Record<string, any>;
  toolCalls?: any[];
}

export interface OrchestrationResult {
  shouldContinue: boolean;
  toolCalls?: any[];
  finalResponse?: string;
}

export interface AIOrchestrator {
  decideNextAction: (
    content: string, 
    conversation: StreamableMessage[]
  ) => Promise<AgentAction>;
  
  processStreamChunk: (
    chunk: string, 
    accumulatedContent: string,
    conversation: StreamableMessage[],
    executeToolCall: (toolCall: any) => Promise<{ role: 'tool'; content: string; tool_call_id: string }>
  ) => Promise<OrchestrationResult>;
  
  shouldContinueConversation: (
    conversation: StreamableMessage[], 
    maxTurns?: number
  ) => boolean;
  
  getDisplayName(): string; // For UI/logging purposes
}

export class DefaultAIOrchestrator implements AIOrchestrator {
  constructor(private availableTools: MCPTool[] = []) {}

  getDisplayName(): string {
    return 'Standard Assistant';
  }

  async decideNextAction(
    content: string, 
    conversation: StreamableMessage[]
  ): Promise<AgentAction> {
    try {
      const parsed = JSON.parse(content);
      if (parsed.tool_calls && parsed.tool_calls.length > 0) {
        return {
          action: 'tool_call',
          toolCalls: parsed.tool_calls
        };
      }
    } catch {
      // Not JSON, regular content
    }
    
    return { action: 'finish' };
  }

  async processStreamChunk(
    chunk: string, 
    accumulatedContent: string,
    conversation: StreamableMessage[],
    executeToolCall: (toolCall: any) => Promise<{ role: 'tool'; content: string; tool_call_id: string }>
  ): Promise<OrchestrationResult> {
    const fullContent = accumulatedContent + chunk;
    
    try {
      const parsedChunk = JSON.parse(fullContent);
      
      if (parsedChunk.tool_calls && parsedChunk.tool_calls.length > 0) {
        logger.info(`Processing ${parsedChunk.tool_calls.length} tool calls`);
        
        // Tool calls will be executed by the calling code
        return {
          shouldContinue: true,
          toolCalls: parsedChunk.tool_calls
        };
      }
    } catch (parseError) {
      // Not JSON or incomplete JSON, continue accumulating
    }
    
    return {
      shouldContinue: false,
      finalResponse: fullContent
    };
  }

  shouldContinueConversation(
    conversation: StreamableMessage[], 
    maxTurns: number = 10
  ): boolean {
    // Basic orchestrator typically doesn't continue after response
    return false;
  }
}

export class OrchestratorFactory {
  static createDefault(availableTools: MCPTool[] = []): AIOrchestrator {
    return new DefaultAIOrchestrator(availableTools);
  }

  static createAgent(
    availableTools: MCPTool[] = [],
    maxTurns: number = 5
  ): AIOrchestrator {
    return new AgentModeOrchestrator(availableTools, maxTurns);
  }

  static create(
    type: 'default' | 'agent' | 'custom',
    availableTools: MCPTool[] = [],
    config?: {
      maxAgentTurns?: number;
      customLogic?: (conversation: StreamableMessage[]) => boolean;
    }
  ): AIOrchestrator {
    switch (type) {
      case 'agent':
        return new AgentModeOrchestrator(availableTools, config?.maxAgentTurns);
      case 'default':
      default:
        return new DefaultAIOrchestrator(availableTools);
    }
  }
}

// Enhanced orchestrator for agent mode
export class AgentModeOrchestrator extends DefaultAIOrchestrator {
  constructor(
    availableTools: MCPTool[] = [],
    private maxAgentTurns: number = 5
  ) {
    super(availableTools);
  }

  getDisplayName(): string {
    return 'Autonomous Agent';
  }

  async decideNextAction(
    content: string, 
    conversation: StreamableMessage[]
  ): Promise<AgentAction> {
    // Agent-specific logic
    const agentTurns = conversation.filter(msg => msg.role === 'assistant').length;
    
    if (agentTurns >= this.maxAgentTurns) {
      logger.info("Max agent turns reached, finishing");
      return { action: 'finish' };
    }

    // Check for tool calls
    try {
      const parsed = JSON.parse(content);
      if (parsed.tool_calls && parsed.tool_calls.length > 0) {
        return {
          action: 'tool_call',
          toolCalls: parsed.tool_calls
        };
      }
    } catch {
      // Not JSON
    }

    // Agent could decide to continue based on conversation context
    if (this.shouldAgentContinue(conversation)) {
      return { action: 'continue' };
    }

    return { action: 'finish' };
  }

  shouldContinueConversation(
    conversation: StreamableMessage[], 
    maxTurns: number = this.maxAgentTurns
  ): boolean {
    // Agent mode can continue conversation autonomously
    const aiMessages = conversation.filter(msg => msg.role === 'assistant');
    return aiMessages.length < maxTurns && this.shouldAgentContinue(conversation);
  }

  private shouldAgentContinue(conversation: StreamableMessage[]): boolean {
    // Implement agent-specific continuation logic
    // E.g., check if the task seems incomplete, if there are follow-up questions, etc.
    const lastMessage = conversation[conversation.length - 1];
    
    // Simple heuristic: continue if the last message contains certain keywords
    const continuationKeywords = ['incomplete', 'more needed', 'continue', 'next step'];
    return continuationKeywords.some(keyword => 
      lastMessage?.content?.toLowerCase().includes(keyword)
    );
  }
}