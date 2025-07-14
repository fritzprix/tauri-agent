// Tauri 환경에서 환경변수 로드를 위한 유틸리티

export function loadEnvConfig(): { [key: string]: string } {
  if (typeof window !== 'undefined' && (window as unknown as { __TAURI__?: unknown }).__TAURI__) {
    // Tauri 환경에서는 런타임에 환경변수를 가져올 수 없으므로
    // 빌드 시점에 주입되거나 다른 방법으로 설정해야 함
    return {
      GROQ_API_KEY: import.meta.env.VITE_GROQ_API_KEY || '',
    };
  }
  
  // Node.js 환경
  if (typeof process !== 'undefined' && process.env) {
    return {
      GROQ_API_KEY: process.env.GROQ_API_KEY || '',
    };
  }
  
  return {};
}

export function getGroqApiKey(): string {
  const env = loadEnvConfig();
  const apiKey = env.GROQ_API_KEY;
  
  if (!apiKey) {
    console.warn('GROQ_API_KEY not found. Please set VITE_GROQ_API_KEY in your .env file');
  }
  
  return apiKey;
}
