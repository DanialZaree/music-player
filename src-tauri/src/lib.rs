// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/

use std::sync::Arc;
use tokio::sync::Mutex;

/// Shared state for the audio streaming proxy.
struct AudioProxy {
    abort_handle: Option<tokio::task::AbortHandle>,
}

impl Default for AudioProxy {
    fn default() -> Self {
        Self { abort_handle: None }
    }
}

type AudioProxyState = Mutex<AudioProxy>;

// ---------------------------------------------------------------------------
// OAuth helper
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Invidious audio URL (fetched via Rust — no CORS)
// ---------------------------------------------------------------------------

/// Fetch the best audio URL for a videoId from Invidious instances.
/// This runs entirely in Rust so it's immune to browser CORS and Tracking Prevention.
#[tauri::command]
async fn get_invidious_audio_url(video_id: String) -> Result<String, String> {
    let instances = [
        "https://inv.thepixora.com",
        "https://invidious.privacydev.net",
        "https://invidious.fdn.fr",
        "https://invidious.tiekoetter.com",
        "https://invidious.io",
        "https://vid.priv.au",
        "https://invidious.perennialte.ch",
    ];

    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36")
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| e.to_string())?;

    let mut set = tokio::task::JoinSet::new();

    for instance in instances {
        let client_clone = client.clone();
        let vid = video_id.clone();
        set.spawn(async move {
            let url = format!("{}/api/v1/videos/{}?fields=adaptiveFormats", instance, vid);
            let resp = client_clone.get(&url).header("Accept", "application/json").send().await.map_err(|_| ())?;
            if !resp.status().is_success() { return Err(()); }
            
            let data: serde_json::Value = resp.json().await.map_err(|_| ())?;
            let formats = data["adaptiveFormats"].as_array().ok_or(())?;
            if formats.is_empty() { return Err(()); }

            let best = formats.iter()
                .filter(|f| {
                    let t = f["type"].as_str().unwrap_or("");
                    t.contains("audio") && f["url"].as_str().is_some()
                })
                .max_by_key(|f| f["bitrate"].as_u64().unwrap_or(0))
                .ok_or(())?;

            let audio_url = best["url"].as_str().ok_or(())?;
            Ok::<(&'static str, String), ()>((instance, audio_url.to_string()))
        });
    }

    while let Some(res) = set.join_next().await {
        if let Ok(Ok((instance, audio_url))) = res {
            println!("[Rust] Got audio URL via {}", instance);
            set.abort_all();
            return Ok(audio_url);
        }
    }

    Err("All Invidious instances failed to return an audio URL".to_string())
}

// ---------------------------------------------------------------------------
// Local streaming proxy (forwards requests to YouTube CDN with proper headers)
// ---------------------------------------------------------------------------

