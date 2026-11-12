/**
 * server.js
 * Node.js + Express + Socket.io Backend for Dual-Device Karaoke
 * Features:
 *  - Pre-indexed OPM (Bands, Modern, Ballads) & All-Time Karaoke Hits catalog in public/songs.json
 *  - Live LRCLIB API search for any song worldwide
 *  - Full-length Karaoke/Instrumental (Minus One) audio streaming via yt-search + yt-dlp-exec
 *  - Real-time song queue management over Socket.io
 */

const express = require('express');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { Readable } = require('stream');
const { Server } = require('socket.io');
const yts = require('yt-search');
const ytdlp = require('yt-dlp-exec');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function loadCatalog() {
  const catalogPath = path.join(__dirname, 'public', 'songs.json');
  if (!fs.existsSync(catalogPath)) return [];
  try {
    return JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
  } catch {
    return [];
  }
}

const streamUrlCache = new Map();

// Active song and queue state
let currentSongState = {
  songId: null,
  song: null,
  triggeredAt: null
};

let songQueue = [];

function broadcastQueueState() {
  io.emit('queue_updated', {
    currentSong: currentSongState.song,
    queue: songQueue
  });
}

function startSongPlayback(song) {
  currentSongState = {
    songId: song ? song.id : null,
    song: song || null,
    triggeredAt: song ? Date.now() : null
  };

  if (song) {
    io.emit('load_and_play', {
      song_id: song.id,
      song,
      timestamp: currentSongState.triggeredAt
    });
  }

  broadcastQueueState();
}

/**
 * Converts LRC synced lyrics ("[00:12.34] Hello world...") into
 * Whisper-compatible word-level timestamps: [{ word, start_time, end_time, lineIndex }]
 */
function parseLrcToWordTimestamps(syncedLyrics, totalDurationSec = 220) {
  if (!syncedLyrics || typeof syncedLyrics !== 'string') return [];

  const lineRegex = /^\[(\d{2}):(\d{2}\.\d{2,3})\](.*)$/;
  const parsedLines = [];

  for (const rawLine of syncedLyrics.split('\n')) {
    const match = rawLine.trim().match(lineRegex);
    if (!match) continue;
    const minutes = parseInt(match[1], 10);
    const seconds = parseFloat(match[2]);
    const startTime = minutes * 60 + seconds;
    const rawText = match[3].trim();

    const cleanText = rawText
      .replace(/<\d{2}:\d{2}\.\d{2,3}>/g, '')
      .replace(/\[\d{2}:\d{2}\.\d{2,3}\]/g, '')
      .trim();

    if (cleanText) {
      parsedLines.push({ startTime, text: cleanText });
    }
  }

  const wordTimestamps = [];

  for (let i = 0; i < parsedLines.length; i++) {
    const currentLine = parsedLines[i];
    const nextLineStart =
      i + 1 < parsedLines.length
        ? parsedLines[i + 1].startTime
        : Math.max(currentLine.startTime + 4, totalDurationSec);

    const words = currentLine.text.split(/\s+/).filter(Boolean);
    if (words.length === 0) continue;

    const gapToNextLine = Math.max(0.4, nextLineStart - currentLine.startTime);
    const naturalPhraseDur = Math.min(gapToNextLine * 0.88, Math.max(1.2, words.length * 0.45));

    const weights = words.map((w) => Math.max(2, w.replace(/[^a-zA-Z0-9]/g, '').length));
    const totalWeight = weights.reduce((sum, w) => sum + w, 0) || words.length;

    let cursor = currentLine.startTime;
    words.forEach((word, wIdx) => {
      const share = (weights[wIdx] / totalWeight) * naturalPhraseDur;
      const start = cursor;
      const isLastWord = wIdx === words.length - 1;
      const end = isLastWord
        ? Math.min(nextLineStart - 0.05, start + share + Math.min(0.6, gapToNextLine * 0.1))
        : start + share - 0.01;

      wordTimestamps.push({
        word,
        start_time: Number(start.toFixed(2)),
        end_time: Number(Math.max(start + 0.06, end).toFixed(2)),
        lineIndex: i
      });

      cursor += share;
    });
  }

  return wordTimestamps;
}

