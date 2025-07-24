# 🚀 **TauriAgent** - Lightning Fast AI Companion

## 📋 프로젝트 개요

**Tauri 기반 초고속 AI 에이전트 플랫폼 - MCP로 무한 확장!**

Tauri의 경량성과 React의 직관성을 결합한 차세대 데스크톱 앱입니다. Electron 대비 10배 빠른 성능으로 AI 에이전트를 만들고, 각자만의 개성과 능력을 부여해서 일상의 모든 작업을 자동화할 수 있습니다.

### 🚀 Tauri의 핵심 장점

- **⚡ 초고속**: Electron 대비 10배 빠른 성능
- **🪶 경량**: ~10MB vs Electron ~100MB+
- **🔒 보안**: 기본적으로 더 안전한 샌드박스
- **🦀 안정성**: Rust 기반으로 메모리 안전성 보장

## 🎯 주요 기능 및 특징

### ✅ 구현 완료된 기능

- **🤖 역할 관리 시스템**: 여러 AI 에이전트 역할 생성/편집/삭제
- **🧠 시스템 프롬프트**: 각 역할별 맞춤형 AI 성격 정의
- **🔗 실시간 MCP 연결**: stdio 프로토콜로 로컬 MCP 서버 실행 **[완료!]**
- **⚡ 도구 호출 시스템**: MCP 서버의 도구를 실시간으로 호출 **[완료!]**
- **💾 IndexedDB 저장소**: 브라우저 로컬 데이터베이스로 역할/대화 저장
- **⚡ Tauri 백엔드**: 고성능 네이티브 데스크톱 앱 프레임워크
- **🎨 UI 컴포넌트**: 터미널 스타일의 모던한 인터페이스
- **⚙️ 중앙 집중식 설정 관리**: API 키, 모델, 메시지 창 크기 등 모든 설정이 앱 내에서 관리 및 영구 저장 **[완료!]**

### 🚧 구현 진행중

- **🔄 AI 통합**: OpenAI/Claude 등 AI 모델 연동
- **📎 고급 기능**: 파일 첨부, 대화 내역, 복합 도구 호출

## 🛠 기술 스택

- **Tauri**: 고성능 크로스플랫폼 데스크톱 앱 프레임워크 (Rust + WebView)
- **React 18**: 현대적 UI 라이브러리
- **TypeScript**: 타입 안전성과 개발자 경험
- **RMCP**: Rust 기반 Model Context Protocol 클라이언트
- **Tailwind CSS**: 유틸리티 우선 CSS 프레임워크
- **IndexedDB**: 브라우저 내장 NoSQL 데이터베이스
- **Vite**: 빠른 개발 서버 및 빌드 도구

## 📁 프로젝트 구조

```bash
crab-agent/
├── src/                        # React 프론트엔드
│   ├── components/             # React 컴포넌트들
│   │   ├── Chat.tsx           # 메인 채팅 인터페이스
│   │   └── RoleManager.tsx    # 역할 관리 UI
│   │   └── SettingsModal.tsx  # 설정 관리 UI
│   ├── context/                # 전역 설정 Context
│   │   └── SettingsContext.tsx # 설정 Context 정의
│   ├── hooks/                  # 커스텀 React Hooks
│   │   └── use-settings.ts     # 설정 Context를 사용하는 Hook
│   ├── lib/                   # 유틸리티 라이브러리
│   │   ├── db.ts              # IndexedDB 관리
│   │   └── tauri-mcp-client.ts # Tauri MCP 클라이언트
│   ├── App.tsx                # 루트 React 컴포넌트
│   ├── main.tsx               # React 진입점
│   └── globals.css            # Tailwind CSS 스타일
├── src-tauri/                 # Rust 백엔드
│   ├── src/
│   │   ├── lib.rs             # Tauri commands 정의
│   │   └── mcp.rs             # MCP 서버 관리 로직
│   ├── Cargo.toml             # Rust 의존성
│   └── tauri.conf.json        # Tauri 설정
├── docs/                      # 문서
│   └── migration.md           # 상세 마이그레이션 계획
├── dist/                      # 빌드 결과물
├── package.json               # Node.js 의존성
├── tailwind.config.js         # Tailwind CSS 설정
└── vite.config.ts             # Vite 설정
```

