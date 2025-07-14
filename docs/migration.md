# MCP Agent Migration Plan - Tauri Edition

## 📋 마이그레이션 개요

Next.js 웹 애플리케이션을 Tauri 데스크톱 애플리케이션으로 마이그레이션하는 상세 계획서입니다.

## 🎯 마이그레이션 목표

### 주요 목표

1. **진짜 MCP 연결**: stdio 프로토콜로 로컬 MCP 서버 직접 실행
2. **네이티브 성능**: 시스템 WebView + Rust 백엔드로 최적 성능
3. **코드 재사용**: 기존 React 컴포넌트 100% 재활용
4. **작은 번들**: Electron 대비 10배 작은 크기

### 해결하려는 문제점

- ❌ 웹에서는 stdio MCP 서버 실행 불가능
- ❌ Electron의 큰 번들 크기와 높은 메모리 사용량
- ❌ 브라우저 보안 제약
- ❌ 파일 시스템 접근 제한

## 🗂 파일 구조 및 마이그레이션 매핑

### 기존 Next.js → 새 Tauri 구조

```
[Next.js]                   →   [Tauri]
app/Chat.tsx               →   src/components/Chat.tsx ✅복사완료
components/RoleManager.tsx →   src/components/RoleManager.tsx ✅복사완료
lib/db.ts                  →   src/lib/db.ts ✅복사완료
lib/mcp-client.ts          →   src/lib/tauri-mcp-client.ts ✅새구현완료
app/globals.css            →   src/globals.css ✅복사완료
app/api/* (삭제됨)         →   src-tauri/src/lib.rs에 Tauri command로 구현 ✅완료
```

## 🏗 구현 단계별 계획

### Phase 1: 기본 Tauri 앱 설정 ✅완료

- [x] Tauri 프로젝트 생성
- [x] package.json 설정 (pnpm 사용)
- [x] TypeScript 설정
- [x] Tailwind CSS 설정
- [x] 기본 Rust 백엔드 구조

### Phase 2: 기존 컴포넌트 통합 ✅완료

- [x] 기존 React 컴포넌트들 복사
- [x] import 경로 수정
- [x] Tauri API 연동
- [x] 스타일링 통합

### Phase 3: Rust MCP 서버 관리 ✅Mock완료

- [x] MCP 서버 프로세스 관리 구조
- [x] Tauri commands 정의
- [x] Mock 구현으로 동작 확인
- [ ] 실제 stdio MCP 프로토콜 구현
- [ ] JSON-RPC 2.0 통신 구현

### Phase 4: 데이터베이스 통합 ✅완료

- [x] IndexedDB 동작 확인
- [x] 기존 Role 데이터 구조 호환
- [ ] 대화 내역 저장/불러오기
- [ ] 백업/복원 기능

### Phase 5: AI 모델 연동

- [ ] OpenAI API 연동
- [ ] Claude API 연동  
- [ ] 로컬 모델 지원 (Ollama 등)
- [ ] 스트리밍 응답 처리

### Phase 6: UI/UX 개선

- [ ] 앱 아이콘 및 브랜딩
- [ ] 메뉴바/시스템 트레이
- [ ] 키보드 단축키
- [ ] 다국어 지원

### Phase 7: 테스트 및 최적화

- [ ] 단위 테스트 (Rust + TypeScript)
- [ ] 통합 테스트
- [ ] 성능 최적화
- [ ] 메모리 누수 체크

### Phase 8: 배포 준비

- [ ] 코드 사이닝 설정
- [ ] 자동 업데이트 구현
- [ ] 크로스 플랫폼 빌드 (macOS/Windows/Linux)
- [ ] 설치 패키지 생성

## 🔧 핵심 구현 사항

### 1. Tauri MCP 클라이언트

#### Rust 백엔드 (src-tauri/src/mcp.rs)

```rust
use std::process::{Child, Command, Stdio};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt};

pub struct MCPServerManager {
    servers: Arc<Mutex<HashMap<String, Child>>>,
}

impl MCPServerManager {
    pub async fn start_stdio_server(&self, config: MCPServerConfig) -> Result<String> {
        let mut cmd = Command::new(&config.command?)
            .args(&config.args.unwrap_or_default())
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .spawn()?;
            
        // stdio 통신 및 JSON-RPC 2.0 구현
        // MCP 프로토콜 메시지 처리
    }
}
```

#### TypeScript 프론트엔드 (src/lib/tauri-mcp-client.ts)

