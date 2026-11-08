/**
 * display.js
 * Minimal React Frontend for the Laptop Karaoke Display & Audio Player.
 * Streams full-length audio tracks, groups word-level timestamps into karaoke lines,
 * and runs a 60fps requestAnimationFrame synchronization loop.
 */

const { useState, useEffect, useRef, useCallback, useMemo } = React;

function createSyntheticInstrumentalWav(durationSeconds = 180) {
  const sampleRate = 22050;
  const numSamples = sampleRate * durationSeconds;
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  const writeString = (offset, str) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, numSamples * 2, true);

  const chords = [
    [220.0, 261.63, 329.63],
    [174.61, 220.0, 261.63],
    [261.63, 329.63, 392.0],
    [196.0, 246.94, 293.66]
  ];

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const chordIndex = Math.floor(t / 2) % chords.length;
    const [f1, f2, f3] = chords[chordIndex];
    const beatEnvelope = 0.65 + 0.35 * Math.sin(2 * Math.PI * 2 * t);
    const sample =
      ((Math.sin(2 * Math.PI * f1 * t) +
        Math.sin(2 * Math.PI * f2 * t) +
        Math.sin(2 * Math.PI * f3 * t)) /
        3) *
      0.18 *
      beatEnvelope;
    view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, sample)) * 32767, true);
  }

  return URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }));
}

