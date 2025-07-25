import React, { createContext, useCallback, useEffect, useRef, useState } from "react";
import { useAIService } from "../hooks/use-ai-service";
import { useMCPServer } from "../hooks/use-mcp-server";
import { StreamableMessage, Session, Assistant } from "../types/chat";
import { useAssistantContext } from "./AssistantContext";
import { createId } from '@paralleldrive/cuid2';
import { dbService } from "../lib/db"; // Import dbService

export interface ChatContextType {
  messages: StreamableMessage[];
  addMessage: (message: StreamableMessage) => void;
  getMessages: () => StreamableMessage[];
  isLoading: boolean;
  error: Error | null;
  submit: (messages?: StreamableMessage[]) => Promise<StreamableMessage>;
  currentSession: Session | null;
  startNewSession: (assistants: Assistant[], type: "single" | "group", name?: string, description?: string) => void;
  loadSession: (sessionId: string) => Promise<void>; // New: Function to load an existing session
  clearCurrentSession: () => void; // New: Function to clear the current session
  deleteSession: (sessionId: string) => Promise<void>; // New: Function to delete a session
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
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
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
    if (currentSession) {
      // Connect servers for all assistants in the current session
      currentSession.assistants.forEach(assistant => {
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

  const startNewSession = useCallback(async (assistants: Assistant[], type: "single" | "group", name?: string, description?: string) => {
    const newSession: Session = {
      id: createId(),
      type,
      assistants,
      name: name || (type === "single" ? assistants[0]?.name : "New Group Chat"),
      description: description || (type === "single" ? assistants[0]?.systemPrompt : "A new group conversation"),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await dbService.sessions.upsert(newSession); // Save new session
    setCurrentSession(newSession);
    setMessages([]); // Clear messages for new session
  }, []);

  const addMessage = useCallback(async (message: StreamableMessage) => {
    if (!currentSession) {
      console.error("No active session to add message to.");
      return;
    }
    const messageWithSessionId = { ...message, sessionId: currentSession.id };
    await dbService.messages.upsert(messageWithSessionId); // Save message
    setMessages((prev) => [...prev, messageWithSessionId]);
  }, [currentSession]);

  const loadSession = useCallback(async (sessionId: string) => {
    const session = await dbService.sessions.read(sessionId);
    if (session) {
      setCurrentSession(session);
      const loadedMessages = await dbService.messages.getPage(1, -1); // Load all messages for the session
      setMessages(loadedMessages.items.filter(m => m.sessionId === sessionId));
    } else {
      console.error(`Session with ID ${sessionId} not found.`);
      setCurrentSession(null);
      setMessages([]);
    }
  }, []);

  const getMessages = useCallback(() => {
    return messagesRef.current;
  },[]);

  const clearCurrentSession = useCallback(() => {
    setCurrentSession(null);
    setMessages([]);
  }, []);

  const deleteSession = useCallback(async (sessionId: string) => {
    await dbService.sessions.delete(sessionId);
    // Optionally, delete associated messages as well
    // await dbService.messages.where("sessionId").equals(sessionId).delete();

    if (currentSession?.id === sessionId) {
      clearCurrentSession();
    }
  }, [currentSession, clearCurrentSession]);

  const submit = useCallback(
    async (messageToAdd?: StreamableMessage[]) => {
      if (!currentSession) {
        console.error("No active session to submit messages to.");
        return Promise.reject(new Error("No active session."));
      }

      let messagesToSend: StreamableMessage[];

      if (messageToAdd) {
        const messagesWithSessionId = messageToAdd.map(msg => ({
          ...msg,
          sessionId: msg.sessionId || currentSession.id
        }));
        messagesToSend = [...messagesRef.current, ...messagesWithSessionId];
        setMessages(messagesToSend);
      } else {
        messagesToSend = messagesRef.current;
      }

      const finalMessagesForAI = messagesToSend.map(msg => ({
        ...msg,
        sessionId: msg.sessionId || currentSession.id
      }));

      const aiResponse = await triggerAIService(finalMessagesForAI);
      if (aiResponse) {
        await dbService.messages.upsert({ ...aiResponse, sessionId: currentSession.id });
      }
      return aiResponse;
    },
    [triggerAIService, currentSession],
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
        currentSession,
        startNewSession,
        loadSession,
        clearCurrentSession,
        deleteSession,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};
