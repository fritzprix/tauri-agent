# Refactoring Plan (Incorporated Version) - Eliminate Functional Duplication and Improve Chat Modality Support Structure

## Improving the Excessive Complexity of Chat

Currently, `./src/components/Chat.tsx` has high complexity due to including various functionalities such as Assistant selection view, Agent Mode Toggle, and MultiAgentOrchestrator activation logic. This section will improve this by allowing the `Chat` component to focus purely on message processing and basic conversational features.

### 1. Separate Assistant Selection View

*   Separate the view for selecting an Assistant to start a Single Session into a distinct component.
*   **Component Name**: `StartSingleChatView.tsx`
*   **Location**: `src/components/`

### 2. Separate Header and Agent Mode Toggle

*   Separate the Header element and Agent Mode Toggle Button from `Chat.tsx` into a distinct component.
*   **Header Component Name**: `TerminalHeader.tsx`
*   **Location**: `src/components/`
*   **Mode Switcher**: Instead of a separate component, implement this by managing the state within `TerminalHeader` and passing it to child components via Context.

### 3. Change MultiAgentOrchestrator Composition

*   `MultiAgentOrchestrator` will be inserted externally as `children` of the `Chat` component, extending the functionality of `Chat` through composition.
*   As a result, `MultiAgentOrchestrator` will no longer require an internal activation/deactivation `toggle`. When `MultiAgentOrchestrator` is enclosed within the `<Chat>` component, Multi-Agent mode will always be active.
*   `Chat.tsx` will no longer need to manage the `mode` (chat | agent) state. This state will be managed by the parent component that renders `Chat` and `MultiAgentOrchestrator`.

### 4. Redefine the Role of the `Chat` Component

Upon completion of the above tasks, the `Chat` component will have a structure focused on basic conversational features such as Tool Calls, message display, and input. Session-related logic, such as selecting an Assistant to start a session, will be separated into distinct components.

### Example of Feature Extension

*   **Single Assistant Chatting**:
    ```tsx
    /dev/null/SingleAssistantChat.tsx#L1-9
    function SingleAssistantChat() {
      // ...
      const { isAgentMode } = useTerminalHeaderContext(); // Example of context usage
      return (
        <Chat>
          {isAgentMode && <Reflection />} {/* Placeholder for Reflection */}
        </Chat>
      )
    }
    ```
    *   The `Reflection` component is not currently implemented and is a placeholder for supporting Autonomous Task execution in SingleAssistantChat. For now, create an empty component, and defer implementation to a later stage.

*   **Multi Agent Chatting**:
    ```tsx
    /dev/null/MultiAgentChat.tsx#L1-7
    function MultiAgentChat() {
      return (
        <Chat>
          <MultiAgentOrchestrator />
        </Chat>
      )
    }
    ```

## Tasks to be Performed

*   `Chat.tsx`
    *   Extract Header and Chat/Agent mode toggle and move them to `TerminalHeader.tsx`.
    *   Extract the View for starting Single Assistant and separate it into `StartSingleChatView.tsx`.
    *   Remove `mode` state management logic, leaving only pure message handling related code.
*   `MultiAgentOrchestrator.tsx`
    *   Remove internal `toggle` logic.
*   Create new components:
    *   `src/components/StartSingleChatView.tsx`
    *   `src/components/TerminalHeader.tsx`
    *   `src/components/Reflection.tsx` (Empty Placeholder Component)
