// ================== 网易云音乐播放器 JS ==================
// 本文件包含网易云音乐播放器（#musicAppPage）的所有 JS 逻辑
// 依赖：showToast, callAI 等全局变量（来自 script.js）
// ===== Part 1: 数据库初始化 / 播放器核心逻辑 =====
function showMusicAppPage() {
    document.getElementById('musicAppPage').classList.add('active');
}

function closeMusicApp() {
    document.getElementById('musicAppPage').classList.remove('active');
}

// 网易云音乐播放器功能
// ============================================

// 初始化音乐播放器Dexie数据库
const wyyDb = new Dexie('WYYMusicPlayerDB');
wyyDb.version(1).stores({
    userSettings: 'id',
    playlistCards: 'id',
    songs: '++id, name, singer, dateAdded',
    songFiles: '++id, songId, type, data',
    lyrics: '++id, songId, data'
});
wyyDb.version(2).stores({
    userSettings: 'id',
    playlistCards: 'id',
    songs: '++id, name, singer, dateAdded, playlistId',
    songFiles: '++id, songId, type, data',
    lyrics: '++id, songId, data',
    playlists: '++id, name, desc, cover, dateCreated'
});

// 音乐播放器元素
const wyyPlayBtn = document.getElementById('wyyPlayBtn');
const wyyPlayerPlayBtn = document.getElementById('wyyPlayerPlayBtn');
const wyyRecordCover = document.getElementById('wyyRecordCover');
const wyyCurrentRecordContainer = document.getElementById('wyyCurrentRecordContainer');
const wyyAlbumArtLarge = document.getElementById('wyyAlbumArtLarge');
const wyyCurrentSongName = document.getElementById('wyyCurrentSongName');
const wyyCurrentSingerName = document.getElementById('wyyCurrentSingerName');
const wyyPlayerSongName = document.getElementById('wyyPlayerSongName');
const wyyPlayerSingerName = document.getElementById('wyyPlayerSingerName');
const wyyPlaylistBtn = document.getElementById('wyyPlaylistBtn');
const wyyPlaylistModal = document.getElementById('wyyPlaylistModal');
const wyySongsList = document.getElementById('wyySongsList');
const wyyEmptyPlaylist = document.getElementById('wyyEmptyPlaylist');
const wyyAddSongBtn = document.getElementById('wyyAddSongBtn');
const wyyClearAllBtn = document.getElementById('wyyClearAllBtn');
const wyyProgressBar = document.getElementById('wyyProgressBar');
const wyyProgress = document.getElementById('wyyProgress');
const wyyCurrentTime = document.getElementById('wyyCurrentTime');
const wyyTotalTime = document.getElementById('wyyTotalTime');
const wyyPrevBtn = document.getElementById('wyyPrevBtn');
const wyyNextBtn = document.getElementById('wyyNextBtn');
const wyyPlayBar = document.getElementById('wyyPlayBar');
const wyyBackBtn = document.getElementById('wyyBackBtn');
const wyyMainPage = document.getElementById('wyyMainPage');
const wyyPlayerPage = document.getElementById('wyyPlayerPage');

// 歌曲输入元素
const wyySongNameInput = document.getElementById('wyySongNameInput');
const wyySingerNameInput = document.getElementById('wyySingerNameInput');
const wyySongUrlInput = document.getElementById('wyySongUrlInput');
const wyyLyricUrlInput = document.getElementById('wyyLyricUrlInput');

// 上传选项按钮
const wyyUrlOptionBtn = document.getElementById('wyyUrlOptionBtn');
const wyyFileOptionBtn = document.getElementById('wyyFileOptionBtn');
const wyyUrlUploadSection = document.getElementById('wyyUrlUploadSection');
const wyyFileUploadSection = document.getElementById('wyyFileUploadSection');

const wyyLyricUrlOptionBtn = document.getElementById('wyyLyricUrlOptionBtn');
const wyyLyricFileOptionBtn = document.getElementById('wyyLyricFileOptionBtn');
const wyyLyricUrlUploadSection = document.getElementById('wyyLyricUrlUploadSection');
const wyyLyricFileUploadSection = document.getElementById('wyyLyricFileUploadSection');

// 文件上传按钮
const wyyUploadCoverBtn = document.getElementById('wyyUploadCoverBtn');
const wyyCoverFileInput = document.getElementById('wyyCoverFileInput');
const wyySongCoverPreview = document.getElementById('wyySongCoverPreview');
const wyyUploadSongFileBtn = document.getElementById('wyyUploadSongFileBtn');
const wyySongFileInput = document.getElementById('wyySongFileInput');
const wyyUploadLyricFileBtn = document.getElementById('wyyUploadLyricFileBtn');
const wyyLyricFileInput = document.getElementById('wyyLyricFileInput');

let wyyAudio = null;
let wyyProgressUpdateInterval = null;

// 播放列表数据
let wyyPlaylist = [];
let wyyCurrentSongIndex = 0;
let wyyCurrentPlaylistId = null; // 当前选中的歌单ID

// 播放模式：'order' 顺序播放, 'single' 单曲循环
let wyyPlayMode = 'order';

// 歌词显示状态：false 显示封面, true 显示歌词
let wyyShowLyrics = false;

// 当前歌词数据
let wyyCurrentLyrics = [];

// 临时存储上传的文件
let wyyTempSongCover = null;
let wyyTempSongFile = null;
let wyyTempLyricFile = null;

// 页面切换功能
if (wyyPlayBar) {
    wyyPlayBar.addEventListener('click', (e) => {
        if (!e.target.closest('.wyy-play-controls')) {
            wyyMainPage.classList.remove('active');
            wyyPlayerPage.classList.add('active');
            wyyUpdatePlayerPage();
        }
    });
}

if (wyyBackBtn) {
    wyyBackBtn.addEventListener('click', () => {
        wyyPlayerPage.classList.remove('active');
        wyyMainPage.classList.add('active');
    });
}

// 初始化播放列表
async function wyyInitPlaylist() {
    try {
        let songs;
        if (wyyCurrentPlaylistId) {
            // 加载指定歌单的歌曲
            songs = await wyyDb.songs.where('playlistId').equals(wyyCurrentPlaylistId).toArray();
            // 在内存中按日期排序
            songs.sort((a, b) => {
                const dateA = a.dateAdded ? new Date(a.dateAdded).getTime() : 0;
                const dateB = b.dateAdded ? new Date(b.dateAdded).getTime() : 0;
                return dateA - dateB;
            });
        } else {
            // 如果没有选中歌单，加载所有歌曲（兼容旧数据）
            songs = await wyyDb.songs.orderBy('dateAdded').toArray();
        }
        
        if (songs.length > 0) {
            wyyPlaylist = songs;
            
            // 加载每首歌曲的文件数据
            for (let i = 0; i < wyyPlaylist.length; i++) {
                const song = wyyPlaylist[i];
                
                // 加载歌曲文件
                const songFile = await wyyDb.songFiles.where({ songId: song.id }).first();
                if (songFile) {
                    song.hasLocalFile = true;
                    song.localFileData = songFile.data;
                    song.fileType = songFile.type;
                }
                
                // 加载歌词文件
                const lyric = await wyyDb.lyrics.where({ songId: song.id }).first();
                if (lyric) {
                    song.hasLocalLyric = true;
                    song.localLyricData = lyric.data;
                }
            }
            
            wyyUpdatePlaylistDisplay();
        } else {
            // 空歌单
            wyyPlaylist = [];
            wyyUpdatePlaylistDisplay();
        }
        
        // 设置当前播放的歌曲
        if (wyyPlaylist.length > 0) {
            await wyyLoadSong(wyyCurrentSongIndex);
        }
    } catch (error) {
        console.error('初始化播放列表失败:', error);
    }
}

// 更新播放列表显示
function wyyUpdatePlaylistDisplay() {
    if (!wyySongsList) return;
    
    if (wyyPlaylist.length === 0) {
        if (wyyEmptyPlaylist) wyyEmptyPlaylist.style.display = 'block';
        wyySongsList.innerHTML = '<div class="wyy-empty-playlist">暂无歌曲，请添加歌曲</div>';
        return;
    }
    
    if (wyyEmptyPlaylist) wyyEmptyPlaylist.style.display = 'none';
    
    let songsHTML = '';
    wyyPlaylist.forEach((song, index) => {
        const isActive = index === wyyCurrentSongIndex;
        const hasCover = song.cover && song.cover !== '';
        songsHTML += `
            <div class="wyy-song-item ${isActive ? 'active' : ''}" data-index="${index}">
                <div class="wyy-song-item-icon ${!hasCover ? 'default' : ''}" style="${hasCover ? `background-image: url(${song.cover})` : ''}">
                    ${!hasCover ? (isActive ? '<i class="fa fa-play"></i>' : (index + 1)) : ''}
                </div>
                <div class="wyy-song-item-info">
                    <div class="wyy-song-item-name">${song.name}</div>
                    <div class="wyy-song-item-singer">${song.singer}</div>
                </div>
                <div class="wyy-song-item-actions" style="display: flex; gap: 5px; align-items: center;">
                    <button class="wyy-song-item-add" data-song-id="${song.id}" title="添加到歌单">
                        <i class="fa fa-plus"></i>
                    </button>
                    <button class="wyy-song-item-remove" data-index="${index}">
                        <i class="fa fa-times"></i>
                    </button>
                </div>
            </div>
        `;
    });
    
    wyySongsList.innerHTML = songsHTML;
    
    // 添加歌曲点击事件
    document.querySelectorAll('.wyy-song-item').forEach(item => {
        item.addEventListener('click', function(e) {
            if (!e.target.closest('.wyy-song-item-remove') && !e.target.closest('.wyy-song-item-add') && !e.target.closest('.wyy-song-item-actions')) {
                const index = parseInt(this.getAttribute('data-index'));
                wyyPlaySong(index);
                if (wyyPlaylistModal) wyyPlaylistModal.style.display = 'none';
            }
        });
    });
    
    // 添加"添加到歌单"按钮点击事件
    document.querySelectorAll('.wyy-song-item-add').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const songId = parseInt(this.getAttribute('data-song-id'));
            wyyShowAddToPlaylistModal(songId);
        });
    });
    
    // 添加删除按钮点击事件
    document.querySelectorAll('.wyy-song-item-remove').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const index = parseInt(this.getAttribute('data-index'));
            wyyRemoveSong(index);
        });
    });
}

