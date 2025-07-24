import { createId } from '@paralleldrive/cuid2';
import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { useAsyncFn } from 'react-use';
import { useMCPServer } from '../hooks/use-mcp-server';
import { dbService, Role } from '../lib/db';
import { getLogger } from '../lib/logger';

const logger = getLogger('RoleContext');

const DEFAULT_PROMPT = "You are an AI assistant agent that can use external tools via MCP (Model Context Protocol).\n- Always analyze the user's intent and, if needed, use available tools to provide the best answer.\n- When a tool is required, call the appropriate tool with correct parameters.\n- If the answer can be given without a tool, respond directly.\n- Be concise and clear. If you use a tool, explain the result to the user in natural language.\n- If you are unsure, ask clarifying questions before taking action.";

interface RoleContextType {
  roles: Role[];
  currentRole: Role | null;
  setCurrentRole: (role: Role | null) => void;
  saveRole: (role: Partial<Role>, mcpConfigText: string) => Promise<Role | undefined>;
  deleteRole: (roleId: string) => Promise<void>;
  error: Error | null;
}

const RoleContext = createContext<RoleContextType | undefined>(undefined);

function getDefaultRole(): Role {
  return {
    id: createId(),
    createdAt: new Date(),
    name: 'Default Role',
    isDefault: true,
    mcpConfig: {
      mcpServers: {}
    },
    systemPrompt: DEFAULT_PROMPT,
    updatedAt: new Date()
  }
}

export const RoleContextProvider = ({ children }: { children: ReactNode }) => {
  const [currentRole, setCurrentRole] = useState<Role | null>(null);
  const [{ value: roles, loading, error }, loadRoles] = useAsyncFn(async () => {
    let fetchedRoles = await dbService.getRoles();
    if (fetchedRoles.length === 0) {
      const defaultRole = getDefaultRole();
      await dbService.upsertRole(defaultRole);
      fetchedRoles = [defaultRole];
    }
    return fetchedRoles;
  }, []);

  const { connectServers } = useMCPServer();

  useEffect(() => {
    loadRoles();
  }, [loadRoles]);

  useEffect(() => {
    if (!loading && roles) {
      const r = roles.find(r => r.isDefault) || roles[0];
      setCurrentRole(r);
    }
  }, [loading, roles]);

  useEffect(() => {
    if (currentRole) {
      logger.debug('Current role changed, connecting to MCP', { role: currentRole.name });
      connectServers(currentRole);
    }
  }, [currentRole, connectServers]);

  const [{ }, saveRole] = useAsyncFn(async (editingRole: Partial<Role>, mcpConfigText: string): Promise<Role | undefined> => {
    if (!editingRole?.name) {
      alert('이름은 필수입니다.');
      return;
    }
    // 기본 systemPrompt가 없으면 Agent에 맞는 프롬프트로 자동 설정
    const systemPrompt = editingRole.systemPrompt || DEFAULT_PROMPT;
    try {
      const mcpConfig = JSON.parse(mcpConfigText);
      const finalConfig = { mcpServers: mcpConfig.mcpServers || {} };

      // 기존 Role 편집 시 id를 유지, 새 Role일 때만 id 생성
      let roleId = editingRole.id;
      let createdAt = editingRole.createdAt;
      if (!roleId) {
        roleId = createId();
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

      await dbService.upsertRole(roleToSave);

      if (currentRole?.id === roleToSave.id || !currentRole) {
        setCurrentRole(roleToSave);
      }
      await loadRoles();
      return roleToSave;
    } catch (error) {
      logger.error('Error saving role:', { error });
      alert('역할 저장 중 오류가 발생했습니다. MCP 설정이 올바른 JSON 형식인지 확인해주세요.');
      return undefined;
    }
  }, [currentRole, loadRoles]);

  const [{ }, deleteRole] = useAsyncFn(async (roleId: string) => {
    if (window.confirm('이 역할을 삭제하시겠습니까?')) {
      try {
        await dbService.deleteRole(roleId);
        await loadRoles();
        // The useEffect hook will handle setting a new currentRole
      } catch (error) {
        logger.error('Error deleting role:', { error });
        alert('역할 삭제 중 오류가 발생했습니다.');
      } finally {
        await loadRoles();
      }
    }
  }, [loadRoles]);

  logger.info("role context : ", {roles: roles?.length});

  const contextValue: RoleContextType = useMemo(() => ({
    roles: roles || [],
    currentRole,
    setCurrentRole,
    saveRole,
    deleteRole,
    error: error ?? null,
  }), [roles, currentRole, setCurrentRole, saveRole, deleteRole, error]);

  return (
    <RoleContext.Provider value={contextValue}>
      {children}
    </RoleContext.Provider>
  );
};

export function useRoleContext() {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error('useRoleManager must be used within a RoleContextProvider');
  return ctx;
}