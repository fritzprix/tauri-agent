import React, { createContext, ReactNode, useEffect, useState } from 'react';
import { AIServiceProvider } from '../lib/ai-service';
import { mcpDB } from '../lib/db';
import { getLogger } from '../lib/logger';

const logger = getLogger('SettingsContext');

interface SettingsContextType {
  apiKeys: Record<AIServiceProvider, string>;
  setApiKeys: (keys: Record<AIServiceProvider, string>) => void;
  selectedProvider: string | undefined;
  setSelectedProvider: (provider: string | undefined) => void;
  selectedModel: string | undefined;
  setSelectedModel: (model: string | undefined) => void;
  messageWindowSize: number;
  setMessageWindowSize: (size: number) => void;
}

export const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

interface SettingsProviderProps {
  children: ReactNode;
}

export const SettingsProvider: React.FC<SettingsProviderProps> = ({ children }) => {
  const [apiKeys, setApiKeysState] = useState<Record<AIServiceProvider, string>>(() => {
    const savedKeys = localStorage.getItem('apiKeys');
    return savedKeys ? JSON.parse(savedKeys) : {};
  });
  const [selectedProvider, setSelectedProviderState] = useState<string | undefined>(() => localStorage.getItem('selectedProvider') || undefined);
  const [selectedModel, setSelectedModelState] = useState<string | undefined>(() => localStorage.getItem('selectedModel') || undefined);
  const [messageWindowSize, setMessageWindowSizeState] = useState<number>(() => {
    const savedSize = localStorage.getItem('messageWindowSize');
    return savedSize ? parseInt(savedSize, 10) : 50; // Default to 50 if not found
  });

  // Function to update API keys and persist to localStorage
  const setApiKeys = (keys: Record<AIServiceProvider, string>) => {
    setApiKeysState(keys);
    localStorage.setItem('apiKeys', JSON.stringify(keys));
  };

  // Function to update selected provider and persist to localStorage
  const setSelectedProvider = (provider: string | undefined) => {
    setSelectedProviderState(provider);
    if (provider) {
      localStorage.setItem('selectedProvider', provider);
    } else {
      localStorage.removeItem('selectedProvider');
    }
    // Also save to mcpDB for LLM settings
    saveLLMSettings(provider, selectedModel);
  };

  // Function to update selected model and persist to localStorage
  const setSelectedModel = (model: string | undefined) => {
    setSelectedModelState(model);
    if (model) {
      localStorage.setItem('selectedModel', model);
    } else {
      localStorage.removeItem('selectedModel');
    }
    // Also save to mcpDB for LLM settings
    saveLLMSettings(selectedProvider, model);
  };

  // Function to update message window size and persist to localStorage
  const setMessageWindowSize = (size: number) => {
    setMessageWindowSizeState(size);
    localStorage.setItem('messageWindowSize', size.toString());
  };

  // Helper to save LLM settings to mcpDB
  const saveLLMSettings = async (provider: string | undefined, model: string | undefined) => {
    try {
      const llmSettings = { provider: provider || '', model: model || '' };
      await mcpDB.saveSetting('llm', llmSettings);
    } catch (error) {
      logger.error('Error saving LLM settings to DB:', {error});
    }
  };

  // Load LLM settings from mcpDB on initial mount if not already in localStorage
  useEffect(() => {
    const loadInitialLLMSettings = async () => {
      if (!selectedProvider && !selectedModel) { // Only load from DB if not already set from localStorage
        try {
          const savedLLMSettings = await mcpDB.getSetting<{ provider: string; model: string }>('llm');
          if (savedLLMSettings) {
            setSelectedProviderState(savedLLMSettings.provider);
            setSelectedModelState(savedLLMSettings.model);
            localStorage.setItem('selectedProvider', savedLLMSettings.provider);
            localStorage.setItem('selectedModel', savedLLMSettings.model);
          }
        } catch (error) {
          logger.error('Error loading initial LLM settings from DB:', {error});
        }
      }
    };
    loadInitialLLMSettings();
  }, []);


  return (
    <SettingsContext.Provider
      value={{
        apiKeys,
        setApiKeys,
        selectedProvider,
        setSelectedProvider,
        selectedModel,
        setSelectedModel,
        messageWindowSize,
        setMessageWindowSize,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};