```typescript
import { invoke } from '@tauri-apps/api/core';

export class TauriMCPClient {
    async startServer(config: MCPServerConfig): Promise<string> {
        return await invoke('start_mcp_server', { config });
    }
    
    async callTool(serverName: string, toolName: string, args: Record<string, unknown>): Promise<ToolCallResult> {
        return await invoke('call_mcp_tool', { serverName, toolName, arguments: args });
    }
}
```

### 2. React 컴포넌트 통합

#### Chat.tsx 수정점

```typescript
// ❌ 기존 웹 방식
import { mcpClient } from '../lib/mcp-client';
await mcpClient.connectToServers(role.mcpConfig);

// ✅ 새 Tauri 방식  
import { tauriMCPClient } from '../lib/tauri-mcp-client';
for (const server of role.mcpConfig.servers) {
  await tauriMCPClient.startServer(server);
}
```

#### RoleManager.tsx 수정점

- import 경로만 수정하면 완전 재사용 가능
- IndexedDB는 그대로 렌더러에서 사용

### 3. MCP 프로토콜 구현 계획

#### JSON-RPC 2.0 메시지 형식

```json
// 도구 목록 요청
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list"
}

// 도구 호출
{
  "jsonrpc": "2.0", 
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "file_read",
    "arguments": { "path": "/path/to/file" }
  }
}
```

## 📦 의존성 비교

### 기존 Next.js vs 새 Tauri

```json
// 제거된 패키지
{
  "removed": [
    "next",           // Next.js 프레임워크
    "ai",             // Vercel AI SDK  
    "webpack",        // 번들러 (Vite로 대체)
    "electron"        // Electron (Tauri로 대체)
  ]
}

// 새로 추가된 패키지
{
  "added": [
    "@tauri-apps/api",     // Tauri 프론트엔드 API
    "@tauri-apps/cli",     // Tauri CLI 도구
    "vite",                // 빌드 도구
    "tokio",               // Rust 비동기 런타임 (Cargo.toml)
    "serde",               // Rust 직렬화 (Cargo.toml)
  ]
}
```

## 🧪 테스트 계획

### 1. 기능 테스트

- [ ] 역할 생성/편집/삭제
- [ ] MCP 서버 stdio 연결/해제
- [ ] 도구 호출 및 결과 표시
- [ ] 대화 저장/불러오기
- [ ] 파일 첨부 기능

### 2. 성능 테스트

- [ ] 앱 시작 시간 < 2초
- [ ] 메모리 사용량 < 100MB
- [ ] MCP 서버 응답 시간 < 500ms
- [ ] UI 반응성 < 50ms

### 3. 크로스 플랫폼 테스트

- [ ] macOS (Intel/Apple Silicon)
- [ ] Windows 10/11
- [ ] Linux (Ubuntu/Arch)

## 🚀 실행 방법

### 개발 환경

```bash
# 1. Rust 설치 확인
rustc --version

# 2. 의존성 설치
pnpm install

# 3. 개발 서버 시작
pnpm tauri dev
```

### 프로덕션 빌드

```bash
# 빌드 및 패키징
pnpm tauri build

# 결과물: src-tauri/target/release/bundle/
```

## 🎯 성공 지표

### 기능적 목표

- [x] 기존 웹 UI의 모든 기능 재현
- [ ] stdio MCP 서버 정상 연결  
- [x] Rust-TypeScript 간 안정적 통신
- [x] 기존 데이터 완전 호환

### 성능 목표

- [ ] 앱 시작 시간 < 2초  
- [ ] 번들 크기 < 20MB
- [ ] 메모리 사용량 < 100MB
- [ ] MCP 연결 시간 < 1초

## 📝 TODO 체크리스트

### 🚧 즉시 할 일

- [ ] MCP stdio 프로토콜 실제 구현
- [ ] JSON-RPC 2.0 메시지 파싱
- [ ] AI 모델 API 연동
- [ ] 에러 핸들링 개선

### 📅 다음 단계

- [ ] 실제 MCP 서버와 테스트
- [ ] 앱 아이콘 및 메뉴 설정
- [ ] 자동 업데이트 구현
- [ ] 배포 파이프라인 구축

## 🔗 유용한 링크

- [Tauri 공식 문서](https://tauri.app/)
- [MCP 프로토콜 스펙](https://modelcontextprotocol.io/)
- [Rust 비동기 프로그래밍](https://rust-lang.github.io/async-book/)

---

**이 migration.md를 참조하여 단계별로 구현하면 고성능 Tauri 앱으로 완전 전환할 수 있습니다.**
