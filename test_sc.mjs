const CLIENT_ID = 'iErh0hlIS7lC1NEeRzcimBG8NFFF045C';

// Try an indie track instead (more likely to be unencrypted)
const res = await fetch(`https://api-v2.soundcloud.com/search/tracks?q=lofi+hip+hop&client_id=${CLIENT_ID}&limit=10`);
const data = await res.json();

for (const track of data.collection) {
  const transcodings = track.media?.transcodings ?? [];
  const progressive = transcodings.find(t => t.format.protocol === 'progressive');
  if (progressive) {
    console.log('FOUND PROGRESSIVE TRACK:', track.title, '-', track.user?.username, 'Duration:', Math.floor(track.duration/1000), 's');
    const sr = await fetch(`${progressive.url}?client_id=${CLIENT_ID}`);
    const sd = await sr.json();
    console.log('Stream URL:', sd.url?.substring(0, 120));
    break;
  }
}
