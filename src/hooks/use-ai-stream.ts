import { AIServiceConfig, IAIService, StreamableMessage } from '../lib/ai-service';
import { getLogger } from '../lib/logger';
import { MCPTool } from '../lib/tauri-mcp-client';

const logger = getLogger("use-ai-stream");


interface ProcessAIStreamOptions {
  aiService: IAIService;
  initialConversation: StreamableMessage[];
  setMessagesState: React.Dispatch<React.SetStateAction<StreamableMessage[]>>;
  modelName?: string;
  systemPrompt?: string;
  availableTools?: MCPTool[];
  aiServiceConfig: AIServiceConfig;
  isAgentMode?: boolean;
  executeToolCall: (toolCall: { id: string; type: 'function'; function: { name: string; arguments: string; } }) => Promise<{ role: 'tool'; content: string; tool_call_id: string }>;
  messageWindowSize: number;
}

export const useAIStream = () => {
  const processAIStream = async ({
    aiService,
    initialConversation,
    setMessagesState,
    modelName,
    systemPrompt,
    availableTools,
    aiServiceConfig,
    isAgentMode = false,
    executeToolCall,
    messageWindowSize,
  }: ProcessAIStreamOptions) => {
    let currentConversation: StreamableMessage[] = initialConversation.slice(-messageWindowSize);
    let responseId = (Date.now() + 1).toString();
    let fullResponse = '';
    let toolCallsDetected = false;

    // 빈 응답 메시지 추가
    let initialResponse: StreamableMessage = {
      id: responseId,
      content: '',
      role: 'assistant',
      isStreaming: true
    };
    setMessagesState(prev => [...prev, initialResponse]);
    logger.info("tools: ", { availableTools, isAgentMode });

    do {
      toolCallsDetected = false;
      let currentChunk = '';
      let isFirstChunk = true;

      for await (const chunk of aiService.streamChat(currentConversation, {
        modelName,
        systemPrompt,
        availableTools,
        config: aiServiceConfig
      })) {
        currentChunk += chunk;

        try {
          const parsedChunk = JSON.parse(currentChunk);
          if (parsedChunk.tool_calls && parsedChunk.tool_calls.length > 0) {
            toolCallsDetected = true;
            // Update the AI's current streaming message to indicate tool use
            setMessagesState(prev => prev.map(msg => msg.id === responseId ? { ...msg, content: fullResponse, thinking: `${isAgentMode ? 'Agent' : 'Assistant'} is using tools...` } : msg));

            for (const toolCall of parsedChunk.tool_calls) {
              const toolResult = await executeToolCall(toolCall);
              // Add tool result to both UI and conversation history
              setMessagesState(prev => [...prev, { id: toolResult.tool_call_id, content: toolResult.content, role: toolResult.role as any }]);
              currentConversation.push({ id: toolResult.tool_call_id, content: toolResult.content, role: toolResult.role as any });
            }
            currentChunk = ''; // Reset chunk after processing tool calls
            break; // Break from inner for-await loop to re-call aiService.streamChat
          } else {
            // Regular content chunk
            if (isFirstChunk) {
              fullResponse = currentChunk;
              isFirstChunk = false;
            } else {
              fullResponse += chunk;
            }
            setMessagesState(prev =>
              prev.map(msg =>
                msg.id === responseId
                  ? { ...msg, content: fullResponse, isStreaming: true }
                  : msg
              )
            );
          }
        } catch (parseError) {
          // If chunk is not JSON (i.e., regular text content or incomplete JSON)
          if (isFirstChunk) {
            fullResponse = currentChunk;
            isFirstChunk = false;
          } else {
            fullResponse += chunk;
          }
          setMessagesState(prev =>
            prev.map(msg =>
              msg.id === responseId
                ? { ...msg, content: fullResponse, isStreaming: true }
                : msg
            )
          );
        }
      }

      // After the inner loop, if no tool calls were detected, the AI's turn is over.
      // If tool calls were detected, the loop will continue, and a new AI message will be created.
      if (!toolCallsDetected) {
        // Finalize the AI's message for this turn
        setMessagesState(prev =>
          prev.map(msg =>
            msg.id === responseId
              ? { ...msg, isStreaming: false }
              : msg
          )
        );
        // Add the AI's final text response to the conversation history
        currentConversation.push({ id: responseId, content: fullResponse, role: 'assistant' });
      } else {
        // If tool calls were detected, prepare for the next turn by creating a new AI message ID
        responseId = (Date.now() + 1).toString();
        fullResponse = '';
        setMessagesState(prev => [...prev, { id: responseId, content: '', role: 'assistant', isStreaming: true }]);
      }

    } while (toolCallsDetected);
  };

  return { processAIStream };
};
