import { useEffect } from 'react';
import { useChatContext } from '../../hooks/use-chat';
import { createId } from '@paralleldrive/cuid2';

export const ToolCaller: React.FC = () => {
  const { messages, addMessage, submit, executeToolCall } = useChatContext();

  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage && lastMessage.role === 'assistant' && lastMessage.tool_calls && lastMessage.tool_calls.length > 0 && !lastMessage.isStreaming) {
      const execute = async () => {
        for (const toolCall of lastMessage.tool_calls!) {
          const result = await executeToolCall(toolCall);
          addMessage({ id: createId(), role: 'tool', content: result.content, tool_call_id: toolCall.id });
        }
        submit();
      };
      execute();
    }
  }, [messages, addMessage, submit, executeToolCall]);

  return null;
};