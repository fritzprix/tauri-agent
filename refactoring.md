# Issue 해결 과제

- 문제점
  - useChatContext / SessionHistoryContext / SessionContext Refactoring 이후
  - Chat.tsx에서 Streaming 중인 Message의 표시가정상적으로 되지 않음
  - 입력 이후 user message / streaming message 모두 안보이다가
  - 창을 옮기거나 크기 변경을 하는 등 UI Event가 발생되면 (아마 이때 DB를 Load해오는듯) 정상적으로 표시됨
  - 즉, DB의 상태는 정상적으로 업데이트 되나 즉각적인 표시에 문제가 있음
  - SessionHistoryContext에서 Optimistic Update를 하고 있기 때문에 실시간성에 문제가 없을 것이라 생각했으나 그렇지 않음

- 기대 결과
  - Streaming 중인 MessageBubble이 정상적으로 표시되어야함

- 참고 코드
  - Chat.tsx
  - use-chat.tsx
  - SessionHistoryContext.tsx

