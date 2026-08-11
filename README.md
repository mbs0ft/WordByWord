# WordByWord <img width="87" height="84" alt="Vector" src="https://github.com/user-attachments/assets/26a8de31-f367-4479-9356-809a5edc99f9" />

**WordByWord** is a fast, entirely client-side web application designed to automatically scan your local music library, search for syllable-synced karaoke lyrics (Enhanced LRC), and save them directly alongside your audio files that works in the browser, no installation needed. 

Built with modern browser capabilities like the File System Access API, it securely operates 100% locally on your machine without requiring any external servers or desktop application installations.

<img width="1708" height="1147" alt="image" src="https://github.com/user-attachments/assets/61b84043-5239-42cb-959c-305bcc545353" />


**Try it now:** https://mb-soft.ru/WordByWord/

## Features

**Word-by-word Synced Lyrics (Enhanced LRC):**
Automatically fetches precise, word-by-word synced lyrics from multiple sources so you can enjoy true karaoke experiences in compatible players (like Navidrome, Symfonium, Feishin, etc).

**Multi-Source Fetching Engine:**
Queries multiple APIs sequentially to guarantee the highest quality match:
1. **[LyricsPlus](https://github.com/ibratabian17/lyricsplus)**
2. **Musixmatch**
3. **[LRCLIB](https://lrclib.net/)**
4. **[lrcmux](https://lrcmux.dev/)**

- **Smart Featuring & Collaboration Artist Cleaning**
  Automatically strips featured artist metadata (`feat.`, `ft.`, `&`, `vs.`) for fallback queries to primary artists, guaranteeing maximum match accuracy for collaborative tracks.

- **Interactive Manual Search & Real-Time Karaoke Player Preview**
  Override track metadata manually, query all 4 databases, inspect duration match tags, and preview synced karaoke line/word highlighting with an interactive audio player.

- **Smart Upgrade & Overwrite Protection**
  Protect existing lyrics with flexible handling modes: **Upgrade to Enhanced** (only upgrades flat line-synced lyrics if word-by-word karaoke is found), **Skip All**, or **Always Overwrite**.

- **Queue Filtering & Keyboard Shortcuts**
  Filter queue items instantly by status (*All, Success, Instrumental, No Karaoke, Skipped*) with fixed column widths, `Ctrl+F` / `Cmd+F` search bar focus, and `Escape` quick modal closing.

- **Settings Backup & Restore**
  Export and import your complete settings configuration (`wordbyword-settings.json`) including provider order, Musixmatch token, theme, and language.

## How to Run

WordByWord requires **zero installation** and **no build tools**. It relies purely on Vanilla JS, HTML, and CSS. 

Because it utilizes the **File System Access API** to write `.lrc` files directly to your disk, modern browsers require running in a **Secure Context** (`https://` or `localhost`).

1. Clone or download this repository.
2. Serve the folder using a local web server. 
   - *Example using VS Code:* Install the **Live Server** extension and click "Go Live" on `index.html`.
   - *Example using Python:* Run `python -m http.server 8000` in the directory and open `http://localhost:8000`.
3. Click **Select Folder** in the top left, grant the browser permission to read/write, and watch the magic happen!

## Contributing
Pull requests, bug reports, and feature ideas are welcome! Feel free to open an issue or submit a PR on GitHub.
