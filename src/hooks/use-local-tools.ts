import { useMemo } from "react";
import { useLocalTools as useLocalToolsContext } from "../context/LocalToolContext";
import { Tool } from "../types/chat";
import { getLogger } from "../lib/logger";
import { useAssistantContext } from "../context/AssistantContext";

const logger = getLogger("useLocalTools");

export const useLocalTools = () => {
  const {
    availableTools: allLocalTools,
    getService,
    executeToolCall,
  } = useLocalToolsContext();
  const { currentAssistant } = useAssistantContext();

  const availableTools = useMemo(() => {
    logger.debug("useLocalTools: assistant.localServices", currentAssistant?.localServices);
    if (!currentAssistant?.localServices) {
      return [];
    }

    const enabledTools: Tool[] = [];
    for (const serviceName of currentAssistant.localServices) {
      const service = getService(serviceName);
      if (service) {
        for (const tool of service.tools) {
          enabledTools.push({ ...tool.toolDefinition, isLocal: true });
        }
      }
    }
    return enabledTools;
  }, [currentAssistant, getService]);

  const isLocalTool = (toolName: string) => {
    return allLocalTools.some((tool) => tool.name === toolName);
  };

  return { availableTools, isLocalTool, executeToolCall };
};
