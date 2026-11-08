# Realtime Dual-Device Karaoke

A real-time, dual-device web karaoke application built with **Node.js**, **Express**, **Socket.io**, and **React**. Use your smartphone as the remote control and songbook queue manager while your laptop or TV acts as the synchronized lyric stage and audio player.

## Features

- **Dual-Device Real-Time Sync**: Instant WebSocket communication via Socket.io (`play_song`, `queue_song`, `next_song`, `load_and_play`, `queue_updated`).
- **OPM & All-Time Karaoke Hits Catalog**: Pre-indexed with 92 verified OPM Classics, OPM Modern, OPM Ballads, and International Karaoke Hits (`public/songs.json`), plus live search powered by the LRCLIB API.
- **Full-Length Karaoke Instrumental Streaming**: Dynamically resolves and streams full-length Minus One / Karaoke Instrumental audio tracks matched to the lyric duration.
- **60fps Word-Level Lyric Highlighting**: Uses `requestAnimationFrame` and HTML5 `<audio>` `currentTime` to highlight words and lines in real time, with `-0.25s` / `+0.25s` fine-tune sync controls.
- **Minimal Monochrome UI**: Clean, distraction-free dark interface with live queue management.

## Quick Start

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the server:
   ```bash
   npm start
   ```

3. Open the interfaces:
   - **Laptop / TV Stage Display**: `http://localhost:3000/display.html`
   - **Phone Remote Control**: `http://localhost:3000/remote.html` (or `http://<your-local-ip>:3000/remote.html` on the same Wi-Fi network)
