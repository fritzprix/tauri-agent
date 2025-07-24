# Issue with Gemini Tool use response rendering

## Condition

- Send query with tool use option using Gemini SDK
- Error caused when tool is called in ./src/components/orchestrators/ToolCaller.tsx

```text
```

## Runtime Logs

> you can refer the schema of the gemini message in the logs following

```text
[2025-07-24][00:12:04][webview:info@http://localhost:1420/src/lib/logger.ts:26:23][INFO] [useAIService] chunk :  {"chunk":"{\"tool_calls\":[{\"name\":\"filesystem__list_allowed_directories\",\"args\":{}}]}"}
[2025-07-24][00:12:04][webview:info@http://localhost:1420/src/lib/logger.ts:26:23][INFO] [useAIService] message :  {"finalMessage":{"id":"rogcbti33ji7urcfz33cuufn","content":"","role":"assistant","isStreaming":true,"thinking":"","tool_calls":[{"name":"filesystem__list_allowed_directories","args":{}}]}}
[2025-07-24][00:12:04][webview:debug@http://localhost:1420/src/lib/logger.ts:22:24][DEBUG] [MCPServerContext] Executing tool call: {"toolCall":{"name":"filesystem__list_allowed_directories","args":{}}}
```
  
## Constraints

> you have to ensure backward compatibility, which means the code works perfect for OpenAI & Groq API

## Task

> Debug the issue