function formatSeconds(sec) {
  if (!sec || Number.isNaN(sec)) return '3:30';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

function mapLrcItemToTrack(item, category = 'Search Result') {
  const durationSec = Math.round(Number(item.duration) || 210);
  const title = item.trackName || item.name || 'Unknown Title';
  const artist = item.artistName || 'Unknown Artist';

  return {
    id: `lrclib-${item.id}`,
    lrclibId: item.id,
    title,
    artist,
    category,
    duration: formatSeconds(durationSec),
    durationSec,
    audioUrl: `/api/audio?title=${encodeURIComponent(title)}&artist=${encodeURIComponent(artist)}&duration=${durationSec}`,
    lyricsUrl: `/api/lyrics/${item.id}?duration=${durationSec}`
  };
}

/**
 * Live API Search & Category Endpoint: /api/search?q=...&category=...
 */
app.get('/api/search', async (req, res) => {
  const query = (req.query.q || '').trim();
  const category = (req.query.category || 'All').trim();
  const catalog = loadCatalog();

  try {
    // If no search query is entered, return the pre-indexed OPM & Karaoke Hits catalog filtered by category
    if (!query) {
      if (category === 'All') {
        return res.json(catalog);
      }
      if (category === 'OPM All') {
        return res.json(catalog.filter((s) => (s.category || '').startsWith('OPM')));
      }
      return res.json(catalog.filter((s) => s.category === category));
    }

    // First match any local catalog songs
    const qLower = query.toLowerCase();
    const localMatches = catalog.filter(
      (s) =>
        s.title.toLowerCase().includes(qLower) ||
        s.artist.toLowerCase().includes(qLower) ||
        (s.category && s.category.toLowerCase().includes(qLower))
    );

    // Also query LRCLIB live API for any song worldwide
    const lrcRes = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(query)}`, {
      headers: { 'User-Agent': 'RealtimeKaraokeApp/1.0' }
    });

    const lrcTracks = lrcRes.ok ? await lrcRes.json() : [];
    const syncedTracks = Array.isArray(lrcTracks)
      ? lrcTracks.filter((t) => t.syncedLyrics && t.syncedLyrics.trim().length > 0)
      : [];

    const combined = [...localMatches];
    const seenKeys = new Set(
      localMatches.map(
        (m) => `${m.title.toLowerCase()}|${m.artist.toLowerCase()}|${Math.round((m.durationSec || 0) / 5)}`
      )
    );

    for (const item of syncedTracks) {
      const key = `${(item.trackName || '').toLowerCase()}|${(item.artistName || '').toLowerCase()}|${Math.round((item.duration || 0) / 5)}`;
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);
      combined.push(mapLrcItemToTrack(item));
      if (combined.length >= 35) break;
    }

    res.json(combined);
  } catch (err) {
    console.error('[API Search Error]:', err.message);
    res.json(catalog);
  }
});

/**
 * Full-Length Karaoke/Instrumental Audio Stream Endpoint:
 * /api/audio?title=...&artist=...&duration=...
 */
app.get('/api/audio', async (req, res) => {
  const title = (req.query.title || '').trim();
  const artist = (req.query.artist || '').trim();
  const targetDuration = Number(req.query.duration) || 210;
  const cacheKey = `${title.toLowerCase()}|${artist.toLowerCase()}|${targetDuration}`;

  try {
    let directAudioUrl = null;
    const cached = streamUrlCache.get(cacheKey);

    if (cached && cached.expiresAt > Date.now()) {
      directAudioUrl = cached.url;
    } else {
      const searchQuery = `${title} ${artist} karaoke instrumental`;
      const searchResult = await yts(searchQuery);
      const allVideos = Array.isArray(searchResult?.videos) ? searchResult.videos : [];

      if (allVideos.length === 0) {
        return res.status(404).end();
      }

      // Filter strictly for Karaoke / Instrumental / Minus One tracks first
      const karaokeVideos = allVideos.filter((v) =>
        /karaoke|instrumental|minus\s*one|off\s*vocal|backing\s*track/i.test(v.title)
      );
      const candidates = (karaokeVideos.length > 0 ? karaokeVideos : allVideos).slice(0, 10);

      // Pick the karaoke instrumental video whose duration is closest to the LRCLIB synced lyrics duration
      candidates.sort((a, b) => {
        const diffA = Math.abs((a.seconds || 0) - targetDuration);
        const diffB = Math.abs((b.seconds || 0) - targetDuration);
        return diffA - diffB;
      });

      const bestVideo = candidates[0];
      console.log(
        `[Karaoke Audio Resolver] Matched "${title} - ${artist}" (${targetDuration}s) -> "${bestVideo.title}" (${bestVideo.seconds}s)`
      );

      try {
        const resolvedOut = await ytdlp(bestVideo.url, {
          getUrl: true,
          format: 'bestaudio[ext=m4a]/bestaudio',
          noWarnings: true,
          noCheckCertificates: true
        });
        directAudioUrl = String(resolvedOut).trim().split('\n')[0];
      } catch (ytdlpErr) {
        console.warn('[Karaoke Audio Resolver] yt-dlp failed on cloud IP, trying Saavn fallback:', ytdlpErr.message);
        const saavnRes = await fetch(
          `https://saavn.sumit.co/api/search/songs?query=${encodeURIComponent(`${title} ${artist}`)}&limit=5`
        );
        if (saavnRes.ok) {
          const saavnData = await saavnRes.json();
          const tracks = saavnData?.data?.results || [];
          if (tracks.length > 0) {
            tracks.sort(
              (a, b) => Math.abs((a.duration || 0) - targetDuration) - Math.abs((b.duration || 0) - targetDuration)
            );
            const dlUrls = tracks[0].downloadUrl || [];
            const best =
              dlUrls.find((d) => d.quality === '320kbps') ||
              dlUrls.find((d) => d.quality === '160kbps') ||
              dlUrls[dlUrls.length - 1];
            directAudioUrl = best?.url || null;
          }
        }
      }

      if (!directAudioUrl) {
        return res.redirect('/audio/song1.mp3');
      }

      streamUrlCache.set(cacheKey, {
        url: directAudioUrl,
        expiresAt: Date.now() + 25 * 60 * 1000
      });
    }

    const upstreamHeaders = {
      'User-Agent': 'Mozilla/5.0'
    };
    if (req.headers.range) {
      upstreamHeaders.Range = req.headers.range;
    }

    const upstreamRes = await fetch(directAudioUrl, { headers: upstreamHeaders });

    res.status(upstreamRes.status);
    const passthroughHeaders = [
      'content-type',
      'content-length',
      'content-range',
      'accept-ranges'
    ];
    for (const h of passthroughHeaders) {
      const val = upstreamRes.headers.get(h);
      if (val) res.setHeader(h, val);
    }

    if (!upstreamRes.body) {
      return res.end();
    }

    const nodeStream = Readable.fromWeb(upstreamRes.body);
    req.on('close', () => {
      nodeStream.destroy();
    });
    nodeStream.pipe(res);
  } catch (err) {
    console.error('[Audio Stream Error]:', err.message);
    res.status(500).end();
  }
});

