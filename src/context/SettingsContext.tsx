import React, { createContext, ReactNode, useEffect, useState, useContext, useCallback } from 'react';
import { AIServiceProvider } from '../lib/ai-service';
import { dbService, Role } from '../lib/db';
import { getLogger } from '../lib/logger';

const logger = getLogger('SettingsContext');

interface SettingsContextType {
  // LLM & API Settings
  apiKeys: Record<AIServiceProvider, string>;
  setApiKeys: (keys: Record<AIServiceProvider, string>) => Promise<void>;
  selectedProvider: string | undefined;
  setSelectedProvider: (provider: string | undefined) => Promise<void>;
  selectedModel: string | undefined;
  setSelectedModel: (model: string | undefined) => Promise<void>;
  messageWindowSize: number;
  setMessageWindowSize: (size: number) => Promise<void>;

  // Role Management
  roles: Role[];
  saveRole: (role: Role) => Promise<void>;
  deleteRole: (roleId: string) => Promise<void>;
  isRolesLoading: boolean;
}

export const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // State
  const [apiKeys, setApiKeysState] = useState<Record<AIServiceProvider, string>>(() => ({} as Record<AIServiceProvider, string>));
  const [selectedProvider, setSelectedProviderState] = useState<string | undefined>();
  const [selectedModel, setSelectedModelState] = useState<string | undefined>();
  const [messageWindowSize, setMessageWindowSizeState] = useState<number>(50);
  const [roles, setRoles] = useState<Role[]>([]);
  const [isRolesLoading, setIsRolesLoading] = useState(true);

  // --- API & LLM Settings ---
  const setApiKeys = async (keys: Record<AIServiceProvider, string>) => {
    setApiKeysState(keys);
    await dbService.saveSetting('apiKeys', keys);
  };

  const setSelectedProvider = async (provider: string | undefined) => {
    setSelectedProviderState(provider);
    const currentSettings = await dbService.getSetting<{ provider: string; model: string }>('llm');
    await dbService.saveSetting('llm', { ...currentSettings, provider: provider || '' });
  };

  const setSelectedModel = async (model: string | undefined) => {
    setSelectedModelState(model);
    const currentSettings = await dbService.getSetting<{ provider: string; model: string }>('llm');
    await dbService.saveSetting('llm', { ...currentSettings, model: model || '' });
  };

  const setMessageWindowSize = async (size: number) => {
    setMessageWindowSizeState(size);
    await dbService.saveSetting('messageWindowSize', size);
  };

  // --- Role Management ---
  const loadRoles = useCallback(async () => {
    setIsRolesLoading(true);
    try {
      let rolesFromDb = await dbService.getRoles();
      if (rolesFromDb.length === 0) {
        logger.info('No roles found, creating default role.');
        const defaultRole: Role = {
          id: `role_${Date.now()}`,
          name: 'Default Role',
          systemPrompt: 'You are a helpful AI assistant.',
          mcpConfig: { mcpServers: {} },
          isDefault: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        await dbService.saveRole(defaultRole);
        rolesFromDb = [defaultRole];
      }
      setRoles(rolesFromDb);
    } catch (error) {
      logger.error('Error loading roles from DB:', { error });
      setRoles([]);
    } finally {
      setIsRolesLoading(false);
    }
  }, []);

  const saveRole = async (role: Role) => {
    await dbService.saveRole(role);
    await loadRoles(); // Reload roles after saving
  };

  const deleteRole = async (roleId: string) => {
    await dbService.deleteRole(roleId);
    await loadRoles(); // Reload roles after deleting
  };

  // --- Initial Load ---
  useEffect(() => {
    const loadInitialSettings = async () => {
      const [savedKeys, savedLLMSettings, savedSize] = await Promise.all([
        dbService.getSetting<Record<AIServiceProvider, string>>('apiKeys'),
        dbService.getSetting<{ provider: string; model: string }>('llm'),
        dbService.getSetting<number>('messageWindowSize'),
        loadRoles(),
      ]);

      if (savedKeys) setApiKeysState(savedKeys);
      if (savedLLMSettings) {
        setSelectedProviderState(savedLLMSettings.provider);
        setSelectedModelState(savedLLMSettings.model);
      }
      if (savedSize) setMessageWindowSizeState(savedSize);
    };
    loadInitialSettings();
  }, [loadRoles]);

  const value = {
    apiKeys,
    setApiKeys,
    selectedProvider,
    setSelectedProvider,
    selectedModel,
    setSelectedModel,
    messageWindowSize,
    setMessageWindowSize,
    roles,
    saveRole,
    deleteRole,
    isRolesLoading,
  };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};
