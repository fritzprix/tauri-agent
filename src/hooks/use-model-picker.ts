import { useEffect, useMemo, useState } from "react";
import { llmConfigManager, ModelInfo, ProviderInfo } from "../lib/llm-config-manager";


interface ApiKeyStatus {
    configured: boolean;
    text: string;
}



const useModelPickerLogic = (apiKeys: Record<string, string>, selectedProvider?: string, selectedModel?: string, onProviderChange?: (p: string) => void, onModelChange?: (m: string) => void) => {
    const [providers, setProviders] = useState<ProviderInfo[]>([]);
    const [models, setModels] = useState<ModelInfo[]>([]);
    const [loading, setLoading] = useState<boolean>(true);

    useEffect(() => {
        try {
            const allProviders = llmConfigManager.getProviders();
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
            const hasKey = !!apiKeys[selectedProviderData.name];
            return { configured: hasKey, text: hasKey ? 'KEY FOUND' : 'KEY MISSING' };
        } catch { return { configured: false, text: 'ERROR' }; }
    }, [selectedProviderData]);

    return { loading, providerOptions, modelOptions, selectedProviderData, selectedModelData, apiKeyStatus };
};

export { useModelPickerLogic };