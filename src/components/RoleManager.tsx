'use client';

import { useState, useEffect } from 'react';
import { mcpDB, Role } from '../lib/db';

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

  useEffect(() => {
    loadRoles();
  }, []);

  const loadRoles = async () => {
    try {
      const allRoles = await mcpDB.getRoles();
      setRoles(allRoles);
    } catch (error) {
      console.error('Error loading roles:', error);
    }
  };

  const handleCreateNew = () => {
    setIsCreating(true);
    setEditingRole({
      name: '',
      systemPrompt: 'You are a helpful AI assistant with access to various tools. Use the available tools to help users accomplish their tasks.',
      mcpConfig: { servers: [] }
    });
    
    // 기본 MCP 설정 예시 - sequential-thinking 서버 사용
    const defaultMcpConfig = {
      servers: [
        {
          name: "sequential-thinking",
          command: "npx",
          args: ["-y", "@modelcontextprotocol/server-sequential-thinking"],
          transport: "stdio"
        }
      ]
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
    
    try {
      const mcpConfig = JSON.parse(mcpConfigText);
      
      // MCP 설정에 기본값 추가 (transport 필드가 없는 경우)
      if (mcpConfig.servers && Array.isArray(mcpConfig.servers)) {
        mcpConfig.servers = mcpConfig.servers.map((server: {
          name: string;
          command?: string;
          args?: string[];
          env?: Record<string, string>;
          transport?: string;
          url?: string;
          port?: number;
        }) => {
          // transport가 명시되지 않은 경우 자동 추론
          let transport = server.transport;
          if (!transport) {
            // command가 npx, node, python 등인 경우 stdio 사용
            if (server.command && ['npx', 'node', 'python', 'python3'].includes(server.command)) {
              transport = 'stdio';
            } else if (server.url || server.port) {
              // URL이나 port가 있으면 http/ws 사용
              transport = 'http';
            } else {
              // 기본값은 stdio
              transport = 'stdio';
            }
          }
          
          return {
            ...server,
            transport
          };
        });
      }
      
      const role: Role = {
        id: editingRole.id || `role_${Date.now()}`,
        name: editingRole.name,
        systemPrompt: editingRole.systemPrompt,
        mcpConfig,
        isDefault: editingRole.isDefault || false,
        createdAt: editingRole.createdAt || new Date(),
        updatedAt: new Date()
      };
      
      await mcpDB.saveRole(role);
      await loadRoles();
      
      // 현재 편집 중인 역할이 활성 역할인 경우 MCP 재연결
      if (currentRole && role.id === currentRole.id) {
        console.log('Reconnecting MCP for updated role:', role.name);
        // onRoleSelect 대신 onRoleUpdate 사용 (모달을 닫지 않음)
        if (onRoleUpdate) {
          onRoleUpdate(role);
        } else {
          onRoleSelect(role);
        }
      }
      
      setEditingRole(null);
      setIsCreating(false);
      setMcpConfigText('');
      
      // 성공 알림
      console.log(`Role "${role.name}" saved successfully`);
      
      // JSON을 예쁘게 포맷팅해서 다시 설정
      setMcpConfigText(JSON.stringify(mcpConfig, null, 2));
    } catch (error) {
      console.error('Error saving role:', error);
      alert('역할 저장 중 오류가 발생했습니다. MCP 설정이 올바른 JSON 형식인지 확인해주세요.');
    }
  };

  const handleDeleteRole = async (roleId: string) => {
    if (confirm('이 역할을 삭제하시겠습니까?')) {
      try {
        await mcpDB.deleteRole(roleId);
        await loadRoles();
      } catch (error) {
        console.error('Error deleting role:', error);
        alert('역할 삭제 중 오류가 발생했습니다.');
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
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gray-700 rounded-lg w-[90%] max-w-6xl h-[80%] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-gray-700">
          <h2 className="text-green-400 font-bold text-lg">Role Management</h2>
          <button 
            onClick={onClose} 
            className="text-gray-500 hover:text-green-400 text-xl px-2"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Role List */}
          <div className="w-1/3 border-r border-gray-700 p-4 overflow-y-auto">
            <button 
              onClick={handleCreateNew}
              className="w-full bg-green-900/20 border border-green-400 text-green-400 p-3 rounded mb-4 hover:bg-green-900/40 transition-colors"
            >
              + 새 역할 만들기
            </button>
            
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
                      <span className="text-yellow-400 text-xs bg-yellow-900/20 px-1 rounded">
                        DEFAULT
                      </span>
                    )}
                    {currentRole?.id === role.id && (
                      <span className="text-blue-400 text-xs bg-blue-900/20 px-1 rounded">
                        ACTIVE
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-gray-400 text-sm mb-3 line-clamp-2">
                  {role.systemPrompt}
                </p>
                <div className="text-xs text-gray-500 mb-2">
                  MCP 서버: {role.mcpConfig.servers.length}개
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => onRoleSelect(role)}
                    className="text-xs text-green-400 hover:text-green-300 underline"
                  >
                    선택
                  </button>
                  <button 
                    onClick={() => handleEditRole(role)}
                    className="text-xs text-blue-400 hover:text-blue-300 underline"
                  >
                    편집
                  </button>
                  {!role.isDefault && (
                    <button 
                      onClick={() => handleDeleteRole(role.id)}
                      className="text-xs text-red-400 hover:text-red-300 underline"
                    >
                      삭제
                    </button>
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
                <div>
                  <label className="block text-gray-400 mb-2 font-medium">역할 이름 *</label>
                  <input
                    type="text"
                    value={editingRole?.name || ''}
                    onChange={(e) => setEditingRole(prev => ({...prev, name: e.target.value}))}
                    className="w-full bg-gray-800 border border-gray-600 p-3 rounded text-green-400 focus:border-green-400 focus:outline-none"
                    placeholder="역할 이름을 입력하세요..."
                  />
                </div>
                
                <div>
                  <label className="block text-gray-400 mb-2 font-medium">시스템 프롬프트 *</label>
                  <textarea
                    value={editingRole?.systemPrompt || ''}
                    onChange={(e) => setEditingRole(prev => ({...prev, systemPrompt: e.target.value}))}
                    className="w-full bg-gray-800 border border-gray-600 p-3 rounded text-green-400 h-32 focus:border-green-400 focus:outline-none resize-none"
                    placeholder="AI가 수행할 역할과 행동 방식을 설명하세요..."
                  />
                </div>
                
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-gray-400 font-medium">
                      MCP 설정 (JSON)
                      <span className="text-xs text-gray-500 ml-2">
                        - 연결할 MCP 서버들을 설정합니다
                      </span>
                    </label>
                    <button
                      type="button"
                      onClick={handleFormatJson}
                      className="text-xs text-blue-400 hover:text-blue-300 underline"
                    >
                      Format JSON
                    </button>
                  </div>
                  <textarea
                    value={mcpConfigText}
                    onChange={(e) => setMcpConfigText(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-600 p-3 rounded text-green-400 h-48 font-mono text-sm focus:border-green-400 focus:outline-none resize-none"
                    placeholder={`{
  "servers": [
    {
      "name": "filesystem",
      "command": "mcp-server-filesystem",
      "args": ["/path/to/directory"],
      "env": {}
    }
  ]
}`}
                  />
                  <div className="text-xs text-gray-500 mt-1">
                    * JSON 형식으로 MCP 서버 설정을 입력하세요. 빈 배열로 두면 MCP 서버를 사용하지 않습니다.
                  </div>
                </div>
              </div>
              
              <div className="flex gap-3 mt-6 pt-4 border-t border-gray-700">
                <button 
                  onClick={handleSaveRole}
                  className="bg-green-900/20 border border-green-400 text-green-400 px-6 py-2 rounded hover:bg-green-900/40 transition-colors"
                >
                  저장
                </button>
                <button 
                  onClick={handleCancel}
                  className="bg-gray-800 border border-gray-600 text-gray-400 px-6 py-2 rounded hover:bg-gray-700 transition-colors"
                >
                  취소
                </button>
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
      </div>
    </div>
  );
}
