import { createId } from "@paralleldrive/cuid2";
import { useEffect } from "react";
import { useLocalTools } from "../../context/LocalToolContext";
import { useMCPServer } from "../../hooks/use-mcp-server";
import { StreamableMessage } from "../../types/chat";
// import { useChatContext } from "../../context/ChatContext";
import { useSessionContext } from "../../context/SessionContext";
import { useChatContext } from "../../hooks/use-chat";

export const ToolCaller: React.FC = () => {
  const { current: currentSession } = useSessionContext();

  const { messages, submit } = useChatContext();
  const { executeToolCall: callMcpTool } = useMCPServer();
  const { isLocalTool, executeToolCall: callLocalTool } = useLocalTools();

  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (
      lastMessage &&
      lastMessage.role === "assistant" &&
      lastMessage.tool_calls &&
      lastMessage.tool_calls.length > 0 &&
      !lastMessage.isStreaming
    ) {
      const execute = async () => {
        const toolResults: StreamableMessage[] = [];
        for (const toolCall of lastMessage.tool_calls!) {
          const toolName = toolCall.function.name;
          const callFunction = isLocalTool(toolName)
            ? callLocalTool
            : callMcpTool;
          const result = await callFunction(toolCall);
          toolResults.push({
            id: createId(),
            role: "tool",
            content: result.content,
            tool_call_id: toolCall.id,
            sessionId: currentSession?.id || "", // Add sessionId
          });
        }
        submit(toolResults);
      };
      execute();
    }
  }, [messages, submit, isLocalTool]);

  return null;
};
