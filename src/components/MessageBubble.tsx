import React from 'react';
import { LoadingSpinner } from './ui';

interface MessageWithAttachments {
  id: string;
  content: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  thinking?: string;
  isStreaming?: boolean;
  attachments?: { name: string; content: string; }[];
}

interface MessageBubbleProps {
  message: MessageWithAttachments;
  currentRoleName?: string;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message, currentRoleName }) => {
  const isUser = message.role === 'user';
  const isTool = message.role === 'tool';
  const isAssistant = message.role === 'assistant' || message.role === 'system';

  const bubbleClasses = `px-3 py-2 rounded ${isUser ? 'bg-blue-900/50 text-blue-200' : 'bg-gray-800/50 text-gray-200'}`;
  const headerClasses = `text-xs mb-1 ${isUser ? 'text-gray-400' : 'text-gray-400'}`;
  const contentClasses = `whitespace-pre-wrap text-sm`;

  let roleLabel = '';
  if (isUser) {
    roleLabel = 'You';
  } else if (isTool) {
    roleLabel = 'Tool Output';
  } else if (isAssistant) {
    roleLabel = currentRoleName ? `Agent (${currentRoleName})` : 'Assistant';
  }

  return (
    <div key={message.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-full lg:max-w-3xl ${bubbleClasses}`}>
        <div className={headerClasses}>{roleLabel}</div>
        <div className={contentClasses}>{message.content}</div>

        {message.thinking && (
          <div className="flex items-center gap-2 mt-2 text-sm text-gray-400 bg-gray-900/70 h-8 overflow-hidden px-2 rounded">
            <LoadingSpinner size="sm" /> {message.thinking}
          </div>
        )}

        {message.attachments && message.attachments.length > 0 && (
          <div className="mt-2 text-xs text-gray-400">
            📎 {message.attachments.length} file(s) attached
          </div>
        )}

        {isTool && (
          <div className="mt-2 text-xs text-gray-500 bg-gray-900/50 p-2 rounded overflow-x-auto max-h-24">
            <pre>{message.content}</pre>
          </div>
        )}
      </div>
    </div>
  );
};

export default MessageBubble;
