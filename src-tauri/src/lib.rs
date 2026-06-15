// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
async fn start_oauth_server(app: tauri::AppHandle, port: u16) -> Result<(), String> {
    use std::io::{Read, Write};
    let listener = std::net::TcpListener::bind(format!("127.0.0.1:{}", port))
        .map_err(|e| e.to_string())?;
    
    tauri::async_runtime::spawn(async move {
        use tauri::Emitter;
        if let Ok((mut stream, _)) = listener.accept() {
            let mut buffer = [0; 2048];
            if stream.read(&mut buffer).is_ok() {
                let request = String::from_utf8_lossy(&buffer);
                if let Some(line) = request.lines().next() {
                    let parts: Vec<&str> = line.split_whitespace().collect();
                    if parts.len() > 1 {
                        let url = parts[1];
                        let _ = app.emit("oauth_callback", url.to_string());
                    }
                }
                
                let response = "HTTP/1.1 200 OK\r\nContent-Type: text/html\r\n\r\n\
                    <html><head><style>\
                    body { font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; background: #03000a; color: white; }\
                    h1 { color: #10b981; }\
                    </style></head><body>\
                    <h1>Authentication Successful!</h1>\
                    <p>You can securely close this tab and return to Aether Music Player.</p>\
                    <script>setTimeout(() => window.close(), 1000)</script>\
                    </body></html>";
                let _ = stream.write_all(response.as_bytes());
            }
        }
    });
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet, start_oauth_server])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
