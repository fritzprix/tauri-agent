import React, { useState } from "react";
import { useChatContext } from "../hooks/use-chat";
import Chat from "./Chat";
import StartSingleChatView from "./StartSingleChatView";

interface ChatContainerProps {
  children?: React.ReactNode;
}

export default function ChatContainer({ children }: ChatContainerProps) {
  const [showAssistantManager, setShowAssistantManager] = useState(false);
  const { currentSession } = useChatContext();

  if (!currentSession) {
    return (
      <StartSingleChatView
        showAssistantManager={showAssistantManager}
        setShowAssistantManager={setShowAssistantManager}
      />
    );
  }

  return (
    <Chat
      showAssistantManager={showAssistantManager}
      setShowAssistantManager={setShowAssistantManager}
    >
      {children}
    </Chat>
  );
}
