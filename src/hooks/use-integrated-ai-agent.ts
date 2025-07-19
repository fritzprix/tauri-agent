import { useMCPAgent } from './use-mcp-agent';
import { useAIStream } from './use-ai-stream';
import { ProcessAIStreamOptions } from './use-ai-stream';
import { OrchestratorFactory } from './use-ai-orchestrator';

export const useIntegratedAIAgent = () => {
  const { processAIStream } = useAIStream();
  const { executeToolCall, availableTools, ...mcpAgent } = useMCPAgent();
  
  const runBasicAssistant = (options: Omit<ProcessAIStreamOptions, 'orchestrator' | 'executeToolCall' | 'availableTools'>) => 
    processAIStream({
      ...options,
      executeToolCall,
      availableTools: availableTools.length > 0 ? availableTools : undefined, // 내부에서 처리
      orchestrator: OrchestratorFactory.createDefault(availableTools)
    });

  const runAgentMode = (options: Omit<ProcessAIStreamOptions, 'orchestrator' | 'executeToolCall' | 'availableTools'>, maxTurns = 5) => 
    processAIStream({
      ...options,
      executeToolCall,
      availableTools: availableTools.length > 0 ? availableTools : undefined, // 내부에서 처리
      orchestrator: OrchestratorFactory.createAgent(availableTools, maxTurns)
    });

  const runCustomAgent = (
    options: Omit<ProcessAIStreamOptions, 'orchestrator' | 'executeToolCall' | 'availableTools'>, 
    orchestrator: any
  ) => 
    processAIStream({
      ...options,
      executeToolCall,
      availableTools: availableTools.length > 0 ? availableTools : undefined, // 내부에서 처리
      orchestrator
    });

  return { 
    runBasicAssistant, 
    runAgentMode, 
    runCustomAgent,
    availableTools,
    executeToolCall,
    ...mcpAgent
  };
};