## 🚀 개발 시작하기

### 1. 사전 요구사항

- **Rust**: [rustup.rs](https://rustup.rs/)에서 설치
- **Node.js**: v18 이상
- **pnpm**: `npm install -g pnpm`

### 2. 환경 변수 설정 (API 키는 앱 내에서 관리됩니다)

이 프로젝트는 API 키를 `.env` 파일에 저장하는 대신, 애플리케이션 내의 설정 모달에서 직접 입력하고 `localStorage`에 안전하게 저장합니다. 따라서 별도의 `.env` 파일 설정은 필요하지 않습니다.

## 🔑 빠른 시작 가이드

### AI API 키 발급 받기 및 앱에 설정하기

애플리케이션을 실행한 후, 우측 상단의 'Settings' 버튼을 클릭하여 설정 모달을 엽니다. 'API Key Settings' 탭에서 각 AI 서비스 제공자(Groq, OpenAI, Anthropic, Gemini)의 API 키를 입력하고 저장할 수 있습니다.

**1. Groq (무료, 빠른 추론)** - 추천! 🌟

1. [Groq Console](https://console.groq.com/keys) 방문
2. 계정 생성 후 "Create API Key" 클릭
3. 발급받은 키를 앱 내 설정 모달에 입력

**2. OpenAI (GPT-4o, GPT-4o-mini)**

1. [OpenAI Platform](https://platform.openai.com/api-keys) 방문
2. "Create new secret key" 클릭
3. 발급받은 키를 앱 내 설정 모달에 입력

**3. Anthropic (Claude-3.5-Sonnet)**

1. [Anthropic Console](https://console.anthropic.com/) 방문
2. API Keys 섹션에서 새 키 생성
3. 발급받은 키를 앱 내 설정 모달에 입력

**4. Gemini (Google Gemini)**

1. [Google AI Studio](https://aistudio.google.com/app/apikey) 방문
2. "Create API key in new project" 또는 기존 프로젝트에서 키 생성
3. 발급받은 키를 앱 내 설정 모달에 입력

> 💡 **팁**: Groq는 무료 tier에서도 충분히 빠르고 강력합니다!

### 3. 의존성 설치

```bash
# Node.js 의존성 설치
pnpm install

# Rust 의존성은 자동으로 설치됩니다
```

### 4. 개발 모드 실행

```bash
pnpm tauri dev
```

### 5. 프로덕션 빌드

```bash
pnpm tauri build
```

## 🦀 Tauri의 장점

### vs Electron

- **번들 크기**: ~10MB vs ~100MB+
- **메모리 사용량**: 훨씬 적음
- **성능**: 시스템 WebView 사용으로 더 빠름
- **보안**: 기본적으로 더 안전한 샌드박스
- **네이티브**: Rust로 진짜 네이티브 기능 접근

### MCP 서버 관리

```rust
// Rust에서 MCP 서버 시작
#[tauri::command]
async fn start_mcp_server(config: MCPServerConfig) -> Result<String, String> {
    let mut cmd = Command::new(&config.command)
        .args(&config.args)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .spawn()?;

    // 프로세스 관리 및 stdio 통신
}
```

## 📈 다음 단계

1. **docs/migration.md** 참조하여 상세 마이그레이션 계획 확인
2. MCP 프로토콜 완전 구현
3. AI 모델 연동 (OpenAI/Claude/로컬 모델)
4. 고급 UI/UX 기능 추가
5. 크로스 플랫폼 테스트 및 배포

## 🎨 UI/UX 특징

- **터미널 스타일**: 개발자 친화적인 다크 테마
- **반응형 디자인**: 다양한 화면 크기 지원
- **모던 인터페이스**: Tailwind CSS 기반 깔끔한 디자인
- **직관적 조작**: 드래그 앤 드롭, 모달 다이얼로그 등

## 🧪 현재 상태

- ✅ **기본 Tauri 앱 구조**: 완료
- ✅ **React 컴포넌트 마이그레이션**: 완료
- ✅ **Rust MCP 서버 관리**: 실제 구현 완료
- ✅ **중앙 집중식 설정 관리**: 앱 내에서 API 키 및 기타 설정 관리 및 영구 저장

---
