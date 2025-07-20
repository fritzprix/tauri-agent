# Refactoring plan

- refactor use-ai-service.ts into context, so that children surrounded by it can access same response state
- implement `ToolCaller.tsx` that viewless component that call the MCP tools based on `response` can depend on `useAIService` and `useChatContext` as well
- migrate SimpleChat / AgentChat to use ToolCaller and useAIService, and wrap them by AIServiceProvider
