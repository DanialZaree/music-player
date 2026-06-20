import YTMusic from "ytmusic-api";

async function run() {
  const ytmusic = new YTMusic();
  await ytmusic.initialize();
  const songs = await ytmusic.searchSongs("Never gonna give you up");
  console.log(songs[0]);
}
run();
