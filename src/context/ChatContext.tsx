import React, { createContext, useCallback, useEffect, useState } from "react";
import { useAIService } from "../hooks/use-ai-service";
import { useMCPServer } from "../hooks/use-mcp-server";
import { StreamableMessage } from "../lib/ai-service";
import { useRoleContext } from "./RoleContext";


export interface ChatContextType {
    messages: StreamableMessage[];
    addMessage: (message: StreamableMessage) => void;
    isLoading: boolean;
    error: Error | null;
    submit: (userMessage?: StreamableMessage) => Promise<StreamableMessage>;
    mcpServerStatus: Record<string, boolean>;
    isMCPConnecting: boolean;
    connectToMCP: (role: any) => Promise<void>;
    availableTools: any[];
    executeToolCall: (toolCall: { id: string; type: 'function'; function: { name: string; arguments: string; } }) => Promise<{ role: 'tool'; content: string; tool_call_id: string }>;
}


export const ChatContext = createContext<ChatContextType | undefined>(undefined);


interface ChatProviderProps {
    children: React.ReactNode;
}


export const ChatContextProvider: React.FC<ChatProviderProps> = ({ children }) => {
    const [messages, setMessages] = useState<StreamableMessage[]>([]);
    const { error, isLoading, response, submit: triggerAIService } = useAIService();
    const { currentRole } = useRoleContext();
    const { availableTools, executeToolCall, connectToMCP, mcpServerStatus, isMCPConnecting } = useMCPServer();

    useEffect(() => {
        if (currentRole) {
            connectToMCP(currentRole);
        }
    }, [currentRole, connectToMCP]);

    useEffect(() => {
        if (response) {
            setMessages(prev => {
                const lastMessage = prev[prev.length - 1];
                let updatedResponse = { ...response };

                try {
                    const parsed = JSON.parse(response.content);
                    if (parsed.tool_calls) {
                        updatedResponse.tool_calls = parsed.tool_calls;
                        updatedResponse.content = ""; // Clear content if it's just tool calls
                    }
                } catch (e) {
                    // Not a JSON string, keep content as is
                }

                if (lastMessage?.role === "assistant" && lastMessage.isStreaming) {
                    return [
                        ...prev.slice(0, -1),
                        updatedResponse
                    ];
                } else {
                    return [
                        ...prev,
                        updatedResponse
                    ];
                }
            });
        }
    }, [response]);

    const addMessage = useCallback((message: StreamableMessage) => {
        setMessages(prev => [...prev, message]);
    }, []);

    const submit = useCallback(async (messageToAdd?: StreamableMessage) => {
        const newMessages = messageToAdd ? [...messages, messageToAdd] : messages;
        if (messageToAdd) {
            setMessages(newMessages);
        }
        return await triggerAIService(newMessages);
    }, [messages, triggerAIService]);

    return (
        <ChatContext.Provider value={{
            messages,
            addMessage,
            isLoading,
            error,
            submit,
            mcpServerStatus,
            isMCPConnecting,
            connectToMCP,
            availableTools,
            executeToolCall
        }}>
            {children}
        </ChatContext.Provider>
    );
};