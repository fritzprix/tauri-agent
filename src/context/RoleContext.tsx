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
    if (!editingRole?.name) {
      alert('이름은 필수입니다.');
      return;
    }
    // 기본 systemPrompt가 없으면 Agent에 맞는 프롬프트로 자동 설정
    const agentPrompt = `You are an AI assistant agent that can use external tools via MCP (Model Context Protocol).\n- Always analyze the user's intent and, if needed, use available tools to provide the best answer.\n- When a tool is required, call the appropriate tool with correct parameters.\n- If the answer can be given without a tool, respond directly.\n- Be concise and clear. If you use a tool, explain the result to the user in natural language.\n- If you are unsure, ask clarifying questions before taking action.`;
    const systemPrompt = editingRole.systemPrompt || agentPrompt;
    try {
      const mcpConfig = JSON.parse(mcpConfigText);
      const finalConfig = { mcpServers: mcpConfig.mcpServers || {} };

      // 기존 Role 편집 시 id를 유지, 새 Role일 때만 id 생성
      let roleId = editingRole.id;
      let createdAt = editingRole.createdAt;
      if (!roleId) {
        roleId = `role_${Date.now()}`;
        createdAt = new Date();
      }

      const roleToSave: Role = {
        id: roleId,
        name: editingRole.name,
        systemPrompt,
        mcpConfig: finalConfig,
        isDefault: editingRole.isDefault || false,
        createdAt: createdAt || new Date(),
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
