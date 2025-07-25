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