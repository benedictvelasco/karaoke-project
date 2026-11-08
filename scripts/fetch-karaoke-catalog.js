/**
 * scripts/fetch-karaoke-catalog.js
 * Queries LRCLIB API for a comprehensive list of OPM songs and All-Time Karaoke Hits,
 * verifies each song has time-synced lyrics, and writes the master catalog to public/songs.json.
 */

const fs = require('fs');
const path = require('path');

const CURATED_QUERIES = [
  // --- OPM Rock & Bands (90s / 2000s Videoke Staples) ---
  { q: 'Eraserheads Ang Huling El Bimbo', category: 'OPM Bands' },
  { q: 'Eraserheads Pare Ko', category: 'OPM Bands' },
  { q: 'Eraserheads With A Smile', category: 'OPM Bands' },
  { q: 'Eraserheads Magasin', category: 'OPM Bands' },
  { q: 'Eraserheads Alapaap', category: 'OPM Bands' },
  { q: 'Eraserheads Spoliarium', category: 'OPM Bands' },
  { q: 'Parokya Ni Edgar Harana', category: 'OPM Bands' },
  { q: 'Parokya Ni Edgar Gitara', category: 'OPM Bands' },
  { q: 'Parokya Ni Edgar Buloy', category: 'OPM Bands' },
  { q: 'Parokya Ni Edgar Halaga', category: 'OPM Bands' },
  { q: 'Parokya Ni Edgar Your Song', category: 'OPM Bands' },
  { q: 'Rivermaya 214', category: 'OPM Bands' },
  { q: 'Rivermaya Kisapmata', category: 'OPM Bands' },
  { q: 'Rivermaya Hinahanap Hanap Kita', category: 'OPM Bands' },
  { q: 'Rivermaya Youll Be Safe Here', category: 'OPM Bands' },
  { q: 'Kamikazee Narda', category: 'OPM Bands' },
  { q: 'Kamikazee Halik', category: 'OPM Bands' },
  { q: 'Mayonnaise Jopay', category: 'OPM Bands' },
  { q: 'Callalily Magbalik', category: 'OPM Bands' },
  { q: 'Hale The Day You Said Goodnight', category: 'OPM Bands' },
  { q: 'Sponge Cola Jeepney', category: 'OPM Bands' },
  { q: 'Sponge Cola Bitiw', category: 'OPM Bands' },
  { q: 'Sponge Cola Tuliro', category: 'OPM Bands' },
  { q: 'Cueshe Ulan', category: 'OPM Bands' },
  { q: '6cyclemind Sandalan', category: 'OPM Bands' },
  { q: '6cyclemind Prinsesa', category: 'OPM Bands' },
  { q: 'Siakol Laklak', category: 'OPM Bands' },
  { q: 'Parokya Ni Edgar Picha Pie', category: 'OPM Bands' },
  { q: 'Eraserheads Toyang', category: 'OPM Bands' },
  { q: 'Moonstar88 Torete', category: 'OPM Bands' },
  { q: 'Itchyworms Beer', category: 'OPM Bands' },
  { q: 'Orange and Lemons Hanggang Kailan', category: 'OPM Bands' },
  { q: 'Sugarfree Burnout', category: 'OPM Bands' },
  { q: 'Bamboo Hallelujah', category: 'OPM Bands' },
  { q: 'Bamboo Noypi', category: 'OPM Bands' },

  // --- OPM Modern & P-Pop / Indie Hits ---
  { q: 'IV of Spades Mundo', category: 'OPM Modern' },
  { q: 'Up Dharma Down Tadhana', category: 'OPM Modern' },
  { q: 'Up Dharma Down Oo', category: 'OPM Modern' },
  { q: 'Ben&Ben Kathang Isip', category: 'OPM Modern' },
  { q: 'Ben&Ben Pagtingin', category: 'OPM Modern' },
  { q: 'Ben&Ben Maybe The Night', category: 'OPM Modern' },
  { q: 'TJ Monterde Palagi', category: 'OPM Modern' },
  { q: 'Maki Dilaw', category: 'OPM Modern' },
  { q: 'Cup of Joe Tingin', category: 'OPM Modern' },
  { q: 'Zack Tabudlo Binibini', category: 'OPM Modern' },
  { q: 'Zack Tabudlo Pano', category: 'OPM Modern' },
  { q: 'Juan Karlos Buwan', category: 'OPM Modern' },
  { q: 'Juan Karlos Ere', category: 'OPM Modern' },
  { q: 'Lola Amour Raining in Manila', category: 'OPM Modern' },
  { q: 'Arthur Nery Pagsamo', category: 'OPM Modern' },
  { q: 'Adie Paraluman', category: 'OPM Modern' },
  { q: 'Nobita Ikaw Lang', category: 'OPM Modern' },
  { q: 'BINI Pantropiko', category: 'OPM Modern' },
  { q: 'BINI Salamin Salamin', category: 'OPM Modern' },

  // --- OPM Ballads & Hugot Classics ---
  { q: 'Silent Sanctuary Ikaw Lamang', category: 'OPM Ballads' },
  { q: 'Silent Sanctuary Kundiman', category: 'OPM Ballads' },
  { q: 'Silent Sanctuary Pasensya Ka Na', category: 'OPM Ballads' },
  { q: 'December Avenue Sa Ngalan Ng Pag-Ibig', category: 'OPM Ballads' },
  { q: 'December Avenue Kung Di Rin Lang Ikaw', category: 'OPM Ballads' },
  { q: 'Moira Dela Torre Tagpuan', category: 'OPM Ballads' },
  { q: 'Moira Dela Torre Paubaya', category: 'OPM Ballads' },
  { q: 'South Border Rainbow', category: 'OPM Ballads' },
  { q: 'Side A Forevermore', category: 'OPM Ballads' },
  { q: 'Freestyle Before I Let You Go', category: 'OPM Ballads' },
  { q: 'MYMP Tell Me Where It Hurts', category: 'OPM Ballads' },
  { q: 'Nina Someday', category: 'OPM Ballads' },
  { q: 'Kitchie Nadal Huwag Na Huwag Mong Sasabihin', category: 'OPM Ballads' },
  { q: 'Yeng Constantino Hawak Kamay', category: 'OPM Ballads' },
  { q: 'Sarah Geronimo Tala', category: 'OPM Ballads' },

  // --- All-Time Karaoke Hits (International Videoke Favorites) ---
  { q: 'Queen Bohemian Rhapsody', category: 'Karaoke Hits' },
  { q: 'Journey Dont Stop Believin', category: 'Karaoke Hits' },
  { q: 'Frank Sinatra My Way', category: 'Karaoke Hits' },
  { q: 'Bon Jovi Livin On A Prayer', category: 'Karaoke Hits' },
  { q: 'Oasis Wonderwall', category: 'Karaoke Hits' },
  { q: 'Backstreet Boys I Want It That Way', category: 'Karaoke Hits' },
  { q: 'ABBA Dancing Queen', category: 'Karaoke Hits' },
  { q: 'Air Supply All Out of Love', category: 'Karaoke Hits' },
  { q: 'Scorpions Wind of Change', category: 'Karaoke Hits' },
  { q: 'Eagles Hotel California', category: 'Karaoke Hits' },
  { q: 'Whitney Houston I Will Always Love You', category: 'Karaoke Hits' },
  { q: 'Celine Dion My Heart Will Go On', category: 'Karaoke Hits' },
  { q: 'Adele Someone Like You', category: 'Karaoke Hits' },
  { q: 'Adele Rolling in the Deep', category: 'Karaoke Hits' },
  { q: 'Bruno Mars Just The Way You Are', category: 'Karaoke Hits' },
  { q: 'Bruno Mars Versace on the Floor', category: 'Karaoke Hits' },
  { q: 'Taylor Swift Love Story', category: 'Karaoke Hits' },
  { q: 'Taylor Swift You Belong With Me', category: 'Karaoke Hits' },
  { q: 'Lady Gaga Bradley Cooper Shallow', category: 'Karaoke Hits' },
  { q: 'Ed Sheeran Perfect', category: 'Karaoke Hits' },
  { q: 'The Cranberries Zombie', category: 'Karaoke Hits' },
  { q: 'Coldplay Yellow', category: 'Karaoke Hits' },
  { q: 'My Chemical Romance Welcome to the Black Parade', category: 'Karaoke Hits' },
  { q: 'Linkin Park In The End', category: 'Karaoke Hits' }
];

