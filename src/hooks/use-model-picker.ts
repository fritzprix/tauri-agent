import { useEffect, useMemo, useState } from "react";
import { llmConfigManager, ModelInfo, ProviderInfo } from "../lib/llm-config-manager";
import { AIServiceProvider } from "../lib/ai-service";
import { Logger } from "../lib/logger";

interface ApiKeyStatus {
    configured: boolean;
    text: string;
}

// Provider to API key mapping (you should move this to environment variables)
const API_KEYS: Record<string, string> = {
    [AIServiceProvider.OpenAI]: import.meta.env.VITE_OPENAI_API_KEY || '',
    [AIServiceProvider.Anthropic]: import.meta.env.VITE_ANTHROPIC_API_KEY || '',
    [AIServiceProvider.Groq]: import.meta.env.VITE_GROQ_API_KEY || '',
    [AIServiceProvider.Gemini]: import.meta.env.VITE_GEMINI_API_KEY || '',
};

const useModelPickerLogic = (selectedProvider?: string, selectedModel?: string, onProviderChange?: (p: string) => void, onModelChange?: (m: string) => void) => {
    const [providers, setProviders] = useState<ProviderInfo[]>([]);
    const [models, setModels] = useState<ModelInfo[]>([]);
    const [loading, setLoading] = useState<boolean>(true);

    useEffect(() => {
        try {
            const allProviders = llmConfigManager.getProviders();
            Logger.debug("loaded providers : ", JSON.stringify({allProviders}))
            setProviders(Object.entries(allProviders).map(([key, info]) => ({ ...info, name: key } satisfies ProviderInfo)));
            setLoading(false);
        } catch (error) { console.error('Failed to load providers:', error); setLoading(false); }
    }, []);

    useEffect(() => {
        if (!loading && providers.length > 0 && !selectedProvider && onProviderChange && onModelChange) {
            const defaultConfig = llmConfigManager.getDefaultServiceConfig();
            if (defaultConfig) {
                onProviderChange(defaultConfig.provider);
                onModelChange(defaultConfig.model);
            }
        }
    }, [loading, providers, selectedProvider, onProviderChange, onModelChange]);

    useEffect(() => {
        if (selectedProvider) {
            try {
                const availableModels = llmConfigManager.getModelsForProvider(selectedProvider);
                
                if (availableModels) {
                    setModels(Object.entries(availableModels).map(([key, info]) => ({ ...info, id:key } satisfies ModelInfo)));
                    Logger.debug("models", JSON.stringify({ availableModels, selectedModel}))
                    if (selectedModel && !availableModels[selectedModel] && onModelChange) {
                        onModelChange('');
                    }
                }
            } catch (error) { console.error('Failed to load models:', error); setModels([]); }
        } else { setModels([]); }
    }, [selectedProvider, selectedModel, onModelChange]);

    const providerOptions = useMemo(() => providers.map(p => ({ value: p.name, label: p.name })), [providers]);
    const modelOptions = useMemo(() => models.map(m => ({ value: m.id || '', label: m.name })), [models]);

    const selectedProviderData = useMemo(() => providers.find(p => p.name === selectedProvider), [providers, selectedProvider]);
    const selectedModelData = useMemo(() => models.find(m => m.id === selectedModel), [models, selectedModel]);

    const apiKeyStatus: ApiKeyStatus | null = useMemo(() => {
        if (!selectedProviderData) return null;
        try {
            Logger.debug(`selected key :  ${JSON.stringify({ provider: selectedProviderData.name })}`)
            const hasKey = !!API_KEYS[selectedProviderData.name];
            return { configured: hasKey, text: hasKey ? 'KEY FOUND' : 'KEY MISSING' };
        } catch { return { configured: false, text: 'ERROR' }; }
    }, [selectedProviderData]);

    return { loading, providerOptions, modelOptions, selectedProviderData, selectedModelData, apiKeyStatus };
};

export { useModelPickerLogic };