use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;
use tokio::process::{Child, Command};
use std::process::Stdio;

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

pub struct MCPServerManager {
    processes: Arc<Mutex<HashMap<String, Child>>>,
}

impl MCPServerManager {
    pub fn new() -> Self {
        Self {
            processes: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// MCP 서버를 시작합니다
    pub async fn start_server(&self, config: MCPServerConfig) -> anyhow::Result<String> {
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

    async fn start_stdio_server(&self, config: MCPServerConfig) -> anyhow::Result<String> {
        let command = config.command.as_ref().ok_or_else(|| {
            anyhow::anyhow!("Command is required for stdio transport")
        })?;

        let default_args = vec![];
        let args = config.args.as_ref().unwrap_or(&default_args);
        
        let mut cmd = Command::new(command);
        for arg in args {
            cmd.arg(arg);
        }
        
        cmd.stdin(Stdio::piped())
           .stdout(Stdio::piped())
           .stderr(Stdio::piped());
        
        // 환경 변수 설정
        if let Some(env) = &config.env {
            for (key, value) in env {
                cmd.env(key, value);
            }
        }

        let process = cmd.spawn()?;

        // 프로세스 저장
        {
            let mut processes = self.processes.lock().await;
            processes.insert(config.name.clone(), process);
        }

        Ok(format!("Started MCP server: {}", config.name))
    }

    /// MCP 서버를 중지합니다
    pub async fn stop_server(&self, server_name: &str) -> anyhow::Result<()> {
        let process_option = {
            let mut processes = self.processes.lock().await;
            processes.remove(server_name)
        };
        
        if let Some(mut process) = process_option {
            process.kill().await?;
            process.wait().await?;
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
        let processes = self.processes.lock().await;
        if !processes.contains_key(server_name) {
            return ToolCallResult {
                success: false,
                result: None,
                error: Some(format!("Server '{}' not found", server_name)),
            }
        }

        // TODO: 실제 MCP 프로토콜 통신 구현
        // 현재는 Mock 응답
        ToolCallResult {
            success: true,
            result: Some(serde_json::json!({
                "server": server_name,
                "tool": tool_name,
                "arguments": arguments,
                "response": "Tool executed successfully"
            })),
            error: None,
        }
    }

    /// 사용 가능한 도구 목록을 가져옵니다
    pub async fn list_tools(&self, server_name: &str) -> anyhow::Result<Vec<MCPTool>> {
        let processes = self.processes.lock().await;
        if !processes.contains_key(server_name) {
            return Err(anyhow::anyhow!("Server '{}' not found", server_name));
        }

        // TODO: 실제 MCP 프로토콜로 도구 목록 가져오기
        // 현재는 Mock 데이터
        let tools = match server_name {
            "sequential-thinking" => vec![
                MCPTool {
                    name: "thinking".to_string(),
                    description: "Enable step-by-step reasoning for complex problems".to_string(),
                    input_schema: serde_json::json!({
                        "type": "object",
                        "properties": {
                            "query": {
                                "type": "string",
                                "description": "The problem to think through"
                            }
                        },
                        "required": ["query"]
                    }),
                },
            ],
            _ => vec![]
        };

        Ok(tools)
    }

    /// 연결된 서버 목록을 반환합니다
    pub fn get_connected_servers(&self) -> Vec<String> {
        // 현재는 동기적으로 처리하기 위해 try_lock 사용
        if let Ok(clients) = self.clients.try_lock() {
            clients.keys().cloned().collect()
        } else {
            vec![]
        }
    }

    /// 특정 서버의 프로세스가 살아있는지 확인합니다
    pub fn is_server_alive(&self, server_name: &str) -> bool {
        if let Ok(clients) = self.clients.try_lock() {
            clients.contains_key(server_name)
        } else {
            false
        }
    }

    /// 모든 서버의 상태를 확인합니다
    pub fn check_all_servers(&self) -> HashMap<String, bool> {
        if let Ok(clients) = self.clients.try_lock() {
            clients.keys().map(|name| (name.clone(), true)).collect()
        } else {
            HashMap::new()
        }
    }
}

impl Drop for MCPServerManager {
    fn drop(&mut self) {
        // 모든 클라이언트를 정리
        if let Ok(mut clients) = self.clients.try_lock() {
            for (name, client) in clients.drain() {
                let rt = tokio::runtime::Handle::try_current();
                if let Ok(handle) = rt {
                    handle.spawn(async move {
                        if let Err(e) = client.cancel().await {
                            eprintln!("Failed to stop MCP server {}: {}", name, e);
                        }
                    });
                }
            }
        }
    }
}
