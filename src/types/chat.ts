export interface MessageWithAttachments {
  id: string;
  content: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  thinking?: string;
  isStreaming?: boolean;
  attachments?: { name: string; content: string; }[];
}

export interface ChatMessage extends MessageWithAttachments {}
export interface AgentMessage extends MessageWithAttachments {}
