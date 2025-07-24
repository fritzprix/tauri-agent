# Refactoring Plan

## add Collaboration feature

### 확장 방식 및 대략적 구조

- ./src/components/orchestrators/ToolCaller.tsx와 같이 `Chat`의 Child로 추가 확장
- 따라서 useChatContext / useSettigns / useMCPServer / useAIService 등 다양한 Context에 접근 가능

### UI/UX

- Collaboration은 ToolCaller.tsx와 달리 UI가 있으며 추가된 UI는 Chat.tsx input 하단에 horizontal bar에 추가되어야 함
- 버튼을 누르면 설정을 위한 modal이 표시
- 이 modal view에서 협력에 참여할 Assistants들을 선택하게됨
- 그리고 기능 활성화 toggle이 존재하며 활성화 여부가 input 하단의 horizontal bar에 표시되는 UI에서 표시되어햐 함

### 구현