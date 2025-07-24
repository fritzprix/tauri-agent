# Refactoring Plan

## Improve AssistantContext and AssistantManager

- The app provides a set of default tools (LocalServices) via `./src/context/LocalToolContext.tsx`.
- Allow users to enable or disable each LocalService using a toggle in the Assistant settings. Save the enabled/disabled state.
- When an Assistant is configured, add only the enabled LocalServices to its available tools.
- In `./src/hooks/use-ai-service.ts`, add a `useLocalTools` hook alongside `useMCPServer`. Merge the available tools from both hooks based on the Assistant’s settings.
- In `/src/components/ToolCaller.tsx`, check if a tool is local or from MCP before calling it. The `useLocalTools` hook should provide an `isLocalTool