function formatSeconds(sec) {
  if (!sec || Number.isNaN(sec)) return '3:30';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchOne(entry, attempt = 1) {
  try {
    const res = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(entry.q)}`, {
      headers: { 'User-Agent': 'RealtimeKaraokeApp/1.0' }
    });
    if (!res.ok) {
      if (attempt < 3) {
        await sleep(600 * attempt);
        return fetchOne(entry, attempt + 1);
      }
      return null;
    }
    const list = await res.json();
    if (!Array.isArray(list)) return null;

    const synced = list.find((t) => t.syncedLyrics && t.syncedLyrics.trim().length > 0);
    if (!synced) return null;

    const durationSec = Math.round(Number(synced.duration) || 210);
    const title = synced.trackName || synced.name;
    const artist = synced.artistName;

    return {
      id: `lrclib-${synced.id}`,
      lrclibId: synced.id,
      title,
      artist,
      category: entry.category,
      duration: formatSeconds(durationSec),
      durationSec,
      audioUrl: `/api/audio?title=${encodeURIComponent(title)}&artist=${encodeURIComponent(artist)}&duration=${durationSec}`,
      lyricsUrl: `/api/lyrics/${synced.id}?duration=${durationSec}`
    };
  } catch {
    if (attempt < 3) {
      await sleep(600 * attempt);
      return fetchOne(entry, attempt + 1);
    }
    return null;
  }
}

async function main() {
  const catalog = [];
  const seenIds = new Set();

  // Process in small batches of 4 with a short delay to avoid rate limits
  for (let i = 0; i < CURATED_QUERIES.length; i += 4) {
    const batch = CURATED_QUERIES.slice(i, i + 4);
    const results = await Promise.all(batch.map((item) => fetchOne(item)));
    for (const item of results) {
      if (item && !seenIds.has(item.id)) {
        seenIds.add(item.id);
        catalog.push(item);
      }
    }
    await sleep(250);
  }

  const outPath = path.join(__dirname, '..', 'public', 'songs.json');
  fs.writeFileSync(outPath, JSON.stringify(catalog, null, 2) + '\n');
  console.log(`Saved ${catalog.length} verified OPM & Karaoke Hits to ${outPath}`);
}

main();
