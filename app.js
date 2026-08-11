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
        return 'en';
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
        updateSegmentedThemeUI(theme);
    }

    function updateSegmentedThemeUI(theme) {
        const activeTheme = theme || localStorage.getItem('theme') || 'system';
        document.querySelectorAll('#theme-segmented-control .segmented-btn').forEach(btn => {
            if (btn.getAttribute('data-value') === activeTheme) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }

    window.setThemeFromSegment = function(theme) {
        localStorage.setItem('theme', theme);
        applyTheme(theme);
        if (typeof window.autoSaveSettings === 'function') {
            window.autoSaveSettings();
        }
    };

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
        updateSegmentedThemeUI(currentTheme);
        document.getElementById('setting-mxm-token').value = localStorage.getItem('mxm_user_token') || '';
        window.updateUILanguage();
        writeLog(window.i18n[window.currentLang].logWaitingFolder, 'info');
        
        function bindOverlayClose(modalId, closeFn) {
            const modal = document.getElementById(modalId);
            if (!modal) return;
            let isMouseDownOnOverlay = false;
            modal.addEventListener('mousedown', (e) => {
                isMouseDownOnOverlay = (e.target === modal);
            });
            modal.addEventListener('click', (e) => {
                if (e.target === modal && isMouseDownOnOverlay) {
                    closeFn();
                }
                isMouseDownOnOverlay = false;
            });
        }
        const settingsModal = document.getElementById('settings-modal');
        const manualSearchModal = document.getElementById('manual-search-modal');
        bindOverlayClose('settings-modal', closeSettingsModal);
        bindOverlayClose('manual-search-modal', closeManualSearchModal);

        ['manual-artist', 'manual-title', 'manual-album'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        window.performManualSearch();
                    }
                });
            }
        });

        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' || e.key === 'Esc') {
                if (settingsModal && settingsModal.classList.contains('active')) {
                    closeSettingsModal();
                }
                if (manualSearchModal && manualSearchModal.classList.contains('active')) {
                    closeManualSearchModal();
                }
            }
            if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'F')) {
                const qSearch = document.getElementById('queue-search');
                if (qSearch) {
                    e.preventDefault();
                    qSearch.focus();
                    qSearch.select();
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
            if (summary && content) {
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
            }
        });
        const tableContainer = document.querySelector('.table-container');
        if (tableContainer) {
            tableContainer.addEventListener('scroll', function() {
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
        }

        setupLogResizer();
    });

    function setupLogResizer() {
        const logsSection = document.getElementById('logs-section');
        const resizeHandle = document.getElementById('log-resize-handle');
        if (logsSection && resizeHandle) {
            const savedHeight = localStorage.getItem('logs_section_height');
            if (savedHeight) {
                logsSection.style.height = savedHeight;
            }

            let isResizing = false;
            let startY = 0;
            let startHeight = 0;

            resizeHandle.addEventListener('mousedown', (e) => {
                isResizing = true;
                startY = e.clientY;
                startHeight = logsSection.offsetHeight;
                resizeHandle.classList.add('active');
                document.body.style.cursor = 'ns-resize';
                document.body.style.userSelect = 'none';
            });

            window.addEventListener('mousemove', (e) => {
                if (!isResizing) return;
                const deltaY = startY - e.clientY;
                const newHeight = Math.max(80, Math.min(window.innerHeight * 0.75, startHeight + deltaY));
                logsSection.style.height = `${newHeight}px`;
            });

            window.addEventListener('mouseup', () => {
                if (isResizing) {
                    isResizing = false;
                    resizeHandle.classList.remove('active');
                    document.body.style.cursor = '';
                    document.body.style.userSelect = '';
                    localStorage.setItem('logs_section_height', logsSection.style.height);
                }
            });
        }
    }

    window.openSettingsModal = function() {
        if (document.getElementById('setting-lang')) {
            document.getElementById('setting-lang').value = window.currentLang;
        }
        updateSegmentedThemeUI(localStorage.getItem('theme') || 'system');
        if (document.getElementById('setting-mxm-token')) {
            document.getElementById('setting-mxm-token').value = localStorage.getItem('mxm_user_token') || '';
        }
        document.querySelector('.modal-card').classList.remove('about-active');
        if (typeof window.renderProviderPriorityList === 'function') {
            window.renderProviderPriorityList();
        }
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
        const langVal = document.getElementById('setting-lang')?.value || 'en';
        const themeVal = localStorage.getItem('theme') || 'system';
        const tokenVal = document.getElementById('setting-mxm-token')?.value.trim() || '';
        
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

    window.exportSettings = function() {
        const settingsData = {
            theme: localStorage.getItem('theme') || 'system',
            lang: localStorage.getItem('lang') || 'ru',
            mxm_user_token: localStorage.getItem('mxm_user_token') || '',
            provider_priority: window.getProviderPriority(),
            preview_volume: localStorage.getItem('preview_volume') || '1'
        };
        const jsonStr = JSON.stringify(settingsData, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'wordbyword-settings.json';
        a.click();
        URL.revokeObjectURL(url);
        writeLog(window.i18n[window.currentLang].settingsExported || 'Settings exported.', 'success');
    };

    window.importSettings = function(file) {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const data = JSON.parse(e.target.result);
                if (data.theme) localStorage.setItem('theme', data.theme);
                if (data.lang) localStorage.setItem('lang', data.lang);
                if (data.mxm_user_token !== undefined) localStorage.setItem('mxm_user_token', data.mxm_user_token);
                if (Array.isArray(data.provider_priority)) window.saveProviderPriority(data.provider_priority);
                if (data.preview_volume !== undefined) localStorage.setItem('preview_volume', data.preview_volume);

                if (data.lang) window.currentLang = data.lang;
                window.updateUILanguage();
                updateSegmentedThemeUI(data.theme || 'system');
                applyTheme(data.theme || 'system');
                if (document.getElementById('setting-mxm-token')) {
                    document.getElementById('setting-mxm-token').value = data.mxm_user_token || '';
                }
                writeLog(window.i18n[window.currentLang].settingsImported || 'Settings imported successfully!', 'success');
            } catch (err) {
                console.error("Import settings error:", err);
                writeLog(window.i18n[window.currentLang].settingsImportError || 'Failed to import settings.', 'error');
            }
        };
        reader.readAsText(file);
    };

    window.showAboutPage = function() {
        document.querySelector('.modal-card').classList.add('about-active');
    };

    window.showSettingsPage = function() {
        document.querySelector('.modal-card').classList.remove('about-active');
    };

    window.addEventListener('dragover', e => e.preventDefault());
    window.addEventListener('drop', e => e.preventDefault());

    function setupUnifiedDragAndDrop() {
        const dropTargets = [
            document.querySelector('.app-container'),
            document.getElementById('queue-table-container')
        ].filter(Boolean);

        dropTargets.forEach(target => {
            ['dragenter', 'dragover'].forEach(evt => {
                target.addEventListener(evt, e => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (target.id === 'queue-table-container') {
                        target.classList.add('dragover');
                    }
                });
            });
            ['dragleave', 'drop'].forEach(evt => {
                target.addEventListener(evt, e => {
                    e.preventDefault();
                    e.stopPropagation();
                    target.classList.remove('dragover');
                });
            });
            target.addEventListener('drop', async e => {
                e.preventDefault();
                e.stopPropagation();
                target.classList.remove('dragover');
                await handleDropData(e.dataTransfer);
            });
        });
    }

    async function handleDropData(dataTransfer) {
        if (!dataTransfer) return;
        let newItems = [];

        if (dataTransfer.items && dataTransfer.items.length > 0) {
            for (let i = 0; i < dataTransfer.items.length; i++) {
                const item = dataTransfer.items[i];
                if (item.kind !== 'file') continue;

                let entry = null;
                if (item.webkitGetAsEntry) entry = item.webkitGetAsEntry();

                if (entry) {
                    const entryFiles = await scanWebkitEntry(entry, []);
                    newItems = newItems.concat(entryFiles);
                } else if (item.getAsFile) {
                    const file = item.getAsFile();
                    if (file && isAudioFile(file.name)) {
                        newItems.push({
                            file: file,
                            handle: null,
                            parentHandle: null,
                            pathParts: [],
                            name: file.name,
                            status: 'pending',
                            artist: '',
                            title: '',
                            album: '',
                            metaSource: '',
                            message: window.i18n[window.currentLang].statusPending
                        });
                    }
                }
            }
        }

        if (newItems.length === 0 && dataTransfer.files && dataTransfer.files.length > 0) {
            for (let i = 0; i < dataTransfer.files.length; i++) {
                const file = dataTransfer.files[i];
                if (isAudioFile(file.name)) {
                    newItems.push({
                        file: file,
                        handle: null,
                        parentHandle: null,
                        pathParts: [],
                        name: file.name,
                        status: 'pending',
                        artist: '',
                        title: '',
                        album: '',
                        metaSource: '',
                        message: window.i18n[window.currentLang].statusPending
                    });
                }
            }
        }

        if (newItems.length > 0) {
            queue = queue.concat(newItems);
            window.queue = queue;
            writeLog(window.i18n[window.currentLang].logFilesAdded.replace('{count}', newItems.length), 'info');
            renderQueueTable();
            updateStats();
            updateControls();
            runBackgroundMetadataScanner();
        }
    }

    async function scanWebkitEntry(entry, pathArray = []) {
        let files = [];
        if (!entry) return files;

        if (entry.isFile) {
            if (isAudioFile(entry.name)) {
                try {
                    const file = await new Promise((resolve, reject) => entry.file(resolve, reject));
                    files.push({
                        file: file,
                        handle: null,
                        parentHandle: null,
                        pathParts: [...pathArray],
                        name: entry.name,
                        status: 'pending',
                        artist: '',
                        title: '',
                        album: '',
                        metaSource: '',
                        message: window.i18n[window.currentLang].statusPending
                    });
                } catch (e) {}
            }
        } else if (entry.isDirectory) {
            const recScanEl = document.getElementById('recursive-scan');
            const isRecursive = recScanEl ? recScanEl.checked : true;
            const dirReader = entry.createReader();

            const readEntriesPromise = () => new Promise((resolve) => dirReader.readEntries(resolve, () => resolve([])));
            let entries = [];
            let batch = await readEntriesPromise();
            while (batch && batch.length > 0) {
                entries = entries.concat(batch);
                batch = await readEntriesPromise();
            }

            for (const child of entries) {
                if (child.isFile && isAudioFile(child.name)) {
                    try {
                        const file = await new Promise((resolve, reject) => child.file(resolve, reject));
                        files.push({
                            file: file,
                            handle: null,
                            parentHandle: null,
                            pathParts: [...pathArray, entry.name],
                            name: child.name,
                            status: 'pending',
                            artist: '',
                            title: '',
                            album: '',
                            metaSource: '',
                            message: window.i18n[window.currentLang].statusPending
                        });
                    } catch (e) {}
                } else if (child.isDirectory && isRecursive) {
                    const subFiles = await scanWebkitEntry(child, [...pathArray, entry.name]);
                    files = files.concat(subFiles);
                }
            }
        }
        return files;
    }

    window.handleMultipleFiles = async function(files) {
        if (!files || files.length === 0) return;
        let addedCount = 0;
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (isAudioFile(file.name)) {
                queue.push({
                    file: file,
                    handle: null,
                    parentHandle: null,
                    pathParts: [],
                    name: file.name,
                    status: 'pending',
                    artist: '',
                    title: '',
                    album: '',
                    metaSource: '',
                    message: window.i18n[window.currentLang].statusPending
                });
                addedCount++;
            }
        }
        window.queue = queue;
        if (addedCount > 0) {
            writeLog(window.i18n[window.currentLang].logFilesAdded.replace('{count}', addedCount), 'info');
            renderQueueTable();
            updateStats();
            updateControls();
            runBackgroundMetadataScanner();
        }
    };

    window.handleSingleFile = function(file) {
        if (!file) return;
        window.handleMultipleFiles([file]);
    };

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

    function formatTimeLRC(seconds) {
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = Math.floor(seconds % 60).toString().padStart(2, '0');
        const ms = Math.floor((seconds % 1) * 100).toString().padStart(2, '0');
        return `${m}:${s}.${ms}`;
    }

    function formatMMSS(seconds) {
        if (!seconds || isNaN(seconds)) return "0:00";
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    }

    function getAudioDuration(file) {
        return new Promise((resolve) => {
            if (!file) { resolve(0); return; }
            let timer = setTimeout(() => { resolve(0); }, 1500);
            try {
                const url = URL.createObjectURL(file);
                const audio = new Audio();
                audio.src = url;
                audio.onloadedmetadata = () => {
                    clearTimeout(timer);
                    const dur = audio.duration;
                    URL.revokeObjectURL(url);
                    resolve(isNaN(dur) ? 0 : dur);
                };
                audio.onerror = () => {
                    clearTimeout(timer);
                    URL.revokeObjectURL(url);
                    resolve(0);
                };
            } catch (e) {
                clearTimeout(timer);
                resolve(0);
            }
        });
    }

    function getLrcDuration(lrcText) {
        if (!lrcText) return 0;
        const matches = [...lrcText.matchAll(/\[(\d{2}):(\d{2})\.(\d{2,3})\]/g)];
        if (matches.length === 0) return 0;
        const lastMatch = matches[matches.length - 1];
        const min = parseInt(lastMatch[1], 10);
        const sec = parseInt(lastMatch[2], 10);
        const ms = parseInt(lastMatch[3].padEnd(3, '0'), 10) / 1000;
        return min * 60 + sec + ms;
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

    function cleanArtistName(artist) {
        if (!artist) return "";
        return artist
            .replace(/\s+(?:feat\.?|ft\.?|featuring|vs\.?|with)\s+.*/i, '')
            .split(/\s*[,&/]\s*/)[0]
            .trim();
    }

    async function fetchFromMusixmatch(artist, title, album = '') {
        const token = localStorage.getItem('mxm_user_token');
        if (!token) return null;

        const artistsToTry = [artist];
        const cleaned = cleanArtistName(artist);
        if (cleaned && cleaned.toLowerCase() !== artist.toLowerCase()) {
            artistsToTry.push(cleaned);
        }

        for (const art of artistsToTry) {
            try {
                let url = `https://apic-desktop.musixmatch.com/ws/1.1/macro.subtitles.get?app_id=web-desktop-app-v1.0&usertoken=${token}&q_artist=${encodeURIComponent(art)}&q_track=${encodeURIComponent(title)}`;
                if (album) url += `&q_album=${encodeURIComponent(album)}`;
                
                const res = await fetch(url);
                if (!res.ok) continue;
                const body = (await res.json()).message?.body?.macro_calls;
                if (!body) continue;

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
        }
        return null;
    }

    async function fetchFromLyricsPlus(artist, title, album = '') {
        const artistsToTry = [artist];
        const cleaned = cleanArtistName(artist);
        if (cleaned && cleaned.toLowerCase() !== artist.toLowerCase()) {
            artistsToTry.push(cleaned);
        }

        for (const art of artistsToTry) {
            for (const m of ['https://lyricsplus.prjktla.my.id', 'https://lyricsplus.atomix.one']) {
                try {
                    let url = `${m}/v2/lyrics/get?artist=${encodeURIComponent(art)}&title=${encodeURIComponent(title)}`;
                    if (album) url += `&album=${encodeURIComponent(album)}`;
                    url += `&source=apple,musixmatch-word`;

                    const res = await fetch(url);
                    if (res.ok) { 
                        const data = await res.json(); 
                        if (data && data.lyrics) return data; 
                    }
                } catch (e) {
                    console.warn(`LyricsPlus source error (${m}):`, e);
                }
            }
        }
        return null;
    }

    async function fetchFromLrclib(artist, title, album = '') {
        const artistsToTry = [artist];
        const cleaned = cleanArtistName(artist);
        if (cleaned && cleaned.toLowerCase() !== artist.toLowerCase()) {
            artistsToTry.push(cleaned);
        }

        for (const art of artistsToTry) {
            try {
                let url = `https://lrclib.net/api/get?artist_name=${encodeURIComponent(art)}&track_name=${encodeURIComponent(title)}`;
                if (album) url += `&album_name=${encodeURIComponent(album)}`;
                const res = await fetch(url);
                if (res.ok) {
                    const data = await res.json();
                    if (data && data.syncedLyrics) {
                        return data.syncedLyrics;
                    }
                }
            } catch (e) {
                console.warn("LRCLIB fetch error:", e);
            }
        }
        return null;
    }

    window.downloadLyrics = async function() {
        const artist = document.getElementById('artist').value.trim();
        const title = document.getElementById('title').value.trim();
        const album = document.getElementById('manual-album')?.value.trim() || '';
        if (!artist || !title) return;

        writeLog(window.i18n[window.currentLang].logSearchingLyrics.replace('{artist}', artist).replace('{title}', title), 'debug');
        let result = await fetchFromLyricsPlus(artist, title, album);
        let source = "Apple Music (LyricsPlus)";

        if (!isWordByWord(result)) {
            writeLog(window.i18n[window.currentLang].logNoSyllablesApple, 'info');
            result = await fetchFromMusixmatch(artist, title, album);
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
        if (!filename) return false;
        const ext = filename.split('.').pop().toLowerCase();
        return ['mp3', 'm4a', 'flac', 'ogg', 'wav', 'aac', 'opus', 'mka', 'wma'].includes(ext);
    }

    async function checkLrcState(dirHandle, audioFileName) {
        if (!dirHandle) return 'missing';
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
        
        const fullChain = [rootName, ...(fileItem.pathParts || [])];
        if (fullChain.length >= 3) {
            if (!artist) artist = fullChain[fullChain.length - 2];
            album = fullChain[fullChain.length - 1];
        } else if (fullChain.length === 2) {
            if (!artist) artist = fullChain[0];
            album = fullChain[1];
        } else {
            album = rootName || "";
        }
        
        return { artist, title, album };
    }

    window.getProviderPriority = function() {
        const defaultPriority = ['apple', 'lrclib', 'musixmatch', 'lrcmux'];
        try {
            const saved = localStorage.getItem('provider_priority');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length === 4) return parsed;
            }
        } catch (e) {}
        return defaultPriority;
    };

    window.saveProviderPriority = function(priorityList) {
        localStorage.setItem('provider_priority', JSON.stringify(priorityList));
        if (typeof window.renderProviderPriorityList === 'function') window.renderProviderPriorityList();
    };

    const providerNames = {
        lrclib: "LRCLIB",
        apple: "LyricsPlus (Apple / QQ / Spotify)",
        musixmatch: "Musixmatch",
        lrcmux: "lrcmux (KuGou / NetEase / YT Music)"
    };

    let draggedPriorityIndex = null;

    window.renderProviderPriorityList = function() {
        const container = document.getElementById('provider-priority-list');
        if (!container) return;
        const currentList = window.getProviderPriority();
        container.innerHTML = '';

        currentList.forEach((id, index) => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'provider-priority-item';
            itemDiv.setAttribute('draggable', 'true');
            itemDiv.setAttribute('data-index', index);
            itemDiv.innerHTML = `
                <div style="display: flex; align-items: center; gap: 8px;">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="var(--text-secondary)" style="cursor: grab; flex-shrink: 0;">
                        <path d="M4 9h16v2H4zm0 4h16v2H4z"/>
                    </svg>
                    <span>${index + 1}. ${providerNames[id] || id}</span>
                </div>
                <div style="display: flex; gap: 2px;">
                    <button class="btn-move" onclick="moveProviderUp(${index})" ${index === 0 ? 'disabled' : ''} title="${window.i18n[window.currentLang].moveUp || 'Up'}">▲</button>
                    <button class="btn-move" onclick="moveProviderDown(${index})" ${index === currentList.length - 1 ? 'disabled' : ''} title="${window.i18n[window.currentLang].moveDown || 'Down'}">▼</button>
                </div>
            `;

            itemDiv.addEventListener('dragstart', (e) => {
                draggedPriorityIndex = index;
                itemDiv.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
            });

            itemDiv.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                itemDiv.classList.add('drag-over');
            });

            itemDiv.addEventListener('dragleave', () => {
                itemDiv.classList.remove('drag-over');
            });

            itemDiv.addEventListener('drop', (e) => {
                e.preventDefault();
                itemDiv.classList.remove('drag-over');
                if (draggedPriorityIndex !== null && draggedPriorityIndex !== index) {
                    const list = window.getProviderPriority();
                    const [movedItem] = list.splice(draggedPriorityIndex, 1);
                    list.splice(index, 0, movedItem);
                    window.saveProviderPriority(list);
                }
            });

            itemDiv.addEventListener('dragend', () => {
                itemDiv.classList.remove('dragging');
                draggedPriorityIndex = null;
            });

            container.appendChild(itemDiv);
        });
    };

    window.moveProviderUp = function(index) {
        if (index <= 0) return;
        const list = window.getProviderPriority();
        const temp = list[index];
        list[index] = list[index - 1];
        list[index - 1] = temp;
        window.saveProviderPriority(list);
    };

    window.moveProviderDown = function(index) {
        const list = window.getProviderPriority();
        if (index >= list.length - 1) return;
        const temp = list[index];
        list[index] = list[index + 1];
        list[index + 1] = temp;
        window.saveProviderPriority(list);
    };

    async function parseOpusTags(file) {
        try {
            const slice = file.slice(0, 64 * 1024);
            const buffer = await slice.arrayBuffer();
            const bytes = new Uint8Array(buffer);
            
            let offset = -1;
            const magicOpus = [0x4F, 0x70, 0x75, 0x73, 0x54, 0x61, 0x67, 0x73];
            const magicVorbis = [0x03, 0x76, 0x6F, 0x72, 0x62, 0x69, 0x73];
            
            for (let i = 0; i < bytes.length - 8; i++) {
                let matchOpus = true;
                for (let j = 0; j < 8; j++) {
                    if (bytes[i + j] !== magicOpus[j]) { matchOpus = false; break; }
                }
                if (matchOpus) { offset = i + 8; break; }
                
                let matchVorbis = true;
                for (let j = 0; j < 7; j++) {
                    if (bytes[i + j] !== magicVorbis[j]) { matchVorbis = false; break; }
                }
                if (matchVorbis) { offset = i + 7; break; }
            }
            
            if (offset === -1) return null;
            
            const view = new DataView(buffer);
            const vendorLen = view.getUint32(offset, true);
            offset += 4 + vendorLen;
            
            const userCommentListLen = view.getUint32(offset, true);
            offset += 4;
            
            const textDecoder = new TextDecoder('utf-8');
            let artist = "", title = "", album = "";
            
            for (let c = 0; c < userCommentListLen && offset < bytes.length - 4; c++) {
                const commentLen = view.getUint32(offset, true);
                offset += 4;
                if (offset + commentLen > bytes.length) break;
                
                const commentStr = textDecoder.decode(bytes.subarray(offset, offset + commentLen));
                offset += commentLen;
                
                const eqIdx = commentStr.indexOf('=');
                if (eqIdx !== -1) {
                    const key = commentStr.substring(0, eqIdx).toUpperCase();
                    const val = commentStr.substring(eqIdx + 1).trim();
                    if (key === 'ARTIST') artist = val;
                    else if (key === 'TITLE') title = val;
                    else if (key === 'ALBUM') album = val;
                }
            }
            
            if (artist || title) {
                return { artist, title, album, source: "Audio Tags" };
            }
        } catch (e) {
            console.warn("Opus tag parsing error:", e);
        }
        return null;
    }

    async function getTrackMetadata(fileItem, rootName) {
        let file = fileItem.file;
        if (!file && fileItem.handle) {
            file = await fileItem.handle.getFile();
            fileItem.file = file;
        }
        const fallback = fallbackFromPath(fileItem, rootName);
        const defArtist = document.getElementById('default-artist').value.trim();

        if (!file) {
            return { 
                artist: fallback.artist || defArtist, 
                title: fallback.title, 
                album: fallback.album, 
                source: "Filename / Path" 
            };
        }

        const ext = file.name.split('.').pop().toLowerCase();
        if (ext === 'opus' || ext === 'ogg') {
            const opusMeta = await parseOpusTags(file);
            if (opusMeta) {
                if (!opusMeta.artist) opusMeta.artist = fallback.artist || defArtist;
                if (!opusMeta.title) opusMeta.title = fallback.title;
                if (!opusMeta.album) opusMeta.album = fallback.album;
                return opusMeta;
            }
        }

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

        if (dirHandle) {
            try {
                if (dirHandle.queryPermission) {
                    const status = await dirHandle.queryPermission({ mode: 'readwrite' });
                    if (status !== 'granted' && dirHandle.requestPermission) {
                        try {
                            await dirHandle.requestPermission({ mode: 'readwrite' });
                        } catch (pe) {}
                    }
                }
                const fileHandle = await dirHandle.getFileHandle(lrcName, { create: true });
                const writable = await fileHandle.createWritable();
                await writable.write(content);
                await writable.close();
                return;
            } catch (e) {
                console.warn("Direct directory write error, using fallback download link:", e);
            }
        }

        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = lrcName;
        document.body.appendChild(a); 
        a.click(); 
        document.body.removeChild(a);
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
        
        const btnStart = document.getElementById('btn-start');
        const btnPause = document.getElementById('btn-pause');
        const btnStop = document.getElementById('btn-stop');
        const btnFolder = document.getElementById('btn-select-folder');
        const btnFiles = document.getElementById('btn-select-files');
        const btnClear = document.getElementById('btn-clear-queue');
        const recScan = document.getElementById('recursive-scan');

        if (btnStart) btnStart.disabled = !hasQueue || disableInteraction;
        if (btnPause) btnPause.disabled = !isRunning || isPaused;
        if (btnStop) btnStop.disabled = !isRunning;
        if (btnFolder) btnFolder.disabled = disableInteraction;
        if (btnFiles) btnFiles.disabled = disableInteraction;
        if (btnClear) btnClear.disabled = !hasQueue || disableInteraction;
        if (recScan) recScan.disabled = disableInteraction;
        
        document.querySelectorAll('.btn-action-search, .btn-action-delete').forEach(btn => {
            btn.disabled = disableInteraction;
        });
    }

    window.deleteQueueItem = function(index) {
        if (index < 0 || index >= queue.length) return;
        const removed = queue.splice(index, 1)[0];
        window.queue = queue;
        if (currentIndex > index) currentIndex--;
        renderQueueTable();
        updateStats();
        updateControls();
        if (removed) {
            writeLog(window.i18n[window.currentLang].logTrackDeleted.replace('{name}', removed.name), 'info');
        }
    };

    window.clearQueue = function() {
        queue = [];
        window.queue = queue;
        currentIndex = 0;
        isRunning = false;
        isPaused = false;
        renderQueueTable();
        updateStats();
        updateControls();
        writeLog(window.i18n[window.currentLang].logQueueCleared, 'info');
    };

    function renderQueueTable() {
        const tbody = document.getElementById('queue-body');
        if (!tbody) return;
        tbody.innerHTML = '';
        
        if (queue.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="empty-table" id="empty-table-text">${window.i18n[window.currentLang].emptyTable}</td></tr>`;
            return;
        }

        queue.sort((a, b) => (a.title || a.name).localeCompare(b.title || b.name, undefined, { numeric: true, sensitivity: 'base' }));

        queue.forEach((item, index) => {
            const tr = document.createElement('tr');
            tr.id = `row-item-${index}`;
            tr.innerHTML = `
                <td>${item.name}</td>
                <td id="row-artist-${index}">${item.artist || '—'}</td>
                <td id="row-title-${index}">${item.title || '—'}</td>
                <td id="row-album-${index}">${item.album || '—'}</td>
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
                    <button class="btn-action-delete" onclick="deleteQueueItem(${index})" title="${window.i18n[window.currentLang].deleteTrack || 'Delete'}" ${isRunning && !isPaused ? 'disabled' : ''}>
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                            <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                        </svg>
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        window.filterQueueTable();
    }

    window.currentStatusFilter = 'all';

    window.setQueueStatusFilter = function(status) {
        window.currentStatusFilter = status;
        document.querySelectorAll('#status-filter-pills .filter-pill').forEach(btn => {
            if (btn.getAttribute('data-status') === status) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
        window.filterQueueTable();
    };

    window.filterQueueTable = function() {
        const query = (document.getElementById('queue-search')?.value || '').toLowerCase();
        const filterStatus = window.currentStatusFilter || 'all';

        queue.forEach((item, index) => {
            const row = document.getElementById(`row-item-${index}`);
            if (!row) return;
            const matchesQuery = !query || 
                            item.name.toLowerCase().includes(query) || 
                            (item.artist && item.artist.toLowerCase().includes(query)) ||
                            (item.title && item.title.toLowerCase().includes(query)) ||
                            (item.album && item.album.toLowerCase().includes(query));
            const matchesStatus = filterStatus === 'all' || item.status === filterStatus;
            row.style.display = (matchesQuery && matchesStatus) ? '' : 'none';
        });
    };

    window.updateItemRow = function(index) {
        const item = queue[index];
        if (!item) return;

        const artistTd = document.getElementById(`row-artist-${index}`);
        const titleTd = document.getElementById(`row-title-${index}`);
        const albumTd = document.getElementById(`row-album-${index}`);
        const sourceTd = document.getElementById(`row-meta-source-${index}`);
        const statusTd = document.getElementById(`row-status-${index}`);
        
        if (artistTd) artistTd.innerText = item.artist || '—';
        if (titleTd) titleTd.innerText = item.title || '—';
        if (albumTd) albumTd.innerText = item.album || '—';
        if (sourceTd) sourceTd.innerText = item.metaSource || '—';
        
        if (statusTd) {
            let badgeClass = 'badge-pending';
            let badgeText = window.i18n[window.currentLang].statusPending;
            
            if (item.status === 'processing') { badgeClass = 'badge-processing'; badgeText = window.i18n[window.currentLang].statusProcessing; }
            else if (item.status === 'success') { badgeClass = 'badge-success'; badgeText = window.i18n[window.currentLang].statusSuccess; }
            else if (item.status === 'skipped') { badgeClass = 'badge-skipped'; badgeText = window.i18n[window.currentLang].statusSkipped; }
            else if (item.status === 'instrumental') { badgeClass = 'badge-warning'; badgeText = window.i18n[window.currentLang].statusInstrumental || 'Instrumental'; }
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
            else if (item.status === 'instrumental') skipped++;
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
            if (item.status === 'success' || item.status === 'skipped' || item.status === 'no_lyrics' || item.status === 'instrumental') {
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

    async function fetchFromLrcmux(artist, title, album = '', durationSec = 0) {
        const artistsToTry = [artist];
        const cleaned = cleanArtistName(artist);
        if (cleaned && cleaned.toLowerCase() !== artist.toLowerCase()) {
            artistsToTry.push(cleaned);
        }

        for (const art of artistsToTry) {
            try {
                let url = `https://api.lrcmux.dev/get?artist=${encodeURIComponent(art)}&title=${encodeURIComponent(title)}`;
                if (album) url += `&album=${encodeURIComponent(album)}`;
                if (durationSec > 0) url += `&duration=${Math.round(durationSec)}`;
                url += `&format=json`;

                const res = await fetch(url);
                if (res.ok) {
                    const data = await res.json();
                    if (data && data.lines) return data;
                }
            } catch (e) {
                console.warn("lrcmux fetch error:", e);
            }
        }
        return null;
    }

    function convertLrcmuxToEnhancedLRC(data) {
        if (!data || !data.lines || data.lines.length === 0) return "";
        let lrcContent = "";
        data.lines.forEach(line => {
            if (!line || typeof line.start !== 'number') return;
            const lineBeginSec = line.start / 1000;
            let lineStr = `[${formatTimeLRC(lineBeginSec)}]`;

            let validWords = [];
            if (Array.isArray(line.words) && line.words.length > 0) {
                validWords = line.words.filter(w => w && typeof w.start === 'number' && w.text && w.text.trim().length > 0 && !/^[\s'()"\\\/]+$/.test(w.text));
            }

            if (validWords.length > 0) {
                validWords.forEach(w => {
                    const wBeginSec = w.start / 1000;
                    lineStr += `<${formatTimeLRC(wBeginSec)}>${w.text}`;
                });
            } else if (line.text && line.text.trim().length > 0 && !/^[\s'()"\\\/]+$/.test(line.text)) {
                lineStr += line.text;
            } else {
                return;
            }
            lrcContent += lineStr + "\n";
        });
        return lrcContent.trim();
    }

    async function checkLrcState(dirHandle, audioFileName) {
        if (!dirHandle) return 'none';
        const lrcName = audioFileName.substring(0, audioFileName.lastIndexOf('.')) + '.lrc';
        try {
            const fileHandle = await dirHandle.getFileHandle(lrcName);
            if (!fileHandle) return 'none';
            const file = await fileHandle.getFile();
            const text = await file.text();
            if (!text || text.trim().length === 0) return 'none';
            if (/<[0-9]{2}:[0-9]{2}(?:\.[0-9]{2,3})?>/.test(text) || (text.includes('<') && text.includes('>') && /\[\d{2}:\d{2}\.\d{2,3}\]/.test(text))) {
                return 'enhanced';
            }
            return 'flat';
        } catch (e) {
            return 'none';
        }
    }

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
            const rootName = rootDirectoryHandle ? rootDirectoryHandle.name : "Library";
            const meta = await getTrackMetadata(item, rootName);
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
            
            let file = item.file;
            if (!file && item.handle) {
                try { file = await item.handle.getFile(); } catch (e) {}
            }
            let durationSec = 0;
            if (file) durationSec = await getAudioDuration(file);

            const priority = window.getProviderPriority();
            
            let wordLrcStr = "";
            let wordSource = "";
            let lineLrcStr = "";
            let lineSource = "";
            let isInstrumental = false;
            let instrumentalSource = "";

            const providerLabels = {
                'apple': 'LyricsPlus (Apple Music)',
                'lrclib': 'LRCLIB',
                'musixmatch': 'Musixmatch',
                'lrcmux': 'lrcmux'
            };

            for (const providerId of priority) {
                if (wordLrcStr || isInstrumental) break;

                const pLabel = providerLabels[providerId] || providerId;

                if (providerId === 'apple') {
                    writeLog(`[Search] Querying ${pLabel}...`, 'debug');
                    try {
                        const res = await fetchFromLyricsPlus(item.artist, item.title, item.album, durationSec);
                        if (res && res.lyrics && res.lyrics.length > 0) {
                            const isWord = isWordByWord(res);
                            const candidateLrc = convertToEnhancedLRC(res);
                            const lrcDur = getLrcDuration(candidateLrc);
                            const diff = (durationSec > 0 && lrcDur > 0) ? Math.abs(lrcDur - durationSec) : 0;
                            
                            const maxAllowedDiff = isWord ? 12 : 5;
                            if (diff <= maxAllowedDiff) {
                                if (isWord) {
                                    wordLrcStr = candidateLrc;
                                    wordSource = pLabel;
                                } else if (!lineLrcStr) {
                                    lineLrcStr = candidateLrc;
                                    lineSource = pLabel;
                                }
                            } else {
                                const diffStr = Math.round(lrcDur - durationSec) > 0 ? `+${Math.round(lrcDur - durationSec)}s` : `${Math.round(lrcDur - durationSec)}s`;
                                writeLog(`[Duration] Skipped ${pLabel}: lyrics length differs (${diffStr}).`, 'warning');
                            }
                        } else {
                            writeLog(`[Search] Word lyrics not found in ${pLabel}.`, 'debug');
                        }
                    } catch (e) {}
                } else if (providerId === 'lrclib') {
                    writeLog(`[Search] Querying ${pLabel}...`, 'debug');
                    try {
                        const res = await fetchFromLrclibFull(item.artist, item.title, item.album, durationSec);
                        if (res && res.length > 0) {
                            for (const lrItem of res) {
                                if (lrItem.instrumental) {
                                    isInstrumental = true;
                                    instrumentalSource = 'LRCLIB';
                                    break;
                                }
                                if (lrItem.syncedLyrics && !lineLrcStr) {
                                    const lrcDur = lrItem.duration || getLrcDuration(lrItem.syncedLyrics);
                                    const diff = (durationSec > 0 && lrcDur > 0) ? Math.abs(lrcDur - durationSec) : 0;
                                    if (diff <= 5) {
                                        lineLrcStr = lrItem.syncedLyrics;
                                        lineSource = `LRCLIB — ${lrItem.trackName || item.title}`;
                                    }
                                }
                            }
                        } else {
                            writeLog(`[Search] Word lyrics not found in ${pLabel}.`, 'debug');
                        }
                    } catch (e) {}
                } else if (providerId === 'musixmatch') {
                    const token = localStorage.getItem('mxm_user_token');
                    if (!token) {
                        writeLog(`Musixmatch token not configured. Skipping Musixmatch...`, 'debug');
                        continue;
                    }
                    writeLog(`[Search] Querying ${pLabel}...`, 'debug');
                    try {
                        const res = await fetchFromMusixmatch(item.artist, item.title, item.album);
                        if (res && res.lyrics && res.lyrics.length > 0) {
                            const isWord = isWordByWord(res);
                            const candidateLrc = convertToEnhancedLRC(res);
                            const lrcDur = getLrcDuration(candidateLrc);
                            const diff = (durationSec > 0 && lrcDur > 0) ? Math.abs(lrcDur - durationSec) : 0;
                            
                            const maxAllowedDiff = isWord ? 12 : 5;
                            if (diff <= maxAllowedDiff) {
                                if (isWord) {
                                    wordLrcStr = candidateLrc;
                                    wordSource = pLabel;
                                } else if (!lineLrcStr) {
                                    lineLrcStr = candidateLrc;
                                    lineSource = pLabel;
                                }
                            } else {
                                const diffStr = Math.round(lrcDur - durationSec) > 0 ? `+${Math.round(lrcDur - durationSec)}s` : `${Math.round(lrcDur - durationSec)}s`;
                                writeLog(`[Duration] Skipped ${pLabel}: lyrics length differs (${diffStr}).`, 'warning');
                            }
                        } else {
                            writeLog(`[Search] Word lyrics not found in ${pLabel}.`, 'debug');
                        }
                    } catch (e) {}
                } else if (providerId === 'lrcmux') {
                    writeLog(`[Search] Querying ${pLabel}...`, 'debug');
                    try {
                        const res = await fetchFromLrcmux(item.artist, item.title, item.album, durationSec);
                        if (res) {
                            if (res.meta?.instrumental) {
                                isInstrumental = true;
                                instrumentalSource = `lrcmux (${res.meta?.source?.name || 'KuGou'})`;
                                break;
                            }
                            const isWord = res.meta?.level === 'word';
                            const candidateLrc = convertLrcmuxToEnhancedLRC(res);
                            if (candidateLrc) {
                                const lrcDur = (typeof res.meta?.duration === 'number' && res.meta.duration > 0) ? res.meta.duration : getLrcDuration(candidateLrc);
                                const diff = (durationSec > 0 && lrcDur > 0) ? Math.abs(lrcDur - durationSec) : 0;
                                const srcName = `lrcmux (${res.meta?.source?.name || 'KuGou'})`;

                                const maxAllowedDiff = isWord ? 12 : 5;
                                if (diff <= maxAllowedDiff) {
                                    if (isWord) {
                                        wordLrcStr = candidateLrc;
                                        wordSource = srcName;
                                    } else if (!lineLrcStr) {
                                        lineLrcStr = candidateLrc;
                                        lineSource = srcName;
                                    }
                                } else {
                                    const diffStr = Math.round(lrcDur - durationSec) > 0 ? `+${Math.round(lrcDur - durationSec)}s` : `${Math.round(lrcDur - durationSec)}s`;
                                    writeLog(`[Duration] Skipped ${srcName}: lyrics length differs (${diffStr}).`, 'warning');
                                }
                            }
                        } else {
                            writeLog(`[Search] Word lyrics not found in ${pLabel}.`, 'debug');
                        }
                    } catch (e) {}
                }
            }

            if (isInstrumental) {
                item.status = 'instrumental';
                item.message = window.i18n[window.currentLang].logTrackInstrumental.replace('{artist}', item.artist).replace('{title}', item.title);
                writeLog(item.message, 'info');
                window.updateItemRow(index);
                return;
            }

            if (wordLrcStr) {
                writeLog(window.i18n[window.currentLang].logSyllablesFound.replace('{source}', wordSource), 'debug');
                await writeLrcFile(item.parentHandle, item.name, wordLrcStr);
                
                item.status = 'success';
                item.lyricsSource = wordSource;
                item.message = lrcState === 'flat' 
                    ? window.i18n[window.currentLang].logTrackSuccessUpdated.replace('{artist}', item.artist).replace('{title}', item.title).replace('{source}', wordSource)
                    : window.i18n[window.currentLang].logTrackSuccess.replace('{artist}', item.artist).replace('{title}', item.title).replace('{source}', wordSource);
                writeLog(item.message, 'success');
            } else if (lrcState === 'flat' && handleMode === 'upgrade-flat') {
                item.status = 'skipped';
                item.message = window.i18n[window.currentLang].logTrackNoSyllablesKept.replace('{artist}', item.artist).replace('{title}', item.title);
                writeLog(item.message, 'info');
            } else if (lineLrcStr) {
                await writeLrcFile(item.parentHandle, item.name, lineLrcStr);
                item.status = 'no_lyrics';
                item.lyricsSource = lineSource;
                item.message = `Saved line-synced lyrics from ${lineSource}`;
                writeLog(`[Saved Line-synced] ${item.artist} — ${item.title} (${lineSource})`, 'info');
            } else {
                item.status = 'no_lyrics';
                item.message = window.i18n[window.currentLang].logTrackNoSyllables.replace('{artist}', item.artist).replace('{title}', item.title);
                writeLog(item.message, 'warning');
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

        const card = document.getElementById('manual-search-card');
        if (card) card.classList.remove('expanded');

        const artistInp = document.getElementById('manual-artist');
        const titleInp = document.getElementById('manual-title');
        const albumInp = document.getElementById('manual-album');
        const listEl = document.getElementById('manual-results-list');
        const durChipEl = document.getElementById('manual-track-duration-chip');

        if (artistInp) artistInp.value = item.artist || '';
        if (titleInp) titleInp.value = item.title || '';
        if (albumInp) albumInp.value = item.album || '';
        if (listEl) listEl.innerHTML = '';
        if (durChipEl) {
            durChipEl.style.display = 'none';
            durChipEl.innerText = '';
        }

        document.getElementById('manual-search-modal').classList.add('active');

        if (!item.artist || !item.title) {
            const rootName = rootDirectoryHandle ? rootDirectoryHandle.name : "Library";
            const meta = await getTrackMetadata(item, rootName);
            item.artist = meta.artist;
            item.title = meta.title;
            item.album = meta.album;
            item.metaSource = meta.source;
            if (artistInp) artistInp.value = item.artist || '';
            if (titleInp) titleInp.value = item.title || '';
            if (albumInp) albumInp.value = item.album || '';
            window.updateItemRow(index);
        }

        let file = item.file;
        if (!file && item.handle) {
            try { file = await item.handle.getFile(); } catch (e) {}
        }
        let trackDuration = 0;
        if (file) {
            trackDuration = await getAudioDuration(file);
        }
        item._duration = trackDuration;

        if (durChipEl) {
            if (trackDuration > 0) {
                durChipEl.innerHTML = `
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" style="vertical-align: -2px;">
                        <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                    </svg>
                    <span>${window.i18n[window.currentLang].trackDuration}: ${formatMMSS(trackDuration)}</span>
                `;
                durChipEl.style.display = 'inline-flex';
            } else {
                durChipEl.style.display = 'none';
            }
        }

        const trackKey = `${item.artist}_${item.title}_${item.name}`.toLowerCase().replace(/[^a-z0-9]/g, '');

        if (window.manualSearchCache[trackKey]) {
            const cached = window.manualSearchCache[trackKey];
            window.tempManualSearchResults = cached.tempResults;
            if (card) card.classList.add('expanded');
            if (listEl) {
                listEl.innerHTML = cached.html;
                listEl.querySelectorAll('.search-result-card').forEach((cardEl, cIdx) => {
                    const details = cardEl.querySelector('.animated-details');
                    const summary = details?.querySelector('summary');
                    const content = details?.querySelector('.details-content');
                    const resItem = cached.results[cIdx];
                    if (summary && content && resItem) {
                        let isSetup = false;
                        summary.addEventListener('click', (e) => {
                            e.preventDefault();
                            if (!isSetup && resItem.lyricsText) {
                                setupKaraokePreview(details, resItem.lyricsText, file);
                                isSetup = true;
                            }
                            if (details.hasAttribute('open')) {
                                content.style.gridTemplateRows = '0fr';
                                setTimeout(() => { details.removeAttribute('open'); }, 250);
                            } else {
                                details.setAttribute('open', '');
                                setTimeout(() => { content.style.gridTemplateRows = '1fr'; }, 10);
                            }
                        });
                    }
                });
            }
            return;
        } else {
            if (card) card.classList.remove('expanded');
            if (listEl) listEl.innerHTML = '';
        }
    };

    window.closeManualSearchModal = function() {
        const modal = document.getElementById('manual-search-modal');
        if (modal) {
            modal.querySelectorAll('audio').forEach(audio => {
                try {
                    audio.pause();
                    audio.currentTime = 0;
                    if (audio.src && audio.src.startsWith('blob:')) {
                        URL.revokeObjectURL(audio.src);
                    }
                } catch (e) {}
            });
            modal.classList.remove('active');
        }
    };

    async function fetchFromLrclibFull(artist, title, album = '', durationSec = 0) {
        let items = [];
        const artistsToTry = [artist];
        const cleaned = cleanArtistName(artist);
        if (cleaned && cleaned.toLowerCase() !== artist.toLowerCase()) {
            artistsToTry.push(cleaned);
        }

        for (const art of artistsToTry) {
            try {
                let url = `https://lrclib.net/api/get?artist_name=${encodeURIComponent(art)}&track_name=${encodeURIComponent(title)}`;
                if (album) url += `&album_name=${encodeURIComponent(album)}`;
                if (durationSec > 0) url += `&duration=${Math.round(durationSec)}`;
                const res = await fetch(url);
                if (res.ok) {
                    const data = await res.json();
                    if (data) items.push(data);
                }
            } catch (e) {}

            try {
                let searchUrl = `https://lrclib.net/api/search?track_name=${encodeURIComponent(title)}&artist_name=${encodeURIComponent(art)}`;
                if (album) searchUrl += `&album_name=${encodeURIComponent(album)}`;
                const sRes = await fetch(searchUrl);
                if (sRes.ok) {
                    const sData = await sRes.json();
                    if (Array.isArray(sData)) {
                        sData.forEach(d => {
                            if (!items.some(existing => existing.id === d.id)) {
                                items.push(d);
                            }
                        });
                    }
                }
            } catch (e) {}
        }

        return items;
    }

    function parseLrcToKaraokeLines(lrcText) {
        if (!lrcText) return [];
        const rawLines = lrcText.split('\n');
        const parsed = [];

        rawLines.forEach(lineStr => {
            const match = lineStr.match(/\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\](.*)/);
            if (match) {
                const mins = parseInt(match[1], 10);
                const secs = parseInt(match[2], 10);
                const ms = match[3] ? parseInt(match[3].padEnd(3, '0'), 10) : 0;
                const timeSec = mins * 60 + secs + ms / 1000;
                const content = match[4];

                const words = [];
                const wordMatches = [...content.matchAll(/<(\d{2}):(\d{2})(?:\.(\d{2,3}))?>([^<]+)/g)];
                if (wordMatches && wordMatches.length > 0) {
                    wordMatches.forEach(wm => {
                        const wMins = parseInt(wm[1], 10);
                        const wSecs = parseInt(wm[2], 10);
                        const wMs = wm[3] ? parseInt(wm[3].padEnd(3, '0'), 10) : 0;
                        const wStartSec = wMins * 60 + wSecs + wMs / 1000;
                        const wText = wm[4];
                        if (wText && wText.trim().length > 0) {
                            words.push({ start: wStartSec, text: wText });
                        }
                    });
                }

                const cleanLineText = content.replace(/<[^>]*>/g, '').trim();
                if (cleanLineText) {
                    parsed.push({
                        time: timeSec,
                        text: cleanLineText,
                        words: words
                    });
                }
            }
        });

        parsed.sort((a, b) => a.time - b.time);
        return parsed;
    }

    function setupKaraokePreview(detailsEl, lyricsText, audioFile) {
        if (!detailsEl || !lyricsText) return;
        const container = detailsEl.querySelector('.details-content');
        if (!container) return;

        const lines = parseLrcToKaraokeLines(lyricsText);
        if (lines.length === 0) return;

        let audioUrl = null;
        if (audioFile) {
            try { audioUrl = URL.createObjectURL(audioFile); } catch (e) {}
        }

        let playerHtml = '';
        if (audioUrl) {
            playerHtml = `
                <div style="margin-top: 8px; margin-bottom: 6px;">
                    <audio controls src="${audioUrl}" style="width: 100%; height: 36px; border-radius: 8px; outline: none;"></audio>
                </div>
            `;
        }

        let linesHtml = lines.map((line, idx) => {
            let lineContentHtml = line.text;
            if (line.words && line.words.length > 0) {
                lineContentHtml = line.words.map((w, wIdx) => {
                    const nextW = line.words[wIdx + 1];
                    const wEnd = nextW ? nextW.start : line.time + 5;
                    const hasSpace = /\s$/.test(w.text);
                    const formattedText = hasSpace ? w.text : (w.text + ' ');
                    return `<span class="karaoke-word" data-wstart="${w.start}" data-wend="${wEnd}">${formattedText}</span>`;
                }).join('');
            }
            return `<div class="karaoke-line" data-line-index="${idx}" data-time="${line.time}">${lineContentHtml}</div>`;
        }).join('');

        container.innerHTML = `
            <div class="animated-details-inner" style="margin-top: 6px;">
                <div class="karaoke-preview-container">
                    ${playerHtml}
                    <div class="karaoke-preview-box">
                        ${linesHtml}
                    </div>
                </div>
            </div>
        `;

        const audioEl = container.querySelector('audio');
        const kBox = container.querySelector('.karaoke-preview-box');
        if (audioEl) {
            try {
                const savedVol = localStorage.getItem('preview_volume');
                if (savedVol !== null) audioEl.volume = parseFloat(savedVol);
            } catch (e) {}
            audioEl.addEventListener('volumechange', () => {
                try { localStorage.setItem('preview_volume', audioEl.volume.toString()); } catch (e) {}
            });
            audioEl.addEventListener('play', () => {
                document.querySelectorAll('#manual-search-modal audio').forEach(otherAudio => {
                    if (otherAudio !== audioEl && !otherAudio.paused) {
                        otherAudio.pause();
                    }
                });
            });
        }
        if (audioEl && kBox) {
            audioEl.addEventListener('timeupdate', () => {
                const curTime = audioEl.currentTime;
                let activeIdx = -1;

                for (let i = 0; i < lines.length; i++) {
                    const lineTime = lines[i].time;
                    const nextLineTime = lines[i + 1] ? lines[i + 1].time : lineTime + 10;
                    if (curTime >= lineTime - 0.2 && curTime < nextLineTime) {
                        activeIdx = i;
                        break;
                    }
                }

                kBox.querySelectorAll('.karaoke-line').forEach((lineEl, idx) => {
                    if (idx === activeIdx) {
                        if (!lineEl.classList.contains('active')) {
                            lineEl.classList.add('active');
                            const kBoxRect = kBox.getBoundingClientRect();
                            const lineRect = lineEl.getBoundingClientRect();
                            const offset = lineRect.top - kBoxRect.top - (kBox.clientHeight / 2) + (lineEl.clientHeight / 2);
                            kBox.scrollTop += offset;
                        }

                        lineEl.querySelectorAll('.karaoke-word').forEach(wordSpan => {
                            const wStart = parseFloat(wordSpan.getAttribute('data-wstart'));
                            const wEnd = parseFloat(wordSpan.getAttribute('data-wend'));
                            
                            if (curTime >= wEnd) {
                                wordSpan.classList.add('word-sung');
                                wordSpan.classList.remove('active-word');
                                wordSpan.style.setProperty('--word-progress', '100%');
                            } else if (curTime >= wStart - 0.05 && curTime < wEnd) {
                                wordSpan.classList.add('active-word');
                                wordSpan.classList.remove('word-sung');
                                const dur = Math.max(wEnd - wStart, 0.08);
                                const pct = Math.min(Math.max((curTime - wStart) / dur, 0), 1) * 100;
                                wordSpan.style.setProperty('--word-progress', `${pct.toFixed(1)}%`);
                            } else {
                                wordSpan.classList.remove('word-sung', 'active-word');
                                wordSpan.style.setProperty('--word-progress', '0%');
                            }
                        });
                    } else {
                        lineEl.classList.remove('active');
                        lineEl.querySelectorAll('.karaoke-word').forEach(wordSpan => {
                            wordSpan.classList.remove('word-sung', 'active-word');
                            wordSpan.style.setProperty('--word-progress', '0%');
                        });
                    }
                });
            });
        }
    }

    window.performManualSearch = async function() {
        const artist = document.getElementById('manual-artist').value.trim();
        const title = document.getElementById('manual-title').value.trim();
        const album = document.getElementById('manual-album')?.value.trim() || '';
        const resultsList = document.getElementById('manual-results-list');
        const activeIndex = window.activeManualSearchIndex;
        const item = queue[activeIndex];
        const localTrackDuration = item?._duration || 0;
        
        let itemFile = item?.file;
        if (!itemFile && item?.handle) {
            try { itemFile = await item.handle.getFile(); } catch (e) {}
        }
        
        if (!artist || !title) return;
        
        document.getElementById('manual-search-card').classList.add('expanded');
        
        resultsList.innerHTML = `
            <div style="text-align: center; color: var(--text-secondary); padding: 32px; display: flex; flex-direction: column; align-items: center; gap: 12px;">
                <div class="spinner"></div>
                <span style="font-size: 13px; font-weight: 500;">${window.i18n[window.currentLang].searching}</span>
            </div>
        `;
        
        window.tempManualSearchResults = {};
        const results = [];
        const instrumentalSources = [];

        const priority = window.getProviderPriority();

        for (const providerId of priority) {
            if (providerId === 'apple') {
                try {
                    const appleRes = await fetchFromLyricsPlus(artist, title, album, localTrackDuration);
                    if (appleRes && appleRes.lyrics && appleRes.lyrics.length > 0) {
                        const isWord = isWordByWord(appleRes);
                        const lrcContent = convertToEnhancedLRC(appleRes);
                        const sourceKey = "Apple Music";
                        window.tempManualSearchResults[sourceKey] = lrcContent;
                        results.push({
                            artist,
                            title,
                            album,
                            source: "LyricsPlus (Apple Music)",
                            sourceKey,
                            isWord,
                            isInstrumental: false,
                            lyricsText: lrcContent
                        });
                    }
                } catch (e) {}
            } else if (providerId === 'lrclib') {
                try {
                    const lrclibRes = await fetchFromLrclibFull(artist, title, album, localTrackDuration);
                    if (lrclibRes && lrclibRes.length > 0) {
                        lrclibRes.forEach((lrItem, idx) => {
                            if (lrItem.instrumental) {
                                instrumentalSources.push(`LRCLIB`);
                            }
                            if (lrItem.syncedLyrics) {
                                const sourceKey = `LRCLIB_${idx}`;
                                const sourceLabel = `LRCLIB — ${lrItem.trackName || title}`;
                                window.tempManualSearchResults[sourceKey] = lrItem.syncedLyrics;
                                results.push({
                                    artist: lrItem.artistName || artist,
                                    title: lrItem.trackName || title,
                                    album: lrItem.albumName || album,
                                    source: sourceLabel,
                                    sourceKey: sourceKey,
                                    isWord: false,
                                    isInstrumental: lrItem.instrumental,
                                    lyricsText: lrItem.syncedLyrics,
                                    providedDuration: lrItem.duration
                                });
                            }
                        });
                    }
                } catch (e) {}
            } else if (providerId === 'musixmatch') {
                try {
                    const mxmRes = await fetchFromMusixmatch(artist, title, album);
                    if (mxmRes && mxmRes.lyrics && mxmRes.lyrics.length > 0) {
                        const isWord = isWordByWord(mxmRes);
                        const lrcContent = convertToEnhancedLRC(mxmRes);
                        const sourceKey = "Musixmatch";
                        window.tempManualSearchResults[sourceKey] = lrcContent;
                        results.push({
                            artist,
                            title,
                            album,
                            source: "Musixmatch",
                            sourceKey,
                            isWord,
                            isInstrumental: false,
                            lyricsText: lrcContent
                        });
                    }
                } catch (e) {}
            } else if (providerId === 'lrcmux') {
                try {
                    const lrcmuxRes = await fetchFromLrcmux(artist, title, album, localTrackDuration);
                    if (lrcmuxRes) {
                        const isInst = lrcmuxRes.meta?.instrumental || false;
                        const sourceName = lrcmuxRes.meta?.source?.name || 'lrcmux';
                        if (isInst) {
                            instrumentalSources.push(`lrcmux (${sourceName})`);
                        }
                        const isWord = lrcmuxRes.meta?.level === 'word';
                        const lrcContent = isInst ? "" : convertLrcmuxToEnhancedLRC(lrcmuxRes);
                        if (lrcContent) {
                            const sourceKey = `lrcmux_${sourceName}`;
                            window.tempManualSearchResults[sourceKey] = lrcContent;
                            results.push({
                                artist: lrcmuxRes.track?.artist || artist,
                                title: lrcmuxRes.track?.title || title,
                                album: lrcmuxRes.track?.album || album,
                                source: `lrcmux (${sourceName})`,
                                sourceKey,
                                isWord,
                                isInstrumental: isInst,
                                lyricsText: lrcContent,
                                providedDuration: lrcmuxRes.track?.duration ? (lrcmuxRes.track.duration > 10000 ? lrcmuxRes.track.duration / 1000 : lrcmuxRes.track.duration) : 0
                            });
                        }
                    }
                } catch (e) {}
            }
        }

        resultsList.innerHTML = '';

        if (results.length === 0 && instrumentalSources.length > 0) {
            resultsList.innerHTML = `
                <div class="search-result-card" style="background: rgba(251, 191, 36, 0.08); border: 1px solid rgba(251, 191, 36, 0.3); padding: 24px; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 10px; margin-top: 12px; border-radius: 20px;">
                    <svg viewBox="0 0 24 24" width="44" height="44" fill="#FBBF24" style="margin-bottom: 2px;">
                        <path d="M4.27 3L3 4.27l9 9v.28c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4v-1.73l4.27 4.27L19.54 21 21 19.73 4.27 3zM14 7h4V3h-6v5.18l2 2V7z"/>
                    </svg>
                    <div style="font-weight: 700; font-size: 15px; color: var(--text-primary);">${window.i18n[window.currentLang].instrumentalNotice}</div>
                    <div style="font-size: 12px; color: var(--text-secondary); line-height: 1.5; max-width: 440px;">${window.currentLang === 'ru' ? 'В базах данных нет вокального текста для этой песни (композиция помечена как инструментальная).' : 'No vocal lyrics found in databases (track is marked as instrumental).'}</div>
                    <div style="font-size: 11px; color: var(--primary); font-weight: 600; margin-top: 4px; background: var(--bg-card); padding: 6px 14px; border-radius: 100px; border: 1px solid var(--border-color);">${window.i18n[window.currentLang].instrumentalConfirmedBy.replace('{sources}', [...new Set(instrumentalSources)].join(', '))}</div>
                </div>
            `;
            return;
        }

        if (results.length === 0) {
            resultsList.innerHTML = `
                <div class="search-result-card" style="background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.3); padding: 24px; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 10px; margin-top: 12px; border-radius: 20px;">
                    <svg viewBox="0 0 24 24" width="44" height="44" fill="#EF4444" style="margin-bottom: 2px;">
                        <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14zM7 9h5v1H7zm0-2h5v1H7z"/>
                    </svg>
                    <div style="font-weight: 700; font-size: 15px; color: var(--text-primary);">${window.i18n[window.currentLang].noResultsFound}</div>
                    <div style="font-size: 12px; color: var(--text-secondary); line-height: 1.5; max-width: 440px;">${window.currentLang === 'ru' ? 'Ничего не найдено ни в одной из подключенных баз (LyricsPlus, LRCLIB, Musixmatch, lrcmux).' : 'Lyrics not found in any connected databases (LyricsPlus, LRCLIB, Musixmatch, lrcmux).'}</div>
                </div>
            `;
            return;
        }

        function getProviderRank(item) {
            const src = (item.source || '').toLowerCase();
            const key = (item.sourceKey || '').toLowerCase();
            if (src.includes('lyricsplus') || src.includes('apple') || key.includes('apple')) return 1;
            if (src.includes('lrclib') || key.includes('lrclib')) return 2;
            if (src.includes('musixmatch') || key.includes('musixmatch')) return 3;
            if (src.includes('lrcmux') || key.includes('lrcmux')) return 4;
            return 99;
        }

        results.sort((a, b) => {
            const durA = a.providedDuration || getLrcDuration(a.lyricsText);
            const durB = b.providedDuration || getLrcDuration(b.lyricsText);
            const diffA = localTrackDuration > 0 && durA > 0 ? Math.abs(durA - localTrackDuration) : 999;
            const diffB = localTrackDuration > 0 && durB > 0 ? Math.abs(durB - localTrackDuration) : 999;
            
            const matchA = diffA <= 3 ? 1 : 0;
            const matchB = diffB <= 3 ? 1 : 0;
            
            if (matchA !== matchB) return matchB - matchA;

            if (a.isWord !== b.isWord) return a.isWord ? -1 : 1;

            const rankA = getProviderRank(a);
            const rankB = getProviderRank(b);
            if (rankA !== rankB) return rankA - rankB;

            return diffA - diffB;
        });

        const clockIcon = `<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" style="vertical-align: -1px; margin-right: 3px;"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg>`;

        results.forEach((resItem) => {
            const card = document.createElement('div');
            card.className = 'search-result-card';
            const cleanPreview = (resItem.lyricsText || '')
                .replace(/<[^>]*>/g, '') 
                .replace(/\[\d{2}:\d{2}(?:\.\d{2,3})?\]/g, '') 
                .trim();

            const lrcDur = (resItem.providedDuration && resItem.providedDuration > 0) ? resItem.providedDuration : getLrcDuration(resItem.lyricsText);
            let durationBadgeHtml = '';
            if (lrcDur > 0 && !resItem.isInstrumental) {
                const formattedLrcDur = formatMMSS(lrcDur);
                if (localTrackDuration > 0) {
                    const diff = Math.round(lrcDur - localTrackDuration);
                    if (Math.abs(diff) <= 3) {
                        durationBadgeHtml = `<span class="duration-tag matched" title="${window.i18n[window.currentLang].durationMatched}">${clockIcon}${formattedLrcDur} (${window.i18n[window.currentLang].durationMatched})</span>`;
                    } else {
                        const diffStr = diff > 0 ? `+${diff}s` : `${diff}s`;
                        durationBadgeHtml = `<span class="duration-tag diff" title="${window.i18n[window.currentLang].durationDiff}">${clockIcon}${formattedLrcDur} (${diffStr})</span>`;
                    }
                } else {
                    durationBadgeHtml = `<span class="duration-tag" style="background: rgba(255,255,255,0.06); color: var(--text-secondary);">${clockIcon}${formattedLrcDur}</span>`;
                }
            }

            let typeBadgeHtml = '';
            if (resItem.isInstrumental) {
                typeBadgeHtml = `<span class="badge badge-warning" style="font-size: 10px; padding: 2px 8px;">${window.currentLang === 'ru' ? 'Инструментал' : 'Instrumental'}</span>`;
            } else if (resItem.isWord) {
                typeBadgeHtml = `<span class="badge badge-success" style="font-size: 10px; padding: 2px 8px;">${window.currentLang === 'ru' ? 'Послоговый' : 'Word-by-word'}</span>`;
            } else {
                typeBadgeHtml = `<span class="badge badge-pending" style="font-size: 10px; padding: 2px 8px;">${window.currentLang === 'ru' ? 'Построчный' : 'Line-synced'}</span>`;
            }

            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: flex-start; width: 100%; gap: 12px;">
                    <div style="flex-grow: 1;">
                        <div style="font-weight: 600; font-size: 14px; color: var(--text-primary); text-align: left;">${resItem.artist} — ${resItem.title}</div>
                        ${resItem.album ? `<div style="font-size: 11px; color: var(--text-secondary); text-align: left; margin-top: 2px;">${resItem.album}</div>` : ''}
                        <div style="display: flex; align-items: center; gap: 8px; margin-top: 6px; flex-wrap: wrap;">
                            <span style="font-size: 11px; color: var(--primary); font-weight: 600;">${resItem.source}</span>
                            ${typeBadgeHtml}
                            ${durationBadgeHtml}
                        </div>
                    </div>
                    ${resItem.isInstrumental 
                        ? `<span style="font-size: 11px; color: var(--text-secondary); font-style: italic;">(без текста)</span>`
                        : `<button class="btn btn-primary" onclick="saveManualSelection('${resItem.sourceKey}')" style="width: auto; padding: 6px 16px; font-size: 12px; height: 32px; border-radius: 100px; flex-shrink: 0;">${window.currentLang === 'ru' ? 'Применить' : 'Apply'}</button>`
                    }
                </div>
                ${cleanPreview ? `
                <details class="animated-details" style="font-size: 11px; width: 100%; margin-top: 8px;">
                    <summary style="color: var(--text-secondary); cursor: pointer; text-align: left;">${window.currentLang === 'ru' ? 'Посмотреть текст' : 'Preview lyrics'}</summary>
                    <div class="details-content">
                        <div class="animated-details-inner"></div>
                    </div>
                </details>
                ` : ''}
            `;
            resultsList.appendChild(card);

            const details = card.querySelector('.animated-details');
            const summary = details?.querySelector('summary');
            const content = details?.querySelector('.details-content');
            if (summary && content) {
                let isSetup = false;
                summary.addEventListener('click', (e) => {
                    e.preventDefault();
                    if (!isSetup && resItem.lyricsText) {
                        setupKaraokePreview(details, resItem.lyricsText, itemFile);
                        isSetup = true;
                    }
                    if (details.hasAttribute('open')) {
                        content.style.gridTemplateRows = '0fr';
                        setTimeout(() => { details.removeAttribute('open'); }, 250);
                    } else {
                        details.setAttribute('open', '');
                        setTimeout(() => { content.style.gridTemplateRows = '1fr'; }, 10);
                    }
                });
            }
        });

        const trackKey = `${item.artist}_${item.title}_${item.name}`.toLowerCase().replace(/[^a-z0-9]/g, '');
        window.manualSearchCache[trackKey] = {
            results,
            html: resultsList.innerHTML,
            tempResults: window.tempManualSearchResults
        };
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
