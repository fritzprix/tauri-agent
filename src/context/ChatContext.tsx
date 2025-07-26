import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useAIService } from "../hooks/use-ai-service";
import { useMCPServer } from "../hooks/use-mcp-server";
import { dbService } from "../lib/db"; // Import dbService and dbUtils
import { StreamableMessage } from "../types/chat";
import { useAssistantContext } from "./AssistantContext";
import { useSessionContext } from "./SessionContext";

export interface ChatContextType {
  messages: StreamableMessage[];
  addMessage: (message: StreamableMessage) => Promise<StreamableMessage>;
  addMessageOptimistic: (
    message: StreamableMessage,
  ) => Promise<StreamableMessage>;
  addMessageBatch: (
    messages: StreamableMessage[],
  ) => Promise<StreamableMessage[]>;
  updateMessage: (
    messageId: string,
    updates: Partial<StreamableMessage>,
  ) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
  getMessages: () => StreamableMessage[];
  isLoading: boolean;
  error: Error | null;
  submit: (messages?: StreamableMessage[]) => Promise<StreamableMessage>;
}

export const ChatContext = createContext<ChatContextType | undefined>(
  undefined,
);

interface ChatProviderProps {
  children: React.ReactNode;
}

export const ChatContextProvider: React.FC<ChatProviderProps> = ({
  children,
}) => {
  const { current: currentSession } = useSessionContext();
  const [messages, setMessages] = useState<StreamableMessage[]>([]);
  const messagesRef = useRef(messages);
  const {
    error,
    isLoading,
    response,
    submit: triggerAIService,
  } = useAIService();
  const { currentAssistant } = useAssistantContext();
  const { connectServers } = useMCPServer();

  // Message validation function
  const validateMessage = useCallback((message: StreamableMessage): boolean => {
    return !!(message.role && (message.content || message.tool_calls));
  }, []);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    if (currentSession) {
      // Connect servers for all assistants in the current session
      currentSession.assistants.forEach((assistant) => {
        connectServers(assistant);
      });
    } else if (currentAssistant) {
      // Fallback for when there's no active session but a currentAssistant is set
      connectServers(currentAssistant);
    }
  }, [currentSession, currentAssistant, connectServers]);

  useEffect(() => {
    if (response) {
      setMessages((prev) => {
        const lastMessage = prev[prev.length - 1];
        let updatedResponse = { ...response };

        if (lastMessage?.role === "assistant" && lastMessage.isStreaming) {
          return [...prev.slice(0, -1), updatedResponse];
        } else {
          return [...prev, updatedResponse];
        }
      });
    }
  }, [response]);


  const addMessage = useCallback(
    async (message: StreamableMessage): Promise<StreamableMessage> => {
      if (!currentSession) {
        throw new Error("No active session to add message to.");
      }

      if (!validateMessage(message)) {
        throw new Error(
          "Invalid message: must have role and either content or tool_calls",
        );
      }

      try {
        const messageWithSessionId = {
          ...message,
          sessionId: currentSession.id,
        };
        await dbService.messages.upsert(messageWithSessionId);
        setMessages((prev) => [...prev, messageWithSessionId]);
        return messageWithSessionId;
      } catch (error) {
        console.error("Failed to add message:", error);
        throw error;
      }
    },
    [currentSession, validateMessage],
  );

  const addMessageOptimistic = useCallback(
    async (message: StreamableMessage): Promise<StreamableMessage> => {
      if (!currentSession) {
        throw new Error("No active session to add message to.");
      }

      if (!validateMessage(message)) {
        throw new Error(
          "Invalid message: must have role and either content or tool_calls",
        );
      }

      const messageWithSessionId = {
        ...message,
        sessionId: currentSession.id,
      };

      // Optimistic update - add to UI immediately
      setMessages((prev) => [...prev, messageWithSessionId]);

      try {
        await dbService.messages.upsert(messageWithSessionId);
        return messageWithSessionId;
      } catch (error) {
        // Rollback on failure - remove from UI
        setMessages((prev) => prev.filter((m) => m.id !== message.id));
        console.error("Failed to add message:", error);
        throw error;
      }
    },
    [currentSession, validateMessage],
  );

  const addMessageBatch = useCallback(
    async (messages: StreamableMessage[]): Promise<StreamableMessage[]> => {
      if (!currentSession) {
        throw new Error("No active session to add messages to.");
      }

      // Validate all messages first
      messages.forEach((message) => {
        if (!validateMessage(message)) {
          throw new Error(
            `Invalid message with id ${message.id}: must have role and either content or tool_calls`,
          );
        }
      });

      try {
        const messagesWithSessionId = messages.map((msg) => ({
          ...msg,
          sessionId: currentSession.id,
        }));

        await dbService.messages.upsertMany(messagesWithSessionId);
        setMessages((prev) => [...prev, ...messagesWithSessionId]);
        return messagesWithSessionId;
      } catch (error) {
        console.error("Failed to add message batch:", error);
        throw error;
      }
    },
    [currentSession, validateMessage],
  );

  const updateMessage = useCallback(
    async (
      messageId: string,
      updates: Partial<StreamableMessage>,
    ): Promise<void> => {
      if (!currentSession) {
        throw new Error("No active session for message update.");
      }

      try {
        const existingMessage = messages.find((m) => m.id === messageId);
        if (!existingMessage) {
          throw new Error(`Message with id ${messageId} not found.`);
        }

        const updatedMessage = {
          ...existingMessage,
          ...updates,
          updatedAt: new Date(),
        };

        if (!validateMessage(updatedMessage)) {
          throw new Error(
            "Invalid message update: must have role and either content or tool_calls",
          );
        }

        await dbService.messages.upsert(updatedMessage);
        setMessages((prev) =>
          prev.map((m) => (m.id === messageId ? updatedMessage : m)),
        );
      } catch (error) {
        console.error("Failed to update message:", error);
        throw error;
      }
    },
    [currentSession, messages, validateMessage],
  );

  const deleteMessage = useCallback(
    async (messageId: string): Promise<void> => {
      try {
        await dbService.messages.delete(messageId);
        setMessages((prev) => prev.filter((m) => m.id !== messageId));
      } catch (error) {
        console.error("Failed to delete message:", error);
        throw error;
      }
    },
    [],
  );


  const getMessages = useCallback(() => {
    return messagesRef.current;
  }, []);


  const submit = useCallback(
    async (messageToAdd?: StreamableMessage[]): Promise<StreamableMessage> => {
      if (!currentSession) {
        throw new Error("No active session to submit messages to.");
      }

      try {
        let messagesToSend: StreamableMessage[];

        if (messageToAdd) {
          // Validate and persist new messages before processing
          const messagesWithSessionId = await Promise.all(
            messageToAdd.map(async (msg) => {
              if (!validateMessage(msg)) {
                throw new Error(
                  "Invalid message in batch: must have role and either content or tool_calls",
                );
              }
              const messageWithId = { ...msg, sessionId: currentSession.id };
              await dbService.messages.upsert(messageWithId);
              return messageWithId;
            }),
          );

          messagesToSend = [...messagesRef.current, ...messagesWithSessionId];
          setMessages(messagesToSend);
        } else {
          messagesToSend = messagesRef.current;
        }

        const aiResponse = await triggerAIService(messagesToSend);

        if (aiResponse) {
          const responseWithSessionId = {
            ...aiResponse,
            sessionId: currentSession.id,
          };
          await dbService.messages.upsert(responseWithSessionId);
          // State will be updated via the useEffect for response
        }

        return aiResponse;
      } catch (error) {
        console.error("Failed to submit messages:", error);
        throw error;
      }
    },
    [triggerAIService, currentSession, validateMessage],
  );

  return (
    <ChatContext.Provider
      value={{
        messages,
        addMessage,
        addMessageOptimistic,
        addMessageBatch,
        updateMessage,
        deleteMessage,
        getMessages,
        isLoading,
        error,
        submit,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};


export function useChatContext(): ChatContextType {
  const context = useContext(ChatContext);
  if (!context) {
    throw Error();
  }
  return context;
}