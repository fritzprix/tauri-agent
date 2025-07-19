import {
  AIServiceConfig,
  IAIService,
  StreamableMessage,
} from "../lib/ai-service";
import { getLogger } from "../lib/logger";
import { MCPTool } from "../lib/tauri-mcp-client";
import { AIOrchestrator, OrchestratorFactory } from "./use-ai-orchestrator";

const logger = getLogger("use-ai-stream");

export interface ProcessAIStreamOptions {
  aiService: IAIService;
  initialConversation: StreamableMessage[];
  setMessagesState: React.Dispatch<React.SetStateAction<StreamableMessage[]>>;
  modelName?: string;
  systemPrompt?: string;
  availableTools?: MCPTool[];
  aiServiceConfig: AIServiceConfig;
  executeToolCall: (toolCall: {
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }) => Promise<{ role: "tool"; content: string; tool_call_id: string }>;
  messageWindowSize: number;
  orchestrator?: AIOrchestrator; // Optional - will use default if not provided
}

export const useAIStream = () => {
  const processAIStream = async ({
    aiService,
    initialConversation,
    setMessagesState,
    modelName,
    systemPrompt,
    availableTools = [],
    aiServiceConfig,
    executeToolCall,
    messageWindowSize,
    orchestrator,
  }: ProcessAIStreamOptions) => {
    // Create default orchestrator if not provided
    const aiOrchestrator =
      orchestrator || OrchestratorFactory.createDefault(availableTools);

    let currentConversation: StreamableMessage[] = initialConversation.slice(
      -messageWindowSize
    );
    let responseId = (Date.now() + 1).toString();
    let fullResponse = "";

    // Initialize empty response
    const initialResponse: StreamableMessage = {
      id: responseId,
      content: "",
      role: "assistant",
      isStreaming: true,
    };
    setMessagesState((prev) => [...prev, initialResponse]);

    logger.info("Starting AI stream", {
      availableTools: availableTools.length,
      orchestrator: aiOrchestrator.getDisplayName(),
    });

    let conversationActive = true;

    while (conversationActive) {
      let currentChunk = "";
      let isFirstChunk = true;
      let turnComplete = false;

      // Stream AI response
      for await (const chunk of aiService.streamChat(currentConversation, {
        modelName,
        systemPrompt,
        availableTools,
        config: aiServiceConfig,
      })) {
        currentChunk += chunk;

        // Update UI with streaming content
        if (isFirstChunk) {
          fullResponse = currentChunk;
          isFirstChunk = false;
        } else {
          fullResponse += chunk;
        }

        // Update streaming message
        setMessagesState((prev) =>
          prev.map((msg) =>
            msg.id === responseId
              ? { ...msg, content: fullResponse, isStreaming: true }
              : msg
          )
        );

        // Let orchestrator process the chunk
        const result = await aiOrchestrator.processStreamChunk(
          chunk,
          fullResponse,
          currentConversation,
          executeToolCall
        );

        if (result.toolCalls && result.toolCalls.length > 0) {
          // Update UI to show tool usage
          setMessagesState((prev) =>
            prev.map((msg) =>
              msg.id === responseId
                ? {
                    ...msg,
                    content: fullResponse,
                    thinking: `${aiOrchestrator.getDisplayName()} is using tools...`,
                  }
                : msg
            )
          );

          // Execute tool calls and add results
          for (const toolCall of result.toolCalls) {
            const toolResult = await executeToolCall(toolCall);
            setMessagesState((prev) => [
              ...prev,
              {
                id: toolResult.tool_call_id,
                content: toolResult.content,
                role: toolResult.role as any,
              },
            ]);
            currentConversation.push({
              id: toolResult.tool_call_id,
              content: toolResult.content,
              role: toolResult.role as any,
            });
          }

          turnComplete = true;
          currentChunk = "";
          break; // Break to start new AI turn
        }
      }

      if (!turnComplete) {
        // No tool calls, finalize this turn
        setMessagesState((prev) =>
          prev.map((msg) =>
            msg.id === responseId ? { ...msg, isStreaming: false } : msg
          )
        );

        currentConversation.push({
          id: responseId,
          content: fullResponse,
          role: "assistant",
        });

        // Check if orchestrator wants to continue
        const action = await aiOrchestrator.decideNextAction(
          fullResponse,
          currentConversation
        );

        conversationActive = action.action === "continue";
      } else {
        // Tool calls executed, prepare for next turn
        responseId = (Date.now() + 1).toString();
        fullResponse = "";
        setMessagesState((prev) => [
          ...prev,
          {
            id: responseId,
            content: "",
            role: "assistant",
            isStreaming: true,
          },
        ]);

        // Check if we should continue the conversation
        conversationActive =
          aiOrchestrator.shouldContinueConversation(currentConversation);
      }
    }

    logger.info("AI stream completed", {
      orchestrator: aiOrchestrator.getDisplayName(),
    });
  };

  return { processAIStream };
};
