import { useState, useEffect } from 'react';
import Dropdown from './Dropdown';
import type { ProviderInfo, ModelInfo } from '../../lib/llm-config-manager';
import { llmConfigManager } from '../../lib/llm-config-manager';
import { mcpDB } from '../../lib/db';

interface ModelPickerProps {
  selectedProvider?: string;
  selectedModel?: string;
  onProviderChange: (provider: string) => void;
  onModelChange: (model: string) => void;
  className?: string;
}

interface ProviderOption {
  id: string;
  info: ProviderInfo;
}

interface ModelOption {
  id: string;
  info: ModelInfo;
}

export default function ModelPicker({
  selectedProvider,
  selectedModel,
  onProviderChange,
  onModelChange,
  className = ""
}: ModelPickerProps) {
  const [providers, setProviders] = useState<ProviderOption[]>([]);
  const [models, setModels] = useState<ModelOption[]>([]);
  const [loading, setLoading] = useState(true);

  // 기본값 설정
  useEffect(() => {
    const setDefaults = () => {
      try {
        // 아직 provider가 선택되지 않았고, 기본 설정이 있는 경우
        if (!selectedProvider && !selectedModel) {
          const defaultConfig = llmConfigManager.getDefaultServiceConfig();
          if (defaultConfig) {
            onProviderChange(defaultConfig.provider);
            onModelChange(defaultConfig.model);
          }
        }
      } catch (error) {
        console.error('Failed to set default configuration:', error);
      }
    };

    // providers가 로드된 후에 기본값 설정
    if (!loading && providers.length > 0) {
      setDefaults();
    }
  }, [loading, providers, selectedProvider, selectedModel, onProviderChange, onModelChange]);

  useEffect(() => {
    const loadProviders = async () => {
      try {
        const allProviders = llmConfigManager.getProviders();
        if (!allProviders || typeof allProviders !== 'object') {
          console.error('Invalid providers data received');
          setLoading(false);
          return;
        }
        
        const providerArray = Object.entries(allProviders).map(([id, info]) => ({
          id,
          info
        }));
        setProviders(providerArray);
        setLoading(false);
      } catch (error) {
        console.error('Failed to load providers:', error);
        setProviders([]); // Set empty array on error
        setLoading(false);
      }
    };

    loadProviders();
  }, []);

  useEffect(() => {
    const loadModels = async () => {
      if (selectedProvider) {
        try {
          const availableModels = llmConfigManager.getModelsForProvider(selectedProvider);
          if (availableModels && typeof availableModels === 'object') {
            const modelArray = Object.entries(availableModels).map(([id, info]) => ({
              id,
              info
            }));
            setModels(modelArray);
            
            // Reset model selection if current model is not available for new provider
            if (selectedModel && !Object.keys(availableModels).includes(selectedModel)) {
              onModelChange('');
            }
          } else {
            setModels([]);
          }
        } catch (error) {
          console.error('Failed to load models:', error);
          setModels([]);
        }
      } else {
        setModels([]);
      }
    };

    loadModels();
  }, [selectedProvider, selectedModel, onModelChange]);

  const handleProviderChange = async (provider: string) => {
    onProviderChange(provider);
    if (selectedModel) {
      await mcpDB.saveSetting('llm', { provider, model: selectedModel });
    }
  };

  const handleModelChange = async (model: string) => {
    onModelChange(model);
    if (selectedProvider) {
      await mcpDB.saveSetting('llm', { provider: selectedProvider, model });
    }
  };

  const providerOptions = providers.map(provider => ({
    value: provider.id,
    label: provider.info.name,
    disabled: false // All providers from config are considered enabled
  }));

  const modelOptions = models.map(model => ({
    value: model.id,
    label: `${model.info.name} - $${model.info.cost.input?.toFixed(4) || '?'}/1k`,
    disabled: false
  }));

  const selectedProviderData = providers.find(p => p.id === selectedProvider);

  if (loading) {
    return (
      <div className={`font-mono text-green-400 ${className}`}>
        <div className="animate-pulse">
          <div className="text-xs mb-2 text-green-600">[ LOADING LLM PROVIDERS... ]</div>
          <div className="h-10 bg-gray-900 border border-gray-700 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-4 font-mono ${className}`}>
      {/* Header */}
      <div className="border-b border-green-700 pb-2">
        <div className="text-green-300 text-sm">
          === LLM CONFIGURATION ===
        </div>
        <div className="text-green-600 text-xs mt-1">
          SELECT PROVIDER AND MODEL
        </div>
      </div>

      {/* Provider Selection */}
      <div className="space-y-2">
        <label className="block text-green-400 text-sm font-mono">
          <span className="text-green-600">[1]</span> PROVIDER:
        </label>
        <Dropdown
          options={providerOptions}
          value={selectedProvider}
          placeholder="> SELECT PROVIDER"
          onChange={handleProviderChange}
        />
        
        {selectedProviderData && (
          <div className="text-xs text-green-600 px-3 py-1 bg-green-900/10 border border-green-800">
            STATUS: ACTIVE | 
            API: {(() => {
              try {
                const envVar = selectedProviderData.info.apiKeyEnvVar;
                const hasKey = envVar && (import.meta.env[envVar] || process.env[envVar]);
                return hasKey ? 'CONFIGURED' : 'MISSING';
              } catch {
                return 'UNKNOWN';
              }
            })()}
          </div>
        )}
      </div>

      {/* Model Selection */}
      <div className="space-y-2">
        <label className="block text-green-400 text-sm font-mono">
          <span className="text-green-600">[2]</span> MODEL:
        </label>
        <Dropdown
          options={modelOptions}
          value={selectedModel}
          placeholder={selectedProvider ? "> SELECT MODEL" : "> SELECT PROVIDER FIRST"}
          onChange={handleModelChange}
          disabled={!selectedProvider || models.length === 0}
        />
        
        {selectedModel && (
          <div className="text-xs text-green-600 px-3 py-1 bg-green-900/10 border border-green-800">
            {(() => {
              try {
                const model = models.find(m => m.id === selectedModel);
                if (!model) return 'MODEL NOT FOUND';
                
                const contextWindow = model.info.contextWindow?.toLocaleString() || '?';
                const inputCost = model.info.cost?.input?.toFixed(4) || '?';
                const hasTools = model.info.supportTools ? 'TOOLS' : 'NO-TOOLS';
                const reasoning = model.info.supportReasoning ? 'REASONING' : 'STANDARD';
                
                return `CONTEXT: ${contextWindow} tokens | COST: $${inputCost}/1k | FEATURES: ${hasTools}, ${reasoning}`;
              } catch (error) {
                console.error('Error displaying model info:', error);
                return 'ERROR LOADING MODEL INFO';
              }
            })()}
          </div>
        )}
      </div>

      {/* Status */}
      <div className="pt-2 border-t border-green-800">
        <div className="text-xs text-green-600">
          STATUS: {selectedProvider && selectedModel ? 'READY' : 'INCOMPLETE CONFIGURATION'}
        </div>
      </div>
    </div>
  );
}