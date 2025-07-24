# Refactoring Plan

## 기존 Role이라는 개념의 명칭 변경 Role => Assistant

- 이에 맞도록 변수명과 표시를 수정

- 관련 코드 List
  - ./src/RoleManager.tsx
  - ./src/context/RoleContext.tsx
  - ./src/lib/db.ts ()
- **주의**: 이는 assistant / user/ system의 통상적 LLM API의 값과 관련 없음, 현재 System Prompt와 MCP Server (도구)의 연장선임
- type 이름을 포함 변수명 등 모두 변경할 것

```ts
export interface Role {
  id: string;
  name: string;
  systemPrompt: string;
  mcpConfig: {
    mcpServers?: Record<string, {
      command: string;
      args?: string[];
      env?: Record<string, string>;
    }>;
  };
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```