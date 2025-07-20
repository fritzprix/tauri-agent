'use client';

import { useState } from 'react';
import { useRoleContext } from '../context/RoleContext';
import { Role } from '../lib/db';
import { getLogger } from '../lib/logger';
import {
  Badge,
  Button,
  Input,
  Modal,
  StatusIndicator,
  Textarea
} from './ui';
import { useMCPServer } from '../hooks/use-mcp-server';

const logger = getLogger('RoleManager');

interface RoleManagerProps {
  onClose: () => void;
}

export default function RoleManager({ onClose }: RoleManagerProps) {
  const { currentRole, roles, saveRole, deleteRole, setCurrentRole } = useRoleContext();
  const { mcpServerStatus: serverStatus, isMCPConnecting: isCheckingStatus, connectToMCP } = useMCPServer();

  // MCP server status logic is now handled elsewhere or can be stubbed/removed if not needed
  const checkServerStatuses = (_role: Role) => {};

  const [editingRole, setEditingRole] = useState<Partial<Role> | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [mcpConfigText, setMcpConfigText] = useState('');
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  

  const handleCreateNew = () => {
    setIsCreating(true);
    const newRoleTemplate: Partial<Role> = {
      name: '',
      systemPrompt: 'You are a helpful AI assistant with access to various tools. Use the available tools to help users accomplish their tasks.',
      mcpConfig: {}
    };
    setEditingRole(newRoleTemplate);
    
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
    checkServerStatuses(role);
  };

  const handleSaveRole = async () => {
    if (!editingRole) return;
    let roleToSave = { ...editingRole } as Role;
    try {
      // Parse MCP config from text
      if (mcpConfigText) {
        roleToSave.mcpConfig = JSON.parse(mcpConfigText);
      }
    } catch {
      alert('유효하지 않은 JSON 형식입니다. JSON을 확인해주세요.');
      return;
    }
    
    await saveRole(editingRole, mcpConfigText);
    setEditingRole(null);
    setIsCreating(false);
    setMcpConfigText('');
    logger.debug(`Role "${roleToSave.name}" saved successfully`);
  };
  
  const handleSelectRole = (role: Role) => {
    setCurrentRole(role);
    connectToMCP(role);
  };

  const handleDeleteRole = async (role: Role) => {
    // Check if it's a default role
    if (role.isDefault) {
      alert('기본 역할은 삭제할 수 없습니다.');
      return;
    }

    // Confirm deletion
    if (!window.confirm(`"${role.name}" 역할을 정말로 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) {
      return;
    }
    try {
      setIsDeleting(role.id);
      logger.info(`Attempting to delete role: ${role.name} (${role.id})`);
      
      // If we're editing this role, cancel editing first
      if (editingRole?.id === role.id) {
        logger.info("cancel!!!");
        handleCancel();
      }
      
      // If this is the current role, we might want to switch to a default role
      if (currentRole?.id === role.id) {
        const defaultRole = roles.find(r => r.isDefault && r.id !== role.id);
        if (defaultRole) {
          setCurrentRole(defaultRole);
        }
      }
      
      // Delete the role
      await deleteRole(role.id);
      
      logger.info(`Successfully deleted role: ${role.name} (${role.id})`);
      
    } catch (error) {
      logger.error(`Failed to delete role: ${role.name} (${role.id})`, { error });
      alert(`역할 삭제에 실패했습니다: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsDeleting(null);
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
  
  const handleCheckStatusForEditor = () => {
      try {
        const config = JSON.parse(mcpConfigText);
        const tempRoleForCheck: Role = {
            id: editingRole?.id || 'temp-check',
            name: editingRole?.name || 'temp-check',
            systemPrompt: '',
            mcpConfig: config,
            isDefault: false,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        checkServerStatuses(tempRoleForCheck);
      } catch {
        alert('유효하지 않은 JSON 형식입니다.');
      }
  }

  return (
    <Modal 
      isOpen={true} 
      onClose={onClose} 
      title="Role Management" 
      size="xl"
    >
      {/* Main container with fixed height */}
      <div className="flex h-full overflow-hidden flex-col md:flex-row">
        {/* Role List - Fixed width with internal scrolling */}
        <div className="w-full md:w-1/3 border-r border-gray-700 flex flex-col h-full">
          {/* Button - Fixed at top */}
          <div className="p-4 border-b border-gray-700 flex-shrink-0">
            <Button 
              variant="primary"
              className="w-full"
              onClick={handleCreateNew}
            >
              + 새 역할 만들기
            </Button>
          </div>
          
          {/* Scrollable roles list */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-2">
              {roles.map(role => (
                <div 
                  key={role.id} 
                  className={`border rounded p-3 cursor-pointer transition-colors ${
                    currentRole?.id === role.id 
                      ? 'border-green-400 bg-green-900/20' 
                      : 'border-gray-700 hover:border-gray-600'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-green-400 font-medium">{role.name}</h3>
                    <div className="flex gap-1 flex-wrap">
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
                    MCP 서버: {role.mcpConfig?.mcpServers ? Object.keys(role.mcpConfig.mcpServers).length : 0}개
                  </div>
                  
                  {currentRole?.id === role.id && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {Object.keys(role.mcpConfig?.mcpServers || {}).map(serverName => (
                            <div
                              key={serverName}
                              className="flex items-center gap-1 text-xs px-1 py-0.5 rounded bg-gray-800"
                            >
                              <StatusIndicator 
                                status={
                                  serverStatus[serverName] === true ? 'connected' : 
                                  serverStatus[serverName] === false ? 'disconnected' : 'unknown'
                                }
                                size="sm"
                              />
                              <span className="text-gray-300">{serverName}</span>
                            </div>
                          ))}
                      </div>
                  )}
                  
                  <div className="flex flex-wrap gap-2">
                    <Button 
                      size="sm"
                      variant="primary"
                      onClick={() => handleSelectRole(role)}
                      disabled={currentRole?.id === role.id}
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
                      onClick={() => checkServerStatuses(role)}
                      disabled={isCheckingStatus}
                    >
                      {isCheckingStatus && currentRole?.id === role.id ? '확인중...' : '상태확인'}
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => handleDeleteRole(role)}
                      // disabled={role.isDefault || isDeleting === role.id}
                      title={role.isDefault ? '기본 역할은 삭제할 수 없습니다.' : '역할 삭제'}
                    >
                      {isDeleting === role.id ? '삭제중...' : '삭제'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Role Editor */}
        {(editingRole || isCreating) && (
            <div className="flex-1 flex flex-col h-full">
              <div className="p-4 border-b border-gray-700 flex-shrink-0">
                <h3 className="text-green-400 font-bold text-lg">
                  {isCreating ? '새 역할 만들기' : '역할 편집'}
                </h3>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4">
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
                          onClick={handleCheckStatusForEditor}
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
                      placeholder={`{
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
                      * mcpServers 형식만 사용됩니다. 빈 객체로 두면 MCP 서버를 사용하지 않습니다.
                    </div>
                    
                    {editingRole && Object.keys(serverStatus).length > 0 && (
                      <div className="mt-3 p-2 bg-gray-900 rounded border border-gray-700">
                        <div className="text-xs text-gray-400 mb-2">에디터 서버 상태:</div>
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(serverStatus).map(([serverName, isConnected]) => (
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
              </div>
              
              <div className="flex gap-3 p-4 border-t border-gray-700 flex-shrink-0">
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