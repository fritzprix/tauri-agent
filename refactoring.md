# Refactoring Plan: Separating Agentic Flow in `Chat.tsx`

**Goal:** Extract the core agentic logic, including tool execution and the iterative `processAIStream` loop for agents, into dedicated custom hooks and components, making `Chat.tsx` primarily responsible for UI orchestration and mode switching.

**Proposed Structure:**

*   **`src/components/Chat.tsx` (Main Component):**
    *   Will remain the top-level component for the chat interface.
    *   Manages the `mode` state (`chat` vs. `agent`).
    *   Renders either a `SimpleChat` component or an `AgentChat` component based on the `mode`.
    *   Handles global UI elements like the header, mode switcher, and model picker.
    *   Manages `currentRole` and related `showRoleManager` state, as roles are shared across both modes.

*   **`src/components/SimpleChat.tsx` (New Component):**
    *   Encapsulates the "simple chat" mode logic.
    *   Manages `messages`, `input`, `isLoading` states for simple chat.
    *   Contains the `handleSubmit` function for simple chat.
    *   Renders the message display and input area specific to simple chat.
    *   Will use a new `useAIStream` hook (see below) for AI communication.

*   **`src/components/AgentChat.tsx` (New Component):**
    *   Encapsulates the "agent" mode logic.
    *   Manages `agentMessages`, `agentInput`, `isAgentLoading`, `attachedFiles` states.
    *   Contains the `handleAgentSubmit` function.
    *   Manages `availableTools`, `isMCPConnecting`, `mcpServerStatus`, `showServerDropdown`, `showToolsDetail` states and their related logic (`connectToMCP`, `getMCPStatus`, `getStatusText`, `executeToolCall`).
    *   Renders the message display, input area, and MCP status/tools detail specific to agent mode.
    *   Will use a new `useAIStream` hook (see below) for AI communication.

*   **`src/hooks/use-ai-stream.ts` (New Custom Hook):**
    *   This hook will encapsulate the `processAIStream` logic, which is common to both simple chat and agent chat for interacting with the AI service.
    *   It will take parameters like `aiService`, `messageWindowSize`, `executeToolCall` (or `executeToolCall` will be part of this hook if it's generic enough), and a callback for updating messages.
    *   It will handle the streaming, tool call detection, and execution.

*   **`src/hooks/use-mcp-agent.ts` (New Custom Hook):**
    *   This hook will encapsulate all MCP-related logic and state.
    *   It will manage `availableTools`, `isMCPConnecting`, `mcpServerStatus`, `showServerDropdown`, `showToolsDetail`.
    *   It will contain `connectToMCP`, `getMCPStatus`, `getStatusText`, `executeToolCall`.
    *   `AgentChat.tsx` will use this hook.

**Step-by-Step Refactoring Process:**

**Phase 1: Extract `useAIStream` Hook**

1.  **Create `src/hooks/use-ai-stream.ts`:**
    *   Move the `processAIStream` function from `Chat.tsx` into this new file.
    *   Modify `processAIStream` to be a custom hook, `useAIStream`, that returns a function to initiate streaming.
    *   Ensure all necessary types (`StreamableMessage`, `AIServiceConfig`, `IAIService`, `MCPTool`) are imported.

**Progress:**
*   `src/hooks/use-ai-stream.ts` has been created and the `processAIStream` logic has been moved there.

**Phase 2: Extract `useMCPAgent` Hook**

1.  **Create `src/hooks/use-mcp-agent.ts`:**
    *   Move all MCP-related state (`availableTools`, `isMCPConnecting`, `mcpServerStatus`, `showServerDropdown`, `showToolsDetail`) and functions (`connectToMCP`, `getMCPStatus`, `getStatusText`, `executeToolCall`) from `Chat.tsx` into this new file.
    *   Make it a custom hook, `useMCPAgent`, that returns these states and functions.
    *   Ensure all necessary types (`Role`, `MCPTool`, `tauriMCPClient`, `getLogger`) are imported.

**Progress:**
*   `src/hooks/use-mcp-agent.ts` has been created and the MCP-related logic has been moved there.

**Phase 3: Create `SimpleChat.tsx` and `AgentChat.tsx` Components**

1.  **Create `src/components/SimpleChat.tsx`:**
    *   Move all simple chat-specific state (`messages`, `input`, `isLoading`) and functions (`handleInputChange`, `handleSubmit`) from `Chat.tsx` into this new component.
    *   Move the simple chat message rendering and input form JSX.
    *   It will receive `selectedProvider`, `selectedModel`, `apiKeys`, `messageWindowSize`, `aiServiceConfig`, `currentRole` (for system prompt) as props.
    *   It will use `useAIStream` internally.

**Progress:**
*   `src/components/SimpleChat.tsx` has been created and the simple chat logic has been moved there.

2.  **Create `src/components/AgentChat.tsx`:**
    *   Move all agent chat-specific state (`agentMessages`, `agentInput`, `isAgentLoading`, `attachedFiles`) and functions (`handleAgentInputChange`, `handleFileAttachment`, `removeAttachedFile`, `handleAgentSubmit`) from `Chat.tsx` into this new component.
    *   Move the agent chat message rendering, input form, MCP status display, and tools detail modal JSX.
    *   It will receive `selectedProvider`, `selectedModel`, `apiKeys`, `messageWindowSize`, `aiServiceConfig`, `currentRole` as props.
    *   It will use `useAIStream` and `useMCPAgent` internally.

**Progress:**
*   `src/components/AgentChat.tsx` has been created and the agent chat logic has been moved there.

**Phase 4: Update `Chat.tsx` and Cleanup**

1.  **Update `Chat.tsx`:**
    *   Import `SimpleChat` and `AgentChat`.
    *   Remove all chat-specific and agent-specific states and functions that have been moved.
    *   Remove `getAIService` and `processAIStream`.
    *   Update the main `return` block to conditionally render `SimpleChat` or `AgentChat`.
    *   Adjust `useEffect` dependencies for auto-scrolling.
    *   Remove the `initApp` function and its `useEffect` call.

**Progress:**
*   `Chat.tsx` has been updated to import `SimpleChat` and `AgentChat`.
*   Most of the chat-specific and agent-specific states and functions have been removed.
*   The `initApp` function and its `useEffect` call have been removed.
*   The `getAIService` function has been removed.
*   The `processAIStream` function has been removed.
*   The `messagesEndRef` is still in `Chat.tsx` and its `useEffect` still references `messages` and `agentMessages` which are no longer in `Chat.tsx`. This needs to be addressed.
*   The `MessageWithAttachments` interface is still in `Chat.tsx` but should be moved to a shared types file if both `SimpleChat` and `AgentChat` need it.

**Remaining Tasks for Phase 4:**

*   Move `MessageWithAttachments` interface to a shared types file (e.g., `src/types/chat.ts`).
*   Adjust `messagesEndRef` and its `useEffect` in `Chat.tsx` as `messages` and `agentMessages` are no longer directly managed there. This ref will likely need to be passed down to `SimpleChat` and `AgentChat` or handled within those components.
*   Final cleanup of `Chat.tsx` to ensure only global states and mode switching logic remain.
*   Run TypeScript checks (`npx tsc --noEmit`) to catch any remaining type errors.
*   Thoroughly test both chat and agent modes to ensure all functionality is preserved.