// 更新播放器页面
function wyyUpdatePlayerPage() {
    if (wyyPlaylist.length === 0 || wyyCurrentSongIndex >= wyyPlaylist.length) return;
    
    const song = wyyPlaylist[wyyCurrentSongIndex];
    if (wyyPlayerSongName) wyyPlayerSongName.textContent = song.name;
    if (wyyPlayerSingerName) wyyPlayerSingerName.textContent = song.singer;
    
    if (wyyAlbumArtLarge) {
        if (song.cover && song.cover !== '') {
            wyyAlbumArtLarge.style.backgroundImage = `url(${song.cover})`;
        } else {
            wyyAlbumArtLarge.style.backgroundImage = '';
            wyyAlbumArtLarge.style.backgroundColor = '#f5f5f5';
        }
    }
    
    if (wyyAudio) {
        if (wyyTotalTime) wyyTotalTime.textContent = wyyFormatTime(wyyAudio.duration || 299);
        wyyStartProgressUpdate();
    }
    
    // 更新歌词显示状态
    const wyyLyricsContainer = document.getElementById('wyyLyricsContainer');
    if (wyyShowLyrics) {
        if (wyyAlbumArtLarge) wyyAlbumArtLarge.classList.add('hidden');
        if (wyyLyricsContainer) wyyLyricsContainer.classList.add('active');
        wyyUpdateLyricsDisplay();
    } else {
        if (wyyAlbumArtLarge) wyyAlbumArtLarge.classList.remove('hidden');
        if (wyyLyricsContainer) wyyLyricsContainer.classList.remove('active');
    }
}

// 播放指定索引的歌曲
async function wyyPlaySong(index) {
    if (index >= 0 && index < wyyPlaylist.length) {
        wyyCurrentSongIndex = index;
        await wyyLoadSong(index);
        wyyPlayCurrentSong();
        wyyUpdatePlaylistDisplay();
        wyyUpdatePlayerPage();
    }
}

// 加载歌曲
async function wyyLoadSong(index) {
    const song = wyyPlaylist[index];
    
    // 停止当前播放
    if (wyyAudio) {
        wyyAudio.pause();
        wyyStopProgressUpdate();
        if (wyyRecordCover) wyyRecordCover.classList.remove('playing');
        if (wyyPlayBtn) wyyPlayBtn.innerHTML = '<i class="fa fa-play"></i>';
        if (wyyPlayerPlayBtn) wyyPlayerPlayBtn.innerHTML = '<i class="fa fa-play"></i>';
        
        // 释放之前的对象URL
        if (wyyAudio.src && wyyAudio.src.startsWith('blob:')) {
            URL.revokeObjectURL(wyyAudio.src);
        }
    }
    
    // 创建新的音频对象
    try {
        if (song.hasLocalFile && song.localFileData) {
            // 将Base64转换为Blob并创建对象URL
            const audioData = wyyBase64ToBlob(song.localFileData, song.fileType || 'audio/mpeg');
            const audioUrl = URL.createObjectURL(audioData);
            wyyAudio = new Audio(audioUrl);
        } else if (song.url) {
            // 处理网易云音乐URL（可能需要特殊处理）
            let audioUrl = song.url;
            // 如果是网易云的外链，尝试添加参数
            if (audioUrl.includes('music.163.com')) {
                // 网易云外链可能需要特殊处理
                console.log('检测到网易云音乐URL，可能需要特殊处理');
            }
            
            wyyAudio = new Audio(audioUrl);
            // 添加跨域支持
            wyyAudio.crossOrigin = 'anonymous';
            // 设置加载策略
            wyyAudio.load();
        } else {
            console.error('没有有效的歌曲文件');
            alert('无法加载歌曲文件，请检查文件格式');
            return;
        }
        
        wyyAudio.loop = false;
        wyyAudio.preload = 'auto';
        
        // 错误处理
        wyyAudio.addEventListener('error', (e) => {
            console.error('音频加载错误:', e);
            const error = wyyAudio.error;
            let errorMsg = '音频加载失败';
            if (error) {
                switch(error.code) {
                    case error.MEDIA_ERR_ABORTED:
                        errorMsg = '音频加载被中止';
                        break;
                    case error.MEDIA_ERR_NETWORK:
                        errorMsg = '网络错误，请检查网络连接';
                        break;
                    case error.MEDIA_ERR_DECODE:
                        errorMsg = '音频解码失败，可能格式不支持';
                        break;
                    case error.MEDIA_ERR_SRC_NOT_SUPPORTED:
                        errorMsg = '音频格式不支持，请尝试其他格式';
                        break;
                }
            }
            console.error(errorMsg);
        });
        
        // 更新音频事件监听
        wyyAudio.addEventListener('ended', wyyHandleSongEnded);
        wyyAudio.addEventListener('loadedmetadata', () => {
            if (wyyAudio.duration && !isNaN(wyyAudio.duration) && isFinite(wyyAudio.duration)) {
                if (wyyTotalTime) wyyTotalTime.textContent = wyyFormatTime(wyyAudio.duration);
                console.log('音频时长:', wyyAudio.duration, '秒');
            } else {
                console.warn('无法获取音频时长');
            }
            wyyUpdateProgress();
        });
        wyyAudio.addEventListener('canplay', () => {
            console.log('音频可以开始播放');
        });
        wyyAudio.addEventListener('canplaythrough', () => {
            console.log('音频完全加载，可以流畅播放');
        });
        wyyAudio.addEventListener('loadeddata', () => {
            console.log('音频数据加载完成');
        });
        wyyAudio.addEventListener('progress', () => {
            if (wyyAudio.buffered.length > 0) {
                const bufferedEnd = wyyAudio.buffered.end(wyyAudio.buffered.length - 1);
                const duration = wyyAudio.duration;
                if (duration > 0) {
                    const bufferedPercent = (bufferedEnd / duration) * 100;
                    console.log('音频缓冲进度:', bufferedPercent.toFixed(1) + '%');
                }
            }
        });
        wyyAudio.addEventListener('stalled', () => {
            console.warn('音频加载停滞');
        });
        wyyAudio.addEventListener('suspend', () => {
            console.warn('音频加载暂停');
        });
        wyyAudio.addEventListener('timeupdate', () => {
            wyyUpdateProgress();
            if (wyyShowLyrics) {
                wyyUpdateLyricsDisplay();
            }
        });
        
        // 更新显示
        if (wyyCurrentSongName) wyyCurrentSongName.textContent = song.name;
        if (wyyCurrentSingerName) wyyCurrentSingerName.textContent = song.singer;
        
        // 更新唱片封面
        if (wyyCurrentRecordContainer) {
            if (song.cover && song.cover !== '') {
                wyyCurrentRecordContainer.style.backgroundImage = `url(${song.cover})`;
            } else {
                wyyCurrentRecordContainer.style.backgroundImage = '';
                wyyCurrentRecordContainer.style.backgroundColor = '#cccccc';
            }
        }
        
        // 加载歌词
        if (song.hasLocalLyric && song.localLyricData) {
            wyyLoadLyricsFromText(song.localLyricData);
        } else if (song.lyricUrl) {
            wyyLoadLyricsFromUrl(song.lyricUrl);
        } else if (song.lyricText) {
            wyyLoadLyricsFromText(song.lyricText);
        }
    } catch (error) {
        console.error('加载歌曲失败:', error);
        alert('加载歌曲失败，请检查文件');
    }
}

// Base64转Blob
function wyyBase64ToBlob(base64, contentType = '') {
    const byteCharacters = atob(base64.split(',')[1]);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: contentType });
}

// 播放当前歌曲
async function wyyPlayCurrentSong() {
    if (!wyyAudio) return;
    
    try {
        // 等待音频可以播放
        if (wyyAudio.readyState < 2) {
            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('音频加载超时'));
                }, 10000);
                
                const checkReady = () => {
                    if (wyyAudio.readyState >= 2) {
                        clearTimeout(timeout);
                        resolve();
                    } else {
                        setTimeout(checkReady, 100);
                    }
                };
                
                wyyAudio.addEventListener('canplay', () => {
                    clearTimeout(timeout);
                    resolve();
                }, { once: true });
                
                checkReady();
            });
        }
        
        await wyyAudio.play();
        if (wyyPlayBtn) wyyPlayBtn.innerHTML = '<i class="fa fa-pause"></i>';
        if (wyyPlayerPlayBtn) wyyPlayerPlayBtn.innerHTML = '<i class="fa fa-pause"></i>';
        if (wyyRecordCover) wyyRecordCover.classList.add('playing');
        wyyStartProgressUpdate();
        console.log('播放成功');
    } catch (err) {
        console.error('播放失败:', err);
        let errorMsg = '播放失败';
        if (err.name === 'NotAllowedError') {
            errorMsg = '浏览器阻止了自动播放，请手动点击播放按钮';
        } else if (err.name === 'NotSupportedError') {
            errorMsg = '音频格式不支持，请尝试其他格式';
        } else if (err.message === '音频加载超时') {
            errorMsg = '音频加载超时，请检查网络连接或文件';
        } else {
            errorMsg = '播放失败：' + err.message;
        }
        alert(errorMsg);
    }
}

