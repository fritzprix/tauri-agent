use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;
use rmcp::{ServiceExt, transport::{TokioChildProcess, ConfigureCommandExt}, model::CallToolRequestParam, service::{RoleClient, RunningService}};
use tokio::process::Command;
use anyhow::Result;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MCPServerConfig {
    pub name: String,
    pub command: Option<String>,
    pub args: Option<Vec<String>>,
    pub env: Option<HashMap<String, String>>,
    #[serde(default = "default_transport")]
    pub transport: String, // "stdio" | "http" | "websocket"
    pub url: Option<String>,
    pub port: Option<u16>,
}

fn default_transport() -> String {
    "stdio".to_string()
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
    pub client: RunningService<RoleClient, ()>,
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

        let default_args = vec![];
        let args = config.args.as_ref().unwrap_or(&default_args);
        
        // Create command with rmcp - configure returns the modified command
        let cmd = Command::new(command).configure(|cmd| {
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

        // Create transport and connect using RMCP pattern
        let transport = TokioChildProcess::new(cmd)?;
        println!("Created transport for command: {} {:?}", command, args);
        
        let client = ().serve(transport).await?;
        println!("Successfully connected to MCP server: {}", config.name);

        let connection = MCPConnection {
            client,
        };

        // Store connection
        {
            let mut connections = self.connections.lock().await;
            connections.insert(config.name.clone(), connection);
            println!("Stored connection for server: {}", config.name);
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
            // RMCP API 사용 - CallToolRequestParam 구조체 사용
            let args_map = if let serde_json::Value::Object(obj) = arguments {
                obj
            } else {
                serde_json::Map::new()
            };

            let call_param = CallToolRequestParam {
                name: tool_name.to_string().into(),
                arguments: Some(args_map),
            };

            match connection.client.call_tool(call_param).await {
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
            println!("Found connection for server: {}", server_name);
            // RMCP API 사용 - list_all_tools 메서드 사용
            match connection.client.list_all_tools().await {
                Ok(tools_response) => {
                    println!("Raw tools response: {:?}", tools_response);
                    let mut tools = Vec::new();
                    
                    // tools_response는 이미 Vec<Tool>이므로 직접 iterate
                    for tool in tools_response {
                        println!("Processing tool: {:?}", tool);
                        tools.push(MCPTool {
                            name: tool.name.to_string(),
                            description: tool.description.unwrap_or_default().to_string(),
                            input_schema: serde_json::to_value(tool.input_schema)
                                .unwrap_or(serde_json::Value::Object(serde_json::Map::new())),
                        });
                    }
                    
                    println!("Converted {} tools", tools.len());
                    Ok(tools)
                }
                Err(e) => {
                    println!("Error listing tools: {}", e);
                    Err(anyhow::anyhow!("Failed to list tools: {}", e))
                }
            }
        } else {
            println!("Server '{}' not found in connections", server_name);
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