function formatClock(sec) {
  if (!sec || Number.isNaN(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

function DisplayApp() {
  const [isConnected, setIsConnected] = useState(false);
  const [currentSong, setCurrentSong] = useState(null);
  const [queue, setQueue] = useState([]);
  const [lyrics, setLyrics] = useState([]);
  const [activeWordIndex, setActiveWordIndex] = useState(-1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [syncOffset, setSyncOffset] = useState(0);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);

  const socketRef = useRef(null);
  const audioRef = useRef(null);
  const rafRef = useRef(null);
  const lyricsRef = useRef([]);
  const offsetRef = useRef(0);

  useEffect(() => {
    lyricsRef.current = lyrics;
  }, [lyrics]);

  useEffect(() => {
    offsetRef.current = syncOffset;
  }, [syncOffset]);

  /**
   * High-Precision Lyric Synchronization Loop:
   * Runs at 60fps via requestAnimationFrame and checks the HTML5 <audio> element's
   * currentTime (plus optional user syncOffset) against word-level timestamps.
   */
  const syncLyricsWithAudio = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const rawTime = audio.currentTime;
    const syncedTime = Math.max(0, rawTime + offsetRef.current);
    setCurrentTime(syncedTime);

    const words = lyricsRef.current;
    if (words.length > 0) {
      // 1. Exact match within [start_time, end_time]
      let foundIndex = words.findIndex(
        (item) => syncedTime >= item.start_time && syncedTime <= item.end_time
      );

      // 2. If between two words on the same phrase, keep the most recently started word active
      if (foundIndex === -1 && syncedTime >= words[0].start_time) {
        for (let i = words.length - 1; i >= 0; i--) {
          if (syncedTime >= words[i].start_time) {
            if (syncedTime - words[i].end_time < 1.2) {
              foundIndex = i;
            }
            break;
          }
        }
      }

      setActiveWordIndex(foundIndex);
    }

    if (!audio.paused && !audio.ended) {
      rafRef.current = requestAnimationFrame(syncLyricsWithAudio);
    }
  }, []);

  const loadAndPlaySong = useCallback(
    async (songId, songMetadata) => {
      const targetAudioUrl = songMetadata?.audioUrl || `/audio/${songId}.mp3`;
      const targetLyricsUrl = songMetadata?.lyricsUrl || `/lyrics/${songId}.json`;

      setCurrentSong(
        songMetadata || {
          id: songId,
          title: `Track (${songId})`,
          artist: 'Karaoke Track'
        }
      );
      setActiveWordIndex(-1);
      setCurrentTime(0);
      setSyncOffset(0);

      try {
        const response = await fetch(targetLyricsUrl);
        if (!response.ok) throw new Error(`Failed to fetch lyrics: ${response.status}`);
        const data = await response.json();
        const wordArray = Array.isArray(data) ? data : data.words || [];
        setLyrics(wordArray);
      } catch (err) {
        console.error('[Display] Error loading lyrics JSON:', err);
        setLyrics([]);
      }

      const audio = audioRef.current;
      if (!audio) return;

      cancelAnimationFrame(rafRef.current);

      delete audio.dataset.fallbackUsed;
      audio.src = targetAudioUrl;
      audio.load();

      try {
        await audio.play();
        setAutoplayBlocked(false);
        rafRef.current = requestAnimationFrame(syncLyricsWithAudio);
      } catch (playErr) {
        console.warn('[Display] Autoplay blocked or stream error:', playErr);
        setAutoplayBlocked(true);
      }
    },
    [syncLyricsWithAudio]
  );

  useEffect(() => {
    const socket = io();
    socketRef.current = socket;

    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));

    socket.on('catalog_init', (data) => {
      if (Array.isArray(data?.queue)) {
        setQueue(data.queue);
      }
    });

    socket.on('load_and_play', (payload) => {
      const songId = typeof payload === 'string' ? payload : payload?.song_id;
      loadAndPlaySong(songId, payload?.song);
    });

    socket.on('queue_updated', (payload) => {
      setQueue(Array.isArray(payload?.queue) ? payload.queue : []);
      if (!payload?.currentSong) {
        setCurrentSong(null);
        setLyrics([]);
      }
    });

    return () => {
      cancelAnimationFrame(rafRef.current);
      socket.disconnect();
    };
  }, [loadAndPlaySong]);

  const handleManualUnlockPlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    try {
      await audio.play();
      setAutoplayBlocked(false);
      rafRef.current = requestAnimationFrame(syncLyricsWithAudio);
    } catch (err) {
      console.error('Manual play failed:', err);
    }
  };

  /**
   * Group flat word array into structured karaoke lines so the singer sees:
   * - Previous Line
   * - Current Active Line (with word-by-word highlighting)
   * - Next Upcoming Line (and Second Upcoming Line)
   */
  const groupedLines = useMemo(() => {
    if (lyrics.length === 0) return [];

    const linesMap = new Map();
    lyrics.forEach((w, idx) => {
      // Group by lineIndex if provided by API, otherwise group every 8 words
      const lineKey = typeof w.lineIndex === 'number' ? w.lineIndex : Math.floor(idx / 8);
      if (!linesMap.has(lineKey)) {
        linesMap.set(lineKey, []);
      }
      linesMap.get(lineKey).push({ ...w, globalIndex: idx });
    });

    return Array.from(linesMap.values()).map((wordsInLine, lineIdx) => ({
      lineIdx,
      startTime: wordsInLine[0].start_time,
      endTime: wordsInLine[wordsInLine.length - 1].end_time,
      words: wordsInLine
    }));
  }, [lyrics]);

  // Determine which line is currently active based on currentTime
  const activeLineIdx = useMemo(() => {
    if (groupedLines.length === 0) return 0;

    if (activeWordIndex !== -1) {
      const found = groupedLines.findIndex((line) =>
        line.words.some((w) => w.globalIndex === activeWordIndex)
      );
      if (found !== -1) return found;
    }

    // Otherwise find the next upcoming line or most recently finished line
    const upcomingIdx = groupedLines.findIndex((line) => line.endTime >= currentTime);
    return upcomingIdx !== -1 ? upcomingIdx : groupedLines.length - 1;
  }, [groupedLines, activeWordIndex, currentTime]);

  const firstVocalTime = lyrics.length > 0 ? lyrics[0].start_time : 0;
  const countdownToVocals =
    firstVocalTime > currentTime + 1 ? Math.ceil(firstVocalTime - currentTime) : 0;

  const progressPercent = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
  const nextSong = queue.length > 0 ? queue[0] : null;

  const prevLine = activeLineIdx > 0 ? groupedLines[activeLineIdx - 1] : null;
  const currentLine = groupedLines[activeLineIdx] || null;
  const nextLine1 = activeLineIdx + 1 < groupedLines.length ? groupedLines[activeLineIdx + 1] : null;
  const nextLine2 = activeLineIdx + 2 < groupedLines.length ? groupedLines[activeLineIdx + 2] : null;

  return (
    <div className="display-screen">
      {/* Minimal Header */}
      <header className="display-topbar">
        <div>
          <h1 className="brand-title">Stage Display</h1>
        </div>

        {currentSong && (
          <div className="now-playing-meta">
            <div className="now-playing-title">{currentSong.title}</div>
            <div className="now-playing-artist">{currentSong.artist}</div>
          </div>
        )}

        <div className="status-badge">
          <span className={`status-dot ${isConnected ? 'connected' : ''}`} />
          {isConnected ? 'Connected' : 'Disconnected'}
        </div>
      </header>

      {/* Main Lyric Stage */}
      <main className="lyric-stage">
        {!currentSong ? (
          <div style={{ maxWidth: '480px' }}>
            <h2 style={{ fontSize: '1.6rem', fontWeight: 500, marginBottom: '10px', color: 'var(--text-primary)' }}>
              Awaiting Track Selection
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', lineHeight: 1.6 }}>
              Open <code>/remote.html</code> on your phone to play a full-length song or add tracks to the queue.
            </p>
          </div>
        ) : (
          <div className="stage-lines-container">
            {autoplayBlocked && (
              <button
                onClick={handleManualUnlockPlay}
                className="btn-minimal btn-primary"
                style={{ marginBottom: '24px', padding: '10px 20px', fontSize: '0.85rem' }}
              >
                Enable Audio Playback
              </button>
            )}

            {countdownToVocals > 0 && (
              <div className="intro-countdown">
                Vocals start in {countdownToVocals}s
              </div>
            )}

            {/* Previous Line (Muted) */}
            <div className="karaoke-line previous-line">
              {prevLine &&
                prevLine.words.map((item) => (
                  <span key={`prev-${item.globalIndex}`} className="lyric-word past">
                    {item.word}
                  </span>
                ))}
            </div>

            {/* Current Active Line (Large, Word-by-Word Highlighted) */}
            <div className="karaoke-line current-line">
              {currentLine ? (
                currentLine.words.map((item) => {
                  const index = item.globalIndex;
                  let wordClass = 'lyric-word';
                  if (index === activeWordIndex) {
                    wordClass += ' active';
                  } else if (currentTime > item.end_time) {
                    wordClass += ' past';
                  }

                  return (
                    <span
                      key={`curr-${index}`}
                      className={wordClass}
                      data-start={item.start_time}
                      data-end={item.end_time}
                    >
                      {item.word}
                    </span>
                  );
                })
              ) : (
                <span style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>
                  Instrumental
                </span>
              )}
            </div>

            {/* Next Upcoming Line */}
            <div className="karaoke-line upcoming-line">
              {nextLine1 &&
                nextLine1.words.map((item) => (
                  <span key={`next1-${item.globalIndex}`} className="lyric-word upcoming">
                    {item.word}
                  </span>
                ))}
            </div>

            {/* Second Upcoming Line */}
            <div className="karaoke-line upcoming-line-secondary">
              {nextLine2 &&
                nextLine2.words.map((item) => (
                  <span key={`next2-${item.globalIndex}`} className="lyric-word upcoming">
                    {item.word}
                  </span>
                ))}
            </div>
          </div>
        )}
      </main>

      {/* Minimal Footer & Queue Status */}
      <footer className="player-footer">
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
        </div>

        <div className="footer-controls">
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span>
              {formatClock(currentTime)} / {formatClock(duration)}
            </span>

            {/* Fine-tune Lyric Sync Offset Controls */}
            {currentSong && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button
                  className="btn-minimal"
                  onClick={() => setSyncOffset((prev) => Number((prev - 0.25).toFixed(2)))}
                  title="Delay lyrics by 0.25s"
                >
                  -0.25s
                </button>
                <span style={{ minWidth: '72px', textAlign: 'center', fontSize: '0.72rem' }}>
                  Sync: {syncOffset >= 0 ? `+${syncOffset.toFixed(2)}s` : `${syncOffset.toFixed(2)}s`}
                </span>
                <button
                  className="btn-minimal"
                  onClick={() => setSyncOffset((prev) => Number((prev + 0.25).toFixed(2)))}
                  title="Advance lyrics by 0.25s"
                >
                  +0.25s
                </button>
              </div>
            )}
          </div>

          <div className="up-next-indicator">
            {nextSong
              ? `Up Next: ${nextSong.title} — ${nextSong.artist} (${queue.length} in queue)`
              : 'Queue Empty'}
          </div>

          <audio
            ref={audioRef}
            className="stylized-audio"
            controls
            preload="auto"
            onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
            onTimeUpdate={syncLyricsWithAudio}
            onPlay={() => {
              cancelAnimationFrame(rafRef.current);
              rafRef.current = requestAnimationFrame(syncLyricsWithAudio);
            }}
            onPause={() => cancelAnimationFrame(rafRef.current)}
            onEnded={() => {
              cancelAnimationFrame(rafRef.current);
              setActiveWordIndex(-1);
              if (socketRef.current) {
                socketRef.current.emit('next_song');
              }
            }}
            onError={(e) => {
              const audio = e.currentTarget;
              if (!audio.dataset.fallbackUsed) {
                audio.dataset.fallbackUsed = 'true';
                audio.src = createSyntheticInstrumentalWav(currentSong?.durationSec || 180);
                audio.play().catch(() => {});
              }
            }}
          />
        </div>
      </footer>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<DisplayApp />);
