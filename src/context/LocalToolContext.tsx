import React, {
  useState,
  useCallback,
  useRef,
  useMemo,
  createContext,
  useContext,
} from "react";
import { MCPTool } from "../lib/tauri-mcp-client";

/**
 * Represents a single tool within a service, pairing its definition with its handler.
 */
export interface ServiceTool {
  toolDefinition: MCPTool;
  handler: (args: any) => any;
}

/**
 * Defines a service, which is a collection of related tools.
 * This is the basic unit for registration.
 */
export interface LocalService {
  name: string; // Unique name for the service, e.g., "weatherService"
  tools: ServiceTool[];
}

/**
 * Defines the values provided by the LocalToolContext.
 * The API is updated to register/unregister services instead of individual tools.
 */
interface LocalToolContextType {
  registerService: (service: LocalService) => void;
  unregisterService: (serviceName: string) => void;
  availableTools: MCPTool[];
  getToolsByService: (serviceName: string) => MCPTool[];
  getAvailableServices: () => string[];
  getService: (serviceName: string) => LocalService | undefined;
  getToolByName: (toolName: string) => ServiceTool | undefined;
  executeToolCall: (toolCall: {
    id: string;
    function: { name: string; arguments: string };
  }) => Promise<{ role: "tool"; content: string; tool_call_id: string }>;
}

const LocalToolContext = createContext<LocalToolContextType | null>(null);

export function LocalToolProvider({ children }: { children: React.ReactNode }) {
  // A ref to a Map that stores all registered services by name.
  const servicesRef = useRef<Map<string, LocalService>>(new Map());

  // A state variable to trigger re-renders when services change.
  const [version, setVersion] = useState(0);
  const forceUpdate = useCallback(() => setVersion((v) => v + 1), []);

  const registerService = useCallback(
    (service: LocalService) => {
      servicesRef.current.set(service.name, service);
      forceUpdate(); // Update UI when a service is registered
    },
    [forceUpdate]
  );

  const unregisterService = useCallback(
    (serviceName: string) => {
      servicesRef.current.delete(serviceName);
      forceUpdate(); // Update UI when a service is unregistered
    },
    [forceUpdate]
  );

  // The list of available tools is derived from all registered services.
  // It is memoized and only recalculated when the version number changes.
  const availableTools = useMemo(() => {
    const allTools: MCPTool[] = [];
    for (const service of servicesRef.current.values()) {
      service.tools.forEach((t) => allTools.push(t.toolDefinition));
    }
    return allTools;
  }, [version]);

  const getToolsByService = useCallback((serviceName: string) => {
    const service = servicesRef.current.get(serviceName);
    return service ? service.tools.map((t) => t.toolDefinition) : [];
  }, []);

  const getAvailableServices = useCallback(() => {
    return Array.from(servicesRef.current.keys());
  }, []);

  const getService = useCallback((serviceName: string) => {
    return servicesRef.current.get(serviceName);
  }, []);

  const getToolByName = useCallback((toolName: string) => {
    for (const service of servicesRef.current.values()) {
      const tool = service.tools.find(
        (t) => t.toolDefinition.name === toolName,
      );
      if (tool) {
        return tool;
      }
    }
    return undefined;
  }, []);

  const executeToolCall = useCallback(
    async (toolCall: {
      id: string;
      function: { name: string; arguments: string };
    }) => {
      const toolName = toolCall.function.name;
      // Search for the tool across all registered services and execute its handler.
      for (const service of servicesRef.current.values()) {
        const tool = service.tools.find(
          (t) => t.toolDefinition.name === toolName
        );
        if (tool) {
          try {
            const args = JSON.parse(toolCall.function.arguments);
            const result = await tool.handler(args);
            return {
              role: "tool" as const,
              content: JSON.stringify(result ?? null),
              tool_call_id: toolCall.id,
            };
          } catch (error: any) {
            return {
              role: "tool" as const,
              content: `Error executing tool: ${error.message}`,
              tool_call_id: toolCall.id,
            };
          }
        }
      }
      return {
        role: "tool" as const,
        content: `Error: Tool "${toolName}" not found.`,
        tool_call_id: toolCall.id,
      };
    },
    []
  );

  const value = useMemo(
    () => ({
      registerService,
      unregisterService,
      availableTools,
      getToolsByService,
      getAvailableServices,
      getService,
      getToolByName,
      executeToolCall,
    }),
    [
      registerService,
      unregisterService,
      availableTools,
      getToolsByService,
      getAvailableServices,
      getService,
      getToolByName,
      executeToolCall,
    ]
  );

  return (
    <LocalToolContext.Provider value={value}>
      {children}
    </LocalToolContext.Provider>
  );
}

export const useLocalTools = () => {
  const context = useContext(LocalToolContext);
  if (!context) {
    throw new Error("useLocalTools must be used within a LocalToolProvider");
  }
  return context;
};