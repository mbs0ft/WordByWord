# WordByWord <img width="87" height="84" alt="Vector" src="https://github.com/user-attachments/assets/26a8de31-f367-4479-9356-809a5edc99f9" />

**WordByWord** is a fast, entirely client-side web application designed to automatically scan your local music library, search for syllable-synced karaoke lyrics (Enhanced LRC), and save them directly alongside your audio files that works in the browser, no installation needed. 

Built with modern browser capabilities like the File System Access API, it securely operates 100% locally on your machine without requiring any external servers or desktop application installations.

**Try it now:** https://mb-soft.ru/WordByWord/

## Features

**Word-by-word Synced Lyrics (Enhanced LRC)**
Automatically fetches precise, word-by-word synced lyrics from multiple sources so you can enjoy true karaoke experiences in compatible players (like Navidrome, Symfonium, Feishin, etc).

**Multi-Source Fetching Engine**
Queries multiple APIs sequentially to guarantee the highest quality match:
1. **Apple Music ([LyricsPlus](https://github.com/ibratabian17/lyricsplus))**
2. **Musixmatch**
3. **[LRCLIB](https://lrclib.net/)**

**Manual Match Search Helper**
Tags messed up? The built-in Manual Search lets you override track metadata, manually query all 3 databases, preview the un-timed text beautifully, and save the correct lyrics in one click.

**Background Metadata Parsing**
As soon as you select a folder, WordByWord parses audio tags (ID3/FLAC) in the background asynchronously without freezing the UI, providing real-time data population in the queue table.

**Beautiful Material You Design (MD3)**
Enjoy a stunning, dynamic, and pastel-toned user interface built from scratch following Material Design 3 guidelines.
- Fluid `.modal` animations and transitions.
- Auto-detects System Theme (Light/Dark mode) on the fly, or manually select your preference.
- Ink ripples and micro-animations throughout the app.

## How to Run

WordByWord requires **zero installation** and **no build tools**. It relies purely on Vanilla JS, HTML, and CSS. 

However, because it uses the powerful **File System Access API** to write `.lrc` files directly to your disk, modern browsers require it to run in a "Secure Context".

1. Clone or download this repository.
2. Serve the folder using a local web server. 
   - *Example using VS Code:* Install the **Live Server** extension and click "Go Live" on `index.html`.
   - *Example using Python:* Run `python -m http.server 8000` in the directory and open `http://localhost:8000`.
3. Click **Select Folder** in the top left, grant the browser permission to read/write, and watch the magic happen!

## Contributing
Feel free to open issues or submit pull requests (or translations)!
