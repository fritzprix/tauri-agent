import { 
  createAIService, 
  createAIServiceFromServiceId, 
  createRecommendedAIService,
  getAvailableServices,
  getAvailableModels 
} from '../lib/ai-service-simple';
import { llmConfigManager } from '../lib/llm-config-manager';

// 사용 예시들

export function exampleUsage() {
  // 1. 기본 서비스 사용
  const defaultService = createAIService({});
  console.log('Default service:', defaultService.getServiceConfig());

  // 2. 특정 서비스 ID로 생성
  const reasoningService = createAIServiceFromServiceId('reasoning');
  console.log('Reasoning service supports reasoning:', reasoningService.supportsReasoning());

  const creativeService = createAIServiceFromServiceId('creative');
  console.log('Creative service context window:', creativeService.getContextWindow());

  const fastService = createAIServiceFromServiceId('fast');
  console.log('Fast service supports tools:', fastService.supportsTools());

  // 3. 요구사항에 따른 모델 추천
  const toolsRequiredService = createRecommendedAIService({
    needsTools: true,
    maxCost: 0.01,
    preferSpeed: true
  });
  console.log('Tools required service:', toolsRequiredService.getCurrentModelInfo());

  const largeContextService = createRecommendedAIService({
    contextWindow: 100000,
    needsReasoning: true
  });
  console.log('Large context service:', largeContextService.getCurrentModelInfo());

  // 4. 직접 모델 지정
  const specificModelService = createAIService({
    provider: 'openai',
    model: 'gpt-4o',
    temperature: 0.2,
    maxTokens: 2000
  });
  console.log('Specific model service:', specificModelService.getModelConfig());

  // 5. 사용 가능한 서비스 및 모델 조회
  console.log('Available services:', getAvailableServices());
  console.log('Available models:', getAvailableModels().map(m => `${m.providerId}:${m.modelId}`));

  // 6. 모델 필터링
  console.log('Models with tools:', llmConfigManager.getModelsWithTools().map(m => `${m.providerId}:${m.modelId}`));
  console.log('Budget models (< $0.001):', llmConfigManager.getModelsByCostRange(0.001, 0.001).map(m => `${m.providerId}:${m.modelId}`));
}

// 채팅 사용 예시
export async function chatExample() {
  // 추론이 필요한 작업을 위한 서비스
  const reasoningService = createAIServiceFromServiceId('reasoning');
  await reasoningService.initializeModel();

  console.log('Using reasoning model for complex problem solving...');
  const messages = [
    {
      id: '1',
      content: 'Explain the difference between supervised and unsupervised machine learning with examples.',
      role: 'user' as const
    }
  ];

  for await (const chunk of reasoningService.streamChat(messages)) {
    process.stdout.write(chunk);
  }

  // 창작을 위한 서비스
  const creativeService = createAIServiceFromServiceId('creative');
  await creativeService.initializeModel();

  console.log('\n\nUsing creative model for story writing...');
  const creativeMessages = [
    {
      id: '1',
      content: 'Write a short story about a robot discovering emotions.',
      role: 'user' as const
    }
  ];

  for await (const chunk of creativeService.streamChat(creativeMessages)) {
    process.stdout.write(chunk);
  }
}

// 도구 사용 예시
export async function toolExample() {
  // 도구 지원이 필요한 작업
  const toolService = createRecommendedAIService({
    needsTools: true,
    preferSpeed: false // 성능 우선
  });

  await toolService.initializeModel();

  console.log('Using tool-enabled model for agent tasks...');
  console.log('Model supports tools:', toolService.supportsTools());

  // MCP 도구가 연결되었다고 가정하고 에이전트 모드 사용
  // const messages = [
  //   {
  //     id: '1',
  //     content: 'Search for information about the latest developments in AI and create a summary.',
  //     role: 'user' as const
  //   }
  // ];

  // 실제 MCP 도구가 연결되어 있을 때만 작동
  // for await (const chunk of toolService.streamChat(messages, 'You are a helpful assistant.', mockMCPTools, 'agent')) {
  //   process.stdout.write(chunk);
  // }
}

// 설정 탐색 예시
export function configExploration() {
  console.log('=== LLM Configuration Manager Examples ===\n');

  // 1. 제공업체 정보
  console.log('Available providers:');
  for (const [id, provider] of Object.entries(llmConfigManager.getProviders())) {
    console.log(`- ${id}: ${provider.name} (${Object.keys(provider.models).length} models)`);
  }

  // 2. 특정 제공업체의 모델들
  console.log('\nOpenAI models:');
  const openaiModels = llmConfigManager.getModelsForProvider('openai');
  if (openaiModels) {
    for (const [id, model] of Object.entries(openaiModels)) {
      console.log(`- ${id}: ${model.name} (${model.contextWindow} tokens, $${model.cost.input}/$${model.cost.output})`);
    }
  }

  // 3. 도구 지원 모델들
  console.log('\nModels with tool support:');
  llmConfigManager.getModelsWithTools().forEach(({ providerId, modelId, model }) => {
    console.log(`- ${providerId}:${modelId}: ${model.name}`);
  });

  // 4. 예산별 모델 추천
  console.log('\nBudget models (input + output cost < $0.002):');
  llmConfigManager.getModelsByCostRange(0.001, 0.001).forEach(({ providerId, modelId, model }) => {
    console.log(`- ${providerId}:${modelId}: ${model.name} ($${model.cost.input}/$${model.cost.output})`);
  });

  // 5. 서비스 설정들
  console.log('\nPre-configured services:');
  for (const [id, config] of Object.entries(llmConfigManager.getServiceConfigs())) {
    const model = llmConfigManager.getModel(config.provider, config.model);
    console.log(`- ${id}: ${config.provider}:${config.model} (${model?.name}) - temp: ${config.temperature}`);
  }
}
