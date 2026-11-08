/**
 * remote.js
 * Minimal React Frontend for the Smartphone Remote Control UI.
 * Displays pre-indexed OPM Bands, OPM Modern, OPM Ballads, and All-Time Karaoke Hits,
 * plus live search across LRCLIB and real-time Queue management.
 */

const { useState, useEffect } = React;

const CATEGORIES = [
  { label: 'All Songs', value: 'All' },
  { label: 'Karaoke Hits', value: 'Karaoke Hits' },
  { label: 'OPM All', value: 'OPM All' },
  { label: 'OPM Bands', value: 'OPM Bands' },
  { label: 'OPM Modern', value: 'OPM Modern' },
  { label: 'OPM Ballads', value: 'OPM Ballads' }
];

const ARTIST_SHORTCUTS = [
  'Eraserheads',
  'Parokya Ni Edgar',
  'Rivermaya',
  'IV of Spades',
  'Ben&Ben',
  'Silent Sanctuary',
  'December Avenue',
  'Up Dharma Down',
  'Kamikazee',
  'Moira Dela Torre',
  'TJ Monterde',
  'Zack Tabudlo',
  'Queen',
  'ABBA',
  'Bon Jovi',
  'Air Supply'
];

function RemoteApp() {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [songs, setSongs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentSong, setCurrentSong] = useState(null);
  const [queue, setQueue] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2500);
  };

  useEffect(() => {
    const socketInstance = io();
    setSocket(socketInstance);

    socketInstance.on('connect', () => setIsConnected(true));
    socketInstance.on('disconnect', () => setIsConnected(false));

    socketInstance.on('catalog_init', (data) => {
      if (data?.currentSongState?.song) {
        setCurrentSong(data.currentSongState.song);
      }
      if (Array.isArray(data?.queue)) {
        setQueue(data.queue);
      }
    });

    socketInstance.on('load_and_play', (payload) => {
      setCurrentSong(payload.song || null);
    });

    socketInstance.on('queue_updated', (payload) => {
      setCurrentSong(payload.currentSong || null);
      setQueue(Array.isArray(payload.queue) ? payload.queue : []);
    });

    return () => socketInstance.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    const delay = searchQuery.trim() ? 280 : 0;
    const timer = setTimeout(async () => {
      try {
        const url = `/api/search?q=${encodeURIComponent(searchQuery.trim())}&category=${encodeURIComponent(activeCategory)}`;
        const res = await fetch(url);
        const data = await res.json();
        if (!cancelled && Array.isArray(data)) {
          setSongs(data);
        }
      } catch (err) {
        console.error('Failed to load songs:', err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }, delay);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery, activeCategory]);

  const handlePlayNow = (song) => {
    if (!socket) return;
    socket.emit('play_song', { song_id: song.id, song });
    showToast(`Playing "${song.title}"`);
  };

  const handleQueueSong = (song) => {
    if (!socket) return;
    socket.emit('queue_song', { song_id: song.id, song });
    showToast(currentSong ? `Added "${song.title}" to queue` : `Playing "${song.title}"`);
  };

  const handleSkipNext = () => {
    if (!socket) return;
    socket.emit('next_song');
  };

  const handleRemoveFromQueue = (queueId) => {
    if (!socket) return;
    socket.emit('remove_from_queue', { queueId });
  };

  return (
    <div className="remote-container">
      {/* Minimal Header */}
      <header className="remote-header">
        <div>
          <h1 className="brand-title">Karaoke Remote</h1>
          <p className="brand-subtitle">{songs.length} Tracks Shown · OPM & Karaoke Hits</p>
        </div>
        <div className="status-badge">
          <span className={`status-dot ${isConnected ? 'connected' : ''}`} />
          {isConnected ? 'Online' : 'Offline'}
        </div>
      </header>

      {/* Queue & Now Playing Section */}
      <section className="queue-panel">
        <div className="queue-header">
          <span>Queue ({queue.length})</span>
          {(currentSong || queue.length > 0) && (
            <button className="btn-minimal" onClick={handleSkipNext}>
              Skip Next
            </button>
          )}
        </div>

        {currentSong ? (
          <div className="now-playing-row">
            <div className="song-info">
              <span className="song-title">Now Playing: {currentSong.title}</span>
              <span className="song-artist">{currentSong.artist}</span>
            </div>
          </div>
        ) : (
          <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            No track currently playing
          </div>
        )}

        {queue.length > 0 && (
          <div className="queue-list">
            {queue.map((item, index) => (
              <div key={item.queueId || `${item.id}-${index}`} className="queue-item">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                  <span className="queue-index">{String(index + 1).padStart(2, '0')}</span>
                  <div className="song-info">
                    <span className="song-title" style={{ fontSize: '0.84rem' }}>{item.title}</span>
                    <span className="song-artist" style={{ fontSize: '0.74rem' }}>{item.artist}</span>
                  </div>
                </div>
                <button
                  className="btn-minimal"
                  onClick={() => handleRemoveFromQueue(item.queueId)}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Search Bar */}
      <input
        type="search"
        className="search-input"
        placeholder="Search any OPM or international karaoke song..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />

      {/* Primary Category Tabs */}
      <div className="preset-bar">
        {CATEGORIES.map((cat) => {
          const active = !searchQuery.trim() && activeCategory === cat.value;
          return (
            <button
              key={cat.value}
              className={`preset-pill ${active ? 'active' : ''}`}
              onClick={() => {
                setSearchQuery('');
                setActiveCategory(cat.value);
              }}
            >
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Quick Artist Shortcuts */}
      <div className="preset-bar">
        {ARTIST_SHORTCUTS.map((artist) => {
          const active = searchQuery.trim().toLowerCase() === artist.toLowerCase();
          return (
            <button
              key={artist}
              className={`preset-pill ${active ? 'active' : ''}`}
              onClick={() => setSearchQuery(active ? '' : artist)}
            >
              {artist}
            </button>
          );
        })}
      </div>

      {/* Status Toast */}
      {toastMessage && <div className="toast-banner">{toastMessage}</div>}

      {/* Song Results */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '28px 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          Loading songs...
        </div>
      ) : (
        <div className="song-list">
          {songs.map((song) => {
            const isCurrent = currentSong?.id === song.id;
            return (
              <div
                key={song.id}
                className={`song-card ${isCurrent ? 'active-song' : ''}`}
              >
                <div className="song-info">
                  <span className="song-title">{song.title}</span>
                  <span className="song-artist">
                    {song.artist}
                    {song.category ? ` · ${song.category}` : ''}
                    {song.duration ? ` · ${song.duration}` : ''}
                  </span>
                </div>
                <div className="song-actions">
                  <button
                    className="btn-minimal"
                    onClick={() => handleQueueSong(song)}
                  >
                    Queue
                  </button>
                  <button
                    className="btn-minimal btn-primary"
                    onClick={() => handlePlayNow(song)}
                  >
                    {isCurrent ? 'Restart' : 'Play'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<RemoteApp />);
