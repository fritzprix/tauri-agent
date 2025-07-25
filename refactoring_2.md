# 상세 UI 리팩토링 계획

## 1. 전체 레이아웃 구조

### 1.1 기본 레이아웃
```
|------ Optional Top Navigation -------|
| S |                                   |
| i |                                   |
| d |         Main Content              |
| e |         Area                      |
| b |                                   |
| a |                                   |
| r |                                   |
```

### 1.2 Sidebar 구성
- **위치**: 화면 좌측
- **기능**: Collapsible (토글 가능)
- **구성 요소** (상단부터):
  - Chat 섹션
  - Group 섹션  
  - History 섹션
  - Settings (최하단)

## 2. 데이터 구조 정의

### 2.1 Session 인터페이스
```typescript
interface Session {
  id: string;
  type: "single" | "group";
  assistants: Assistant[];
  name?: string; // Group 세션의 경우 그룹명
  description?: string; // Group 세션의 경우 설명
  createdAt: Date;
  updatedAt: Date;
}
```

### 2.2 Message 구조 확장
```typescript
interface StreamableMessage {
  // 기존 필드들...
  sessionId: string; // 추가
}
```

### 2.3 Group 구조
```typescript
interface Group {
  id: string;
  name: string;
  description: string;
  assistants: Assistant[];
  createdAt: Date;
}
```

## 3. 기능별 상세 구현 계획

### 3.1 Chat (단일 Assistant 대화)

#### 3.1.1 UI 구성
- **Sidebar에서의 표시**: "New Chat" 버튼 및 최근 Chat 세션 목록
- **Main Content 초기 상태**: Assistant 선택 화면
  - 사용 가능한 Assistant 목록을 카드 형태로 표시
  - 각 카드에는 Assistant 이름, 설명, 아이콘 포함
- **세션 시작 후**: 선택된 Assistant와의 대화 인터페이스

#### 3.1.2 기능 흐름
1. Sidebar에서 "New Chat" 클릭
2. Main Content에 Assistant 선택 화면 표시
3. Assistant 선택 시 새 세션 생성 및 대화 시작
4. 세션은 자동으로 History에 저장

### 3.2 Group (다중 Assistant 대화)

#### 3.2.1 Group 생성 Modal
- **트리거**: Sidebar Group 섹션의 "Create Group" 버튼
- **Modal 구성**:
  - Group Name (필수)
  - Description (필수)
  - Assistant 선택 영역
    - 좌측: 전체 Assistant 목록 (검색/필터 기능 포함)
    - 우측: 선택된 Assistants 미리보기
    - 각 Assistant 항목에 체크박스

#### 3.2.2 Assistant 선택 인터페이스
```
[검색창: "Search assistants..."]

☐ Assistant A (AI Coding Helper)
☑ Assistant B (Writing Assistant)    →  Selected Assistants:
☐ Assistant C (Data Analyst)         →  • Assistant B
☑ Assistant D (UI/UX Designer)       →  • Assistant D
☐ Assistant E (DevOps Helper)        →
                                      →  [Create Group] [Cancel]
```

#### 3.2.3 Group 세션 관리
- Group 선택 시 기존 Session 구조와 호환되는 세션 생성
- 메시지는 sessionId로 연결하여 히스토리 관리
- **메시지 라우팅**: 현재는 단순히 sessionId 기반 저장, 향후 확장 고려

### 3.3 History (대화 히스토리)

#### 3.3.1 목록 표시
- **정렬**: Last active 기준 (최근 활동 세션이 상단)
- **페이징**: 20개씩 로드, 스크롤 하단 도달 시 추가 로드
- **항목 구성**:
  - 세션 제목 (Single: Assistant 이름, Group: Group 이름)
  - 마지막 메시지 미리보기
  - 마지막 활동 시간
  - 세션 타입 표시 (아이콘으로 구분)

#### 3.3.2 History 항목 예시
```
🤖 Assistant B - Writing Helper              2시간 전
   "Could you help me review this document..."

👥 Marketing Team (3 assistants)             어제
   "Let's brainstorm some campaign ideas..."

🤖 Assistant A - Coding Helper               3일 전
   "How do I implement authentication in..."
```

### 3.4 Settings

#### 3.4.1 Settings Modal
- **트리거**: Sidebar 최하단 Settings 클릭
- **구성 요소**:
  - 테마 설정 (Terminal look 커스터마이징)
  - 언어 설정
  - 키보드 shortcuts
  - 데이터 관리 (히스토리 삭제 등)

## 4. Terminal-like 디자인 시스템

### 4.1 Color Palette
- **배경**: `#0a0a0a` (진한 검정)
- **주요 텍스트**: `#00ff41` (매트릭스 그린)
- **보조 텍스트**: `#888888` (회색)
- **테두리**: `#333333` (어두운 회색)
- **강조 색상**: `#00cc33` (밝은 그린)
- **에러/경고**: `#ff4444` (빨강)

### 4.2 Typography
- **폰트**: Monospace 계열 (예: `Fira Code`, `JetBrains Mono`)
- **크기 체계**: 
  - 제목: 16px
  - 본문: 14px
  - 보조: 12px

### 4.3 UI 컴포넌트
- **버튼**: 테두리만 있는 스타일, hover 시 배경 채우기
- **입력 필드**: 언더라인 스타일, focus 시 그린 글로우
- **모달**: 중앙 정렬, 어두운 배경 오버레이
- **체크박스**: 커스텀 그린 체크마크

## 5. 상태 관리 및 데이터 흐름

### 5.1 전역 상태
```typescript
interface AppState {
  currentView: 'chat' | 'group' | 'history';
  activeSession: Session | null;
  sessions: Session[];
  groups: Group[];
  sidebarCollapsed: boolean;
}
```

### 5.2 주요 함수들
- `createSession(type, assistants)`: 새 세션 생성
- `findMessagesBySessionId(sessionId)`: 세션별 메시지 조회
- `loadMoreHistory(page)`: 히스토리 페이징
- `toggleSidebar()`: 사이드바 토글

## 6. 구현 우선순위

### Phase 1: 기본 구조
1. 레이아웃 구조 구현 (Sidebar + Main Content)
2. 기본 라우팅 및 상태 관리
3. Terminal 디자인 시스템 적용

### Phase 2: 핵심 기능
1. Chat 기능 (단일 Assistant)
2. Session 관리 및 Message 확장
3. History 기본 기능

### Phase 3: 고급 기능
1. Group 생성 및 관리
2. Group 세션 처리
3. Settings 모달

### Phase 4: 최적화
1. 애니메이션 및 전환 효과
2. 성능 최적화
3. 접근성 개선

## 7. 추가 고려사항

### 7.1 반응형 디자인
- 모바일에서는 Sidebar를 오버레이 방식으로 처리
- 태블릿에서는 Sidebar 너비 조정

### 7.2 키보드 단축키
- `Ctrl/Cmd + N`: 새 Chat
- `Ctrl/Cmd + G`: 새 Group
- `Ctrl/Cmd + H`: History 이동
- `Ctrl/Cmd + ,`: Settings
- `Ctrl/Cmd + B`: Sidebar 토글

### 7.3 성능 최적화
- History 가상 스크롤링 구현 (현재는 `react-window`의 `FixedSizeList`가 가변 높이 메시지에 적합하지 않아 보류. 향후 `VariableSizeList` 또는 `react-virtualized` 탐색 필요)
- Message lazy loading
- Image/파일 첨부 최적화

이 계획을 바탕으로 단계적으로 구현하면 사용자에게 직관적이고 효율적인 multi-assistant 인터페이스를 제공할 수 있을 것입니다.
