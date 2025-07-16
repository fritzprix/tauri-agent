'use client';

import { useState, useEffect } from 'react';
import { mcpDB, Role } from '../lib/db';
import { tauriMCPClient, type MCPServerConfig } from '../lib/tauri-mcp-client';
import { 
  Modal, 
  Button, 
  Input, 
  Textarea, 
  StatusIndicator, 
  Badge 
} from './ui';
import { getLogger } from '../lib/logger';

const logger = getLogger('RoleManager');

interface RoleManagerProps {
  onClose: () => void;
  onRoleSelect: (role: Role) => void;
  onRoleUpdate?: (role: Role) => void;
  currentRole: Role | null;
}

export default function RoleManager({ onClose, onRoleSelect, onRoleUpdate, currentRole }: RoleManagerProps) {
  const [roles, setRoles] = useState<Role[]>([]);
  const [editingRole, setEditingRole] = useState<Partial<Role> | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [mcpConfigText, setMcpConfigText] = useState('');
  const [serverStatuses, setServerStatuses] = useState<Record<string, boolean>>({});
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);

  useEffect(() => {
    const initRoles = async () => {
      await loadRoles();
      // Check status for current role if available
      if (currentRole) {
        await checkServerStatuses(currentRole.mcpConfig);
      }
    };
    initRoles();
  }, []);

  // 서버 상태 체크
  const checkServerStatuses = async (mcpConfig: any) => {
    setIsCheckingStatus(true);
    try {
      const statuses: Record<string, boolean> = {};
      const allServerNames = new Set<string>();
      
      // Collect all unique server names
      if (mcpConfig.mcpServers) {
        Object.keys(mcpConfig.mcpServers).forEach(name => allServerNames.add(name));
      }
      
      if (mcpConfig.servers && Array.isArray(mcpConfig.servers)) {
        mcpConfig.servers.forEach((server: any) => allServerNames.add(server.name));
      }
      
      // Check status for each unique server
      for (const serverName of allServerNames) {
        try {
          const isConnected = await tauriMCPClient.checkServerStatus(serverName);
          statuses[serverName] = isConnected;
        } catch {
          statuses[serverName] = false;
        }
      }
      
      setServerStatuses(statuses);
    } catch (error) {
      logger.error('Error checking server statuses:', {error});
    } finally {
      setIsCheckingStatus(false);
    }
  };

  const loadRoles = async () => {
    try {
      const allRoles = await mcpDB.getRoles();
      setRoles(allRoles);
    } catch (error) {
      logger.error('Error loading roles:', {error});
    }
  };

  const handleCreateNew = () => {
    setIsCreating(true);
    setEditingRole({
      name: '',
      systemPrompt: 'You are a helpful AI assistant with access to various tools. Use the available tools to help users accomplish their tasks.',
      mcpConfig: {}
    });
    
    // Claude MCP 설정 예시 - sequential-thinking 서버 사용
    const defaultMcpConfig = {
      mcpServers: {
        "sequential-thinking": {
          command: "npx",
          args: ["-y", "@modelcontextprotocol/server-sequential-thinking"],
          env: {}
        },
        "filesystem": {
          command: "npx",
          args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"],
          env: {}
        }
      }
    };
    
    setMcpConfigText(JSON.stringify(defaultMcpConfig, null, 2));
  };

  const handleEditRole = (role: Role) => {
    setEditingRole(role);
    setIsCreating(false);
    setMcpConfigText(JSON.stringify(role.mcpConfig, null, 2));
  };

  const handleSaveRole = async () => {
    if (!editingRole?.name || !editingRole?.systemPrompt) {
      alert('이름과 시스템 프롬프트는 필수입니다.');
      return;
    }
    logger.debug(mcpConfigText);
    try {
      const mcpConfig = JSON.parse(mcpConfigText);
      logger.debug("parsed object :", {mcpConfig});
      // Claude MCP 형식을 내부 형식으로 변환
      let convertedConfig = { ...mcpConfig };
      
      // Keep only Claude format (mcpServers)
      if (mcpConfig.mcpServers) {
        convertedConfig = {
          mcpServers: mcpConfig.mcpServers
        };
      }
      
      const role: Role = {
        id: editingRole.id || `role_${Date.now()}`,
        name: editingRole.name,
        systemPrompt: editingRole.systemPrompt,
        mcpConfig: convertedConfig,
        isDefault: editingRole.isDefault || false,
        createdAt: editingRole.createdAt || new Date(),
        updatedAt: new Date()
      };
      
      await mcpDB.saveRole(role);
      await loadRoles();
      
      // Start MCP servers
      await startMCPServers(convertedConfig);

      // 서버 상태 체크
      await checkServerStatuses(convertedConfig);
      
      // 현재 편집 중인 역할이 활성 역할인 경우 MCP 재연결
      if (currentRole && role.id === currentRole.id) {
        logger.debug('Reconnecting MCP for updated role:', role.name);
        if (onRoleUpdate) {
          onRoleUpdate(role);
        } else {
          onRoleSelect(role);
        }
      }
      
      setEditingRole(null);
      setIsCreating(false);
      setMcpConfigText('');
      
      logger.debug(`Role "${role.name}" saved successfully`);
      setMcpConfigText(JSON.stringify(convertedConfig, null, 2));
    } catch (error) {
      logger.error('Error saving role:', {error});
      alert('역할 저장 중 오류가 발생했습니다. MCP 설정이 올바른 JSON 형식인지 확인해주세요.');
    }
  };

  const handleDeleteRole = async (roleId: string) => {
    if (confirm('이 역할을 삭제하시겠습니까?')) {
      try {
        await mcpDB.deleteRole(roleId);
        await loadRoles();
      } catch (error) {
      logger.error('Error deleting role:', {error});
        alert('역할 삭제 중 오류가 발생했습니다.');
      }
    }
  };

  const startMCPServers = async (mcpConfig: any) => {
    if (mcpConfig.mcpServers) {
      for (const serverName in mcpConfig.mcpServers) {
        logger.debug("start ", {server: serverName});
        const server = mcpConfig.mcpServers[serverName];
        const config: MCPServerConfig = {
          name: serverName,
          command: server.command,
          args: server.args,
          env: server.env,
          transport: 'stdio',
        };
        try {
          await tauriMCPClient.startServer(config);
        } catch (error) {
          logger.error(`Failed to start server ${serverName}:`, {error});
        }
      }
    }
  };

  const handleCancel = () => {
    setEditingRole(null);
    setIsCreating(false);
    setMcpConfigText('');
  };

  const handleFormatJson = () => {
    try {
      const parsed = JSON.parse(mcpConfigText);
      setMcpConfigText(JSON.stringify(parsed, null, 2));
    } catch {
      alert('유효하지 않은 JSON 형식입니다. JSON을 확인해주세요.');
    }
  };

  return (
    <Modal 
      isOpen={true} 
      onClose={onClose} 
      title="Role Management" 
      size="xl"
    >
      <div className="flex flex-1 overflow-hidden">
        {/* Role List */}
        <div className="w-1/3 border-r border-gray-700 p-4 overflow-y-auto">
          <Button 
            variant="primary"
            className="w-full mb-4"
            onClick={handleCreateNew}
          >
            + 새 역할 만들기
          </Button>
            
            {roles.map(role => (
              <div 
                key={role.id} 
                className={`border rounded p-3 mb-2 cursor-pointer transition-colors ${
                  currentRole?.id === role.id 
                    ? 'border-green-400 bg-green-900/20' 
                    : 'border-gray-700 hover:border-gray-600'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-green-400 font-medium">{role.name}</h3>
                  <div className="flex gap-1">
                    {role.isDefault && (
                      <Badge variant="warning">DEFAULT</Badge>
                    )}
                    {currentRole?.id === role.id && (
                      <Badge variant="active">ACTIVE</Badge>
                    )}
                  </div>
                </div>
                <p className="text-gray-400 text-sm mb-3 line-clamp-2">
                  {role.systemPrompt}
                </p>
                <div className="text-xs text-gray-500 mb-2">
                  MCP 서버: {(() => {
                    const allServers = new Set();
                    
                    // Add Claude format servers
                    if (role.mcpConfig.mcpServers) {
                      Object.keys(role.mcpConfig.mcpServers).forEach(name => allServers.add(name));
                    }
                    
                    return allServers.size;
                  })()}개
                </div>
                
                {/* Server Status Indicators */}
                <div className="flex flex-wrap gap-1 mb-2">
                  {(() => {
                    const allServers = new Map();
                    
                    // Add Claude format servers
                    if (role.mcpConfig.mcpServers) {
                      Object.keys(role.mcpConfig.mcpServers).forEach(serverName => {
                        allServers.set(serverName, serverName);
                      });
                    }
                    
                    return Array.from(allServers.keys()).map(serverName => (
                      <div
                        key={serverName}
                        className="flex items-center gap-1 text-xs px-1 py-0.5 rounded bg-gray-800"
                      >
                        <StatusIndicator 
                          status={
                            serverStatuses[serverName] === true ? 'connected' : 
                            serverStatuses[serverName] === false ? 'disconnected' : 'unknown'
                          }
                          size="sm"
                        />
                        <span className="text-gray-300">{serverName}</span>
                      </div>
                    ));
                  })()}
                </div>
                
                <div className="flex gap-2">
                  <Button 
                    size="sm"
                    variant="primary"
                    onClick={() => onRoleSelect(role)}
                  >
                    선택
                  </Button>
                  <Button 
                    size="sm"
                    variant="secondary"
                    onClick={() => handleEditRole(role)}
                  >
                    편집
                  </Button>
                  <Button 
                    size="sm"
                    variant="ghost"
                    onClick={() => checkServerStatuses(role.mcpConfig)}
                    disabled={isCheckingStatus}
                  >
                    {isCheckingStatus ? '확인중...' : '상태확인'}
                  </Button>
                  {!role.isDefault && (
                    <Button 
                      size="sm"
                      variant="danger"
                      onClick={() => handleDeleteRole(role.id)}
                    >
                      삭제
                    </Button>
                  )}
                </div>
              </div>
            ))}
        </div>

        {/* Role Editor */}
        {(editingRole || isCreating) && (
            <div className="flex-1 p-4 overflow-y-auto">
              <h3 className="text-green-400 font-bold mb-4 text-lg">
                {isCreating ? '새 역할 만들기' : '역할 편집'}
              </h3>
              
              <div className="space-y-4">
                <Input
                  label="역할 이름 *"
                  value={editingRole?.name || ''}
                  onChange={(e) => setEditingRole(prev => ({...prev, name: e.target.value}))}
                  placeholder="역할 이름을 입력하세요..."
                />
                
                <Textarea
                  label="시스템 프롬프트 *"
                  value={editingRole?.systemPrompt || ''}
                  onChange={(e) => setEditingRole(prev => ({...prev, systemPrompt: e.target.value}))}
                  placeholder="AI가 수행할 역할과 행동 방식을 설명하세요..."
                  className="h-32"
                />
                
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-gray-400 font-medium">
                      MCP 설정 (JSON)
                      <span className="text-xs text-gray-500 ml-2">
                        - 연결할 MCP 서버들을 설정합니다
                      </span>
                    </label>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          try {
                            const config = JSON.parse(mcpConfigText);
                            checkServerStatuses(config);
                          } catch {
                            alert('유효하지 않은 JSON 형식입니다.');
                          }
                        }}
                        disabled={isCheckingStatus}
                      >
                        {isCheckingStatus ? '확인중...' : '서버 상태 확인'}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleFormatJson}
                      >
                        Format JSON
                      </Button>
                    </div>
                  </div>
                  <Textarea
                    value={mcpConfigText}
                    onChange={(e) => setMcpConfigText(e.target.value)}
                    className="h-48 font-mono text-sm"
                    placeholder={`Claude MCP 형식:
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"],
      "env": {}
    },
    "sequential-thinking": {
      "command": "npx", 
      "args": ["-y", "@modelcontextprotocol/server-sequential-thinking"],
      "env": {}
    }
  }
}`}
                  />
                  <div className="text-xs text-gray-500 mt-1">
                    * Claude MCP 형식 (mcpServers)을 사용합니다. 빈 객체로 두면 MCP 서버를 사용하지 않습니다.
                  </div>
                  
                  {/* Server Status Display */}
                  {Object.keys(serverStatuses).length > 0 && (
                    <div className="mt-3 p-2 bg-gray-900 rounded border border-gray-700">
                      <div className="text-xs text-gray-400 mb-2">서버 상태:</div>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(serverStatuses).map(([serverName, isConnected]) => (
                          <div
                            key={serverName}
                            className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-gray-800"
                          >
                            <StatusIndicator 
                              status={isConnected ? 'connected' : 'disconnected'} 
                            />
                            <span className="text-gray-300">{serverName}</span>
                            <Badge variant={isConnected ? 'success' : 'error'}>
                              {isConnected ? 'OK' : 'NOK'}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex gap-3 mt-6 pt-4 border-t border-gray-700">
                <Button 
                  variant="primary"
                  onClick={handleSaveRole}
                >
                  저장
                </Button>
                <Button 
                  variant="secondary"
                  onClick={handleCancel}
                >
                  취소
                </Button>
              </div>
            </div>
          )}

          {/* Empty state when no role is being edited */}
          {!editingRole && !isCreating && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-gray-500">
                <div className="text-4xl mb-4">⚙️</div>
                <p>역할을 선택하여 편집하거나</p>
                <p>새 역할을 만들어보세요</p>
              </div>
            </div>
          )}
        </div>
        </Modal>
  );
}
