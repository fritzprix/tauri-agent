# Refactoring Plan - UI 개편

## Sidebar를 통해 기능 확장

- Chat
  - 단일 Assitant와 대화를 제공
  - 선택 시 Main Content에 Assistant 선택 옵션 표시
  - 여기서 Assistant를 선택하면 대화 세션이 시작됨
    - 세션에는 대상 Assistant와 Messages 등을 포함하는 정보 구조
- Group
  - Group 생성 기능 및 기존 생성된 Group 선택 가능
  - Group 생성 선택 시 Group 생성을 위한 Modal View 표시
    - 해당 Modal View에는 Assistants List에서 Assistants를 선택하여 Group을 생성할 수 있음
  - 기존 Group 선택 시 Group Session을 시작
    - 위 Chat과 호환되는 Session 구조, 관리되는 Assistant가 복수가되는 것만 차이가 았음
- History
  - 기존의 대화 (세션) list를 표시
  - Scroll down해서 hit bottom 하면 load more 해서 page를 더 가져옴
- 최하단에 Settings
  - 클릭하면 Setting Modal을 표시

---

## Clarification Questions:

1.  **Assistant Selection (Chat):**
    - When an Assistant is selected to start a new session, where will the "Assistant selection option" be displayed in the Main Content? Is this a temporary UI element that disappears once a session starts, or is it part of the persistent chat interface?
      - ans) 보통 sidebar과 화면의 좌측에 위치하고 collapsible하게 구성되면 나머지 공간에 사용자의 주요한 interaction을 다루는 영역 즉, 화면의 대부분을 차지하는 공간

      ```ascii
      |----- top nav. (optional) ----|
      | - |                          |
      | - |                          |
      | s |                          |
      | i | ----- main content ----- |
      | d |                          |
      | e |                          |
      | - |                          |
      | - |                          |
      ```

    - What specific information should the "session information structure" (대상 Assistant와 Messages 등을 포함하는 정보 구조) contain beyond the Assistant and messages? For example, does it need a session ID, creation timestamp, or other metadata?
      - ans) session에 사용자와 대화를 위한 모든 정보
        - assistant(s) 복수일 수 있음, Group (Multi Agent Orchestration 지원)
        - id, createdAt, updatedAt
        - type: "single" | "group"
        - session은 생성과 삭제만 있고 변경 불가
        - messages 이건 별도의 table로
          - findMessagesBySessionId()로 가져올 수 있도록 `StreamableMessage`에 sessionId 값을 추가

        ```ts
        interface Session {
          id: string;
          assistants: Assistant[];
          ...
        }
        ```

2.  **Group Creation and Session:**
    - For "Group 생성 선택 시 Group 생성을 위한 Modal View 표시," what are the minimum required fields for creating a group (e.g., group name, description)?
      - ans) group name, description, assistants
    - When selecting Assistants from the "Assistants List" for group creation, how will the user interact with this list (e.g., multi-select checkboxes, drag-and-drop)?
      - ans) list에 각 item 마다 checkbox가 있고, multi-select checkboxes 방식
        - item에 checkbox을 선택하면, 선택된 assistants list에 표시되서 전체 선택이 어떻게 구성되는지 preview할 수 있게함
        - assistant name을 기준으로 search (list filters) 할 수 있는 기능을 제공
    - Regarding "위 Chat과 호환되는 Session 구조, 관리되는 Assistant가 복수가되는 것만 차이가 았음," how will messages be routed or attributed within a group session if multiple Assistants are involved? Will there be a mechanism to specify which Assistant responds, or will all Assistants process messages concurrently?
      - ans) message는 sessionId에 의해 mapping이 되며 이를 통해 lookup하여 히스토리를 가져올 수 있음

3.  **History:**
    - What criteria will be used to sort the "기존의 대화 (세션) list"? (e.g., last active, creation date, alphabetical by Assistant/Group name)?
      - ans) last active
    - What is the expected "page size" for loading more history items when scrolling down?
      - 20

4.  **General UI/UX:**
    - Will the sidebar itself be collapsible or resizable?
      - collapsible would be enough, resizablility is too much, we don't need it
    - Are there any specific visual cues or animations expected when switching between Chat, Group, and History views, or when opening the Settings modal?
      - I have no idea, but want to have one suitable to terminal-like look
    - How will the "terminal-like" look and feel be consistently applied across these new features, especially for new UI elements like the Group creation modal and history list items?
      - black bg, greenish text and border, etc.
