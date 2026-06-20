#[tokio::main]
async fn main() {
    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36")
        .build()
        .unwrap();
    
    let instances = [
        "https://pipedapi.smnz.de",
        "https://pipedapi.drgns.space",
        "https://pipedapi.adminforge.de",
        "https://pipedapi.moomoo.me",
    ];

    for instance in &instances {
        let url = format!("{}/streams/eJO5HU_7_1w", instance);
        let resp = match client.get(&url).send().await {
            Ok(r) => r,
            Err(e) => {
                println!("{} -> ERROR: {}", instance, e);
                continue;
            }
        };
        println!("{} -> {}", instance, resp.status());
        if resp.status().is_success() {
            let body = resp.text().await.unwrap_or_default();
            println!("Contains audioStreams? {}", body.contains("audioStreams"));
        }
    }
}
