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

### 2. 의존성 설치

```bash
# Node.js 의존성 설치
pnpm install

# Rust 의존성은 자동으로 설치됩니다
```

### 3. 개발 모드 실행

```bash
pnpm tauri dev
```

### 4. 프로덕션 빌드

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
- 🚧 **AI 모델 연동**: 계획 단계

---

**원래 Next.js 웹앱에서 Tauri로 마이그레이션한 프로젝트입니다.** 기존 React 컴포넌트를 100% 재사용하면서 Rust의 성능과 안정성을 활용한 데스크톱 앱으로 발전시켰습니다.
