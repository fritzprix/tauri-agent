# 문제점

- ./src/hooks/use-ai-service.ts는 ./src/lib/ai-service.ts에서 chunk를 넘겨 받는다. 기존에는 JSON과 plain string의 혼용이였는데 이것을 일관된 JSON String으로 변환 혹은 아예 Object로 전달하여 메시지의 각 형식, tool_calls, content, thinking을 논리적으로 구분하기 용아힌 코드를만들고자 한다.
- 문제는 tool_calls / thinking의 응답 방식이 서비스 공급자 별로 상이하여 이러한 의존성을 하나의 일관적이도 통합된 API로 만들고자 한다.
- `StreamableMessage`를 보면 thinking / tool_calls / content 등 이를 위한 field 들이 있으나 적절하게 사용되고 있지 않다.
- 특히 ToolCaller.tsx에서 tool 호출을 하는데 JSON parsing 로직이 Groq에 맞춰져 있어 다른 서비스의 응답에 대해서 적절하게 대응하지 못하는 문제가 있다.
- `./src/lib/ai-service.ts`에 다양한 conversion 함수들을 참고하여 역 함수를 만들고 이를 기반으로 tool_calls를 보다 효과적으로 use-ai-service.ts에서 처리하도록 한다.