/// Start a local TCP streaming proxy for the given audio URL.
/// Returns the localhost port number.
/// The audio element connects to http://localhost:{port}/ which is never
/// blocked by Tracking Prevention, and the proxy forwards range requests
/// to YouTube CDN with proper browser headers.
#[tauri::command]
async fn start_audio_proxy(
    url: String,
    state: tauri::State<'_, AudioProxyState>,
) -> Result<u16, String> {
    use tokio::net::TcpListener;
    use tokio::io::{AsyncReadExt, AsyncWriteExt};

    // Abort previous proxy if running
    {
        let mut proxy = state.lock().await;
        if let Some(handle) = proxy.abort_handle.take() {
            handle.abort();
        }
    }

    let listener = TcpListener::bind("127.0.0.1:0").await.map_err(|e| e.to_string())?;
    let port = listener.local_addr().map_err(|e| e.to_string())?.port();
    let url = Arc::new(url);

    let task = tokio::task::spawn(async move {
        loop {
            let Ok((mut socket, _)) = listener.accept().await else { continue };
            let url = Arc::clone(&url);

            tokio::spawn(async move {
                let mut buf = vec![0u8; 8192];
                let n = match socket.read(&mut buf).await {
                    Ok(n) if n > 0 => n,
                    _ => return,
                };
                let request = String::from_utf8_lossy(&buf[..n]);

                // Parse Range header for seeking support
                let range = request.lines()
                    .find(|l| l.to_lowercase().starts_with("range:"))
                    .map(|l| l[6..].trim().to_string());

                // Build proxied request to YouTube CDN
                let client = reqwest::Client::builder()
                    .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36")
                    .build()
                    .unwrap();

                let mut req = client.get(url.as_str())
                    .header("Accept", "*/*")
                    .header("Referer", "https://www.youtube.com/")
                    .header("Origin", "https://www.youtube.com")
                    .header("Connection", "keep-alive");

                if let Some(ref range_val) = range {
                    req = req.header("Range", range_val);
                }

                let resp = match req.send().await {
                    Ok(r) => r,
                    Err(e) => {
                        let msg = format!("HTTP/1.1 502 Bad Gateway\r\nContent-Length: {0}\r\n\r\n{1}", e.to_string().len(), e);
                        let _ = socket.write_all(msg.as_bytes()).await;
                        return;
                    }
                };

                let status = resp.status().as_u16();
                let content_type = resp.headers()
                    .get("content-type")
                    .and_then(|v| v.to_str().ok())
                    .unwrap_or("audio/webm")
                    .to_string();
                let content_length = resp.headers()
                    .get("content-length")
                    .and_then(|v| v.to_str().ok())
                    .map(|s| s.to_string());
                let content_range = resp.headers()
                    .get("content-range")
                    .and_then(|v| v.to_str().ok())
                    .map(|s| s.to_string());

                let bytes = match resp.bytes().await {
                    Ok(b) => b,
                    Err(_) => return,
                };

                let mut headers = format!(
                    "HTTP/1.1 {}\r\nContent-Type: {}\r\nAccess-Control-Allow-Origin: *\r\nAccept-Ranges: bytes\r\n",
                    status, content_type
                );
                headers.push_str(&format!("Content-Length: {}\r\n", content_length.as_deref().unwrap_or(&bytes.len().to_string())));
                if let Some(cr) = content_range {
                    headers.push_str(&format!("Content-Range: {}\r\n", cr));
                }
                headers.push_str("\r\n");

                let _ = socket.write_all(headers.as_bytes()).await;
                let _ = socket.write_all(&bytes).await;
            });
        }
    });

    {
        let mut proxy = state.lock().await;
        proxy.abort_handle = Some(task.abort_handle());
    }

    Ok(port)
}

// ---------------------------------------------------------------------------
// YouTube search via rusty_ytdl
// ---------------------------------------------------------------------------

#[derive(serde::Serialize)]
struct YTTrack {
    id: String,
    title: String,
    artist: String,
    album: String,
    duration: u64,
    #[serde(rename = "coverUrl")]
    cover_url: String,
    #[serde(rename = "previewUrl")]
    preview_url: Option<String>,
}

#[tauri::command]
async fn search_youtube_music(query: String) -> Result<Vec<YTTrack>, String> {
    use rusty_ytdl::search::{YouTube, SearchOptions, SearchType};

    let yt = YouTube::new().map_err(|e| e.to_string())?;

    let options = SearchOptions {
        search_type: SearchType::Video,
        limit: 15,
        ..Default::default()
    };

    let results = yt.search(query, Some(&options)).await.map_err(|e| e.to_string())?;

    let mut tracks = Vec::new();
    for res in results {
        if let rusty_ytdl::search::SearchResult::Video(v) = res {
            tracks.push(YTTrack {
                id: v.id.clone(),
                title: v.title.clone(),
                artist: v.channel.name.clone(),
                album: "YouTube".to_string(),
                duration: v.duration / 1000,
                cover_url: v.thumbnails.first().map(|t| t.url.clone()).unwrap_or_default(),
                preview_url: None,
            });
        }
    }

    Ok(tracks)
}

// ---------------------------------------------------------------------------
// App entry point
// ---------------------------------------------------------------------------

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AudioProxyState::default())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            start_oauth_server,
            get_invidious_audio_url,
            start_audio_proxy,
            search_youtube_music,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
