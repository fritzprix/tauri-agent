// API 키와 설정 관리를 위한 유틸리티

export interface AppConfig {
  groqApiKey: string;
}

// 개발 환경에서 환경변수에서 API 키 로드
export function loadApiKeyFromEnv(): string | null {
  if (typeof window !== 'undefined' && import.meta.env.VITE_GROQ_API_KEY) {
    return import.meta.env.VITE_GROQ_API_KEY;
  }
  return null;
}

// API 키 유효성 검증
export function validateGroqApiKey(apiKey: string): boolean {
  return apiKey.startsWith('gsk_') && apiKey.length > 20;
}

// 설정 관리 클래스
export class ConfigManager {
  private static instance: ConfigManager;
  private apiKey: string | null = null;

  private constructor() {
    // 환경변수에서 초기 로드 시도
    this.apiKey = loadApiKeyFromEnv();
  }

  static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  getGroqApiKey(): string | null {
    return this.apiKey;
  }

  setGroqApiKey(apiKey: string): boolean {
    if (validateGroqApiKey(apiKey)) {
      this.apiKey = apiKey;
      return true;
    }
    return false;
  }

  hasValidApiKey(): boolean {
    return this.apiKey !== null && validateGroqApiKey(this.apiKey);
  }
}

export const configManager = ConfigManager.getInstance();
