import React, { createContext, useCallback, useEffect, useRef, useState } from "react";
import { useAIService } from "../hooks/use-ai-service";
import { useMCPServer } from "../hooks/use-mcp-server";
import { StreamableMessage } from "../lib/ai-service";
import { useAssistantContext } from "./AssistantContext";

export interface ChatContextType {
  messages: StreamableMessage[];
  addMessage: (message: StreamableMessage) => void;
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

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    if (currentAssistant) {
      connectServers(currentAssistant);
    }
  }, [currentAssistant, connectServers]);

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

  const addMessage = useCallback((message: StreamableMessage) => {
    setMessages((prev) => [...prev, message]);
  }, []);

  const getMessages = useCallback(() => {
    return messagesRef.current;
  },[]);

  const submit = useCallback(
    async (messageToAdd?: StreamableMessage[]) => {
      const newMessages = messageToAdd
        ? [...messagesRef.current, ...messageToAdd]
        : messagesRef.current;
      if (messageToAdd) {
        setMessages(newMessages);
      }
      return await triggerAIService(newMessages);
    },
    [triggerAIService],
  );

  return (
    <ChatContext.Provider
      value={{
        messages,
        addMessage,
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
