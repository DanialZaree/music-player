use rusty_ytdl::{Video, VideoOptions, VideoSearchOptions, VideoQuality};

#[tokio::main]
async fn main() {
    let video_options = VideoOptions {
        quality: VideoQuality::HighestAudio,
        filter: VideoSearchOptions::Audio,
        ..Default::default()
    };
    let video = Video::new_with_options("FhF9RwkHAJw", video_options).unwrap();
    let info = video.get_info().await.unwrap();
    for f in info.formats {
        println!("container: {}, codecs: {:?}, bitrate: {}", f.mime_type.container, f.mime_type.codecs, f.bitrate);
    }
}