// 处理歌曲结束
function wyyHandleSongEnded() {
    if (wyyPlaylist.length > 0) {
        if (wyyPlayMode === 'single') {
            // 单曲循环：重新播放当前歌曲
            wyyAudio.currentTime = 0;
            wyyPlayCurrentSong();
        } else {
            // 顺序播放：播放下一首
            wyyCurrentSongIndex = (wyyCurrentSongIndex + 1) % wyyPlaylist.length;
            wyyLoadSong(wyyCurrentSongIndex);
            wyyPlayCurrentSong();
            wyyUpdatePlaylistDisplay();
            wyyUpdatePlayerPage();
        }
    } else {
        if (wyyPlayBtn) wyyPlayBtn.innerHTML = '<i class="fa fa-play"></i>';
        if (wyyPlayerPlayBtn) wyyPlayerPlayBtn.innerHTML = '<i class="fa fa-play"></i>';
        if (wyyRecordCover) wyyRecordCover.classList.remove('playing');
        wyyStopProgressUpdate();
    }
}

// 添加上传歌曲
async function wyyAddSong() {
    if (!wyySongNameInput || !wyySingerNameInput) return;
    
    const name = wyySongNameInput.value.trim();
    const singer = wyySingerNameInput.value.trim();
    const url = wyySongUrlInput ? wyySongUrlInput.value.trim() : '';
    const lyricUrl = wyyLyricUrlInput ? wyyLyricUrlInput.value.trim() : '';
    
    if (!name || !singer) {
        alert('请填写歌曲名称和歌手');
        return;
    }
    
    // 检查是否有歌曲文件
    if (!wyyTempSongFile && !url) {
        alert('请上传歌曲文件或输入歌曲URL');
        return;
    }
    
    // 检查是否选中了歌单
    if (!wyyCurrentPlaylistId) {
        alert('请先选择一个歌单或创建新歌单');
        return;
    }
    
    try {
        const songData = {
            name,
            singer,
            cover: wyyTempSongCover || '',
            lyricUrl: '',
            playlistId: wyyCurrentPlaylistId,
            hasLocalFile: false,
            hasLocalLyric: false,
            dateAdded: new Date()
        };
        
        // 保存歌曲基本信息
        const songId = await wyyDb.songs.add(songData);
        
        // 处理歌曲文件
        if (wyyTempSongFile) {
            await wyyDb.songFiles.add({
                songId: songId,
                type: wyyTempSongFile.type,
                data: wyyTempSongFile.data
            });
            
            songData.hasLocalFile = true;
            songData.localFileData = wyyTempSongFile.data;
            songData.fileType = wyyTempSongFile.type;
        } else if (url) {
            if (!url.startsWith('http://') && !url.startsWith('https://')) {
                alert('请提供有效的歌曲URL（以http://或https://开头）');
                return;
            }
            songData.url = url;
            await wyyDb.songs.update(songId, { url: url });
        }
        
        // 处理歌词文件
        if (wyyTempLyricFile) {
            await wyyDb.lyrics.add({
                songId: songId,
                data: wyyTempLyricFile.data
            });
            
            songData.hasLocalLyric = true;
            songData.localLyricData = wyyTempLyricFile.data;
        } else if (lyricUrl) {
            songData.lyricUrl = lyricUrl;
            await wyyDb.songs.update(songId, { lyricUrl: lyricUrl });
        }
        
        // 处理封面
        if (wyyTempSongCover) {
            await wyyDb.songs.update(songId, { cover: wyyTempSongCover });
        }
        
        songData.id = songId;
        wyyPlaylist.push(songData);
        
        // 清空输入框和临时数据
        wyySongNameInput.value = '';
        wyySingerNameInput.value = '';
        if (wyySongUrlInput) wyySongUrlInput.value = '';
        if (wyyLyricUrlInput) wyyLyricUrlInput.value = '';
        if (wyySongCoverPreview) wyySongCoverPreview.style.backgroundImage = '';
        wyyTempSongCover = null;
        wyyTempSongFile = null;
        wyyTempLyricFile = null;
        
        wyyUpdatePlaylistDisplay();
        
        // 如果是第一首歌曲，设置为当前播放
        if (wyyPlaylist.length === 1) {
            wyyCurrentSongIndex = 0;
            await wyyLoadSong(0);
        }
        
        alert('歌曲添加成功！');
    } catch (error) {
        console.error('添加歌曲失败:', error);
        alert('添加歌曲失败，请重试');
    }
}

// 删除歌曲
async function wyyRemoveSong(index) {
    if (index >= 0 && index < wyyPlaylist.length) {
        const song = wyyPlaylist[index];
        
        try {
            // 从数据库中删除
            await wyyDb.songs.delete(song.id);
            await wyyDb.songFiles.where({ songId: song.id }).delete();
            await wyyDb.lyrics.where({ songId: song.id }).delete();
            
            // 释放对象URL
            if (song.hasLocalFile && wyyAudio && wyyAudio.src && wyyAudio.src.startsWith('blob:')) {
                URL.revokeObjectURL(wyyAudio.src);
            }
            
            wyyPlaylist.splice(index, 1);
            
            // 如果删除的是当前播放的歌曲
            if (index === wyyCurrentSongIndex) {
                if (wyyPlaylist.length > 0) {
                    wyyCurrentSongIndex = Math.min(wyyCurrentSongIndex, wyyPlaylist.length - 1);
                    await wyyLoadSong(wyyCurrentSongIndex);
                    if (wyyAudio && !wyyAudio.paused) {
                        wyyPlayCurrentSong();
                    }
                } else {
                    if (wyyAudio) {
                        wyyAudio.pause();
                    }
                    if (wyyCurrentSongName) wyyCurrentSongName.textContent = '暂无歌曲';
                    if (wyyCurrentSingerName) wyyCurrentSingerName.textContent = '';
                    if (wyyPlayerSongName) wyyPlayerSongName.textContent = '暂无歌曲';
                    if (wyyPlayerSingerName) wyyPlayerSingerName.textContent = '';
                    if (wyyCurrentRecordContainer) {
                        wyyCurrentRecordContainer.style.backgroundImage = '';
                        wyyCurrentRecordContainer.style.backgroundColor = '#cccccc';
                    }
                    if (wyyAlbumArtLarge) {
                        wyyAlbumArtLarge.style.backgroundImage = '';
                        wyyAlbumArtLarge.style.backgroundColor = '#f5f5f5';
                    }
                    if (wyyPlayBtn) wyyPlayBtn.innerHTML = '<i class="fa fa-play"></i>';
                    if (wyyPlayerPlayBtn) wyyPlayerPlayBtn.innerHTML = '<i class="fa fa-play"></i>';
                    if (wyyRecordCover) wyyRecordCover.classList.remove('playing');
                    wyyStopProgressUpdate();
                }
            } else if (index < wyyCurrentSongIndex) {
                wyyCurrentSongIndex--;
            }
            
            wyyUpdatePlaylistDisplay();
            wyyUpdatePlayerPage();
        } catch (error) {
            console.error('删除歌曲失败:', error);
        }
    }
}

// 清空列表
async function wyyClearAllSongs() {
    if (wyyPlaylist.length > 0 && confirm('确定要清空所有歌曲吗？')) {
        try {
            // 释放所有对象URL
            wyyPlaylist.forEach(song => {
                if (song.hasLocalFile && wyyAudio && wyyAudio.src && wyyAudio.src.startsWith('blob:')) {
                    URL.revokeObjectURL(wyyAudio.src);
                }
            });
            
            // 清空数据库
            await wyyDb.songs.clear();
            await wyyDb.songFiles.clear();
            await wyyDb.lyrics.clear();
            
            wyyPlaylist = [];
            if (wyyAudio) {
                wyyAudio.pause();
            }
            if (wyyCurrentSongName) wyyCurrentSongName.textContent = '暂无歌曲';
            if (wyyCurrentSingerName) wyyCurrentSingerName.textContent = '';
            if (wyyPlayerSongName) wyyPlayerSongName.textContent = '暂无歌曲';
            if (wyyPlayerSingerName) wyyPlayerSingerName.textContent = '';
            if (wyyCurrentRecordContainer) {
                wyyCurrentRecordContainer.style.backgroundImage = '';
                wyyCurrentRecordContainer.style.backgroundColor = '#cccccc';
            }
            if (wyyAlbumArtLarge) {
                wyyAlbumArtLarge.style.backgroundImage = '';
                wyyAlbumArtLarge.style.backgroundColor = '#f5f5f5';
            }
            if (wyyPlayBtn) wyyPlayBtn.innerHTML = '<i class="fa fa-play"></i>';
            if (wyyPlayerPlayBtn) wyyPlayerPlayBtn.innerHTML = '<i class="fa fa-play"></i>';
            if (wyyRecordCover) wyyRecordCover.classList.remove('playing');
            wyyStopProgressUpdate();
            
            wyyUpdatePlaylistDisplay();
            wyyUpdatePlayerPage();
        } catch (error) {
            console.error('清空列表失败:', error);
        }
    }
}

// 加载歌词
function wyyLoadLyricsFromUrl(url) {
    if (!url) {
        wyyCurrentLyrics = [];
        wyyUpdateLyricsDisplay();
        return;
    }
    
    fetch(url)
        .then(response => response.text())
        .then(text => {
            wyyLoadLyricsFromText(text);
        })
        .catch(error => {
            console.log('歌词加载失败:', error);
            wyyCurrentLyrics = [];
            wyyUpdateLyricsDisplay();
        });
}

// 解析LRC歌词
function wyyParseLyrics(text) {
    if (!text) return [];
    
    const lines = text.split('\n');
    const lyrics = [];
    
    for (let line of lines) {
        line = line.trim();
        if (!line) continue;
        
        // 匹配时间标签 [mm:ss.xx] 或 [mm:ss]
        const timeRegex = /\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\]/g;
        const matches = [...line.matchAll(timeRegex)];
        
        if (matches.length > 0) {
            const lyricText = line.replace(timeRegex, '').trim();
            if (!lyricText) continue;
            
            for (let match of matches) {
                const minutes = parseInt(match[1]);
                const seconds = parseInt(match[2]);
                const milliseconds = match[3] ? parseInt(match[3].padEnd(3, '0')) : 0;
                const time = minutes * 60 + seconds + milliseconds / 1000;
                
                lyrics.push({
                    time: time,
                    text: lyricText
                });
            }
        }
    }
    
    // 按时间排序
    lyrics.sort((a, b) => a.time - b.time);
    return lyrics;
}

