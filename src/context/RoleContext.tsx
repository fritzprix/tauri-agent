import { createContext, ReactNode, useContext, useEffect, useState, useMemo } from 'react';
import { Role } from '../lib/db';
import { getLogger } from '../lib/logger';
import { useSettings } from './SettingsContext';
import { useMCPAgent } from '../hooks/use-mcp-agent';

const logger = getLogger('RoleContext');

interface RoleContextType {
  roles: Role[];
  currentRole: Role | null;
  setCurrentRole: (role: Role | null) => void;
  saveRole: (role: Partial<Role>, mcpConfigText: string) => Promise<Role | undefined>;
  deleteRole: (roleId: string) => Promise<void>;
  serverStatuses: Record<string, boolean>;
  isCheckingStatus: boolean;
  checkServerStatuses: (role: Role) => Promise<void>;
}

const RoleContext = createContext<RoleContextType | undefined>(undefined);

export const RoleContextProvider = ({ children }: { children: ReactNode }) => {
  const {
    roles,
    saveRole: saveRoleToSettings,
    deleteRole: deleteRoleFromSettings,
    isRolesLoading,
  } = useSettings();

  const [currentRole, setCurrentRole] = useState<Role | null>(null);
  const { connectToMCP, mcpServerStatus, isMCPConnecting } = useMCPAgent();

  useEffect(() => {
    if (!isRolesLoading && roles.length > 0) {
      const currentRoleStillExists = currentRole && roles.some(r => r.id === currentRole.id);
      if (!currentRoleStillExists) {
        const roleToSet = roles.find(r => r.isDefault) || roles[0] || null;
        setCurrentRole(roleToSet);
      }
    }
  }, [roles, isRolesLoading, currentRole]);

  useEffect(() => {
    if (currentRole) {
      logger.debug('Current role changed, connecting to MCP', { role: currentRole.name });
      connectToMCP(currentRole);
    }
  }, [currentRole, connectToMCP]);

  const saveRole = async (editingRole: Partial<Role>, mcpConfigText: string): Promise<Role | undefined> => {
    if (!editingRole?.name || !editingRole?.systemPrompt) {
      alert('이름과 시스템 프롬프트는 필수입니다.');
      return;
    }
    try {
      const mcpConfig = JSON.parse(mcpConfigText);
      const finalConfig = { mcpServers: mcpConfig.mcpServers || {} };

      const roleToSave: Role = {
        id: editingRole.id || `role_${Date.now()}`,
        name: editingRole.name,
        systemPrompt: editingRole.systemPrompt,
        mcpConfig: finalConfig,
        isDefault: editingRole.isDefault || false,
        createdAt: editingRole.createdAt || new Date(),
        updatedAt: new Date(),
      };

      await saveRoleToSettings(roleToSave);

      if (currentRole?.id === roleToSave.id || !currentRole) {
        setCurrentRole(roleToSave);
      }
      return roleToSave;
    } catch (error) {
      logger.error('Error saving role:', { error });
      alert('역할 저장 중 오류가 발생했습니다. MCP 설정이 올바른 JSON 형식인지 확인해주세요.');
      return undefined;
    }
  };

  const deleteRole = async (roleId: string) => {
    if (window.confirm('이 역할을 삭제하시겠습니까?')) {
      try {
        await deleteRoleFromSettings(roleId);
        // The useEffect hook will handle setting a new currentRole
      } catch (error) {
        logger.error('Error deleting role:', { error });
        alert('역할 삭제 중 오류가 발생했습니다.');
      }
    }
  };

  const value: RoleContextType = {
    roles,
    currentRole,
    setCurrentRole,
    saveRole,
    deleteRole,
    serverStatuses: mcpServerStatus,
    isCheckingStatus: isMCPConnecting,
    checkServerStatuses: connectToMCP,
  };

  return (
    <RoleContext.Provider value={value}>
      {children}
    </RoleContext.Provider>
  );
};

export function useRoleManager() {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error('useRoleManager must be used within a RoleContextProvider');
  return ctx;
}
