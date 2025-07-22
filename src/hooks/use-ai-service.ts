import { createId } from "@paralleldrive/cuid2";
import { useCallback, useMemo, useState } from "react";
import {
  AIServiceConfig,
  AIServiceFactory,
  StreamableMessage,
} from "../lib/ai-service";
import { getLogger } from "../lib/logger";
import { useSettings } from "./use-settings";
import { Role } from "../lib/db";
import { useMCPServer } from "./use-mcp-server";

const logger = getLogger("useAIService");

const DEFAULT_SYSTEM_PROMPT = "You are a helpful assistant.";

export const useAIService = (config?: AIServiceConfig, role?: Role) => {
  const {
    value: {
      preferredModel: { model, provider },
      apiKeys,
    },
  } = useSettings();
  const [response, setResponse] = useState<StreamableMessage | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const serviceInstance = useMemo(() => AIServiceFactory.getService(provider, apiKeys[provider], {
        defaultModel: model,
        maxRetries: 3,
        maxTokens: 4096,
      }),
    [provider, apiKeys, model]);

    const {availableTools} = useMCPServer();

  const submit = useCallback(
    async (messages: StreamableMessage[]): Promise<StreamableMessage> => {
      setIsLoading(true);
      setError(null);
      setResponse(null);

      let currentResponseId = createId();
      let fullContent = "";
      let thinking = "";
      let toolCalls: any[] = [];
      let finalMessage: StreamableMessage | null = null;

      try {
        const stream = serviceInstance.streamChat(messages, {
          modelName: model,
          systemPrompt: role?.systemPrompt || DEFAULT_SYSTEM_PROMPT,
          availableTools,
          config: config,
        });

        for await (const chunk of stream) {
          const parsedChunk = JSON.parse(chunk);
          
          if (parsedChunk.thinking) {
            thinking += parsedChunk.thinking;
          }
          if (parsedChunk.tool_calls) {
            parsedChunk.tool_calls.forEach((toolCallChunk: any) => {
              const { index } = toolCallChunk;
              if (index === undefined) {
                toolCalls.push(toolCallChunk);
                return;
              }

              if (toolCalls[index]) {
                if (toolCallChunk.function?.arguments) {
                  toolCalls[index].function.arguments += toolCallChunk.function.arguments;
                }
                if (toolCallChunk.id) {
                  toolCalls[index].id = toolCallChunk.id;
                }
              } else {
                toolCalls[index] = toolCallChunk;
              }
            });
            toolCalls = toolCalls.filter(Boolean);
          }
          if (parsedChunk.content) {
            fullContent += parsedChunk.content;
          }

          finalMessage = {
            id: currentResponseId,
            content: fullContent,
            role: "assistant",
            isStreaming: true,
            thinking,
            tool_calls: toolCalls,
          };
          logger.info("message : ", {finalMessage});
          setResponse(finalMessage);
        }

        finalMessage = {
          id: currentResponseId,
          content: fullContent,
          thinking,
          role: "assistant",
          isStreaming: false,
          tool_calls: toolCalls,
        };
        setResponse(finalMessage);
        return finalMessage;
      } catch (err) {
        logger.error("Error in useAIService stream:", err);
        setError(err as Error);
        setResponse((prev) => {
          if (prev) {
            return { ...prev, isStreaming: false, thinking: undefined };
          }
          return null;
        });
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [role, model, provider, apiKeys, config, serviceInstance, availableTools]
  );

  return { response, isLoading, error, submit };
};