function wyyLoadLyricsFromText(text) {
    if (!text) {
        wyyCurrentLyrics = [];
        wyyUpdateLyricsDisplay();
        return;
    }
    
    // 如果是Base64编码，先解码
    let lyricText = text;
    if (text.startsWith('data:text/plain;base64,')) {
        try {
            const base64Data = text.split(',')[1];
            lyricText = atob(base64Data);
        } catch (e) {
            console.error('歌词解码失败:', e);
        }
    }
    
    wyyCurrentLyrics = wyyParseLyrics(lyricText);
    wyyUpdateLyricsDisplay();
}

// 更新歌词显示
function wyyUpdateLyricsDisplay() {
    const lyricsContent = document.getElementById('wyyLyricsContent');
    if (!lyricsContent) return;
    
    if (wyyCurrentLyrics.length === 0) {
        lyricsContent.innerHTML = '<div style="opacity: 0.6;">暂无歌词</div>';
        return;
    }
    
    // 如果正在播放，高亮当前歌词
    if (wyyAudio && !wyyAudio.paused) {
        const currentTime = wyyAudio.currentTime;
        let activeIndex = -1;
        
        for (let i = wyyCurrentLyrics.length - 1; i >= 0; i--) {
            if (currentTime >= wyyCurrentLyrics[i].time) {
                activeIndex = i;
                break;
            }
        }
        
        let html = '';
        wyyCurrentLyrics.forEach((lyric, index) => {
            const isActive = index === activeIndex;
            html += `<div style="margin: 10px 0; ${isActive ? 'color: #fff; font-weight: bold; font-size: 18px;' : 'opacity: 0.6;'}">${lyric.text}</div>`;
        });
        
        lyricsContent.innerHTML = html;
        
        // 滚动到当前歌词
        if (activeIndex >= 0) {
            const activeElement = lyricsContent.children[activeIndex];
            if (activeElement) {
                activeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    } else {
        // 未播放时显示所有歌词
        let html = '';
        wyyCurrentLyrics.forEach(lyric => {
            html += `<div style="margin: 10px 0; opacity: 0.6;">${lyric.text}</div>`;
        });
        lyricsContent.innerHTML = html;
    }
}

// 播放按钮事件
if (wyyPlayBtn) {
    wyyPlayBtn.addEventListener('click', async () => {
        if (wyyPlaylist.length === 0) {
            alert('请先添加歌曲');
            return;
        }
        
        if (!wyyAudio) {
            await wyyLoadSong(wyyCurrentSongIndex);
        }
        
        if (wyyAudio && wyyAudio.paused) {
            await wyyPlayCurrentSong();
        } else if (wyyAudio) {
            wyyAudio.pause();
            wyyPlayBtn.innerHTML = '<i class="fa fa-play"></i>';
            if (wyyPlayerPlayBtn) wyyPlayerPlayBtn.innerHTML = '<i class="fa fa-play"></i>';
            if (wyyRecordCover) wyyRecordCover.classList.remove('playing');
            wyyStopProgressUpdate();
        }
    });
}

if (wyyPlayerPlayBtn) {
    wyyPlayerPlayBtn.addEventListener('click', async () => {
        if (wyyPlaylist.length === 0) {
            alert('请先添加歌曲');
            return;
        }
        
        if (!wyyAudio) {
            await wyyLoadSong(wyyCurrentSongIndex);
        }
        
        if (wyyAudio && wyyAudio.paused) {
            await wyyPlayCurrentSong();
        } else if (wyyAudio) {
            wyyAudio.pause();
            if (wyyPlayBtn) wyyPlayBtn.innerHTML = '<i class="fa fa-play"></i>';
            wyyPlayerPlayBtn.innerHTML = '<i class="fa fa-play"></i>';
            if (wyyRecordCover) wyyRecordCover.classList.remove('playing');
            wyyStopProgressUpdate();
        }
    });
}

// 上一首/下一首
if (wyyPrevBtn) {
    wyyPrevBtn.addEventListener('click', () => {
        if (wyyPlaylist.length === 0) return;
        
        wyyCurrentSongIndex = (wyyCurrentSongIndex - 1 + wyyPlaylist.length) % wyyPlaylist.length;
        wyyPlaySong(wyyCurrentSongIndex);
    });
}

if (wyyNextBtn) {
    wyyNextBtn.addEventListener('click', () => {
        if (wyyPlaylist.length === 0) return;
        
        wyyCurrentSongIndex = (wyyCurrentSongIndex + 1) % wyyPlaylist.length;
        wyyPlaySong(wyyCurrentSongIndex);
    });
}

// 循环模式切换
const wyyLoopModeBtn = document.getElementById('wyyLoopModeBtn');
const wyyLoopIcon = document.getElementById('wyyLoopIcon');

if (wyyLoopModeBtn && wyyLoopIcon) {
    wyyLoopModeBtn.addEventListener('click', () => {
        if (wyyPlayMode === 'order') {
            // 切换到单曲循环
            wyyPlayMode = 'single';
            wyyLoopIcon.className = 'fa fa-repeat';
            wyyLoopModeBtn.classList.add('wyy-loop-mode-single');
            if (wyyAudio) {
                wyyAudio.loop = false; // 使用自定义循环逻辑
            }
        } else {
            // 切换到顺序播放
            wyyPlayMode = 'order';
            wyyLoopIcon.className = 'fa fa-list';
            wyyLoopModeBtn.classList.remove('wyy-loop-mode-single');
            if (wyyAudio) {
                wyyAudio.loop = false;
            }
        }
    });
}

// 播放列表按钮事件（主页面）
if (wyyPlaylistBtn) {
    wyyPlaylistBtn.addEventListener('click', () => {
        if (wyyPlaylistModal) wyyPlaylistModal.style.display = 'flex';
    });
}

// 播放器详情页面的播放列表按钮（打开播放列表）
const wyyPlayerPlaylistBtn = document.getElementById('wyyPlayerPlaylistBtn');
const wyyLyricsContainer = document.getElementById('wyyLyricsContainer');

if (wyyPlayerPlaylistBtn) {
    wyyPlayerPlaylistBtn.addEventListener('click', () => {
        if (wyyPlaylistModal) wyyPlaylistModal.style.display = 'flex';
    });
}

// 封面点击切换歌词
if (wyyAlbumArtLarge) {
    wyyAlbumArtLarge.addEventListener('click', () => {
        wyyShowLyrics = !wyyShowLyrics;
        
        if (wyyShowLyrics) {
            wyyAlbumArtLarge.classList.add('hidden');
            if (wyyLyricsContainer) wyyLyricsContainer.classList.add('active');
            wyyUpdateLyricsDisplay();
        } else {
            wyyAlbumArtLarge.classList.remove('hidden');
            if (wyyLyricsContainer) wyyLyricsContainer.classList.remove('active');
        }
    });
}

// 进度条功能
function wyyStartProgressUpdate() {
    wyyStopProgressUpdate();
    wyyProgressUpdateInterval = setInterval(wyyUpdateProgress, 1000);
    wyyUpdateProgress();
}

function wyyStopProgressUpdate() {
    if (wyyProgressUpdateInterval) {
        clearInterval(wyyProgressUpdateInterval);
        wyyProgressUpdateInterval = null;
    }
}

function wyyUpdateProgress() {
    if (!wyyAudio || !wyyAudio.duration) return;
    
    const percent = (wyyAudio.currentTime / wyyAudio.duration) * 100;
    if (wyyProgress) wyyProgress.style.width = percent + '%';
    if (wyyCurrentTime) wyyCurrentTime.textContent = wyyFormatTime(wyyAudio.currentTime);
    if (wyyTotalTime) wyyTotalTime.textContent = wyyFormatTime(wyyAudio.duration);
}

function wyyFormatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

if (wyyProgressBar) {
    wyyProgressBar.addEventListener('click', (e) => {
        if (!wyyAudio) return;
        
        const rect = wyyProgressBar.getBoundingClientRect();
        const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        wyyAudio.currentTime = percent * wyyAudio.duration;
        wyyUpdateProgress();
    });
}

// 添加上传选项切换功能
if (wyyUrlOptionBtn && wyyFileOptionBtn && wyyUrlUploadSection && wyyFileUploadSection) {
    wyyUrlOptionBtn.addEventListener('click', () => {
        wyyUrlOptionBtn.classList.add('active');
        wyyFileOptionBtn.classList.remove('active');
        wyyUrlUploadSection.classList.add('active');
        wyyFileUploadSection.classList.remove('active');
    });

    wyyFileOptionBtn.addEventListener('click', () => {
        wyyFileOptionBtn.classList.add('active');
        wyyUrlOptionBtn.classList.remove('active');
        wyyFileUploadSection.classList.add('active');
        wyyUrlUploadSection.classList.remove('active');
    });
}

if (wyyLyricUrlOptionBtn && wyyLyricFileOptionBtn && wyyLyricUrlUploadSection && wyyLyricFileUploadSection) {
    wyyLyricUrlOptionBtn.addEventListener('click', () => {
        wyyLyricUrlOptionBtn.classList.add('active');
        wyyLyricFileOptionBtn.classList.remove('active');
        wyyLyricUrlUploadSection.classList.add('active');
        wyyLyricFileUploadSection.classList.remove('active');
    });

    wyyLyricFileOptionBtn.addEventListener('click', () => {
        wyyLyricFileOptionBtn.classList.add('active');
        wyyLyricUrlOptionBtn.classList.remove('active');
        wyyLyricFileUploadSection.classList.add('active');
        wyyLyricUrlUploadSection.classList.remove('active');
    });
}

// 上传封面按钮
if (wyyUploadCoverBtn && wyyCoverFileInput) {
    wyyUploadCoverBtn.addEventListener('click', () => {
        wyyCoverFileInput.click();
    });

    wyyCoverFileInput.addEventListener('change', function(event) {
        const file = event.target.files[0];
        if (file) {
            if (!file.type.match('image.*')) {
                alert('请选择图片文件！');
                return;
            }
            
            if (file.size > 2 * 1024 * 1024) {
                alert('图片大小不能超过2MB！');
                return;
            }
            
            const reader = new FileReader();
            reader.onload = function(e) {
                if (wyySongCoverPreview) wyySongCoverPreview.style.backgroundImage = `url(${e.target.result})`;
                wyyTempSongCover = e.target.result;
            };
            reader.readAsDataURL(file);
        }
    });
}

// 上传歌曲文件按钮
if (wyyUploadSongFileBtn && wyySongFileInput) {
    wyyUploadSongFileBtn.addEventListener('click', () => {
        wyySongFileInput.click();
    });

    wyySongFileInput.addEventListener('change', function(event) {
        const file = event.target.files[0];
        if (file) {
            const validAudioTypes = [
                'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/wave', 'audio/x-wav',
                'audio/ogg', 'audio/oga', 'audio/x-m4a', 'audio/mp4', 'audio/flac',
                'audio/x-flac', 'audio/aac', 'audio/aacp'
            ];
            
            const validExtensions = ['.mp3', '.wav', '.ogg', '.m4a', '.flac', '.aac'];
            const fileName = file.name.toLowerCase();
            const isValidExtension = validExtensions.some(ext => fileName.endsWith(ext));
            
            if (!validAudioTypes.includes(file.type) && !isValidExtension) {
                alert('请选择有效的音频文件（MP3、WAV、OGG、M4A、FLAC、AAC等格式）！');
                return;
            }
            
            if (file.size > 50 * 1024 * 1024) {
                alert('音频文件大小不能超过50MB！');
                return;
            }
            
            const reader = new FileReader();
            reader.onload = function(e) {
                wyyTempSongFile = {
                    data: e.target.result,
                    type: file.type || 'audio/mpeg',
                    name: file.name
                };
                alert(`已选择歌曲文件: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
            };
            reader.readAsDataURL(file);
        }
    });
}

// 上传歌词文件按钮
if (wyyUploadLyricFileBtn && wyyLyricFileInput) {
    wyyUploadLyricFileBtn.addEventListener('click', () => {
        wyyLyricFileInput.click();
    });

    wyyLyricFileInput.addEventListener('change', function(event) {
        const file = event.target.files[0];
        if (file) {
            const validTypes = ['.lrc', '.txt'];
            const fileName = file.name.toLowerCase();
            const isValidType = validTypes.some(type => fileName.endsWith(type));
            
            if (!isValidType) {
                alert('请选择LRC或TXT格式的歌词文件！');
                return;
            }
            
            if (file.size > 1 * 1024 * 1024) {
                alert('歌词文件大小不能超过1MB！');
                return;
            }
            
            const reader = new FileReader();
            reader.onload = function(e) {
                wyyTempLyricFile = {
                    data: e.target.result,
                    name: file.name
                };
                alert(`已选择歌词文件: ${file.name}`);
            };
            reader.readAsDataURL(file);
        }
    });
}

// 添加歌曲按钮事件
if (wyyAddSongBtn) {
    wyyAddSongBtn.addEventListener('click', wyyAddSong);
}

// 清空列表按钮事件
if (wyyClearAllBtn) {
    wyyClearAllBtn.addEventListener('click', wyyClearAllSongs);
}

// 点击模态框外部关闭
if (wyyPlaylistModal) {
    wyyPlaylistModal.addEventListener('click', (e) => {
        if (e.target === wyyPlaylistModal) {
            wyyPlaylistModal.style.display = 'none';
            wyyTempSongCover = null;
            wyyTempSongFile = null;
            wyyTempLyricFile = null;
            if (wyySongCoverPreview) wyySongCoverPreview.style.backgroundImage = '';
        }
    });
}

// ===== Part 2: 文件上传 / 用户设置 / 歌单 / 一起听 =====
function wyyHandleFileUpload(event, type) {
    const file = event.target.files[0];
    
    if (file) {
        if (!file.type.match('image.*')) {
            alert('请选择图片文件！');
            return;
        }
        
        if (file.size > 5 * 1024 * 1024) {
            alert('图片大小不能超过5MB！');
            return;
        }
        
        const reader = new FileReader();
        
        reader.onload = function(e) {
            if (type === 'avatar') {
                if (wyyModalAvatarPreview) wyyModalAvatarPreview.style.backgroundImage = `url(${e.target.result})`;
                wyyTempAvatar = e.target.result;
            } else {
                const cardNum = type.replace('card', '');
                const preview = document.getElementById(`wyyModalCardPreview${cardNum}`);
                if (preview) {
                    preview.style.backgroundImage = `url(${e.target.result})`;
                    wyyTempCards[cardNum] = e.target.result;
                }
            }
        };
        
        reader.readAsDataURL(file);
    }
}

async function wyyLoadCurrentSettings() {
    try {
        const userSettings = await wyyDb.userSettings.get('avatar');
        if (userSettings && wyyModalAvatarPreview) {
            wyyModalAvatarPreview.style.backgroundImage = `url(${userSettings.data})`;
        } else if (wyyModalAvatarPreview) {
            wyyModalAvatarPreview.style.backgroundImage = '';
        }
        
        const savedNickname = (await wyyDb.userSettings.get('nickname'))?.data || 'user';
        const savedFollow = (await wyyDb.userSettings.get('follow'))?.data || '29';
        const savedFans = (await wyyDb.userSettings.get('fans'))?.data || '9';
        const savedLevel = (await wyyDb.userSettings.get('level'))?.data || 'Lv.7';
        const savedTime = (await wyyDb.userSettings.get('time'))?.data || '904h';
        
        if (wyyNicknameInput) wyyNicknameInput.value = savedNickname;
        if (wyyFollowInput) wyyFollowInput.value = savedFollow;
        if (wyyFansInput) wyyFansInput.value = savedFans;
        if (wyyLevelInput) wyyLevelInput.value = savedLevel;
        if (wyyTimeInput) wyyTimeInput.value = savedTime;
        
        for (let i = 1; i <= 4; i++) {
            const cardKey = `card${i}`;
            const savedCard = await wyyDb.playlistCards.get(cardKey);
            const preview = document.getElementById(`wyyModalCardPreview${i}`);
            if (preview) {
                if (savedCard) {
                    preview.style.backgroundImage = `url(${savedCard.data})`;
                } else {
                    preview.style.backgroundImage = '';
                }
            }
        }
    } catch (error) {
        console.error('加载设置失败:', error);
    }
}

async function wyySaveSettings() {
    try {
        if (wyyTempAvatar) {
            if (wyyAvatarDisplay) wyyAvatarDisplay.style.backgroundImage = `url(${wyyTempAvatar})`;
            await wyyDb.userSettings.put({ id: 'avatar', data: wyyTempAvatar });
        }
        
        if (wyyNicknameInput) {
            const nickname = wyyNicknameInput.value.trim() || 'user';
            if (wyyNicknameDisplay) {
                const vipTag = wyyNicknameDisplay.querySelector('.wyy-vip-tag');
                const vipTagHtml = vipTag ? vipTag.outerHTML : '';
                wyyNicknameDisplay.innerHTML = nickname + ' ' + vipTagHtml;
            }
            await wyyDb.userSettings.put({ id: 'nickname', data: nickname });
        }
        
        if (wyyFollowInput && wyyFansInput && wyyLevelInput && wyyTimeInput) {
            const follow = wyyFollowInput.value;
            const fans = wyyFansInput.value;
            const level = wyyLevelInput.value;
            const time = wyyTimeInput.value;
            
            if (wyyFollowValue) wyyFollowValue.textContent = follow;
            if (wyyFansValue) wyyFansValue.textContent = fans;
            if (wyyLevelValue) wyyLevelValue.textContent = level;
            if (wyyTimeValue) wyyTimeValue.textContent = time;
            
            await wyyDb.userSettings.put({ id: 'follow', data: follow });
            await wyyDb.userSettings.put({ id: 'fans', data: fans });
            await wyyDb.userSettings.put({ id: 'level', data: level });
            await wyyDb.userSettings.put({ id: 'time', data: time });
        }
        
        for (let i = 1; i <= 4; i++) {
            if (wyyTempCards[i]) {
                const cardElement = document.getElementById(`wyyCard${i}`);
                if (cardElement) {
                    cardElement.style.backgroundImage = `url(${wyyTempCards[i]})`;
                    await wyyDb.playlistCards.put({ id: `card${i}`, data: wyyTempCards[i] });
                }
            }
        }
        
        wyyResetTempData();
    } catch (error) {
        console.error('保存设置失败:', error);
    }
}

function wyyResetTempData() {
    wyyTempAvatar = null;
    for (let i = 1; i <= 4; i++) {
        wyyTempCards[i] = null;
    }
}

// ============================================
// 歌单管理功能
// ============================================

// 加载歌单列表
async function wyyLoadPlaylists() {
    try {
        const playlists = await wyyDb.playlists.orderBy('dateCreated').reverse().toArray();
        const playlistsList = document.getElementById('wyyPlaylistsList');
        if (!playlistsList) return;
        
        if (playlists.length === 0) {
            playlistsList.innerHTML = '';
            return;
        }
        
        let html = '';
        playlists.forEach(playlist => {
            html += `
                <div class="wyy-playlist-card" data-playlist-id="${playlist.id}" style="cursor: pointer;">
                    <div class="wyy-playlist-cover" style="${playlist.cover ? `background-image: url(${playlist.cover})` : 'background: #f0f0f0;'}"></div>
                    <div class="wyy-playlist-info">
                        <div class="wyy-playlist-name">${playlist.name}</div>
                        <div class="wyy-playlist-desc">${playlist.desc || '暂无描述'}</div>
                    </div>
                    <div class="wyy-playlist-actions" style="display: flex; gap: 10px; align-items: center;">
                        <button class="wyy-control-btn" onclick="event.stopPropagation(); wyyExportSinglePlaylist(${playlist.id})" title="导出">
                            <i class="fa fa-download"></i>
                        </button>
                        <button class="wyy-control-btn" onclick="event.stopPropagation(); wyyDeletePlaylist(${playlist.id})" title="删除" style="color: #ff4444;">
                            <i class="fa fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        });
        
        playlistsList.innerHTML = html;
        
        // 添加点击事件（点击歌单卡片显示详情，点击操作按钮不触发）
        document.querySelectorAll('.wyy-playlist-card[data-playlist-id]').forEach(card => {
            card.addEventListener('click', async function(e) {
                // 如果点击的是操作按钮区域，不触发
                if (e.target.closest('.wyy-playlist-actions')) {
                    return;
                }
                const playlistId = parseInt(this.getAttribute('data-playlist-id'));
                await wyyShowPlaylistDetail(playlistId);
            });
        });
    } catch (error) {
        console.error('加载歌单列表失败:', error);
    }
}

// 切换歌单
async function wyySwitchPlaylist(playlistId) {
    wyyCurrentPlaylistId = playlistId;
    await wyyInitPlaylist();
}

// 显示歌单详情
async function wyyShowPlaylistDetail(playlistId) {
    try {
        const playlist = await wyyDb.playlists.get(playlistId);
        if (!playlist) {
            alert('歌单不存在');
            return;
        }
        
        let songs = await wyyDb.songs.where('playlistId').equals(playlistId).toArray();
        // 在内存中按日期排序
        songs.sort((a, b) => {
            const dateA = a.dateAdded ? new Date(a.dateAdded).getTime() : 0;
            const dateB = b.dateAdded ? new Date(b.dateAdded).getTime() : 0;
            return dateA - dateB;
        });
        
        // 更新标题
        const titleElement = document.getElementById('wyyPlaylistDetailTitle');
        if (titleElement) {
            titleElement.textContent = `${playlist.name} (${songs.length}首)`;
        }
        
        // 显示歌曲列表
        const songsListElement = document.getElementById('wyyPlaylistDetailSongsList');
        if (!songsListElement) return;
        
        if (songs.length === 0) {
            songsListElement.innerHTML = '<div class="wyy-empty-playlist">该歌单暂无歌曲</div>';
        } else {
            let html = '';
            songs.forEach((song, index) => {
                const hasCover = song.cover && song.cover !== '';
                html += `
                    <div class="wyy-song-item" data-song-id="${song.id}">
                        <div class="wyy-song-item-icon ${!hasCover ? 'default' : ''}" style="${hasCover ? `background-image: url(${song.cover})` : ''}">
                            ${!hasCover ? (index + 1) : ''}
                        </div>
                        <div class="wyy-song-item-info">
                            <div class="wyy-song-item-name">${song.name}</div>
                            <div class="wyy-song-item-singer">${song.singer}</div>
                        </div>
                    </div>
                `;
            });
            songsListElement.innerHTML = html;
        }
        
        // 显示模态框
        const modal = document.getElementById('wyyPlaylistDetailModal');
        if (modal) {
            modal.style.display = 'flex';
            
            // 设置切换到该歌单的按钮事件
            const switchBtn = document.getElementById('wyySwitchToPlaylistBtn');
            if (switchBtn) {
                switchBtn.onclick = async () => {
                    await wyySwitchPlaylist(playlistId);
                    modal.style.display = 'none';
                };
            }
        }
    } catch (error) {
        console.error('加载歌单详情失败:', error);
        alert('加载歌单详情失败');
    }
}

// 关闭歌单详情
const wyyClosePlaylistDetailBtn = document.getElementById('wyyClosePlaylistDetailBtn');
const wyyPlaylistDetailModal = document.getElementById('wyyPlaylistDetailModal');

if (wyyClosePlaylistDetailBtn) {
    wyyClosePlaylistDetailBtn.addEventListener('click', () => {
        if (wyyPlaylistDetailModal) wyyPlaylistDetailModal.style.display = 'none';
    });
}

if (wyyPlaylistDetailModal) {
    wyyPlaylistDetailModal.addEventListener('click', (e) => {
        if (e.target === wyyPlaylistDetailModal) {
            wyyPlaylistDetailModal.style.display = 'none';
        }
    });
}

// 打开歌单管理
const wyyManagePlaylistsBtn = document.getElementById('wyyManagePlaylistsBtn');
if (wyyManagePlaylistsBtn) {
    wyyManagePlaylistsBtn.addEventListener('click', () => {
        const modal = document.getElementById('wyyPlaylistManageModal');
        if (modal) {
            modal.style.display = 'flex';
        }
    });
}

// 创建歌单
const wyyNewPlaylistBtn = document.getElementById('wyyNewPlaylistBtn');
const wyyCreatePlaylistModal = document.getElementById('wyyCreatePlaylistModal');
const wyyNewPlaylistName = document.getElementById('wyyNewPlaylistName');
const wyyNewPlaylistDesc = document.getElementById('wyyNewPlaylistDesc');
const wyyNewPlaylistCoverPreview = document.getElementById('wyyNewPlaylistCoverPreview');
const wyyUploadPlaylistCoverBtn = document.getElementById('wyyUploadPlaylistCoverBtn');
const wyyPlaylistCoverFileInput = document.getElementById('wyyPlaylistCoverFileInput');
const wyyCancelCreatePlaylistBtn = document.getElementById('wyyCancelCreatePlaylistBtn');
const wyySaveCreatePlaylistBtn = document.getElementById('wyySaveCreatePlaylistBtn');

let wyyTempPlaylistCover = null;

if (wyyNewPlaylistBtn) {
    wyyNewPlaylistBtn.addEventListener('click', () => {
        if (wyyCreatePlaylistModal) wyyCreatePlaylistModal.style.display = 'flex';
        if (wyyNewPlaylistName) wyyNewPlaylistName.value = '';
        if (wyyNewPlaylistDesc) wyyNewPlaylistDesc.value = '';
        if (wyyNewPlaylistCoverPreview) wyyNewPlaylistCoverPreview.style.backgroundImage = '';
        wyyTempPlaylistCover = null;
    });
}

if (wyyUploadPlaylistCoverBtn && wyyPlaylistCoverFileInput) {
    wyyUploadPlaylistCoverBtn.addEventListener('click', () => {
        wyyPlaylistCoverFileInput.click();
    });

    wyyPlaylistCoverFileInput.addEventListener('change', function(event) {
        const file = event.target.files[0];
        if (file) {
            if (!file.type.match('image.*')) {
                alert('请选择图片文件！');
                return;
            }
            if (file.size > 5 * 1024 * 1024) {
                alert('图片大小不能超过5MB！');
                return;
            }
            const reader = new FileReader();
            reader.onload = function(e) {
                if (wyyNewPlaylistCoverPreview) wyyNewPlaylistCoverPreview.style.backgroundImage = `url(${e.target.result})`;
                wyyTempPlaylistCover = e.target.result;
            };
            reader.readAsDataURL(file);
        }
    });
}

if (wyyCancelCreatePlaylistBtn) {
    wyyCancelCreatePlaylistBtn.addEventListener('click', () => {
        if (wyyCreatePlaylistModal) wyyCreatePlaylistModal.style.display = 'none';
    });
}

if (wyySaveCreatePlaylistBtn && wyyNewPlaylistName) {
    wyySaveCreatePlaylistBtn.addEventListener('click', async () => {
        const name = wyyNewPlaylistName.value.trim();
        if (!name) {
            alert('请输入歌单名称');
            return;
        }
        
        try {
            const playlistId = await wyyDb.playlists.add({
                name: name,
                desc: wyyNewPlaylistDesc ? wyyNewPlaylistDesc.value.trim() : '',
                cover: wyyTempPlaylistCover || '',
                dateCreated: new Date()
            });
            
            if (wyyCreatePlaylistModal) wyyCreatePlaylistModal.style.display = 'none';
            await wyyLoadPlaylists();
            await wyySwitchPlaylist(playlistId);
            alert('歌单创建成功！');
        } catch (error) {
            console.error('创建歌单失败:', error);
            alert('创建歌单失败，请重试');
        }
    });
}

if (wyyCreatePlaylistModal) {
    wyyCreatePlaylistModal.addEventListener('click', (e) => {
        if (e.target === wyyCreatePlaylistModal) {
            wyyCreatePlaylistModal.style.display = 'none';
        }
    });
}

// 删除歌单
async function wyyDeletePlaylist(playlistId) {
    if (!confirm('确定要删除这个歌单吗？歌单中的歌曲不会被删除。')) {
        return;
    }
    
    try {
        // 删除歌单
        await wyyDb.playlists.delete(playlistId);
        
        // 如果删除的是当前歌单，切换到默认歌单
        if (wyyCurrentPlaylistId === playlistId) {
            wyyCurrentPlaylistId = null;
            await wyyInitPlaylist();
        }
        
        await wyyLoadPlaylists();
        alert('歌单删除成功！');
    } catch (error) {
        console.error('删除歌单失败:', error);
        alert('删除歌单失败，请重试');
    }
}

// 导出单个歌单
async function wyyExportSinglePlaylist(playlistId) {
    try {
        const playlist = await wyyDb.playlists.get(playlistId);
        if (!playlist) {
            alert('歌单不存在');
            return;
        }
        
        const songs = await wyyDb.songs.where('playlistId').equals(playlistId).toArray();
        
        // 加载每首歌曲的完整信息
        const fullSongs = [];
        for (const song of songs) {
            const songFile = await wyyDb.songFiles.where({ songId: song.id }).first();
            const lyric = await wyyDb.lyrics.where({ songId: song.id }).first();
            
            const fullSong = {
                name: song.name,
                singer: song.singer,
                cover: song.cover || '',
                url: song.url || '',
                lyricUrl: song.lyricUrl || '',
                hasLocalFile: !!songFile,
                hasLocalLyric: !!lyric
            };
            
            if (songFile) {
                fullSong.fileData = songFile.data;
                fullSong.fileType = songFile.type;
            }
            
            if (lyric) {
                fullSong.lyricData = lyric.data;
            }
            
            fullSongs.push(fullSong);
        }
        
        const exportData = {
            playlist: {
                name: playlist.name,
                desc: playlist.desc,
                cover: playlist.cover
            },
            songs: fullSongs,
            exportDate: new Date().toISOString()
        };
        
        const dataStr = JSON.stringify(exportData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${playlist.name}.json`;
        link.click();
        URL.revokeObjectURL(url);
        
        alert('歌单导出成功！');
    } catch (error) {
        console.error('导出歌单失败:', error);
        alert('导出歌单失败，请重试');
    }
}

// 导出当前歌单
const wyyExportPlaylistBtn = document.getElementById('wyyExportPlaylistBtn');
if (wyyExportPlaylistBtn) {
    wyyExportPlaylistBtn.addEventListener('click', async () => {
        if (!wyyCurrentPlaylistId) {
            alert('请先选择一个歌单');
            return;
        }
        await wyyExportSinglePlaylist(wyyCurrentPlaylistId);
    });
}

// 导入歌单
const wyyImportPlaylistBtn = document.getElementById('wyyImportPlaylistBtn');
const wyyImportPlaylistFileInput = document.getElementById('wyyImportPlaylistFileInput');

if (wyyImportPlaylistBtn && wyyImportPlaylistFileInput) {
    wyyImportPlaylistBtn.addEventListener('click', () => {
        wyyImportPlaylistFileInput.click();
    });

    wyyImportPlaylistFileInput.addEventListener('change', async function(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        if (!file.name.endsWith('.json')) {
            alert('请选择JSON格式的文件');
            return;
        }
        
        try {
            const text = await file.text();
            const importData = JSON.parse(text);
            
            if (!importData.playlist || !importData.songs) {
                alert('文件格式不正确');
                return;
            }
            
            // 创建歌单
            const playlistId = await wyyDb.playlists.add({
                name: importData.playlist.name + ' (导入)',
                desc: importData.playlist.desc || '',
                cover: importData.playlist.cover || '',
                dateCreated: new Date()
            });
            
            // 导入歌曲
            for (const songData of importData.songs) {
                const songId = await wyyDb.songs.add({
                    name: songData.name,
                    singer: songData.singer,
                    cover: songData.cover || '',
                    url: songData.url || '',
                    lyricUrl: songData.lyricUrl || '',
                    playlistId: playlistId,
                    dateAdded: new Date()
                });
                
                if (songData.hasLocalFile && songData.fileData) {
                    await wyyDb.songFiles.add({
                        songId: songId,
                        type: songData.fileType || 'audio/mpeg',
                        data: songData.fileData
                    });
                }
                
                if (songData.hasLocalLyric && songData.lyricData) {
                    await wyyDb.lyrics.add({
                        songId: songId,
                        data: songData.lyricData
                    });
                }
            }
            
            await wyyLoadPlaylists();
            await wyySwitchPlaylist(playlistId);
            alert('歌单导入成功！');
        } catch (error) {
            console.error('导入歌单失败:', error);
            alert('导入歌单失败：' + error.message);
        }
    });
}

// 添加到歌单功能
const wyyAddToPlaylistModal = document.getElementById('wyyAddToPlaylistModal');
const wyyPlaylistSelectorList = document.getElementById('wyyPlaylistSelectorList');
const wyyCancelAddToPlaylistBtn = document.getElementById('wyyCancelAddToPlaylistBtn');
let wyyCurrentAddSongId = null;

// 显示添加到歌单模态框
async function wyyShowAddToPlaylistModal(songId) {
    wyyCurrentAddSongId = songId;
    
    try {
        const playlists = await wyyDb.playlists.orderBy('dateCreated').reverse().toArray();
        
        if (!wyyPlaylistSelectorList) return;
        
        if (playlists.length === 0) {
            wyyPlaylistSelectorList.innerHTML = '<div style="text-align: center; padding: 20px; color: #999;">还没有歌单，请先创建歌单</div>';
        } else {
            let html = '';
            playlists.forEach(playlist => {
                html += `
                    <div class="wyy-playlist-selector-item" data-playlist-id="${playlist.id}" style="padding: 12px; border-bottom: 1px solid #eee; cursor: pointer; display: flex; align-items: center; gap: 12px; transition: background 0.2s;">
                        <div class="wyy-playlist-cover" style="width: 40px; height: 40px; border-radius: 6px; ${playlist.cover ? `background-image: url(${playlist.cover})` : 'background: #f0f0f0;'}"></div>
                        <div style="flex: 1;">
                            <div style="font-weight: 500; color: #333; margin-bottom: 2px;">${playlist.name}</div>
                            <div style="font-size: 12px; color: #999;">${playlist.desc || '暂无描述'}</div>
                        </div>
                        <i class="fa fa-chevron-right" style="color: #ccc;"></i>
                    </div>
                `;
            });
            
            wyyPlaylistSelectorList.innerHTML = html;
            
            // 添加点击事件
            document.querySelectorAll('.wyy-playlist-selector-item').forEach(item => {
                item.addEventListener('click', async function() {
                    const playlistId = parseInt(this.getAttribute('data-playlist-id'));
                    await wyyAddSongToPlaylist(songId, playlistId);
                });
            });
        }
        
        if (wyyAddToPlaylistModal) wyyAddToPlaylistModal.style.display = 'flex';
    } catch (error) {
        console.error('加载歌单列表失败:', error);
        alert('加载歌单列表失败');
    }
}

// 将歌曲添加到歌单
async function wyyAddSongToPlaylist(songId, playlistId) {
    try {
        // 检查歌曲是否已经在歌单中
        const existingSong = await wyyDb.songs.where({ id: songId, playlistId: playlistId }).first();
        if (existingSong) {
            alert('歌曲已在该歌单中');
            if (wyyAddToPlaylistModal) wyyAddToPlaylistModal.style.display = 'none';
            return;
        }
        
        // 获取原歌曲信息
        const originalSong = await wyyDb.songs.get(songId);
        if (!originalSong) {
            alert('歌曲不存在');
            return;
        }
        
        // 创建新歌曲记录（添加到新歌单）
        const newSongData = {
            name: originalSong.name,
            singer: originalSong.singer,
            cover: originalSong.cover || '',
            url: originalSong.url || '',
            lyricUrl: originalSong.lyricUrl || '',
            playlistId: playlistId,
            dateAdded: new Date()
        };
        
        const newSongId = await wyyDb.songs.add(newSongData);
        
        // 复制歌曲文件
        const songFile = await wyyDb.songFiles.where({ songId: songId }).first();
        if (songFile) {
            await wyyDb.songFiles.add({
                songId: newSongId,
                type: songFile.type,
                data: songFile.data
            });
        }
        
        // 复制歌词文件
        const lyric = await wyyDb.lyrics.where({ songId: songId }).first();
        if (lyric) {
            await wyyDb.lyrics.add({
                songId: newSongId,
                data: lyric.data
            });
        }
        
        if (wyyAddToPlaylistModal) wyyAddToPlaylistModal.style.display = 'none';
        alert('歌曲已添加到歌单！');
    } catch (error) {
        console.error('添加歌曲到歌单失败:', error);
        alert('添加歌曲到歌单失败，请重试');
    }
}

if (wyyCancelAddToPlaylistBtn) {
    wyyCancelAddToPlaylistBtn.addEventListener('click', () => {
        if (wyyAddToPlaylistModal) wyyAddToPlaylistModal.style.display = 'none';
    });
}

if (wyyAddToPlaylistModal) {
    wyyAddToPlaylistModal.addEventListener('click', (e) => {
        if (e.target === wyyAddToPlaylistModal) {
            wyyAddToPlaylistModal.style.display = 'none';
        }
    });
}

// 歌单管理模态框
const wyyPlaylistManageModal = document.getElementById('wyyPlaylistManageModal');
const wyyClosePlaylistManageBtn = document.getElementById('wyyClosePlaylistManageBtn');

if (wyyClosePlaylistManageBtn) {
    wyyClosePlaylistManageBtn.addEventListener('click', () => {
        if (wyyPlaylistManageModal) wyyPlaylistManageModal.style.display = 'none';
    });
}

if (wyyPlaylistManageModal) {
    wyyPlaylistManageModal.addEventListener('click', (e) => {
        if (e.target === wyyPlaylistManageModal) {
            wyyPlaylistManageModal.style.display = 'none';
        }
    });
}

// ============================================
// 一起听功能
// ============================================
let wyyTogetherListenRole = null; // 当前一起听的角色
let wyyTogetherListenInterval = null; // 更新一起听状态的定时器

const wyyTogetherListenBtn = document.getElementById('wyyTogetherListenBtn');
const wyyTogetherListenModal = document.getElementById('wyyTogetherListenModal');
const wyyTogetherListenRoleList = document.getElementById('wyyTogetherListenRoleList');
const wyyCancelTogetherListenBtn = document.getElementById('wyyCancelTogetherListenBtn');
const wyyStopTogetherListenBtn = document.getElementById('wyyStopTogetherListenBtn');

// 打开一起听选择角色模态框
if (wyyTogetherListenBtn) {
    wyyTogetherListenBtn.addEventListener('click', () => {
        wyyShowTogetherListenRoleSelector();
    });
}

// 显示角色选择器（从数据库加载角色，不包括联机好友）
async function wyyShowTogetherListenRoleSelector() {
    if (!wyyTogetherListenRoleList) return;
    
    try {
        const accountId = getCurrentAccountId();
        const allChars = await db.characters.toArray();
        // 筛选：非user类型、是好友状态的角色
        const friends = allChars.filter(char => {
            if (char.type === 'user') return false;
            if (!accountId) return char.wechat_status === 'friend';
            const status = getFriendStatus(char, accountId);
            return status === 'friend';
        });
        
        if (friends.length === 0) {
            wyyTogetherListenRoleList.innerHTML = '<div style="text-align: center; padding: 20px; color: #999;">还没有好友，请先添加角色好友</div>';
        } else {
            let html = '';
            friends.forEach(char => {
                const charName = char.name || '未知';
                const displayName = char.nick || char.name || '未知';
                const isActive = wyyTogetherListenRole === charName;
                const avatarUrl = char.avatar || '';
                const firstChar = String(displayName).charAt(0);
                
                const avatarHtml = avatarUrl 
                    ? `<div style="width: 42px; height: 42px; border-radius: 50%; background: url('${avatarUrl}') center/cover no-repeat; flex-shrink: 0;"></div>`
                    : `<div style="width: 42px; height: 42px; border-radius: 50%; background: #f0f0f0; display: flex; align-items: center; justify-content: center; font-size: 18px; color: #666; flex-shrink: 0;">${firstChar}</div>`;
                
                html += `
                    <div class="wyy-together-listen-item ${isActive ? 'active' : ''}" data-role="${charName}" data-char-id="${char.id}" style="padding: 12px 16px; border-bottom: 1px solid #f0f0f0; cursor: pointer; display: flex; align-items: center; gap: 12px; transition: background 0.2s;">
                        ${avatarHtml}
                        <div style="flex: 1; min-width: 0;">
                            <div style="font-weight: 500; color: #333; margin-bottom: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${displayName}</div>
                            ${isActive ? '<div style="font-size: 12px; color: #ff6b6b;">♪ 正在一起听</div>' : ''}
                        </div>
                        ${isActive ? '<i class="fa fa-check-circle" style="color: #ff6b6b; font-size: 18px;"></i>' : '<i class="fa fa-chevron-right" style="color: #ccc;"></i>'}
                    </div>
                `;
            });
            wyyTogetherListenRoleList.innerHTML = html;
            
            // 添加点击事件
            document.querySelectorAll('.wyy-together-listen-item[data-role]').forEach(item => {
                item.addEventListener('click', function() {
                    const role = this.getAttribute('data-role');
                    const charId = this.getAttribute('data-char-id');
                    if (wyyTogetherListenRole === role) {
                        wyyStopTogetherListen();
                    } else {
                        wyyStartTogetherListen(role, charId);
                    }
                });
            });
        }
    } catch (error) {
        console.error('[一起听] 加载角色列表失败:', error);
        wyyTogetherListenRoleList.innerHTML = '<div style="text-align: center; padding: 20px; color: #999;">加载失败，请重试</div>';
    }
    
    // 更新结束按钮显示
    if (wyyStopTogetherListenBtn) {
        if (wyyTogetherListenRole) {
            wyyStopTogetherListenBtn.style.display = 'block';
        } else {
            wyyStopTogetherListenBtn.style.display = 'none';
        }
    }
    
    if (wyyTogetherListenModal) wyyTogetherListenModal.style.display = 'flex';
}

// 开始一起听
let wyyTogetherListenCharId = null; // 当前一起听角色的ID
function wyyStartTogetherListen(role, charId) {
    // 确保role是字符串
    wyyTogetherListenRole = String(role);
    wyyTogetherListenCharId = charId ? parseInt(charId) : null;
    if (wyyTogetherListenBtn) wyyTogetherListenBtn.classList.add('active');
    if (wyyTogetherListenModal) wyyTogetherListenModal.style.display = 'none';
    
    // 更新播放页顶栏显示
    wyyUpdateTogetherListenDisplay();
    
    // 状态会通过 systemPrompt 传递给角色
    wyyStartTogetherListenUpdate();
    
    showToast(`正在和 ${wyyTogetherListenRole} 一起听 ♪`);
}

// 结束一起听
function wyyStopTogetherListen() {
    const prevRole = wyyTogetherListenRole;
    wyyTogetherListenRole = null;
    wyyTogetherListenCharId = null;
    if (wyyTogetherListenBtn) wyyTogetherListenBtn.classList.remove('active');
    if (wyyTogetherListenModal) wyyTogetherListenModal.style.display = 'none';
    
    // 更新播放页顶栏显示
    wyyUpdateTogetherListenDisplay();
    
    // 停止定时更新
    wyyStopTogetherListenUpdate();
    
    if (prevRole) showToast(`已结束和 ${prevRole} 一起听`);
}

// 开始定时更新一起听状态（不再更新卡片，只保持状态）
function wyyStartTogetherListenUpdate() {
    wyyStopTogetherListenUpdate();
    // 不再更新卡片，因为不再发送消息到对话框
    // 状态会通过 systemPrompt 传递给角色
}

// 停止定时更新
function wyyStopTogetherListenUpdate() {
    if (wyyTogetherListenInterval) {
        clearInterval(wyyTogetherListenInterval);
        wyyTogetherListenInterval = null;
    }
}

// 更新播放页一起听状态显示
function wyyUpdateTogetherListenDisplay() {
    const titleEl = document.querySelector('.wyy-player-top-bar-title');
    if (!titleEl) return;
    
    if (wyyTogetherListenRole) {
        titleEl.innerHTML = `<div style="font-size:14px; line-height:1.2;">正在播放</div><div style="font-size:11px; color:rgba(255,255,255,0.6); line-height:1.2;">与 ${wyyTogetherListenRole} 一起听 ♪</div>`;
    } else {
        titleEl.textContent = '正在播放';
    }
}

// 获取当前一起听的状态信息（供system prompt使用）
function wyyGetTogetherListenInfo() {
    if (!wyyTogetherListenRole) return null;
    
    let songName = '未知歌曲';
    let singerName = '未知歌手';
    
    if (wyyPlaylist.length > 0 && wyyCurrentSongIndex < wyyPlaylist.length) {
        const currentSong = wyyPlaylist[wyyCurrentSongIndex];
        songName = currentSong.name || currentSong.title || '未知歌曲';
        singerName = currentSong.singer || currentSong.artist || '未知歌手';
    }
    
    return {
        role: wyyTogetherListenRole,
        charId: wyyTogetherListenCharId,
        songName: songName,
        singerName: singerName,
        isPlaying: wyyAudio && !wyyAudio.paused
    };
}

// 从聊天切换歌曲（全局函数，供HTML onclick使用）
window.wyySwitchSongFromChat = function(role, direction) {
    // 确保类型一致进行比较
    const roleStr = String(role);
    if (String(wyyTogetherListenRole) !== roleStr) {
        alert('当前没有和该角色一起听');
        return;
    }
    
    if (direction === 'prev') {
        if (wyyPlaylist.length > 0) {
            wyyCurrentSongIndex = (wyyCurrentSongIndex - 1 + wyyPlaylist.length) % wyyPlaylist.length;
            wyyPlaySong(wyyCurrentSongIndex);
            // 不再发送消息到对话框，状态会通过 systemPrompt 传递给角色
        }
    } else if (direction === 'next') {
        if (wyyPlaylist.length > 0) {
            wyyCurrentSongIndex = (wyyCurrentSongIndex + 1) % wyyPlaylist.length;
            wyyPlaySong(wyyCurrentSongIndex);
            // 不再发送消息到对话框，状态会通过 systemPrompt 传递给角色
        }
    }
}

if (wyyCancelTogetherListenBtn) {
    wyyCancelTogetherListenBtn.addEventListener('click', () => {
        if (wyyTogetherListenModal) wyyTogetherListenModal.style.display = 'none';
    });
}

if (wyyStopTogetherListenBtn) {
    wyyStopTogetherListenBtn.addEventListener('click', () => {
        wyyStopTogetherListen();
    });
}

if (wyyTogetherListenModal) {
    wyyTogetherListenModal.addEventListener('click', (e) => {
        if (e.target === wyyTogetherListenModal) {
            wyyTogetherListenModal.style.display = 'none';
        }
    });
}

// 阻止歌词容器滚动事件冒泡，避免影响页面滚动
if (wyyLyricsContainer) {
    wyyLyricsContainer.addEventListener('touchmove', (e) => {
        e.stopPropagation();
    }, { passive: true });
    wyyLyricsContainer.addEventListener('wheel', (e) => {
        e.stopPropagation();
    }, { passive: true });
}

// 页面加载时恢复设置和初始化播放列表
window.addEventListener('DOMContentLoaded', async () => {
    try {
        // 确保播放器详情页面初始状态是隐藏的
        if (wyyPlayerPage) wyyPlayerPage.classList.remove('active');
        if (wyyMainPage) wyyMainPage.classList.add('active');
        
        const savedAvatar = await wyyDb.userSettings.get('avatar');
        if (savedAvatar && wyyAvatarDisplay) {
            wyyAvatarDisplay.style.backgroundImage = `url(${savedAvatar.data})`;
        }
        
        const savedNickname = await wyyDb.userSettings.get('nickname');
        const savedFollow = await wyyDb.userSettings.get('follow');
        const savedFans = await wyyDb.userSettings.get('fans');
        const savedLevel = await wyyDb.userSettings.get('level');
        const savedTime = await wyyDb.userSettings.get('time');
        
        if (savedNickname && wyyNicknameDisplay) {
            const vipTag = wyyNicknameDisplay.querySelector('.wyy-vip-tag');
            const vipTagHtml = vipTag ? vipTag.outerHTML : '';
            wyyNicknameDisplay.innerHTML = savedNickname.data + ' ' + vipTagHtml;
        }
        if (savedFollow && wyyFollowValue) wyyFollowValue.textContent = savedFollow.data;
        if (savedFans && wyyFansValue) wyyFansValue.textContent = savedFans.data;
        if (savedLevel && wyyLevelValue) wyyLevelValue.textContent = savedLevel.data;
        if (savedTime && wyyTimeValue) wyyTimeValue.textContent = savedTime.data;
        
        for (let i = 1; i <= 4; i++) {
            const cardKey = `card${i}`;
            const savedCard = await wyyDb.playlistCards.get(cardKey);
            const cardElement = document.getElementById(`wyyCard${i}`);
            if (cardElement && savedCard) {
                cardElement.style.backgroundImage = `url(${savedCard.data})`;
            }
        }
        
        await wyyInitPlaylist();
        await wyyLoadPlaylists();
    } catch (error) {
        console.error('加载设置失败:', error);
    }
});