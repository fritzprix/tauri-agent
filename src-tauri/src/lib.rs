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
    let servers_config = if let Some(mcp_servers) = config.get("mcpServers").and_then(|v| v.as_object()) {
        // Claude format: mcpServers 객체를 MCPServerConfig 배열로 변환
        println!("🚀 [TAURI] Processing Claude format (mcpServers)");
        let mut server_list = Vec::new();
        
        for (name, server_config) in mcp_servers.iter() {
            let mut server_value = server_config.clone();
            // name 필드 추가
            if let serde_json::Value::Object(ref mut obj) = server_value {
                obj.insert("name".to_string(), serde_json::Value::String(name.clone()));
                obj.insert("transport".to_string(), serde_json::Value::String("stdio".to_string()));
            }
            let server_cfg: mcp::MCPServerConfig = serde_json::from_value(server_value)
                .map_err(|e| format!("Invalid server config: {}", e))?;
            server_list.push(server_cfg);
        }
        server_list
    } else if let Some(servers_array) = config.get("servers").and_then(|v| v.as_array()) {
        // 기존 format: servers 배열
        println!("🚀 [TAURI] Processing legacy format (servers array)");
        let mut server_list = Vec::new();
        for server_value in servers_array {
            let server_cfg: mcp::MCPServerConfig = serde_json::from_value(server_value.clone())
                .map_err(|e| format!("Invalid server config: {}", e))?;
            server_list.push(server_cfg);
        }
        server_list
    } else {
        return Err("Invalid config: missing mcpServers object or servers array".to_string());
    };

    println!("🚀 [TAURI] Found {} servers in config", servers_config.len());

    let manager = get_mcp_manager();

    // Start all servers from the config
    for server_cfg in servers_config {
        let server_name = server_cfg.name.clone();
        if !manager.is_server_alive(&server_name).await {
            println!("🚀 [TAURI] Starting server: {}", server_name);
            if let Err(e) = manager.start_server(server_cfg).await {
                eprintln!("❌ [TAURI] Failed to start server {}: {}", server_name, e);
            }
            tokio::time::sleep(tokio::time::Duration::from_millis(1000)).await;
        } else {
            println!("🚀 [TAURI] Server {} already running", server_name);
        }
    }

    // Get all tools from all connected servers (which now have prefixed names)
    match manager.list_all_tools().await {
        Ok(tools) => {
            println!("✅ [TAURI] Total tools collected: {}", tools.len());
            Ok(tools)
        }
        Err(e) => {
            eprintln!("❌ [TAURI] Error listing all tools: {}", e);
            Err(e.to_string())
        }
    }
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
