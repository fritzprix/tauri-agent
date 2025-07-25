# Refactoring Plan - 기능 중복 제거 및 Chat Modality 지원 구조 개선

## Chat의 과중한 복잡도 개선

- `./src/components/Chat.tsx`에 Assistant를 선택하는 View가 포함되어 있다 이것을 별도의 View로 분리
  - Assistant를 선택해서 Single Session을 시작하는 별도의 View (이름은 적당히)
  - Header 요소를 별도로 분리하고 Agent Mode Toggle Button 제공
  - ToolCaller를 제외하고 MultiAgentOrchestrator는 외부에서 삽입하는 방식으로 변경하여 Chat의 기능을 Composition 하는 접근으로 변경
  - 또한 이렇게 될경우 `./src/components/orchestrators/MultiAgentOrchestrator.tsx`에서는 활성화 Toggle이 더이상 필요 없이 해당 Component가 <Chat> ... </Chat>에 둘러 쌓여 있을 때 무조건 Multi-Agent 활성화 시키면 되는것
- 위와 같이 작업이 되면 Chat은 Tool Call 및 대화 기본 기능에 충실한 구조로 되고 이후 기능 확장은 아래와 같이 된다.
  - Single Assistant Chatting

    ```tsx
    function SingleAssistantChat() {
    ...
      return (
        <Chat>
          {isAgentMode && <Reflection />}
        </Chat>
      )
    }

    ```

  - Multi Agent Chatting

  ```tsx
  function MultiAgentChat() {
    return (
      <Chat>
        <MultiAgentOrchestrator />
      </Chat>
    )
  }
  ```

## 작업할 내용

- Chat.tsx
  - header 및 chat / agent 모드 toggle 추출하여 이동.
  - SingleAssistant 시작을 위해 Assistant 선택하는 View를 추출하여 별도의 코드로 관리.
- MultiAgentOrchestrator.tsx
  - toggle 제거

## Clarification Questions

1.  **New Component for Assistant Selection**: What should the new component for assistant selection be named (e.g., `AssistantSelectionView.tsx`, `StartChatView.tsx`) and where should it be located (e.g., `src/components/` or a new subdirectory)?
=> `StartSingleChatView.tsx` would be better distinguish from group chat, and be located in `src/components/`
2.  **Extracted Header Component**: What should the extracted header component be named (e.g., `ChatHeader.tsx`, `TerminalHeader.tsx`) and where should it be located?
=> `TerminalHeader.tsx` would be fine, and can be located in `src/components/`
3.  **Extracted Mode Switcher Component**: What should the extracted mode switcher component be named (e.g., `ModeSwitcher.tsx`, `ChatModeToggle.tsx`) and where should it be located?
=> 내 생각에는 별도로 Component를 만드는 것 보다는 TerminalHeader에서 상태를 관리하고 Context를 써서 하위 component에 전달하면 될 것 같아 예를 들어서 대충 아래와 같은 방식
   ```tsx
   <TerminalHeader>
     ...
     <SingleAgentChat/>
   </TerminalHeader>

   function SingleAgentChat() {
     const { isAgentMode } = useTerminalHeaderContext();
     return (
       <Chat>
         {isAgentMode && <Reflection />}
       </Chat>
     )
   }

   ```
4.  **`MultiAgentOrchestrator` Insertion**: The plan states "MultiAgentOrchestrator는 외부에서 삽입하는 방식으로 변경하여 Chat의 기능을 Composition 하는 접근으로 변경". This implies `MultiAgentOrchestrator` will be passed as `children` to `Chat`. However, `Chat.tsx` already has `children?: React.ReactNode;` in its props. The current `MultiAgentOrchestrator` component also has its own internal logic for activation/deactivation. How should the `MultiAgentOrchestrator` be composed with `Chat`? Should `Chat` still manage the `mode` state (`chat` | `agent`) or should that be handled by the parent component that renders `Chat` and `MultiAgentOrchestrator`?
=> 맞아, 지금 Chat.tsx에 기본으로 추가되어 있는 것을 분리하라는 것이고, 이것은 Chat.tsx가 SingleAssistantChat에서 사용될 때 이런 기능은 필요 없기 때문이지, 그리고 MultiAgentOrchestrator를 사용하게 되면 기본이 Agent모드가 된다고 보면되겠지, 따라서 더이상의 `mode`는 필요 없는거야.
5.  **`Reflection` Component**: The example for `SingleAssistantChat` includes `<Reflection />`. Is this an existing component, or a placeholder for a future feature? If it's existing, where is it located? If it's a placeholder, should it be created as an empty component for now?
=> 아직 구현이 안되어 있고, SingleAssistantChat에서 Autonomous Task 수행을 지원하기 위한 reflection 하고 다시 계획을 수립하고 작업을 진행하던가 아니면 report to user하던가 2가지 동작을 하도록 할 거야. 우선 placeholder만 만들어 두고 구현은 아직 필요 없어. 다음 단계의 작업으로 우선 놔두자.
6.  **`Chat` Component's Role**: After refactoring, what will be the primary responsibility of the `Chat` component? Will it solely focus on message display and input, or will it still manage some session-related logic?
=> 위에 제안한 변경 사항을 거치면 순수하게 message handling 관련 코드만 남게 될 거라고 예상하고 있어, session 관련 코드 특히 session을 시작하기 위한 assistant 선택 같은 것은 별도의 컴포넌트로 뺄꺼잖아.
