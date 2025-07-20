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

  // Enhanced styling based on role
  const getBubbleStyles = () => {
    if (isUser) {
      return {
        container: 'justify-end',
        bubble: 'text-white shadow-lg shadow-blue-900/25 border border-blue-500/20',
        avatar: '🧑‍💻',
        avatarBg: 'bg-blue-500'
      };
    } else if (isTool) {
      return {
        container: 'justify-start',
        bubble: 'shadow-lg shadow-purple-900/25 border border-purple-500/20',
        avatar: '🔧',
        avatarBg: 'bg-purple-500'
      };
    } else {
      return {
        container: 'justify-start',
        bubble: 'shadow-lg shadow-black/25 border border-gray-600/20',
        avatar: '🤖',
        avatarBg: 'bg-green-500'
      };
    }
  };

  const styles = getBubbleStyles();

  const getRoleLabel = () => {
    if (isUser) return 'You';
    if (isTool) return 'Tool Output';
    if (isAssistant) return currentRoleName ? `Agent (${currentRoleName})` : 'Assistant';
    return '';
  };

  const formatContent = (content: string) => {
    // Simple markdown-like formatting for better readability
    return content
      .split('\n')
      .map((line, index) => {
        // Handle code blocks
        if (line.startsWith('```')) {
          return <div key={index} className="text-xs text-gray-400 font-mono">{line}</div>;
        }
        // Handle headers
        if (line.startsWith('# ')) {
          return <div key={index} className="font-bold text-lg mt-3 mb-1">{line.substring(2)}</div>;
        }
        if (line.startsWith('## ')) {
          return <div key={index} className="font-bold text-base mt-2 mb-1">{line.substring(3)}</div>;
        }
        // Handle bold text
        if (line.includes('**')) {
          const parts = line.split('**');
          return (
            <div key={index}>
              {parts.map((part, i) => 
                i % 2 === 1 ? <strong key={i}>{part}</strong> : part
              )}
            </div>
          );
        }
        return <div key={index}>{line || '\u00A0'}</div>;
      });
  };

  return (
    <div className={`flex ${styles.container} mb-8 mt-3 animate-in fade-in duration-300`}>
      <div className={`max-w-[85%] lg:max-w-4xl ${styles.bubble} rounded-2xl px-5 py-4 backdrop-blur-sm transition-all duration-200 hover:shadow-xl`}>
        {/* Header with avatar and role */}
        <div className="flex items-center gap-3 mb-3">
          <div className={`w-7 h-7 ${styles.avatarBg} rounded-full flex items-center justify-center text-sm shadow-sm`}>
            {styles.avatar}
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-medium opacity-90">{getRoleLabel()}</span>
            <span className="text-xs opacity-60">{new Date().toLocaleTimeString()}</span>
          </div>
        </div>

        {/* Main content */}
        <div className="text-sm leading-relaxed">
          {formatContent(message.content)}
        </div>

        {/* Thinking indicator */}
        {message.thinking && (
          <div className="flex items-center gap-3 mt-4 p-3 bg-black/20 rounded-lg border border-white/10">
            <LoadingSpinner size="sm" />
            <span className="text-sm opacity-80 italic">{message.thinking}</span>
          </div>
        )}

        {/* Attachments */}
        {message.attachments && message.attachments.length > 0 && (
          <div className="mt-4 p-3 bg-black/20 rounded-lg border border-white/10">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm">📎</span>
              <span className="text-sm font-medium">
                {message.attachments.length} file{message.attachments.length > 1 ? 's' : ''} attached
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {message.attachments.map((attachment, index) => (
                <div
                  key={index}
                  className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 rounded-full text-xs"
                >
                  <span className="text-green-400">📄</span>
                  <span className="truncate max-w-32">{attachment.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Enhanced tool output */}
        {isTool && (
          <div className="mt-4 bg-black/30 rounded-lg border border-purple-400/20 overflow-hidden">
            <div className="px-3 py-2 bg-purple-900/30 border-b border-purple-400/20 flex items-center gap-2">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
              </div>
              <span className="text-xs text-purple-300 font-mono">Tool Output</span>
            </div>
            <div className="p-4 max-h-32 overflow-y-auto custom-scrollbar">
              <pre className="text-xs text-purple-100 font-mono whitespace-pre-wrap break-words">
                {message.content}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MessageBubble;