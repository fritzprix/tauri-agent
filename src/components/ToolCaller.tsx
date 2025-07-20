import { useEffect } from 'react';
import { useChatContext } from '../hooks/use-chat';
import { createId } from '@paralleldrive/cuid2';

export const ToolCaller: React.FC = () => {
  const { messages, addMessage, submit, executeToolCall } = useChatContext();

  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage && lastMessage.role === 'assistant' && lastMessage.tool_calls && !lastMessage.isStreaming) {
      const execute = async () => {
        for (const toolCall of lastMessage.tool_calls!) {
          const result = await executeToolCall(toolCall);
          addMessage({ id: createId(), role: 'tool', content: result.content, tool_call_id: result.tool_call_id });
        }
        submit();
      };
      execute();
    }
  }, [messages, addMessage, submit, executeToolCall]);

  return null;
};