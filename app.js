(function() {
    const jsmediatags = window.jsmediatags;
    let rootDirectoryHandle = null;
    let queue = [];
    let currentIndex = 0;
    let isRunning = false;
    let isPaused = false;
    window.queue = queue;
    window.currentLang = (function() {
        const saved = localStorage.getItem('lang');
        if (saved) return saved;
        const sysLang = navigator.language || navigator.userLanguage;
        if (sysLang && sysLang.toLowerCase().startsWith('ru')) {
            return 'ru';
        }
        return 'en'; // Default fallback
    })();
    window.updateUILanguage = function() {
        const lang = window.currentLang;
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (window.i18n[lang][key]) {
                if (el.tagName === 'INPUT' && (el.type === 'text' || el.type === 'password')) {
                    el.placeholder = window.i18n[lang][key];
                } else {
                    el.innerText = window.i18n[lang][key];
                }
            }
        });
        const select = document.getElementById('lrc-exist-mode');
        if (select) {
            select.options[0].text = window.i18n[lang].upgradeFlat;
            select.options[1].text = window.i18n[lang].skipAll;
            select.options[2].text = window.i18n[lang].overwrite;
        }
        const qSearch = document.getElementById('queue-search');
        if (qSearch) qSearch.placeholder = window.i18n[lang].searchPlaceholder;
        
        const defArtist = document.getElementById('default-artist');
        if (defArtist) defArtist.placeholder = window.i18n[lang].defaultArtistPlaceholder;

        const artistInput = document.getElementById('artist');
        if (artistInput) artistInput.placeholder = window.i18n[lang].colArtist;

        const titleInput = document.getElementById('title');
        if (titleInput) titleInput.placeholder = window.i18n[lang].colTitle;
        const tooltip = document.getElementById('default-artist-tooltip');
        if (tooltip) {
            tooltip.title = window.i18n[lang].defaultArtistTooltip;
        }
        const emptyText = document.getElementById('empty-table-text');
        if (emptyText && (!window.queue || window.queue.length === 0)) {
            emptyText.innerText = window.i18n[lang].emptyTable;
        } else if (window.queue && window.queue.length > 0) {
            window.queue.forEach((_, idx) => {
                if (typeof window.updateItemRow === 'function') {
                    window.updateItemRow(idx);
                }
            });
        }
        
        if (typeof window.updateStats === 'function') {
            window.updateStats();
        }
    };

    function applyTheme(theme) {
        let themeToApply = theme;
        if (theme === 'system') {
            themeToApply = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
        }
        document.documentElement.setAttribute('data-theme', themeToApply);
    }
    const currentTheme = localStorage.getItem('theme') || 'system';
    applyTheme(currentTheme);
    window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
        const activeTheme = localStorage.getItem('theme') || 'system';
        if (activeTheme === 'system') {
            applyTheme('system');
        }
    });
    window.addEventListener('DOMContentLoaded', () => {
        document.getElementById('setting-lang').value = window.currentLang;
        document.getElementById('setting-theme').value = localStorage.getItem('theme') || 'system';
        document.getElementById('setting-mxm-token').value = localStorage.getItem('mxm_user_token') || '';
        window.updateUILanguage();
        writeLog(window.i18n[window.currentLang].logWaitingFolder, 'info');
        const settingsModal = document.getElementById('settings-modal');
        if (settingsModal) {
            settingsModal.addEventListener('click', (e) => {
                if (e.target === settingsModal) {
                    closeSettingsModal();
                }
            });
        }

        const manualSearchModal = document.getElementById('manual-search-modal');
        if (manualSearchModal) {
            manualSearchModal.addEventListener('click', (e) => {
                if (e.target === manualSearchModal) {
                    closeManualSearchModal();
                }
            });
        }
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' || e.key === 'Esc') {
                if (settingsModal && settingsModal.classList.contains('active')) {
                    closeSettingsModal();
                }
                if (manualSearchModal && manualSearchModal.classList.contains('active')) {
                    closeManualSearchModal();
                }
            }
        });
        document.getElementById('setting-mxm-token').addEventListener('input', function(e) {
            const val = e.target.value;
            if (val.includes('[UserToken]:')) {
                const match = val.match(/\[UserToken\]:\s*([a-f0-9]+)/i);
                if (match && match[1]) {
                    e.target.value = match[1].trim();
                    writeLog(window.i18n[window.currentLang].logTokenExtracted, 'success');
                }
            }
            window.autoSaveSettings();
        });
        document.querySelectorAll('.animated-details').forEach(el => {
            const summary = el.querySelector('summary');
            const content = el.querySelector('.details-content');
            
            summary.addEventListener('click', (e) => {
                e.preventDefault();
                
                if (el.hasAttribute('open')) {
                    content.style.gridTemplateRows = '0fr';
                    setTimeout(() => {
                        el.removeAttribute('open');
                    }, 250);
                } else {
                    el.setAttribute('open', '');
                    setTimeout(() => {
                        content.style.gridTemplateRows = '1fr';
                    }, 10);
                }
            });
        });
        document.querySelector('.table-container').addEventListener('scroll', function() {
            const ths = this.querySelectorAll('th');
            if (this.scrollTop > 5) {
                ths.forEach(th => {
                    th.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.4)';
                    th.style.borderBottomColor = 'rgba(255, 255, 255, 0.15)';
                });
            } else {
                ths.forEach(th => {
                    th.style.boxShadow = 'none';
                    th.style.borderBottomColor = 'var(--border-color)';
                });
            }
        });
    });
    window.openSettingsModal = function() {
        document.getElementById('setting-lang').value = window.currentLang;
        document.getElementById('setting-theme').value = localStorage.getItem('theme') || 'system';
        document.getElementById('setting-mxm-token').value = localStorage.getItem('mxm_user_token') || '';
        document.querySelector('.modal-card').classList.remove('about-active');
        document.getElementById('settings-modal').classList.add('active');
    };

    window.closeSettingsModal = function() {
        document.getElementById('settings-modal').classList.remove('active');
        setTimeout(() => {
            document.querySelector('.modal-card').classList.remove('about-active');
            document.querySelectorAll('.animated-details').forEach(el => {
                el.removeAttribute('open');
                const content = el.querySelector('.details-content');
                if (content) {
                    content.style.gridTemplateRows = '0fr';
                }
            });
        }, 300);
    };

    window.autoSaveSettings = function() {
        const langVal = document.getElementById('setting-lang').value;
        const themeVal = document.getElementById('setting-theme').value;
        const tokenVal = document.getElementById('setting-mxm-token').value.trim();
        
        localStorage.setItem('theme', themeVal);
        localStorage.setItem('mxm_user_token', tokenVal);
        
        applyTheme(themeVal);
        
        if (window.currentLang !== langVal) {
            window.currentLang = langVal;
            localStorage.setItem('lang', langVal);
            window.updateUILanguage();
            writeLog(window.i18n[window.currentLang].logSettingsSaved, 'success');
        }
    };

    window.showAboutPage = function() {
        document.querySelector('.modal-card').classList.add('about-active');
    };

    window.showSettingsPage = function() {
        document.querySelector('.modal-card').classList.remove('about-active');
    };
    const dropZone = document.getElementById('drop-zone');
    if (dropZone) {
        ['dragenter', 'dragover'].forEach(eventName => dropZone.addEventListener(eventName, e => { e.preventDefault(); dropZone.classList.add('dragover'); }));
        ['dragleave', 'drop'].forEach(eventName => dropZone.addEventListener(eventName, e => { e.preventDefault(); dropZone.classList.remove('dragover'); }));
        dropZone.addEventListener('drop', e => { 
            e.preventDefault(); 
            if (e.dataTransfer.files.length > 0) handleSingleFile(e.dataTransfer.files[0]); 
        });
    }
    function writeLog(text, type = 'info') {
        const logDiv = document.getElementById('log');
        if (!logDiv) return;
        const time = new Date().toLocaleTimeString();
        const line = document.createElement('div');
        line.className = `log-line log-${type}`;
        line.innerText = `[${time}] ${text}`;
        const isAtBottom = logDiv.scrollHeight - logDiv.clientHeight - logDiv.scrollTop <= 40;
        
        logDiv.appendChild(line);
        
        if (isAtBottom) {
            logDiv.scrollTop = logDiv.scrollHeight;
        }
    }
    function parseFileName(fileName) {
        const nameWithoutExt = fileName.substring(0, fileName.lastIndexOf('.')) || fileName;
        let title = nameWithoutExt.replace(/^\d+[\s.-]+/, '').trim();
        const parts = title.split(/ - | — | – |-/);
        return parts.length > 1 
            ? { artist: parts[0].trim(), title: parts.slice(1).join(' - ').trim() } 
            : { artist: "", title: title };
    }
    function handleSingleFile(file) {
        if (!file) return;
        writeLog(window.i18n[window.currentLang].logSingleSelected.replace('{name}', file.name));
        const metaDisplay = document.getElementById('meta-display');
        const manualSearch = document.getElementById('manual-search');
        metaDisplay.style.display = "none";
        manualSearch.style.display = "none";
        
        const backupMeta = parseFileName(file.name);

        jsmediatags.read(file, {
            onSuccess: function(tag) {
                const artist = tag.tags.artist?.trim() || backupMeta.artist;
                const title = tag.tags.title?.trim() || backupMeta.title;
                applySingleMetadata(artist, title, "Tags successfully read.");
            },
            onError: function() { 
                applySingleMetadata(backupMeta.artist, backupMeta.title, "Tags not found. Used filename parsing."); 
            }
        });
    }

    function applySingleMetadata(artist, title, msg) {
        document.getElementById('artist').value = artist; 
        document.getElementById('title').value = title;
        const metaDisplay = document.getElementById('meta-display');
        metaDisplay.innerHTML = `<div><strong>${window.i18n[window.currentLang].singleMode}</strong> ${artist || '?'} — ${title}</div><span style="font-size:11px;color:var(--text-secondary);">${msg}</span>`;
        metaDisplay.style.display = "flex"; 
        document.getElementById('manual-search').style.display = "flex";
    }
    function formatTimeLRC(seconds) {
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = Math.floor(seconds % 60).toString().padStart(2, '0');
        const ms = Math.floor((seconds % 1) * 100).toString().padStart(2, '0');
        return `${m}:${s}.${ms}`;
    }
    function convertToEnhancedLRC(data) {
        let lrcContent = "";

        data.lyrics.forEach(line => {
            let lineBegin = parseFloat(line.begin || line.time);
            if (lineBegin > 1000) lineBegin /= 1000;
            
            const rawWords = line.words || line.syllabus;
            let lineStr = `[${formatTimeLRC(lineBegin)}]`;

            if (rawWords && rawWords.length > 0) {
                let firstWordBegin = parseFloat(rawWords[0].begin || rawWords[0].time);
                if (firstWordBegin > 1000) firstWordBegin /= 1000;
                const hasCrazyOffsetBug = (firstWordBegin >= lineBegin + 2.0);

                let lastWordEnd = lineBegin;

                rawWords.forEach(w => {
                    let wordBegin = parseFloat(w.begin || w.time);
                    let wordEnd = parseFloat(w.end || (w.time + w.duration));
                    
                    if (wordBegin > 1000) wordBegin /= 1000;
                    if (wordEnd > 1000) wordEnd /= 1000;
                    
                    if (hasCrazyOffsetBug) {
                        wordBegin = lineBegin + (wordBegin - firstWordBegin);
                        wordEnd = lineBegin + (wordEnd - firstWordBegin);
                    }
                    if (wordBegin < lineBegin) wordBegin = lineBegin;
                    if (wordEnd < wordBegin) wordEnd = wordBegin + 0.5;

                    lineStr += `<${formatTimeLRC(wordBegin)}>${w.text}`;
                    lastWordEnd = wordEnd;
                });
                
                lineStr += `<${formatTimeLRC(lastWordEnd)}>`;
            } else {
                lineStr += line.text;
            }
            lrcContent += lineStr + "\n";
        });

        return lrcContent;
    }
    function isWordByWord(result) {
        if (!result || !result.lyrics) return false;
        if (result.type && result.type.toUpperCase() === 'WORD') return true;
        return result.lyrics.some(line => {
            const words = line.words || line.syllabus || [];
            return words.length > 0;
        });
    }
    async function fetchFromMusixmatch(artist, title) {
        const token = localStorage.getItem('mxm_user_token')?.trim();
        if (!token) {
            writeLog(window.i18n[window.currentLang].logMxmNoToken, 'warning');
            return null;
        }
        try {
            const res = await fetch(`https://apic-desktop.musixmatch.com/ws/1.1/macro.subtitles.get?app_id=web-desktop-app-v1.0&usertoken=${token}&q_artist=${encodeURIComponent(artist)}&q_track=${encodeURIComponent(title)}`);
            if (!res.ok) return null;
            const body = (await res.json()).message?.body?.macro_calls;
            if (!body) return null;

            const rsCall = body['track.richsync.get'];
            if (rsCall && rsCall.message.header.status_code === 200) {
                const parsed = JSON.parse(rsCall.message.body.richsync?.richsync_body);
                const lyrics = parsed.map(item => ({
                    begin: item.ts,
                    text: item.l.map(w => w.c).join(''),
                    words: item.l.map(w => ({ text: w.c, begin: item.ts + w.o }))
                }));
                return { lyrics };
            }
        } catch (e) {
            console.error("Musixmatch API error:", e);
        } 
        return null;
    }
    async function fetchFromLyricsPlus(artist, title) {
        for (const m of ['https://lyricsplus.prjktla.my.id', 'https://lyricsplus.atomix.one']) {
            try {
                const res = await fetch(`${m}/v2/lyrics/get?artist=${encodeURIComponent(artist)}&title=${encodeURIComponent(title)}&source=apple,musixmatch-word`);
                if (res.ok) { 
                    const data = await res.json(); 
                    if (data && data.lyrics) return data; 
                }
            } catch (e) {
                console.warn(`LyricsPlus source error (${m}):`, e);
            }
        } 
        return null;
    }
    window.downloadLyrics = async function() {
        const artist = document.getElementById('artist').value.trim();
        const title = document.getElementById('title').value.trim();
        if (!artist || !title) return;

        writeLog(window.i18n[window.currentLang].logSearchingLyrics.replace('{artist}', artist).replace('{title}', title), 'debug');
        let result = await fetchFromLyricsPlus(artist, title);
        let source = "Apple Music (LyricsPlus)";

        if (!isWordByWord(result)) {
            writeLog(window.i18n[window.currentLang].logNoSyllablesApple, 'info');
            result = await fetchFromMusixmatch(artist, title);
            source = "Musixmatch";
        }

        if (isWordByWord(result)) {
            writeLog(window.i18n[window.currentLang].logTrackSuccess.replace('{artist}', artist).replace('{title}', title).replace('{source}', source), 'success');
            const lrcContent = convertToEnhancedLRC(result);
            
            const blob = new Blob([lrcContent], {type: 'text/plain'});
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `${artist} - ${title}.lrc`;
            document.body.appendChild(a); 
            a.click(); 
            document.body.removeChild(a);
            writeLog(window.i18n[window.currentLang].logSingleSuccess, 'success');
        } else {
            writeLog(window.i18n[window.currentLang].logSingleNotFound, 'error');
        }
    };
    window.selectLibraryFolder = async function() {
        try {
            rootDirectoryHandle = await window.showDirectoryPicker();
            document.getElementById('selected-folder-path').innerText = window.i18n[window.currentLang].folderSelected.replace('{name}', rootDirectoryHandle.name);
            writeLog(window.i18n[window.currentLang].logFolderSelected.replace('{name}', rootDirectoryHandle.name), 'info');
            
            await reloadQueue();
        } catch (err) {
            console.error("Folder pick error:", err);
            if (err.name === 'AbortError' || err.message.includes('aborted')) {
                writeLog(window.i18n[window.currentLang].logFolderSelectionCancelled, 'warning');
            } else {
                writeLog(err.message, 'error');
            }
        }
    };
    async function scanDirectory(dirHandle, pathArray = []) {
        let files = [];
        const isRecursive = document.getElementById('recursive-scan').checked;
        
        for await (const entry of dirHandle.values()) {
            if (entry.kind === 'file') {
                if (isAudioFile(entry.name)) {
                    files.push({
                        handle: entry,
                        parentHandle: dirHandle,
                        pathParts: [...pathArray],
                        name: entry.name,
                        status: 'pending',
                        artist: '',
                        title: '',
                        album: '',
                        metaSource: '',
                        message: window.i18n[window.currentLang].statusPending
                    });
                }
            } else if (entry.kind === 'directory' && isRecursive) {
                const subFiles = await scanDirectory(entry, [...pathArray, entry.name]);
                files = files.concat(subFiles);
            }
        }
        return files;
    }

    function isAudioFile(filename) {
        const ext = filename.split('.').pop().toLowerCase();
        return ['mp3', 'm4a', 'flac', 'ogg', 'wav', 'aac', 'opus', 'mka', 'wma'].includes(ext);
    }
    async function checkLrcState(dirHandle, audioFileName) {
        const lrcName = audioFileName.substring(0, audioFileName.lastIndexOf('.')) + '.lrc';
        try {
            const fileHandle = await dirHandle.getFileHandle(lrcName);
            const file = await fileHandle.getFile();
            const text = await file.text();
            const hasWordTimings = /<\d{1,2}:\d{2}\.\d{2,3}>/.test(text);
            return hasWordTimings ? 'enhanced' : 'flat';
        } catch (e) {
            return 'missing';
        }
    }
    function fallbackFromPath(fileItem, rootName) {
        const parsedName = parseFileName(fileItem.name);
        let title = parsedName.title;
        let artist = parsedName.artist;
        let album = "";
        
        const fullChain = [rootName, ...fileItem.pathParts];
        if (fullChain.length >= 3) {
            if (!artist) artist = fullChain[fullChain.length - 2];
            album = fullChain[fullChain.length - 1];
        } else if (fullChain.length === 2) {
            if (!artist) artist = fullChain[0];
            album = fullChain[1];
        } else {
            album = rootName;
        }
        
        return { artist, title, album };
    }
    async function getTrackMetadata(fileItem, rootName) {
        const file = await fileItem.handle.getFile();
        const fallback = fallbackFromPath(fileItem, rootName);
        const defArtist = document.getElementById('default-artist').value.trim();

        return new Promise((resolve) => {
            jsmediatags.read(file, {
                onSuccess: function(tag) {
                    let artist = tag.tags.artist?.trim() || "";
                    let title = tag.tags.title?.trim() || "";
                    let album = tag.tags.album?.trim() || "";
                    
                    let source = "Audio Tags";
                    
                    if (!artist || !title) {
                        if (!artist) artist = fallback.artist || defArtist;
                        if (!title) title = fallback.title;
                        if (!album) album = fallback.album;
                        source = "Tags & Folder Structure";
                    }
                    
                    resolve({ artist, title, album, source });
                },
                onError: function() {
                    let artist = fallback.artist || defArtist;
                    resolve({ 
                        artist: artist, 
                        title: fallback.title, 
                        album: fallback.album, 
                        source: "Folder Structure / Filename" 
                    });
                }
            });
        });
    }
    async function writeLrcFile(dirHandle, audioFileName, content) {
        const lrcName = audioFileName.substring(0, audioFileName.lastIndexOf('.')) + '.lrc';
        const fileHandle = await dirHandle.getFileHandle(lrcName, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(content);
        await writable.close();
    }
    async function reloadQueue() {
        if (!rootDirectoryHandle) return;
        
        writeLog(window.i18n[window.currentLang].logScanning, 'info');
        queue = await scanDirectory(rootDirectoryHandle, []);
        window.queue = queue;
        
        currentIndex = 0;
        isRunning = false;
        isPaused = false;
        
        writeLog(window.i18n[window.currentLang].logFoundTracks.replace('{count}', queue.length), 'info');
        
        updateStats();
        renderQueueTable();
        updateControls();
        
        setTimeout(() => {
            runBackgroundMetadataScanner();
        }, 500);
    }

    let bgScannerSessionId = 0;
    async function runBackgroundMetadataScanner() {
        const currentSessionId = ++bgScannerSessionId;
        const rootName = rootDirectoryHandle ? rootDirectoryHandle.name : "Library";
        
        for (let i = 0; i < queue.length; i++) {
            if (bgScannerSessionId !== currentSessionId) break;
            
            const item = queue[i];
            if (!item.artist || !item.title) {
                try {
                    const meta = await getTrackMetadata(item, rootName);
                    item.artist = meta.artist;
                    item.title = meta.title;
                    item.album = meta.album;
                    item.metaSource = meta.source;
                    window.updateItemRow(i);
                } catch (e) {}
            }
            if (i % 5 === 0) await new Promise(r => setTimeout(r, 5));
        }
    }
    function updateControls() {
        const hasQueue = queue.length > 0;
        const disableInteraction = isRunning && !isPaused;
        
        document.getElementById('btn-start').disabled = !hasQueue || disableInteraction;
        document.getElementById('btn-pause').disabled = !isRunning || isPaused;
        document.getElementById('btn-stop').disabled = !isRunning;
        document.getElementById('btn-select-folder').disabled = disableInteraction;
        document.getElementById('recursive-scan').disabled = disableInteraction;
        document.querySelectorAll('.btn-action-search').forEach(btn => {
            btn.disabled = disableInteraction;
        });
    }
    function renderQueueTable() {
        const tbody = document.getElementById('queue-body');
        if (!tbody) return;
        tbody.innerHTML = '';
        
        if (queue.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="empty-table" id="empty-table-text">${window.i18n[window.currentLang].emptyTable}</td></tr>`;
            return;
        }

        queue.forEach((item, index) => {
            const tr = document.createElement('tr');
            tr.id = `row-item-${index}`;
            tr.innerHTML = `
                <td>${item.name}</td>
                <td id="row-artist-${index}">${item.artist || '—'}</td>
                <td id="row-title-${index}">${item.title || '—'}</td>
                <td id="row-meta-source-${index}">${item.metaSource || '—'}</td>
                <td id="row-status-${index}">
                    <span class="badge badge-pending">${window.i18n[window.currentLang].statusPending}</span>
                </td>
                <td>
                    <button class="btn-action-search" onclick="openManualSearchModal(${index})" title="${window.i18n[window.currentLang].manualSearchTitle || 'Manual Search'}" ${isRunning && !isPaused ? 'disabled' : ''}>
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                            <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
                        </svg>
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    window.filterQueueTable = function() {
        const query = document.getElementById('queue-search').value.toLowerCase();
        queue.forEach((item, index) => {
            const row = document.getElementById(`row-item-${index}`);
            if (!row) return;
            const matches = item.name.toLowerCase().includes(query) || 
                            (item.artist && item.artist.toLowerCase().includes(query)) ||
                            (item.title && item.title.toLowerCase().includes(query));
            row.style.display = matches ? '' : 'none';
        });
    };

    window.updateItemRow = function(index) {
        const item = queue[index];
        if (!item) return;

        const artistTd = document.getElementById(`row-artist-${index}`);
        const titleTd = document.getElementById(`row-title-${index}`);
        const sourceTd = document.getElementById(`row-meta-source-${index}`);
        const statusTd = document.getElementById(`row-status-${index}`);
        
        if (artistTd) artistTd.innerText = item.artist || '—';
        if (titleTd) titleTd.innerText = item.title || '—';
        if (sourceTd) sourceTd.innerText = item.metaSource || '—';
        
        if (statusTd) {
            let badgeClass = 'badge-pending';
            let badgeText = window.i18n[window.currentLang].statusPending;
            
            if (item.status === 'processing') { badgeClass = 'badge-processing'; badgeText = window.i18n[window.currentLang].statusProcessing; }
            else if (item.status === 'success') { badgeClass = 'badge-success'; badgeText = window.i18n[window.currentLang].statusSuccess; }
            else if (item.status === 'skipped') { badgeClass = 'badge-skipped'; badgeText = window.i18n[window.currentLang].statusSkipped; }
            else if (item.status === 'no_lyrics') { badgeClass = 'badge-warning'; badgeText = window.i18n[window.currentLang].statusNoLyrics; }
            else if (item.status === 'error' || item.status === 'failed') { badgeClass = 'badge-danger'; badgeText = window.i18n[window.currentLang].statusError; }
            
            statusTd.innerHTML = `<span class="badge ${badgeClass}" title="${item.message}">${badgeText}</span>`;
        }
    };
    window.updateStats = function() {
        let success = 0, noLyrics = 0, skipped = 0, failed = 0;
        
        queue.forEach(item => {
            if (item.status === 'success') success++;
            else if (item.status === 'no_lyrics') noLyrics++;
            else if (item.status === 'skipped') skipped++;
            else if (item.status === 'error' || item.status === 'failed') failed++;
        });

        const scannedEl = document.getElementById('stat-scanned');
        const successEl = document.getElementById('stat-success');
        const noLyricsEl = document.getElementById('stat-no-lyrics');
        const skippedEl = document.getElementById('stat-skipped');

        if (scannedEl) scannedEl.innerText = queue.length;
        if (successEl) successEl.innerText = success;
        if (noLyricsEl) noLyricsEl.innerText = noLyrics;
        if (skippedEl) skippedEl.innerText = skipped;

        const totalDone = success + noLyrics + skipped + failed;
        const pct = queue.length > 0 ? Math.round((totalDone / queue.length) * 100) : 0;
        
        const progBar = document.getElementById('queue-progress');
        if (progBar) progBar.style.width = `${pct}%`;
        
        const progText = document.getElementById('progress-text');
        if (progText) progText.innerText = `${totalDone} / ${queue.length} (${pct}%)`;
    };
    window.startQueue = async function() {
        if (queue.length === 0) return;
        isRunning = true;
        isPaused = false;
        updateControls();
        writeLog(window.i18n[window.currentLang].logQueueStarted, 'info');

        while (currentIndex < queue.length && isRunning && !isPaused) {
            const item = queue[currentIndex];
            if (item.status === 'success' || item.status === 'skipped' || item.status === 'no_lyrics') {
                currentIndex++;
                window.updateStats();
                continue;
            }

            await processQueueItem(currentIndex);
            currentIndex++;
            window.updateStats();

            if (currentIndex < queue.length && isRunning && !isPaused) {
                const delaySeconds = parseFloat(document.getElementById('request-delay').value) || 1.5;
                writeLog(`Pause ${delaySeconds} sec...`, 'debug');
                await new Promise(resolve => setTimeout(resolve, delaySeconds * 1000));
            }
        }

        if (currentIndex >= queue.length) {
            isRunning = false;
            writeLog(window.i18n[window.currentLang].logQueueFinished.replace('{count}', queue.filter(i => i.status === 'success').length), 'success');
        } else if (isPaused) {
            writeLog(window.i18n[window.currentLang].logQueuePaused, 'warning');
        }

        updateControls();
    };
    window.pauseQueue = function() {
        isPaused = true;
        updateControls();
        writeLog(window.i18n[window.currentLang].logQueuePaused, 'warning');
    };
    window.stopQueue = function() {
        isRunning = false;
        isPaused = false;
        currentIndex = 0;
        writeLog(window.i18n[window.currentLang].logQueueStopped, 'danger');
        queue.forEach((item, index) => {
            if (item.status === 'pending' || item.status === 'processing') {
                item.status = 'pending';
                item.message = window.i18n[window.currentLang].statusPending;
                window.updateItemRow(index);
            }
        });
        
        window.updateStats();
        updateControls();
    };
    async function processQueueItem(index) {
        const item = queue[index];
        item.status = 'processing';
        window.updateItemRow(index);
        writeLog(window.i18n[window.currentLang].logProcessingTrack.replace('{current}', index + 1).replace('{total}', queue.length).replace('{name}', item.name), 'info');

        try {
            const lrcState = await checkLrcState(item.parentHandle, item.name);
            const handleMode = document.getElementById('lrc-exist-mode').value;

            if (lrcState === 'enhanced' && (handleMode === 'skip-all' || handleMode === 'upgrade-flat')) {
                item.status = 'skipped';
                item.message = window.i18n[window.currentLang].logLrcExists.replace('{name}', item.name);
                window.updateItemRow(index);
                writeLog(window.i18n[window.currentLang].logLrcExists.replace('{name}', item.name), 'info');
                return;
            }

            if (lrcState === 'flat' && handleMode === 'skip-all') {
                item.status = 'skipped';
                item.message = window.i18n[window.currentLang].logLrcAnyExists.replace('{name}', item.name);
                window.updateItemRow(index);
                writeLog(window.i18n[window.currentLang].logLrcAnyExists.replace('{name}', item.name), 'info');
                return;
            }
            const meta = await getTrackMetadata(item, rootDirectoryHandle.name);
            item.artist = meta.artist;
            item.title = meta.title;
            item.album = meta.album;
            item.metaSource = meta.source;
            window.updateItemRow(index);

            if (!item.artist || !item.title) {
                item.status = 'failed';
                item.message = window.i18n[window.currentLang].logNoTags.replace('{name}', item.name);
                window.updateItemRow(index);
                writeLog(window.i18n[window.currentLang].logNoTags.replace('{name}', item.name), 'error');
                return;
            }
            writeLog(window.i18n[window.currentLang].logSearchingLyrics.replace('{artist}', item.artist).replace('{title}', item.title), 'debug');
            let result = await fetchFromLyricsPlus(item.artist, item.title);
            let source = "Apple Music (LyricsPlus)";

            if (!isWordByWord(result)) {
                writeLog(window.i18n[window.currentLang].logNoSyllablesApple, 'debug');
                result = await fetchFromMusixmatch(item.artist, item.title);
                source = "Musixmatch";
            }
            if (isWordByWord(result)) {
                writeLog(window.i18n[window.currentLang].logSyllablesFound.replace('{source}', source), 'debug');
                const lrcContent = convertToEnhancedLRC(result);
                await writeLrcFile(item.parentHandle, item.name, lrcContent);
                
                item.status = 'success';
                item.message = lrcState === 'flat' 
                    ? window.i18n[window.currentLang].logTrackSuccessUpdated.replace('{artist}', item.artist).replace('{title}', item.title).replace('{source}', source)
                    : window.i18n[window.currentLang].logTrackSuccess.replace('{artist}', item.artist).replace('{title}', item.title).replace('{source}', source);
                
                const successLog = lrcState === 'flat'
                    ? window.i18n[window.currentLang].logTrackSuccessUpdated.replace('{artist}', item.artist).replace('{title}', item.title).replace('{source}', source)
                    : window.i18n[window.currentLang].logTrackSuccess.replace('{artist}', item.artist).replace('{title}', item.title).replace('{source}', source);
                
                writeLog(successLog, 'success');
            } else {
                if (lrcState === 'flat') {
                    item.status = 'skipped';
                    item.message = window.i18n[window.currentLang].logTrackNoSyllablesKept.replace('{artist}', item.artist).replace('{title}', item.title);
                    writeLog(window.i18n[window.currentLang].logTrackNoSyllablesKept.replace('{artist}', item.artist).replace('{title}', item.title), 'info');
                } else {
                    item.status = 'no_lyrics';
                    item.message = window.i18n[window.currentLang].logTrackNoSyllables.replace('{artist}', item.artist).replace('{title}', item.title);
                    writeLog(window.i18n[window.currentLang].logTrackNoSyllables.replace('{artist}', item.artist).replace('{title}', item.title), 'warning');
                }
            }
        } catch (err) {
            console.error("Queue process item error:", err);
            item.status = 'error';
            item.message = err.message || 'Error';
            writeLog(window.i18n[window.currentLang].logTrackError.replace('{name}', item.name).replace('{error}', err.message || err), 'error');
        }

        window.updateItemRow(index);
    }
    window.openManualSearchModal = async function(index) {
        window.activeManualSearchIndex = index;
        const item = queue[index];
        if (!item) return;

        document.getElementById('manual-search-card').classList.remove('expanded');
        if (!item.artist || !item.title) {
            const meta = await getTrackMetadata(item, rootDirectoryHandle?.name || "Library");
            item.artist = meta.artist;
            item.title = meta.title;
            item.album = meta.album;
            item.metaSource = meta.source;
            window.updateItemRow(index);
        }

        document.getElementById('manual-artist').value = item.artist || '';
        document.getElementById('manual-title').value = item.title || '';
        document.getElementById('manual-results-list').innerHTML = '';
        
        document.getElementById('manual-search-modal').classList.add('active');
    };

    window.closeManualSearchModal = function() {
        document.getElementById('manual-search-modal').classList.remove('active');
    };

    async function fetchFromLrclib(artist, title) {
        try {
            const res = await fetch(`https://lrclib.net/api/get?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(title)}`);
            if (res.ok) {
                const data = await res.json();
                if (data && data.syncedLyrics) {
                    return data.syncedLyrics;
                }
            }
        } catch (e) {
            console.warn("LRCLIB fetch error:", e);
        }
        return null;
    }

    window.performManualSearch = async function() {
        const artist = document.getElementById('manual-artist').value.trim();
        const title = document.getElementById('manual-title').value.trim();
        const resultsList = document.getElementById('manual-results-list');
        
        if (!artist || !title) return;
        
        document.getElementById('manual-search-card').classList.add('expanded');
        
        resultsList.innerHTML = `<div style="text-align: center; color: var(--text-secondary); padding: 20px;">${window.i18n[window.currentLang].searching}</div>`;
        
        window.tempManualSearchResults = {};
        const results = [];
        try {
            const appleRes = await fetchFromLyricsPlus(artist, title);
            if (appleRes && appleRes.lyrics) {
                const isWord = isWordByWord(appleRes);
                const lrcContent = convertToEnhancedLRC(appleRes);
                const sourceKey = "Apple Music";
                const sourceLabel = isWord ? "Apple Music (Enhanced / Послоговый)" : "Apple Music (Synced / Построчный)";
                window.tempManualSearchResults[sourceKey] = lrcContent;
                results.push({
                    artist,
                    title,
                    source: sourceLabel,
                    sourceKey,
                    lyricsText: lrcContent
                });
            }
        } catch (e) { console.error("Apple Music search error:", e); }
        try {
            const mxmRes = await fetchFromMusixmatch(artist, title);
            if (mxmRes && mxmRes.lyrics) {
                const isWord = isWordByWord(mxmRes);
                const lrcContent = convertToEnhancedLRC(mxmRes);
                const sourceKey = "Musixmatch";
                const sourceLabel = isWord ? "Musixmatch (Enhanced / Послоговый)" : "Musixmatch (Synced / Построчный)";
                window.tempManualSearchResults[sourceKey] = lrcContent;
                results.push({
                    artist,
                    title,
                    source: sourceLabel,
                    sourceKey,
                    lyricsText: lrcContent
                });
            }
        } catch (e) { console.error("Musixmatch search error:", e); }
        try {
            const lrclibRes = await fetchFromLrclib(artist, title);
            if (lrclibRes) {
                const sourceKey = "LRCLIB";
                const sourceLabel = "LRCLIB (Synced / Построчный)";
                window.tempManualSearchResults[sourceKey] = lrclibRes;
                results.push({
                    artist,
                    title,
                    source: sourceLabel,
                    sourceKey,
                    lyricsText: lrclibRes
                });
            }
        } catch (e) { console.error("LRCLIB search error:", e); }
        resultsList.innerHTML = '';
        if (results.length === 0) {
            resultsList.innerHTML = `<div style="text-align: center; color: var(--text-secondary); padding: 20px;">${window.i18n[window.currentLang].noResultsFound}</div>`;
            return;
        }

        results.forEach((item) => {
            const card = document.createElement('div');
            card.className = 'search-result-card';
            const cleanPreview = item.lyricsText
                .replace(/<[^>]*>/g, '') 
                .replace(/\[\d{2}:\d{2}\.\d{2,3}\]/g, '') 
                .trim();

            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                    <div>
                        <div style="font-weight: 600; font-size: 14px; color: var(--text-primary); text-align: left;">${item.artist} - ${item.title}</div>
                        <div style="font-size: 11px; color: var(--primary); margin-top: 2px; font-weight: 500; text-align: left;">${item.source}</div>
                    </div>
                    <button class="btn btn-primary" onclick="saveManualSelection('${item.sourceKey}')" style="width: auto; padding: 6px 16px; font-size: 12px; height: 32px; border-radius: 100px;">Применить</button>
                </div>
                <details class="animated-details" style="font-size: 11px; width: 100%;">
                    <summary style="color: var(--text-secondary); cursor: pointer; text-align: left;">Посмотреть текст</summary>
                    <div class="details-content">
                        <div class="animated-details-inner" style="max-height: 120px; overflow-y: auto; background: var(--bg-log); border-radius: 8px; padding: 8px; font-family: monospace; white-space: pre-wrap; margin-top: 6px; color: var(--text-secondary); text-align: left; line-height: 1.4;">${cleanPreview}</div>
                    </div>
                </details>
            `;
            resultsList.appendChild(card);
            const details = card.querySelector('.animated-details');
            const summary = details.querySelector('summary');
            const content = details.querySelector('.details-content');
            summary.addEventListener('click', (e) => {
                e.preventDefault();
                if (details.hasAttribute('open')) {
                    content.style.gridTemplateRows = '0fr';
                    setTimeout(() => { details.removeAttribute('open'); }, 250);
                } else {
                    details.setAttribute('open', '');
                    setTimeout(() => { content.style.gridTemplateRows = '1fr'; }, 10);
                }
            });
        });
    };

    window.saveManualSelection = async function(sourceKey) {
        const item = queue[window.activeManualSearchIndex];
        const lrcContent = window.tempManualSearchResults[sourceKey];
        if (!item || !lrcContent) return;

        try {
            await writeLrcFile(item.parentHandle, item.name, lrcContent);
            
            item.status = 'success';
            item.metaSource = sourceKey;
            item.message = `Manually selected lyrics from ${sourceKey}`;
            
            window.updateItemRow(window.activeManualSearchIndex);
            window.updateStats();
            
            window.closeManualSearchModal();
            writeLog(`LRC successfully saved manually for ${item.name} (${sourceKey})`, 'success');
        } catch (e) {
            console.error("Failed to save manually selected LRC:", e);
            writeLog(`Error saving manual match: ${e.message}`, 'error');
        }
    };
})();
