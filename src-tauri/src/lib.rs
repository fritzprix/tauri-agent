use std::sync::OnceLock;
use tauri_plugin_log::{Target, TargetKind};

mod mcp;
use mcp::{MCPServerConfig, MCPServerManager, ToolCallResult};

// 전역 MCP 서버 매니저
static MCP_MANAGER: OnceLock<MCPServerManager> = OnceLock::new();

fn get_mcp_manager() -> &'static MCPServerManager {
    MCP_MANAGER.get_or_init(|| MCPServerManager::new())
}

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
async fn start_mcp_server(config: MCPServerConfig) -> Result<String, String> {
    get_mcp_manager()
        .start_server(config)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn stop_mcp_server(server_name: String) -> Result<(), String> {
    get_mcp_manager()
        .stop_server(&server_name)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn call_mcp_tool(
    server_name: String,
    tool_name: String,
    arguments: serde_json::Value,
) -> ToolCallResult {
    get_mcp_manager()
        .call_tool(&server_name, &tool_name, arguments)
        .await
}

#[tauri::command]
async fn list_mcp_tools(server_name: String) -> Result<Vec<mcp::MCPTool>, String> {
    get_mcp_manager()
        .list_tools(&server_name)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn list_tools_from_config(config: serde_json::Value) -> Result<Vec<mcp::MCPTool>, String> {
    println!("🚀 [TAURI] list_tools_from_config called!");
    println!(
        "🚀 [TAURI] Config received: {}",
        serde_json::to_string_pretty(&config).unwrap_or_default()
    );

    // Claude format을 지원: mcpServers 또는 servers 배열을 처리
    let servers = if let Some(mcp_servers) = config.get("mcpServers").and_then(|v| v.as_object()) {
        // Claude format: mcpServers 객체를 servers 배열로 변환
        println!("🚀 [TAURI] Processing Claude format (mcpServers)");
        let mut server_list = Vec::new();
        
        for (name, server_config) in mcp_servers.iter() {
            let mut server_value = server_config.clone();
            // name 필드 추가
            if let serde_json::Value::Object(ref mut obj) = server_value {
                obj.insert("name".to_string(), serde_json::Value::String(name.clone()));
                obj.insert("transport".to_string(), serde_json::Value::String("stdio".to_string()));
            }
            server_list.push(server_value);
        }
        server_list
    } else if let Some(servers_array) = config.get("servers").and_then(|v| v.as_array()) {
        // 기존 format: servers 배열
        println!("🚀 [TAURI] Processing legacy format (servers array)");
        servers_array.clone()
    } else {
        return Err("Invalid config: missing mcpServers object or servers array".to_string());
    };

    println!("🚀 [TAURI] Found {} servers in config", servers.len());

    let mut all_tools = Vec::new();

    for (i, server_value) in servers.iter().enumerate() {
        println!("🚀 [TAURI] Processing server {}: {:?}", i + 1, server_value);

        // 서버 설정을 파싱
        let mut server_config: mcp::MCPServerConfig = serde_json::from_value(server_value.clone())
            .map_err(|e| format!("Invalid server config: {}", e))?;

        // transport가 기본값이고 command가 있으면 더 정확한 값으로 설정
        if server_config.transport == "stdio" {
            if let Some(command) = &server_config.command {
                server_config.transport = match command.as_str() {
                    "npx" | "node" | "python" | "python3" => "stdio".to_string(),
                    _ => "stdio".to_string(),
                };
            }
        }

        let server_name = server_config.name.clone();
        println!(
            "🚀 [TAURI] Server: {} (command: {:?}, transport: {})",
            server_name, server_config.command, server_config.transport
        );

        // 서버가 이미 실행 중인지 확인
        let manager = get_mcp_manager();
        if !manager.is_server_alive(&server_name).await {
            println!("🚀 [TAURI] Starting server: {}", server_name);
            // 서버 시작
            if let Err(e) = manager.start_server(server_config).await {
                eprintln!("❌ [TAURI] Failed to start server {}: {}", server_name, e);
                continue;
            }

            // 서버 시작 후 잠시 대기 (초기화를 위해)
            tokio::time::sleep(tokio::time::Duration::from_millis(1000)).await;
        } else {
            println!("🚀 [TAURI] Server {} already running", server_name);
        }

        // 서버별 도구 목록 가져오기
        println!("🚀 [TAURI] Getting tools from server: {}", server_name);
        match manager.list_tools(&server_name).await {
            Ok(tools) => {
                println!(
                    "✅ [TAURI] Got {} tools from server {}",
                    tools.len(),
                    server_name
                );
                all_tools.extend(tools);
            }
            Err(e) => {
                eprintln!(
                    "❌ [TAURI] Error getting tools for server {}: {}",
                    server_name, e
                );
            }
        }
    }

    println!("🚀 [TAURI] Total tools collected: {}", all_tools.len());
    Ok(all_tools)
}

#[tauri::command]
async fn get_connected_servers() -> Vec<String> {
    get_mcp_manager().get_connected_servers().await
}

#[tauri::command]
async fn check_server_status(server_name: String) -> bool {
    get_mcp_manager().is_server_alive(&server_name).await
}

#[tauri::command]
async fn check_all_servers_status() -> std::collections::HashMap<String, bool> {
    get_mcp_manager().check_all_servers().await
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_log::Builder::new()
                .targets([
                    Target::new(TargetKind::Stdout),
                    Target::new(TargetKind::LogDir { file_name: None }),
                    Target::new(TargetKind::Webview),
                ])
                .build(),
        )
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            start_mcp_server,
            stop_mcp_server,
            call_mcp_tool,
            list_mcp_tools,
            list_tools_from_config,
            get_connected_servers,
            check_server_status,
            check_all_servers_status
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
