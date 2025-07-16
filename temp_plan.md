# Refactoring Plan: Tool Calling in `Chat.tsx`

## Objective
Implement robust and consistent tool calling functionality in both 'chat' and 'agent' modes within `src/components/Chat.tsx`, ensuring proper execution of MCP tools and seamless integration with the AI conversation flow.

## Current Status (Completed Steps)
1.  **Logger Integration:** Replaced all `console.log` and `console.error` calls with the new `getLogger` pattern (`logger.debug`, `logger.error`) for consistent and context-aware logging.
2.  **`executeToolCall` Function:** Created a dedicated asynchronous function `executeToolCall` to handle the parsing of AI-generated tool call objects and their execution via `tauriMCPClient.callTool`. This function returns a `StreamableMessage` with `role: 'tool'` and the tool's result or an error.
3.  **`processAIStream` Helper Function:** Introduced a new asynchronous helper function `processAIStream` to encapsulate the core logic for:
    *   Managing the AI conversation history (`currentConversation`).
    *   Handling the `do...while` loop for multi-turn AI interactions (allowing the AI to make multiple tool calls or generate multiple responses in a single user turn).
    *   Processing streamed chunks from `aiService.streamChat`, including:
        *   Detecting and parsing `tool_calls` from JSON chunks.
        *   Calling `executeToolCall` for each detected tool call.
        *   Updating the UI state (`setMessagesState`) with both AI content and tool results.
        *   Adding tool results to the `currentConversation` to be sent back to the AI.
4.  **Integration into `handleSubmit` and `handleAgentSubmit`:** Both `handleSubmit` (for 'chat' mode) and `handleAgentSubmit` (for 'agent' mode) now utilize the `processAIStream` helper function, passing in their respective state management functions (`setMessages` or `setAgentMessages`) and other relevant parameters.

## Remaining Tasks (Next Steps)

1.  **Refine `processAIStream` for UI Feedback:**
    *   Currently, the UI update for "Agent/Assistant is using tools..." is a simple append. Consider a more sophisticated UI indication for tool execution (e.g., a dedicated status message, a spinner next to the tool call).
    *   Ensure that the final AI response is clearly distinguishable after tool execution.

2.  **Error Handling and User Feedback:**
    *   Improve user-facing error messages for failed tool executions.
    *   Consider how to present tool execution errors to the AI model for self-correction.

3.  **Testing and Validation:**
    *   Thoroughly test tool calling in both 'chat' and 'agent' modes with various tool configurations (e.g., successful calls, failed calls, tools requiring multiple turns).
    *   Verify that the conversation history is correctly maintained and passed to the AI after tool executions.

4.  **Code Review and Cleanup:**
    *   Review the entire `Chat.tsx` file for any remaining `console.log` or `console.error` instances.
    *   Ensure all types are correctly inferred or explicitly defined.
    *   Remove any dead code or commented-out sections.