/**
 * Live Word-Level Lyrics Endpoint by LRCLIB ID: /api/lyrics/:lrclibId
 */
app.get('/api/lyrics/:lrclibId', async (req, res) => {
  const { lrclibId } = req.params;
  const targetDuration = Number(req.query.duration) || 0;

  try {
    const response = await fetch(`https://lrclib.net/api/get/${encodeURIComponent(lrclibId)}`, {
      headers: { 'User-Agent': 'RealtimeKaraokeApp/1.0' }
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: 'Lyrics not found on LRCLIB' });
    }

    const data = await response.json();
    const words = parseLrcToWordTimestamps(data.syncedLyrics, targetDuration || data.duration);
    res.json(words);
  } catch (err) {
    console.error('[API Lyrics Error]:', err.message);
    res.status(500).json({ error: 'Failed to fetch synced lyrics' });
  }
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.get('/remote', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'remote.html'));
});

app.get('/display', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'display.html'));
});

function resolveSongPayload(payload) {
  const songId = typeof payload === 'string' ? payload : payload?.song_id;
  const providedSong = payload?.song;
  const catalog = loadCatalog();

  return (
    providedSong ||
    catalog.find((s) => s.id === songId) || {
      id: songId,
      title: `Track (${songId})`,
      artist: 'Karaoke Track',
      audioUrl: `/audio/song1.mp3`,
      lyricsUrl: `/lyrics/song1.json`
    }
  );
}

io.on('connection', (socket) => {
  console.log(`[Socket.io] Client connected: ${socket.id}`);

  socket.emit('catalog_init', {
    songs: loadCatalog(),
    currentSongState,
    queue: songQueue
  });

  socket.on('play_song', (payload) => {
    const selectedSong = resolveSongPayload(payload);
    console.log(
      `[Socket.io] Playing full track: "${selectedSong.title}" by ${selectedSong.artist} (${selectedSong.duration})`
    );
    startSongPlayback(selectedSong);
  });

  socket.on('queue_song', (payload) => {
    const selectedSong = resolveSongPayload(payload);
    const queueEntry = {
      ...selectedSong,
      queueId: `${selectedSong.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    };

    if (!currentSongState.song) {
      startSongPlayback(queueEntry);
    } else {
      songQueue.push(queueEntry);
      broadcastQueueState();
    }
  });

  socket.on('next_song', () => {
    if (songQueue.length > 0) {
      const nextTrack = songQueue.shift();
      startSongPlayback(nextTrack);
    } else {
      currentSongState = { songId: null, song: null, triggeredAt: null };
      broadcastQueueState();
    }
  });

  socket.on('remove_from_queue', (payload) => {
    const targetQueueId = payload?.queueId;
    songQueue = songQueue.filter((item) => item.queueId !== targetQueueId);
    broadcastQueueState();
  });

  socket.on('clear_queue', () => {
    songQueue = [];
    broadcastQueueState();
  });

  socket.on('disconnect', () => {
    console.log(`[Socket.io] Client disconnected: ${socket.id}`);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`----------------------------------------------------`);
  console.log(`Karaoke Server running on http://localhost:${PORT}`);
  console.log(`Phone Remote UI : http://localhost:${PORT}/remote.html`);
  console.log(`Laptop Display UI: http://localhost:${PORT}/display.html`);
  console.log(`----------------------------------------------------`);
});
