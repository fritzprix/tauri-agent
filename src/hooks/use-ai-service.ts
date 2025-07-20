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

  const submit = useCallback(
    async (messages: StreamableMessage[]): Promise<StreamableMessage> => {
      setIsLoading(true);
      setError(null);
      setResponse(null);

      let currentResponseId = createId();
      let fullContent = "";
      let finalMessage: StreamableMessage | null = null;

      try {
        const stream = serviceInstance.streamChat(messages, {
          modelName: model,
          systemPrompt: role?.systemPrompt || DEFAULT_SYSTEM_PROMPT,
          config: config,
        });

        for await (const chunk of stream) {
          fullContent += chunk;

          finalMessage = {
            id: currentResponseId,
            content: fullContent,
            role: "assistant",
            isStreaming: true,
          };
          setResponse(finalMessage);
        }

        finalMessage = {
          id: currentResponseId,
          content: fullContent,
          role: "assistant",
          isStreaming: false,
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
    [role, model, provider, apiKeys, config, serviceInstance]
  );

  return { response, isLoading, error, submit };
};
