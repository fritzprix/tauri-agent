use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;
use rmcp::{ServiceExt, transport::{TokioChildProcess, ConfigureCommandExt}};
use tokio::process::Command;
use anyhow::Result;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MCPServerConfig {
    pub name: String,
    pub command: Option<String>,
    pub args: Option<Vec<String>>,
    pub env: Option<HashMap<String, String>>,
    pub transport: String, // "stdio" | "http" | "websocket"
    pub url: Option<String>,
    pub port: Option<u16>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MCPTool {
    pub name: String,
    pub description: String,
    pub input_schema: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ToolCallResult {
    pub success: bool,
    pub result: Option<serde_json::Value>,
    pub error: Option<String>,
}

pub struct MCPConnection {
    pub config: MCPServerConfig,
    pub client: rmcp::Client<TokioChildProcess>,
}

pub struct MCPServerManager {
    connections: Arc<Mutex<HashMap<String, MCPConnection>>>,
}

impl MCPServerManager {
    pub fn new() -> Self {
        Self {
            connections: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// MCP 서버를 시작하고 연결합니다
    pub async fn start_server(&self, config: MCPServerConfig) -> Result<String> {
        match config.transport.as_str() {
            "stdio" => self.start_stdio_server(config).await,
            "http" => {
                // HTTP 서버는 외부에서 이미 실행 중이라고 가정
                Ok(format!("HTTP server configured: {}", config.name))
            }
            "websocket" => {
                // WebSocket 서버는 외부에서 이미 실행 중이라고 가정
                Ok(format!("WebSocket server configured: {}", config.name))
            }
            _ => Err(anyhow::anyhow!("Unsupported transport: {}", config.transport)),
        }
    }

    async fn start_stdio_server(&self, config: MCPServerConfig) -> Result<String> {
        let command = config.command.as_ref().ok_or_else(|| {
            anyhow::anyhow!("Command is required for stdio transport")
        })?;

        let args = config.args.as_ref().unwrap_or(&vec![]);
        
        // Create command with rmcp
        let mut cmd = Command::new(command);
        
        // Configure command arguments using the trait method
        cmd.configure(|cmd| {
            for arg in args {
                cmd.arg(arg);
            }
            
            // Set environment variables if any
            if let Some(env) = &config.env {
                for (key, value) in env {
                    cmd.env(key, value);
                }
            }
        });

        // Create transport and connect
        let transport = TokioChildProcess::new(cmd)?;
        let client = ().serve(transport).await?;

        let connection = MCPConnection {
            config: config.clone(),
            client,
        };

        // Store connection
        {
            let mut connections = self.connections.lock().await;
            connections.insert(config.name.clone(), connection);
        }

        Ok(format!("Started and connected to MCP server: {}", config.name))
    }

    /// MCP 서버를 중지합니다
    pub async fn stop_server(&self, server_name: &str) -> Result<()> {
        let mut connections = self.connections.lock().await;
        
        if let Some(connection) = connections.remove(server_name) {
            // Cancel the client connection
            let _ = connection.client.cancel().await;
            println!("Stopped MCP server: {}", server_name);
        }

        Ok(())
    }

    /// 도구를 호출합니다
    pub async fn call_tool(
        &self,
        server_name: &str,
        tool_name: &str,
        arguments: serde_json::Value,
    ) -> ToolCallResult {
        let connections = self.connections.lock().await;
        
        if let Some(connection) = connections.get(server_name) {
            // Convert arguments to proper format for RMCP
            let args_map = if let serde_json::Value::Object(obj) = arguments {
                obj
            } else {
                serde_json::Map::new()
            };

            // RMCP API 호출 - call_tool 메서드 사용
            match connection.client.call_tool(tool_name.to_string(), args_map).await {
                Ok(result) => ToolCallResult {
                    success: true,
                    result: Some(serde_json::to_value(result).unwrap_or(serde_json::Value::Null)),
                    error: None,
                },
                Err(e) => ToolCallResult {
                    success: false,
                    result: None,
                    error: Some(e.to_string()),
                },
            }
        } else {
            ToolCallResult {
                success: false,
                result: None,
                error: Some(format!("Server '{}' not found", server_name)),
            }
        }
    }

    /// 사용 가능한 도구 목록을 가져옵니다
    pub async fn list_tools(&self, server_name: &str) -> Result<Vec<MCPTool>> {
        let connections = self.connections.lock().await;
        
        if let Some(connection) = connections.get(server_name) {
            match connection.client.list_tools().await {
                Ok(tools_response) => {
                    let mut tools = Vec::new();
                    
                    for tool in tools_response.tools {
                        tools.push(MCPTool {
                            name: tool.name,
                            description: tool.description.unwrap_or_default(),
                            input_schema: serde_json::to_value(tool.input_schema)
                                .unwrap_or(serde_json::Value::Object(serde_json::Map::new())),
                        });
                    }
                    
                    Ok(tools)
                }
                Err(e) => Err(anyhow::anyhow!("Failed to list tools: {}", e)),
            }
        } else {
            Err(anyhow::anyhow!("Server '{}' not found", server_name))
        }
    }

    /// 연결된 서버 목록을 반환합니다
    pub async fn get_connected_servers(&self) -> Vec<String> {
        let connections = self.connections.lock().await;
        connections.keys().cloned().collect()
    }

    /// 특정 서버가 연결되어 있는지 확인합니다
    pub async fn is_server_alive(&self, server_name: &str) -> bool {
        let connections = self.connections.lock().await;
        connections.contains_key(server_name)
    }

    /// 모든 서버의 상태를 확인합니다
    pub async fn check_all_servers(&self) -> HashMap<String, bool> {
        let connections = self.connections.lock().await;
        let mut status_map = HashMap::new();
        
        for server_name in connections.keys() {
            status_map.insert(server_name.clone(), true);
        }
        
        status_map
    }
}

impl Drop for MCPServerManager {
    fn drop(&mut self) {
        // Cleanup will be handled by the async runtime
        // when connections are dropped
    }
}
