# Refactoring Plan

## Multi Agent Feature

### 위치

- 구현 위치: `./src/components/orchestrators`

### 개념

- 여러 Assistant를 그룹으로 묶을 수 있습니다. (기존 `AssistantManager.tsx` 확장)
- 그룹을 선택하면 "Group 모드"가 활성화됩니다.
- Group 모드에서는 아래와 같은 흐름으로 동작합니다:
  - Assistant가 `MultiAgentOrchestrator`라는 커스텀 Assistant로 전환됩니다.
  - Orchestrator는 6가지 도구 함수를 사용할 수 있습니다:
    1. **promptToUser(prompt: string)**
       - 사용자에게 추가 정보를 요청합니다.
       - `useChatContext()`의 `addMessage`로 메시지를 추가하고, 재귀 호출을 종료합니다.
    2. **switchAssistant(instruction: string)**
       - 다른 Assistant로 전환하고, 해당 Assistant에게 instruction을 전달합니다.
       - `useChatContext()`의 `submit`을 사용합니다.
    3. **setPlan(items: string[])**
       - 체크리스트 형태의 계획을 설정합니다.
       - 모든 항목이 완료되지 않은 상태에서 다시 호출되면, 아직 완료되지 않았음을 알립니다.
    4. **checkDone(index: number)**
       - 계획의 특정 항목을 완료로 표시합니다.
    5. **clearPlan()**
       - 계획을 취소하고 제거합니다.
    6. **reportResult(result_in_detail: string)**
       - 작업 결과를 사용자에게 정리해서 전달하고, 재귀를 종료합니다.
       - `addMessage`를 사용합니다.

- 활성화 시, `useAssistantContext`로 Assistant를 `MultiAgentOrchestrator`로 설정합니다.
- 사용자의 요청에 대해 위 6가지 도구로 대응합니다.
- `useChatContext`의 messages를 모니터링합니다.
  - 마지막 메시지가 tool_call이 아니고, `MultiAgentOrchestrator`가 보낸 메시지가 아니라면, 자동으로 `submit()`을 호출해 응답을 생성합니다.
- 이 과정은 재귀적으로 동작하며, 아래 함수가 호출되면 재귀가 종료됩니다:
  - `promptToUser()`
  - `reportResult()`

### UI/UX

- 기존의 viewless component(`ToolCaller.tsx`)와 달리, 활성화 여부를 체크할 수 있는 간단한 뷰를 제공합니다.
- 이 뷰는 확장 가능한 컨테이너로, `Chat.tsx`의 입력창 근처에 배치합니다.
  - `Chat.tsx`의 children이 자연스럽게 렌더링되도록 합니다.

### 고려사항

- 각 메시지가 어떤 Assistant에 의해 생성됐는지 상태를 관리해야 합니다.
  - 모든 메시지에 Assistant 정보(최소 이름)를 포함시켜야 하며, API 호출 시 prompt에도 반영해야 합니다.

### 재귀 안전성

- Orchestrator의 재귀 호출이 무한 반복되지 않도록 최대 재귀 깊이 제한 또는 반복 횟수 제한을 둡니다.
- 예외 상황(예: Assistant가 응답하지 않거나, 계획이 끝나지 않는 경우)에서 재귀를 안전하게 종료할 수 있는 로직을 추가합니다.

### 메시지 구조 명확화

- 각 메시지에는 아래와 같은 구조를 권장합니다:
  
  ```ts
  export interface StreamableMessage {
    id: string;
    content: string;
    assistantName: string; // 메시지를 생성한 Assistant 이름
    role: "user" | "assistant" | "system" | "tool";
    thinking?: string;
    isStreaming?: boolean;
    attachments?: { name: string; content: string }[];
    tool_calls?: {
      id: string;
      type: "function";
      function: { name: string; arguments: string };
    }[];
    tool_use?: { id: string; name: string; input: Record<string, unknown> };
    function_call?: { name: string; arguments: Record<string, unknown> };
    tool_call_id?: string;
  }
  ```

- 메시지 생성 시 assistantName을 반드시 포함하고, 필요한 경우 isToolCall 등 추가 정보를 명확히 표기합니다.
