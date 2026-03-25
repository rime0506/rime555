// ================== 个性化设置 JS ==================
// 本文件包含个性化设置页面（#custom-main-page）的所有 JS 逻辑
// 依赖：db, showToast, compressImage 等全局变量（来自 script.js）
// ===== Section 1: 折叠展开 / 字体 / 字号 / 桌面文字颜色 / 返回首页 =====
        // 核心：折叠展开切换
        function toggleExpand(id) {
            const expand = document.getElementById(id);
            const arrow = document.getElementById(`arrow${id.replace('expand','')}`);
            if (expand.style.display === 'flex') {
                expand.style.display = 'none';
                arrow.classList.remove('active');
                // arrow.innerText = '→'; // SVG旋转
            } else {
                expand.style.display = 'flex';
                arrow.classList.add('active');
                // arrow.innerText = '↑'; // SVG旋转
            }
        }

        // 全局字体设置相关函数
        let customFontStyleElement = null;
        
        // 预览自定义字体
        function previewCustomFont() {
            const fontUrl = document.getElementById('custom-font-input').value.trim();
            const fontName = document.getElementById('custom-font-name-input').value.trim();
            
            if (!fontUrl || !fontName) {
                alert('请填写字体链接和字体名称');
                return;
            }
            
            // 动态加载字体样式
            loadCustomFont(fontUrl, fontName, true);
        }
        
        // 加载并应用自定义字体（支持 Google Fonts CSS 链接 和 TTF/WOFF/WOFF2/OTF 直链）
        function loadCustomFont(fontUrl, fontName, previewOnly = false) {
            // 移除旧的字体样式
            const oldLink = document.getElementById('custom-font-link');
            if (oldLink) oldLink.remove();
            const oldFontFace = document.getElementById('custom-font-face');
            if (oldFontFace) oldFontFace.remove();
            
            // 判断是否为字体文件直链（TTF、WOFF、WOFF2、OTF）
            const fontFileMatch = fontUrl.match(/\.(ttf|woff2?|otf)(\?.*)?$/i);
            
            if (fontFileMatch) {
                // === 字体文件直链模式：使用 @font-face 加载 ===
                const ext = fontFileMatch[1].toLowerCase();
                let format = 'truetype';
                if (ext === 'woff') format = 'woff';
                else if (ext === 'woff2') format = 'woff2';
                else if (ext === 'otf') format = 'opentype';
                
                const fontFaceStyle = document.createElement('style');
                fontFaceStyle.id = 'custom-font-face';
                fontFaceStyle.textContent = `
                    @font-face {
                        font-family: "${fontName}";
                        src: url("${fontUrl}") format("${format}");
                        font-weight: normal;
                        font-style: normal;
                        font-display: swap;
                    }
                `;
                document.head.appendChild(fontFaceStyle);
                
                // 使用 FontFace API 检测字体是否加载成功
                if (window.FontFace) {
                    const font = new FontFace(fontName, `url(${fontUrl})`);
                    font.load().then(() => {
                        document.fonts.add(font);
                        console.log(`[Font] ✓ 字体 "${fontName}" 加载成功 (${ext}直链)`);
                        if (previewOnly) {
                            const previewText = document.getElementById('font-preview-text');
                            previewText.style.fontFamily = `"${fontName}", sans-serif`;
                            previewText.innerText = `这是字体预览效果 ABC 123\n${fontName}`;
                        } else {
                            applyFontGlobal(fontName);
                        }
                    }).catch(err => {
                        console.error(`[Font] ✗ 字体加载失败:`, err);
                        showToast('❌ 字体加载失败，请检查链接是否正确');
                    });
                } else {
                    // 降级：等待一小段时间后尝试应用
                    setTimeout(() => {
                        if (previewOnly) {
                            const previewText = document.getElementById('font-preview-text');
                            previewText.style.fontFamily = `"${fontName}", sans-serif`;
                            previewText.innerText = `这是字体预览效果 ABC 123\n${fontName}`;
                        } else {
                            applyFontGlobal(fontName);
                        }
                    }, 2000);
                }
            } else {
                // === CSS 链接模式（Google Fonts 等）===
                const link = document.createElement('link');
                link.id = 'custom-font-link';
                link.rel = 'stylesheet';
                link.href = fontUrl;
                document.head.appendChild(link);
                
                link.onload = function() {
                    console.log(`[Font] ✓ 字体样式表加载成功: ${fontUrl}`);
                    if (previewOnly) {
                        const previewText = document.getElementById('font-preview-text');
                        previewText.style.fontFamily = `"${fontName}", sans-serif`;
                        previewText.innerText = `这是字体预览效果 ABC 123\n${fontName}`;
                    } else {
                        applyFontGlobal(fontName);
                    }
                };
                
                link.onerror = function() {
                    showToast('❌ 字体加载失败，请检查链接是否正确');
                };
            }
        }
        
        // 应用字体到全局（排除图标/等宽/SVG等特殊元素，避免影响布局）
        function applyFontGlobal(fontName) {
            // 移除旧的全局字体样式
            if (customFontStyleElement) {
                customFontStyleElement.remove();
            }
            
            // 创建新的样式元素 —— 通过 body 继承，而非 * 强制覆盖
            customFontStyleElement = document.createElement('style');
            customFontStyleElement.id = 'custom-font-global';
            customFontStyleElement.textContent = `
                /* 全局覆盖：应用自定义字体到所有文本元素 */
                * {
                    font-family: "${fontName}", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
                }
                /* 保持等宽字体不受影响 */
                code, pre, .monospace,
                #json-preview-content,
                #summary-detail-content-edit {
                    font-family: "${fontName}", 'Courier New', 'Consolas', 'Monaco', monospace !important;
                }
            `;
            document.head.appendChild(customFontStyleElement);
        }
        
        // 保存并应用自定义字体（立即生效+持久化）
        async function saveAndApplyFont() {
            const fontUrl = document.getElementById('custom-font-input').value.trim();
            const fontName = document.getElementById('custom-font-name-input').value.trim();
            
            if (!fontUrl || !fontName) {
                showToast('请先填写字体链接和字体名称');
                return;
            }
            
            // 应用字体
            loadCustomFont(fontUrl, fontName, false);
            
            // 持久化到数据库
            try {
                await db.dexiData.put({ key: 'customFontUrl', value: fontUrl });
                await db.dexiData.put({ key: 'customFontName', value: fontName });
                showToast('✅ 字体已保存并应用');
            } catch (e) {
                console.error('[Font] 保存字体失败:', e);
                showToast('⚠️ 字体已应用但保存失败');
            }
        }

        // 清除自定义字体，恢复默认
        async function clearCustomFont() {
            // 清除输入框
            document.getElementById('custom-font-input').value = '';
            document.getElementById('custom-font-name-input').value = '';
            
            // 移除字体链接和全局样式
            const fontLink = document.getElementById('custom-font-link');
            if (fontLink) fontLink.remove();
            
            // 移除 @font-face 样式（TTF直链模式）
            const fontFace = document.getElementById('custom-font-face');
            if (fontFace) fontFace.remove();
            
            if (customFontStyleElement) {
                customFontStyleElement.remove();
                customFontStyleElement = null;
            }
            
            // 重置预览区域
            const previewText = document.getElementById('font-preview-text');
            previewText.style.fontFamily = '';
            previewText.innerText = '这是字体预览效果 ABC 123';
            
            // 清除数据库中的字体设置
            try {
                await db.dexiData.put({ key: 'customFontUrl', value: '' });
                await db.dexiData.put({ key: 'customFontName', value: '' });
            } catch (e) {
                console.error('[Font] 清除字体设置失败:', e);
            }
            
            showToast('✅ 已恢复默认字体');
        }
        
        // ===== 全局字体大小设置 =====
        let globalFontSizeStyleElement = null;
        
        // 预览全局字体大小（拖动滑块时实时生效）
        function previewGlobalFontSize(size) {
            document.getElementById('global-font-size-value').textContent = size + 'px';
            applyGlobalFontSize(size);
        }
        
        // 应用全局字体大小
        function applyGlobalFontSize(size) {
            if (globalFontSizeStyleElement) {
                globalFontSizeStyleElement.remove();
            }
            
            globalFontSizeStyleElement = document.createElement('style');
            globalFontSizeStyleElement.id = 'global-font-size-style';
            globalFontSizeStyleElement.textContent = `
                /* 全局默认字体大小 */
                .message-content,
                .message-content .msg-text,
                .message-content .text-content {
                    font-size: ${size}px !important;
                }
            `;
            document.head.appendChild(globalFontSizeStyleElement);
        }
        
        // 保存全局字体大小
        async function saveGlobalFontSize() {
            const size = document.getElementById('global-font-size-slider').value;
            try {
                await db.dexiData.put({ key: 'globalFontSize', value: size });
                applyGlobalFontSize(size);
                showToast(`✅ 字体大小已保存：${size}px`);
            } catch(e) {
                console.error('[FontSize] 保存失败:', e);
                showToast('⚠️ 保存失败');
            }
        }
        
        // 重置全局字体大小为默认
        async function resetGlobalFontSize() {
            document.getElementById('global-font-size-slider').value = 14;
            document.getElementById('global-font-size-value').textContent = '14px';
            
            // 移除自定义样式
            if (globalFontSizeStyleElement) {
                globalFontSizeStyleElement.remove();
                globalFontSizeStyleElement = null;
            }
            
            try {
                await db.dexiData.put({ key: 'globalFontSize', value: '' });
            } catch(e) {
                console.error('[FontSize] 清除设置失败:', e);
            }
            showToast('✅ 已恢复默认字体大小');
        }
        
        // 桌面文字颜色相关
        let desktopTextColorStyleElement = null;
        
        function applyDesktopTextColor(color) {
            if (!color) return;
            
            // 移除旧样式
            if (desktopTextColorStyleElement) {
                desktopTextColorStyleElement.remove();
            }
            
            // 创建新的样式覆盖
            desktopTextColorStyleElement = document.createElement('style');
            desktopTextColorStyleElement.id = 'desktop-text-color-style';
            desktopTextColorStyleElement.textContent = `
                .app-icon .name,
                .dock-icon .name,
                .top-widget .text .title,
                .top-widget .text .subtext,
                .circle-photo .name,
                .circle-photo .bubble,
                .days-capsule .capsule {
                    color: ${color} !important;
                }
            `;
            document.head.appendChild(desktopTextColorStyleElement);
        }

        // 同步预览区和输入框
        function syncPreview() {
            // 壁纸预览
            const bg = document.getElementById('desktop-body').style.backgroundImage;
            if (bg) {
                document.getElementById('wallpaper-preview').style.backgroundImage = bg;
                document.getElementById('wallpaper-preview').innerText = '';
            }
            // 小组件
            document.getElementById('widget-icon-preview').style.backgroundImage = document.getElementById('widget-icon').style.backgroundImage;
            document.getElementById('widget-title-input').value = document.getElementById('widget-title').innerText.replace(/\{|\}/g, '').trim();
            document.getElementById('widget-subtext-input').value = document.getElementById('widget-subtext').innerText.trim();
            // 拍立得
            document.getElementById('photo-left-preview').style.backgroundImage = document.getElementById('img-left').style.backgroundImage;
            document.getElementById('photo-right-preview').style.backgroundImage = document.getElementById('img-right').style.backgroundImage;
            // 头像
            document.getElementById('avatar1-preview').style.backgroundImage = document.getElementById('avatar-img-1').style.backgroundImage;
            document.getElementById('avatar2-preview').style.backgroundImage = document.getElementById('avatar-img-2').style.backgroundImage;
            document.getElementById('avatar1-bubble-input').value = document.getElementById('avatar-bubble1').innerText.trim();
            document.getElementById('avatar1-name-input').value = document.getElementById('avatar-name1').innerText.trim();
            document.getElementById('avatar2-bubble-input').value = document.getElementById('avatar-bubble2').innerText.trim();
            document.getElementById('avatar2-name-input').value = document.getElementById('avatar-name2').innerText.trim();
            // 倒数日
            document.getElementById('days-input').value = document.getElementById('days-text').innerText.trim();
            // 椭圆形颜色
            const heartColor = getComputedStyle(document.documentElement).getPropertyValue('--heart-color').trim() || '#ffb6c1';
            const capsuleColor = getComputedStyle(document.documentElement).getPropertyValue('--capsule-bg').trim() || '#FFF7FA';
            const bubbleColor = getComputedStyle(document.documentElement).getPropertyValue('--bubble-bg').trim() || '#FFF7FA';
            document.getElementById('heart-color-input').value = heartColor;
            document.getElementById('capsule-color-input').value = capsuleColor;
            document.getElementById('bubble-color-input').value = bubbleColor;
            // 桌面文字颜色同步
            const dtcEl = document.getElementById('desktop-text-color-input');
            if (dtcEl) {
                // 从已有的样式中读取当前颜色，或保留输入框当前值
                const existingStyle = document.getElementById('desktop-text-color-style');
                if (!existingStyle && dtcEl.value === '#999999') {
                    // 默认值，不做任何事
                }
            }
            // 同步应用/Dock图标预览
            document.querySelectorAll('.icon-select-item[data-icon-id]').forEach(item => {
                const iconId = item.getAttribute('data-icon-id');
                const desktopIcon = document.getElementById(`icon-${iconId}`)?.querySelector('.icon') || document.getElementById(`dock-${iconId}`)?.querySelector('.icon');
                const previewIcon = item.querySelector('.icon');
                if (desktopIcon && previewIcon) {
                    previewIcon.style.backgroundImage = desktopIcon.style.backgroundImage;
                    previewIcon.style.backgroundSize = 'cover';
                    previewIcon.style.backgroundPosition = 'center';
                }
            });
            // 字体预览同步
            const fontName = document.getElementById('custom-font-name-input').value.trim();
            const previewText = document.getElementById('font-preview-text');
            if (fontName && previewText) {
                previewText.style.fontFamily = `"${fontName}", sans-serif`;
                previewText.innerText = `这是字体预览效果 ABC 123\n${fontName}`;
            }
        }

        // 页面切换
        function showCustomPage() {
            document.getElementById('home-page').style.display = 'none';
            document.getElementById('custom-main-page').style.display = 'flex';
            syncPreview();
            // 加载聊天主题列表
            loadChatThemeList();
            // 初始化主题预览
            setTimeout(() => {
                previewChatTheme();
            }, 100);
        }
        function backHomePage() {
            document.getElementById('custom-main-page').style.display = 'none';
            document.getElementById('home-page').style.display = 'flex';
        }

// ===== Section 2: 统一 apply 函数 / 图片选择器 / 自动保存 =====
        // ===== 统一 apply 函数（同时更新桌面 + 设置页预览） =====
        function applyWallpaper(url) {
            document.getElementById('desktop-body').style.backgroundImage = `url(${url})`;
            const preview = document.getElementById('wallpaper-preview');
            if (preview) { preview.style.backgroundImage = `url(${url})`; preview.innerText = ''; }
            autoSaveCustomization();
        }
        function applyIcon(iconId, url, triggerEl) {
            let iconDom = document.getElementById(`icon-${iconId}`)?.querySelector('.icon') || document.getElementById(`dock-${iconId}`)?.querySelector('.icon');
            if (iconDom) iconDom.style.backgroundImage = `url(${url})`;
            // 同步设置页图标预览
            const settingsItem = document.querySelector(`.icon-select-item[data-icon-id="${iconId}"] .icon`);
            if (settingsItem) settingsItem.style.backgroundImage = `url(${url})`;
            if (triggerEl) {
                const previewIcon = triggerEl.querySelector('.icon');
                if (previewIcon) previewIcon.style.backgroundImage = `url(${url})`;
            }
            autoSaveCustomization();
        }
        function applyWidgetIcon(url) {
            document.getElementById('widget-icon').style.backgroundImage = `url(${url})`;
            const preview = document.getElementById('widget-icon-preview');
            if (preview) preview.style.backgroundImage = `url(${url})`;
            autoSaveCustomization();
        }
        function applyPhoto(pos, url) {
            document.getElementById(`img-${pos}`).style.backgroundImage = `url(${url})`;
            const preview = document.getElementById(`photo-${pos}-preview`);
            if (preview) preview.style.backgroundImage = `url(${url})`;
            autoSaveCustomization();
        }
        function applyAvatar(id, url) {
            const img = document.getElementById(`avatar-img-${id}`);
            if (img) { img.style.backgroundImage = `url(${url})`; img.classList.add('has-image'); }
            const preview = document.getElementById(`avatar${id}-preview`);
            if (preview) preview.style.backgroundImage = `url(${url})`;
            autoSaveCustomization();
        }

        // ===== 统一图片选择弹窗 =====
        let _imgPickerCallback = null;
        function showImagePicker(config) {
            // config: { onApply: function(url) }
            const existing = document.getElementById('image-picker-modal');
            if (existing) existing.remove();
            _imgPickerCallback = config.onApply;

            const overlay = document.createElement('div');
            overlay.id = 'image-picker-modal';
            overlay.className = 'image-picker-overlay';
            overlay.innerHTML = `
                <div class="image-picker-card">
                    <div class="image-picker-title">选择图片来源</div>
                    <div class="image-picker-option" onclick="imagePickerFromGallery()">
                        <span style="font-size:20px;">📷</span>
                        <span>从相册选择</span>
                    </div>
                    <div class="image-picker-option" onclick="imagePickerShowUrlInput()">
                        <span style="font-size:20px;">🔗</span>
                        <span>粘贴图片链接</span>
                    </div>
                    <div class="image-picker-url-area" id="image-picker-url-area" style="display:none;">
                        <input type="text" class="image-picker-url-input" id="image-picker-url-input" placeholder="粘贴图片链接地址" oninput="imagePickerPreviewUrl(this.value)" onfocus="setTimeout(()=>this.scrollIntoView({behavior:'smooth',block:'center'}),300)" style="font-size:16px;">
                        <div class="image-picker-preview-box" id="image-picker-preview-box">图片预览</div>
                        <div class="image-picker-confirm" onclick="imagePickerConfirmUrl()">确认使用</div>
                    </div>
                    <div class="image-picker-cancel" onclick="closeImagePicker()">取消</div>
                </div>
            `;
            overlay.onclick = (e) => { if (e.target === overlay) closeImagePicker(); };
            document.body.appendChild(overlay);
        }
        function imagePickerFromGallery() {
            let input = document.getElementById('image-picker-file-input');
            if (!input) {
                input = document.createElement('input');
                input.type = 'file';
                input.id = 'image-picker-file-input';
                input.accept = 'image/*';
                input.style.display = 'none';
                document.body.appendChild(input);
            }
            input.onchange = function() {
                const file = this.files[0];
                if (file && _imgPickerCallback) {
                    const reader = new FileReader();
                    reader.onload = async e => {
                        const compressed = await compressImage(e.target.result, 1200, 0.8);
                        _imgPickerCallback(compressed);
                        closeImagePicker();
                    };
                    reader.readAsDataURL(file);
                }
                this.value = '';
            };
            input.click();
        }
        function imagePickerShowUrlInput() {
            const area = document.getElementById('image-picker-url-area');
            if (area) {
                area.style.display = 'flex';
                // 🔧 键盘适配：输入框显示后自动聚焦，并在键盘弹起后滚动到可见区域
                setTimeout(() => {
                    const urlInput = document.getElementById('image-picker-url-input');
                    if (urlInput) {
                        urlInput.focus();
                        urlInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }, 300);
            }
        }
        function imagePickerPreviewUrl(url) {
            url = url.trim();
            const box = document.getElementById('image-picker-preview-box');
            if (!box) return;
            if (url) {
                box.style.backgroundImage = `url(${url})`;
                box.style.backgroundSize = 'cover';
                box.style.backgroundPosition = 'center';
                box.innerText = '';
            } else {
                box.style.backgroundImage = '';
                box.innerText = '图片预览';
            }
        }
        function imagePickerConfirmUrl() {
            const url = document.getElementById('image-picker-url-input')?.value?.trim();
            if (url && _imgPickerCallback) {
                _imgPickerCallback(url);
            }
            closeImagePicker();
        }
        function closeImagePicker() {
            const modal = document.getElementById('image-picker-modal');
            if (modal) modal.remove();
            _imgPickerCallback = null;
        }
        // 设置页图标点击 —— 弹出图片选择器
        function selectIconPicker(el, iconId) {
            showImagePicker({
                onApply: (url) => applyIcon(iconId, url, el)
            });
        }
        
        // 自动保存个性化设置（防抖，避免频繁写入）
        let _autoSaveTimer = null;
        function autoSaveCustomization() {
            if (_autoSaveTimer) clearTimeout(_autoSaveTimer);
            _autoSaveTimer = setTimeout(async () => {
                try {
                    // 保存所有图片相关的数据到Dexie
                    const saveItems = {};
                    
                    // 壁纸
                    const wallpaper = document.getElementById('desktop-body')?.style.backgroundImage?.replace(/url\(|\)|"/g, '') || '';
                    if (wallpaper) saveItems.wallpaper = wallpaper;
                    
                    // 小组件图标
                    const widgetIcon = document.getElementById('widget-icon')?.style.backgroundImage?.replace(/url\(|\)|"/g, '') || '';
                    if (widgetIcon) saveItems.widgetIcon = widgetIcon;
                    
                    // 拍立得
                    const photoLeft = document.getElementById('img-left')?.style.backgroundImage?.replace(/url\(|\)|"/g, '') || '';
                    const photoRight = document.getElementById('img-right')?.style.backgroundImage?.replace(/url\(|\)|"/g, '') || '';
                    if (photoLeft) saveItems.photoLeft = photoLeft;
                    if (photoRight) saveItems.photoRight = photoRight;
                    
                    // 头像
                    const avatar1 = document.getElementById('avatar-img-1')?.style.backgroundImage?.replace(/url\(|\)|"/g, '') || '';
                    const avatar2 = document.getElementById('avatar-img-2')?.style.backgroundImage?.replace(/url\(|\)|"/g, '') || '';
                    if (avatar1) saveItems.avatar1 = avatar1;
                    if (avatar2) saveItems.avatar2 = avatar2;
                    
                    // 应用图标
                    const iconIds = ['appstore','notes','remind','facetime','photo','xianyu','cabin','icity','findphone'];
                    iconIds.forEach(id => {
                        const el = document.getElementById(`icon-${id}`)?.querySelector('.icon');
                        if (el?.style.backgroundImage) {
                            const val = el.style.backgroundImage.replace(/url\(|\)|"/g, '');
                            if (val) saveItems[`icon${id.charAt(0).toUpperCase() + id.slice(1)}`] = val;
                        }
                    });
                    
                    // Dock图标
                    const dockIds = ['setting','custom','message','phone'];
                    dockIds.forEach(id => {
                        const el = document.getElementById(`dock-${id}`)?.querySelector('.icon');
                        if (el?.style.backgroundImage) {
                            const val = el.style.backgroundImage.replace(/url\(|\)|"/g, '');
                            if (val) saveItems[`dock${id.charAt(0).toUpperCase() + id.slice(1)}`] = val;
                        }
                    });
                    
                    // 写入Dexie
                    for (const [key, value] of Object.entries(saveItems)) {
                        await db.dexiData.put({ key, value });
                    }
                    
                    console.log('[AutoSave] ✓ 图标/壁纸自动保存成功');
                } catch (err) {
                    console.error('[AutoSave] ✗ 自动保存失败:', err);
                }
            }, 500); // 500ms 防抖
        }

// ===== Section 3: 保存全部设置 / 导出导入装修包 =====
        // 核心：保存所有设置到DEXie (保留原有逻辑，仅排除 AI 相关 key 防止覆盖)
        async function saveAllSetting() {
            try {
                // 读取所有输入值
                const saveData = {
                    wallpaper: document.getElementById('desktop-body')?.style.backgroundImage?.replace(/url\(|\)|"/g, '') || '',
                    widgetIcon: document.getElementById('widget-icon')?.style.backgroundImage?.replace(/url\(|\)|"/g, '') || '',
                    widgetTitle: document.getElementById('widget-title-input')?.value?.trim() || document.getElementById('widget-title')?.innerText?.trim() || 'lovely Day',
                    widgetSubtext: document.getElementById('widget-subtext-input')?.value?.trim() || document.getElementById('widget-subtext')?.innerText?.trim() || '世界破破烂烂小猫缝缝补补 🐾',
                    photoLeft: document.getElementById('img-left')?.style.backgroundImage?.replace(/url\(|\)|"/g, '') || '',
                    photoRight: document.getElementById('img-right')?.style.backgroundImage?.replace(/url\(|\)|"/g, '') || '',
                    avatar1: document.getElementById('avatar-img-1')?.style.backgroundImage?.replace(/url\(|\)|"/g, '') || '',
                    avatar2: document.getElementById('avatar-img-2')?.style.backgroundImage?.replace(/url\(|\)|"/g, '') || '',
                    avatar1Bubble: document.getElementById('avatar1-bubble-input')?.value?.trim() || '> .. <',
                    avatar1Name: document.getElementById('avatar1-name-input')?.value?.trim() || '> .. <',
                    avatar2Bubble: document.getElementById('avatar2-bubble-input')?.value?.trim() || 'gw..♡',
                    avatar2Name: document.getElementById('avatar2-name-input')?.value?.trim() || 'gw..♡',
                    daysText: document.getElementById('days-input')?.value?.trim() || '446 days'
                };
                
                // 存储应用图标
                const iconIds = ['appstore','notes','remind','facetime','photo','xianyu','cabin','icity','findphone'];
                iconIds.forEach(id => {
                    const el = document.getElementById(`icon-${id}`)?.querySelector('.icon');
                    if (el) saveData[`icon${id.charAt(0).toUpperCase() + id.slice(1)}`] = el.style.backgroundImage.replace(/url\(|\)|"/g, '');
                });
                // 存储Dock图标
                const dockIds = ['setting','custom','message','phone'];
                dockIds.forEach(id => {
                    const el = document.getElementById(`dock-${id}`)?.querySelector('.icon');
                    if (el) saveData[`dock${id.charAt(0).toUpperCase() + id.slice(1)}`] = el.style.backgroundImage.replace(/url\(|\)|"/g, '');
                });

                // 保存椭圆形颜色
                const heartColor = document.getElementById('heart-color-input')?.value || '#ffb6c1';
                const capsuleColor = document.getElementById('capsule-color-input')?.value || '#FFF7FA';
                const bubbleColor = document.getElementById('bubble-color-input')?.value || '#FFF7FA';
                saveData.heartColor = heartColor;
                saveData.capsuleColor = capsuleColor;
                saveData.bubbleColor = bubbleColor;

                // 保存桌面文字颜色
                const desktopTextColor = document.getElementById('desktop-text-color-input')?.value || '#999999';
                saveData.desktopTextColor = desktopTextColor;

                // 保存自定义字体
                const customFontUrl = document.getElementById('custom-font-input')?.value?.trim() || '';
                const customFontName = document.getElementById('custom-font-name-input')?.value?.trim() || '';
                saveData.customFontUrl = customFontUrl;
                saveData.customFontName = customFontName;

                // 保存全局字体大小
                const globalFontSize = document.getElementById('global-font-size-slider')?.value || '';
                saveData.globalFontSize = globalFontSize;

                // 保存自定义CSS
                const customCssCode = document.getElementById('custom-css-input')?.value || '';
                saveData.customCssCode = customCssCode;

                // 循环保存到数据库
                for (const [key, value] of Object.entries(saveData)) {
                    await db.dexiData.put({ key, value });
                }

                // 实时更新页面显示
                const widgetTitle = document.getElementById('widget-title');
                const widgetSubtext = document.getElementById('widget-subtext');
                const bubble1 = document.getElementById('avatar-bubble1');
                const name1 = document.getElementById('avatar-name1');
                const bubble2 = document.getElementById('avatar-bubble2');
                const name2 = document.getElementById('avatar-name2');
                const daysText = document.getElementById('days-text');
                
                if (widgetTitle) widgetTitle.innerText = saveData.widgetTitle;
                if (widgetSubtext) widgetSubtext.innerText = saveData.widgetSubtext;
                if (bubble1) bubble1.innerText = saveData.avatar1Bubble;
                if (name1) name1.innerText = saveData.avatar1Name;
                if (bubble2) bubble2.innerText = saveData.avatar2Bubble;
                if (name2) name2.innerText = saveData.avatar2Name;
                if (daysText) daysText.innerText = saveData.daysText;
                
                // 应用椭圆形颜色
                document.documentElement.style.setProperty('--heart-color', heartColor);
                document.documentElement.style.setProperty('--capsule-bg', capsuleColor);
                document.documentElement.style.setProperty('--bubble-bg', bubbleColor);

                // 应用桌面文字颜色
                if (desktopTextColor && desktopTextColor !== '#999999') {
                    applyDesktopTextColor(desktopTextColor);
                }

                // 应用自定义字体到全局
                if (customFontUrl && customFontName) {
                    loadCustomFont(customFontUrl, customFontName, false);
                }

                // 应用自定义CSS
                applyCustomCSS();

                // 保存提示
                showToast('✅ 保存成功');
                console.log('[SaveSetting] ✓ 个性化设置保存成功', saveData);
            } catch (error) {
                console.error('[SaveSetting] ✗ 保存失败:', error);
                showToast('❌ 保存失败: ' + error.message);
            }
        }

        // ===== 导出/导入桌面装修包 =====
        async function exportDesktopTheme() {
            try {
                const theme = {};
                // 壁纸
                theme.wallpaper = document.getElementById('desktop-body')?.style.backgroundImage?.replace(/url\(|\)|"/g, '') || '';
                // 小组件
                theme.widgetIcon = document.getElementById('widget-icon')?.style.backgroundImage?.replace(/url\(|\)|"/g, '') || '';
                theme.widgetTitle = document.getElementById('widget-title')?.innerText?.trim() || '';
                theme.widgetSubtext = document.getElementById('widget-subtext')?.innerText?.trim() || '';
                // 拍立得
                theme.photoLeft = document.getElementById('img-left')?.style.backgroundImage?.replace(/url\(|\)|"/g, '') || '';
                theme.photoRight = document.getElementById('img-right')?.style.backgroundImage?.replace(/url\(|\)|"/g, '') || '';
                // 头像
                theme.avatar1 = document.getElementById('avatar-img-1')?.style.backgroundImage?.replace(/url\(|\)|"/g, '') || '';
                theme.avatar2 = document.getElementById('avatar-img-2')?.style.backgroundImage?.replace(/url\(|\)|"/g, '') || '';
                theme.avatar1Bubble = document.getElementById('avatar-bubble1')?.innerText?.trim() || '';
                theme.avatar1Name = document.getElementById('avatar-name1')?.innerText?.trim() || '';
                theme.avatar2Bubble = document.getElementById('avatar-bubble2')?.innerText?.trim() || '';
                theme.avatar2Name = document.getElementById('avatar-name2')?.innerText?.trim() || '';
                // 倒数日
                theme.daysText = document.getElementById('days-text')?.innerText?.trim() || '';
                // 应用图标
                const iconIds = ['appstore','notes','remind','facetime','photo','xianyu','cabin','icity','findphone'];
                iconIds.forEach(id => {
                    const el = document.getElementById(`icon-${id}`)?.querySelector('.icon');
                    if (el && el.style.backgroundImage) theme[`icon_${id}`] = el.style.backgroundImage.replace(/url\(|\)|"/g, '');
                });
                // Dock图标
                const dockIds = ['setting','custom','message','phone'];
                dockIds.forEach(id => {
                    const el = document.getElementById(`dock-${id}`)?.querySelector('.icon');
                    if (el && el.style.backgroundImage) theme[`dock_${id}`] = el.style.backgroundImage.replace(/url\(|\)|"/g, '');
                });
                // 颜色
                theme.heartColor = getComputedStyle(document.documentElement).getPropertyValue('--heart-color').trim() || '';
                theme.capsuleColor = getComputedStyle(document.documentElement).getPropertyValue('--capsule-bg').trim() || '';
                theme.bubbleColor = getComputedStyle(document.documentElement).getPropertyValue('--bubble-bg').trim() || '';
                // 桌面文字颜色
                theme.desktopTextColor = document.getElementById('desktop-text-color-input')?.value || '#999999';
                // 字体
                theme.customFontUrl = document.getElementById('custom-font-input')?.value?.trim() || '';
                theme.customFontName = document.getElementById('custom-font-name-input')?.value?.trim() || '';
                // 全局字体大小
                theme.globalFontSize = document.getElementById('global-font-size-slider')?.value || '';
                // 自定义CSS
                theme.customCssCode = document.getElementById('custom-css-input')?.value || '';

                // 生成文件
                const jsonStr = JSON.stringify(theme, null, 2);
                const blob = new Blob([jsonStr], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `桌面装修包_${new Date().toLocaleDateString('zh-CN').replace(/\//g, '-')}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                showToast('✅ 装修包已导出');
            } catch (err) {
                console.error('[ExportTheme] 导出失败:', err);
                showToast('❌ 导出失败: ' + err.message);
            }
        }

        async function importDesktopTheme(input) {
            const file = input.files[0];
            if (!file) return;
            input.value = '';
            try {
                const text = await file.text();
                const theme = JSON.parse(text);
                if (typeof theme !== 'object' || theme === null) throw new Error('文件格式无效');

                // 壁纸
                if (theme.wallpaper) {
                    document.getElementById('desktop-body').style.backgroundImage = `url(${theme.wallpaper})`;
                    const wp = document.getElementById('wallpaper-preview');
                    if (wp) { wp.style.backgroundImage = `url(${theme.wallpaper})`; wp.innerText = ''; }
                }
                // 小组件
                if (theme.widgetIcon) {
                    document.getElementById('widget-icon').style.backgroundImage = `url(${theme.widgetIcon})`;
                    const wip = document.getElementById('widget-icon-preview');
                    if (wip) wip.style.backgroundImage = `url(${theme.widgetIcon})`;
                }
                if (theme.widgetTitle) {
                    document.getElementById('widget-title').innerText = theme.widgetTitle;
                    const wti = document.getElementById('widget-title-input');
                    if (wti) wti.value = theme.widgetTitle;
                }
                if (theme.widgetSubtext) {
                    document.getElementById('widget-subtext').innerText = theme.widgetSubtext;
                    const wsi = document.getElementById('widget-subtext-input');
                    if (wsi) wsi.value = theme.widgetSubtext;
                }
                // 拍立得
                if (theme.photoLeft) {
                    document.getElementById('img-left').style.backgroundImage = `url(${theme.photoLeft})`;
                    const plp = document.getElementById('photo-left-preview');
                    if (plp) plp.style.backgroundImage = `url(${theme.photoLeft})`;
                }
                if (theme.photoRight) {
                    document.getElementById('img-right').style.backgroundImage = `url(${theme.photoRight})`;
                    const prp = document.getElementById('photo-right-preview');
                    if (prp) prp.style.backgroundImage = `url(${theme.photoRight})`;
                }
                // 头像
                if (theme.avatar1) {
                    const img1 = document.getElementById('avatar-img-1');
                    if (img1) { img1.style.backgroundImage = `url(${theme.avatar1})`; img1.classList.add('has-image'); }
                    const ap1 = document.getElementById('avatar1-preview');
                    if (ap1) ap1.style.backgroundImage = `url(${theme.avatar1})`;
                }
                if (theme.avatar2) {
                    const img2 = document.getElementById('avatar-img-2');
                    if (img2) { img2.style.backgroundImage = `url(${theme.avatar2})`; img2.classList.add('has-image'); }
                    const ap2 = document.getElementById('avatar2-preview');
                    if (ap2) ap2.style.backgroundImage = `url(${theme.avatar2})`;
                }
                if (theme.avatar1Bubble) {
                    const b1 = document.getElementById('avatar-bubble1');
                    if (b1) b1.innerText = theme.avatar1Bubble;
                    const ib1 = document.getElementById('avatar1-bubble-input');
                    if (ib1) ib1.value = theme.avatar1Bubble;
                }
                if (theme.avatar1Name) {
                    const n1 = document.getElementById('avatar-name1');
                    if (n1) n1.innerText = theme.avatar1Name;
                    const in1 = document.getElementById('avatar1-name-input');
                    if (in1) in1.value = theme.avatar1Name;
                }
                if (theme.avatar2Bubble) {
                    const b2 = document.getElementById('avatar-bubble2');
                    if (b2) b2.innerText = theme.avatar2Bubble;
                    const ib2 = document.getElementById('avatar2-bubble-input');
                    if (ib2) ib2.value = theme.avatar2Bubble;
                }
                if (theme.avatar2Name) {
                    const n2 = document.getElementById('avatar-name2');
                    if (n2) n2.innerText = theme.avatar2Name;
                    const in2 = document.getElementById('avatar2-name-input');
                    if (in2) in2.value = theme.avatar2Name;
                }
                // 倒数日
                if (theme.daysText) {
                    document.getElementById('days-text').innerText = theme.daysText;
                    const di = document.getElementById('days-input');
                    if (di) di.value = theme.daysText;
                }
                // 应用图标
                const iconIds = ['appstore','notes','remind','facetime','photo','xianyu','cabin','icity','findphone'];
                iconIds.forEach(id => {
                    const val = theme[`icon_${id}`];
                    if (val) {
                        const el = document.getElementById(`icon-${id}`)?.querySelector('.icon');
                        if (el) el.style.backgroundImage = `url(${val})`;
                        const si = document.querySelector(`.icon-select-item[data-icon-id="${id}"] .icon`);
                        if (si) { si.style.backgroundImage = `url(${val})`; si.style.backgroundSize = 'cover'; si.style.backgroundPosition = 'center'; }
                    }
                });
                // Dock图标
                const dockIds = ['setting','custom','message','phone'];
                dockIds.forEach(id => {
                    const val = theme[`dock_${id}`];
                    if (val) {
                        const el = document.getElementById(`dock-${id}`)?.querySelector('.icon');
                        if (el) el.style.backgroundImage = `url(${val})`;
                        const si = document.querySelector(`.icon-select-item[data-icon-id="${id}"] .icon`);
                        if (si) { si.style.backgroundImage = `url(${val})`; si.style.backgroundSize = 'cover'; si.style.backgroundPosition = 'center'; }
                    }
                });
                // 颜色
                if (theme.heartColor) {
                    document.documentElement.style.setProperty('--heart-color', theme.heartColor);
                    const hci = document.getElementById('heart-color-input');
                    if (hci) hci.value = theme.heartColor;
                }
                if (theme.capsuleColor) {
                    document.documentElement.style.setProperty('--capsule-bg', theme.capsuleColor);
                    const cci = document.getElementById('capsule-color-input');
                    if (cci) cci.value = theme.capsuleColor;
                }
                if (theme.bubbleColor) {
                    document.documentElement.style.setProperty('--bubble-bg', theme.bubbleColor);
                    const bci = document.getElementById('bubble-color-input');
                    if (bci) bci.value = theme.bubbleColor;
                }
                // 桌面文字颜色
                if (theme.desktopTextColor) {
                    applyDesktopTextColor(theme.desktopTextColor);
                    const dtci = document.getElementById('desktop-text-color-input');
                    if (dtci) dtci.value = theme.desktopTextColor;
                }
                // 字体
                if (theme.customFontUrl && theme.customFontName) {
                    const cfi = document.getElementById('custom-font-input');
                    if (cfi) cfi.value = theme.customFontUrl;
                    const cfni = document.getElementById('custom-font-name-input');
                    if (cfni) cfni.value = theme.customFontName;
                    loadCustomFont(theme.customFontUrl, theme.customFontName, false);
                }
                // 全局字体大小
                if (theme.globalFontSize && theme.globalFontSize !== '') {
                    const slider = document.getElementById('global-font-size-slider');
                    const label = document.getElementById('global-font-size-value');
                    if (slider) slider.value = theme.globalFontSize;
                    if (label) label.textContent = theme.globalFontSize + 'px';
                    applyGlobalFontSize(theme.globalFontSize);
                }
                // 自定义CSS
                if (theme.customCssCode !== undefined) {
                    const cssi = document.getElementById('custom-css-input');
                    if (cssi) cssi.value = theme.customCssCode;
                    applyCustomCSS();
                }

                // 自动保存到数据库
                await saveAllSetting();
                showToast('✅ 装修包导入成功');
                console.log('[ImportTheme] ✓ 装修包导入成功', theme);
            } catch (err) {
                console.error('[ImportTheme] 导入失败:', err);
                showToast('❌ 导入失败: ' + err.message);
            }
        }

// ===== Section 4: restoreSetting / 自定义CSS功能 =====
        // 核心：从DEXie恢复所有设置
        async function restoreSetting() {
            // 获取所有存储的数据
            const allData = await db.dexiData.toArray();
            const dataMap = {};
            allData.forEach(item => {
                dataMap[item.key] = item.value;
            });
            
            // API 配置无需在首页显示，只在展开时加载

            // 恢复壁纸
            if (dataMap.wallpaper) document.getElementById('desktop-body').style.backgroundImage = `url(${dataMap.wallpaper})`;
            // 恢复小组件
            if (dataMap.widgetIcon) document.getElementById('widget-icon').style.backgroundImage = `url(${dataMap.widgetIcon})`;
            if (dataMap.widgetTitle) document.getElementById('widget-title').innerText = dataMap.widgetTitle;
            if (dataMap.widgetSubtext) document.getElementById('widget-subtext').innerText = dataMap.widgetSubtext;
            // 恢复拍立得
            if (dataMap.photoLeft) document.getElementById('img-left').style.backgroundImage = `url(${dataMap.photoLeft})`;
            if (dataMap.photoRight) document.getElementById('img-right').style.backgroundImage = `url(${dataMap.photoRight})`;
            // 恢复头像
            if (dataMap.avatar1) {
                const img1 = document.getElementById('avatar-img-1');
                img1.style.backgroundImage = `url(${dataMap.avatar1})`;
                img1.classList.add('has-image');
            }
            if (dataMap.avatar2) {
                const img2 = document.getElementById('avatar-img-2');
                img2.style.backgroundImage = `url(${dataMap.avatar2})`;
                img2.classList.add('has-image');
            }
            if (dataMap.avatar1Bubble) {
                document.getElementById('avatar-bubble1').innerText = dataMap.avatar1Bubble;
                const input1b = document.getElementById('avatar1-bubble-input');
                if (input1b) input1b.value = dataMap.avatar1Bubble;
            }
            if (dataMap.avatar1Name) {
                document.getElementById('avatar-name1').innerText = dataMap.avatar1Name;
                const input1n = document.getElementById('avatar1-name-input');
                if (input1n) input1n.value = dataMap.avatar1Name;
            }
            if (dataMap.avatar2Bubble) {
                document.getElementById('avatar-bubble2').innerText = dataMap.avatar2Bubble;
                const input2b = document.getElementById('avatar2-bubble-input');
                if (input2b) input2b.value = dataMap.avatar2Bubble;
            }
            if (dataMap.avatar2Name) {
                document.getElementById('avatar-name2').innerText = dataMap.avatar2Name;
                const input2n = document.getElementById('avatar2-name-input');
                if (input2n) input2n.value = dataMap.avatar2Name;
            }
            // 恢复倒数日
            if (dataMap.daysText) {
                document.getElementById('days-text').innerText = dataMap.daysText;
                const daysInput = document.getElementById('days-input');
                if (daysInput) daysInput.value = dataMap.daysText;
            }
            // 恢复小组件文本到输入框
            if (dataMap.widgetTitle) {
                const wtInput = document.getElementById('widget-title-input');
                if (wtInput) wtInput.value = dataMap.widgetTitle;
            }
            if (dataMap.widgetSubtext) {
                const wsInput = document.getElementById('widget-subtext-input');
                if (wsInput) wsInput.value = dataMap.widgetSubtext;
            }
            // 恢复应用图标
            const iconIds = ['appstore','notes','remind','facetime','photo','xianyu','cabin','icity','findphone'];
            iconIds.forEach(id => {
                const key = `icon${id.charAt(0).toUpperCase() + id.slice(1)}`;
                const el = document.getElementById(`icon-${id}`)?.querySelector('.icon');
                if (dataMap[key] && el) el.style.backgroundImage = `url(${dataMap[key]})`;
            });
            // 恢复Dock图标
            const dockIds = ['setting','custom','message','phone'];
            dockIds.forEach(id => {
                const key = `dock${id.charAt(0).toUpperCase() + id.slice(1)}`;
                const el = document.getElementById(`dock-${id}`)?.querySelector('.icon');
                if (dataMap[key] && el) el.style.backgroundImage = `url(${dataMap[key]})`;
            });
            
        // 恢复椭圆形颜色
        if (dataMap.heartColor) {
            document.documentElement.style.setProperty('--heart-color', dataMap.heartColor);
            const hcInput = document.getElementById('heart-color-input');
            if (hcInput) hcInput.value = dataMap.heartColor;
        }
        if (dataMap.capsuleColor) {
            document.documentElement.style.setProperty('--capsule-bg', dataMap.capsuleColor);
            const ccInput = document.getElementById('capsule-color-input');
            if (ccInput) ccInput.value = dataMap.capsuleColor;
        }
        if (dataMap.bubbleColor) {
            document.documentElement.style.setProperty('--bubble-bg', dataMap.bubbleColor);
            const bcInput = document.getElementById('bubble-color-input');
            if (bcInput) bcInput.value = dataMap.bubbleColor;
        }
        
        // 恢复桌面文字颜色
        if (dataMap.desktopTextColor && dataMap.desktopTextColor !== '#999999') {
            applyDesktopTextColor(dataMap.desktopTextColor);
            const dtcInput = document.getElementById('desktop-text-color-input');
            if (dtcInput) dtcInput.value = dataMap.desktopTextColor;
        }
        
        // 恢复全局字体大小
        if (dataMap.globalFontSize && dataMap.globalFontSize !== '') {
            const slider = document.getElementById('global-font-size-slider');
            const label = document.getElementById('global-font-size-value');
            if (slider) slider.value = dataMap.globalFontSize;
            if (label) label.textContent = dataMap.globalFontSize + 'px';
            applyGlobalFontSize(dataMap.globalFontSize);
        }
        
        // 恢复自定义字体
        if (dataMap.customFontUrl && dataMap.customFontName) {
            // 填充输入框
            document.getElementById('custom-font-input').value = dataMap.customFontUrl;
            document.getElementById('custom-font-name-input').value = dataMap.customFontName;
            // 加载并应用全局字体
            loadCustomFont(dataMap.customFontUrl, dataMap.customFontName, false);
        }

        // 恢复自定义CSS
        if (dataMap.customCssCode) {
            const cssInput = document.getElementById('custom-css-input');
            if (cssInput) cssInput.value = dataMap.customCssCode;
            applyCustomCSS();
        }
    }

    // ===== 自定义CSS功能 =====

    // 应用自定义CSS
    function applyCustomCSS() {
        const cssCode = document.getElementById('custom-css-input').value;
        let styleEl = document.getElementById('user-custom-css');
        if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = 'user-custom-css';
            document.head.appendChild(styleEl);
        }
        styleEl.textContent = cssCode || '';
    }

    // 清空自定义CSS
    function clearCustomCSS() {
        document.getElementById('custom-css-input').value = '';
        applyCustomCSS();
        if (typeof showToast === 'function') showToast('已清空自定义CSS');
    }

    /**
     * 保存当前全局自定义CSS为预设
     * 将textarea中的CSS代码以命名预设的方式持久化到IndexedDB
     */
    async function saveGlobalCSSPreset() {
        const cssCode = document.getElementById('custom-css-input')?.value?.trim();
        if (!cssCode) {
            showToast('当前没有CSS代码可保存');
            return;
        }

        const presetName = prompt('请输入预设名称：');
        if (!presetName || !presetName.trim()) return;

        try {
            const existing = await db.dexiData.get('globalCSSPresets');
            const presets = existing ? existing.value : [];

            // 检查是否重名
            if (presets.find(p => p.name === presetName.trim())) {
                if (!confirm(`预设"${presetName.trim()}"已存在，是否覆盖？`)) return;
                const idx = presets.findIndex(p => p.name === presetName.trim());
                if (idx !== -1) presets.splice(idx, 1);
            }

            presets.push({
                name: presetName.trim(),
                cssCode: cssCode,
                time: Date.now()
            });

            await db.dexiData.put({ key: 'globalCSSPresets', value: presets });
            showToast(`CSS预设"${presetName.trim()}"已保存！`);
        } catch (e) {
            console.error('[全局CSS] 保存预设失败:', e);
            showToast('保存预设失败');
        }
    }

    /**
     * 加载全局CSS预设列表
     * 从IndexedDB读取已保存的CSS预设并展示为可操作列表
     */
    async function loadGlobalCSSPreset() {
        try {
            const existing = await db.dexiData.get('globalCSSPresets');
            const presets = existing ? existing.value : [];

            if (presets.length === 0) {
                showToast('暂无保存的CSS预设');
                return;
            }

            const listEl = document.getElementById('global-css-preset-list');
            if (!listEl) return;

            // 切换显示/隐藏
            if (listEl.style.display !== 'none' && listEl.innerHTML !== '') {
                listEl.style.display = 'none';
                return;
            }

            let html = '';
            for (let i = 0; i < presets.length; i++) {
                const p = presets[i];
                const timeStr = p.time ? new Date(p.time).toLocaleDateString() : '';
                const preview = (p.cssCode || '').substring(0, 50).replace(/</g, '&lt;') + (p.cssCode?.length > 50 ? '...' : '');

                html += `
                    <div style="display:flex; align-items:center; padding:10px 12px; background:#fff; border:1px solid #e8e8e8; border-radius:10px; margin-bottom:8px;">
                        <div style="flex:1; min-width:0;">
                            <div style="font-size:13px; font-weight:500; color:#333; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${p.name}</div>
                            <div style="font-size:10px; color:#aaa; margin-top:3px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${preview} ${timeStr ? '· ' + timeStr : ''}</div>
                        </div>
                        <div style="display:flex; gap:6px; flex-shrink:0; margin-left:8px;">
                            <div onclick="applyGlobalCSSPreset(${i})" style="padding:5px 12px; font-size:11px; background:#007aff; color:#fff; border-radius:6px; cursor:pointer; font-weight:500;">应用</div>
                            <div onclick="deleteGlobalCSSPreset(${i})" style="padding:5px 10px; font-size:11px; background:#f5f5f5; color:#ff3b30; border-radius:6px; cursor:pointer;">删除</div>
                        </div>
                    </div>
                `;
            }

            listEl.innerHTML = html;
            listEl.style.display = 'block';
        } catch (e) {
            console.error('[全局CSS] 加载预设失败:', e);
            showToast('加载预设失败');
        }
    }

    /**
     * 应用指定的全局CSS预设
     * 将预设中的CSS代码回填到textarea并立即生效
     */
    async function applyGlobalCSSPreset(index) {
        try {
            const existing = await db.dexiData.get('globalCSSPresets');
            const presets = existing ? existing.value : [];
            if (index < 0 || index >= presets.length) return;

            const p = presets[index];
            const cssInput = document.getElementById('custom-css-input');
            if (cssInput) {
                cssInput.value = p.cssCode || '';
            }

            // 立即应用CSS
            applyCustomCSS();

            showToast(`已应用CSS预设"${p.name}"`);

            // 隐藏预设列表
            const listEl = document.getElementById('global-css-preset-list');
            if (listEl) listEl.style.display = 'none';
        } catch (e) {
            console.error('[全局CSS] 应用预设失败:', e);
            showToast('应用预设失败');
        }
    }

    /**
     * 删除指定的全局CSS预设
     * 从IndexedDB中移除并刷新预设列表
     */
    async function deleteGlobalCSSPreset(index) {
        try {
            const existing = await db.dexiData.get('globalCSSPresets');
            const presets = existing ? existing.value : [];
            if (index < 0 || index >= presets.length) return;

            const name = presets[index].name;
            if (!confirm(`确定要删除CSS预设"${name}"吗？`)) return;

            presets.splice(index, 1);
            await db.dexiData.put({ key: 'globalCSSPresets', value: presets });

            showToast(`已删除CSS预设"${name}"`);

            // 刷新列表
            const listEl = document.getElementById('global-css-preset-list');
            if (listEl) {
                listEl.style.display = 'none';
                listEl.innerHTML = '';
            }
            if (presets.length > 0) {
                loadGlobalCSSPreset();
            }
        } catch (e) {
            console.error('[全局CSS] 删除预设失败:', e);
            showToast('删除预设失败');
        }
    }

    /**
     * 显示CSS类名参考弹窗
     * 列出聊天页面各区域的CSS类名，方便用户编写自定义CSS
     */
    function showCSSClassReference() {
        let modal = document.getElementById('css-class-ref-modal');
        if (modal) {
            modal.style.display = 'flex';
            return;
        }
        modal = document.createElement('div');
        modal.id = 'css-class-ref-modal';
        modal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:10001; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(3px); -webkit-backdrop-filter:blur(3px);';
        modal.onclick = function(e) { if (e.target === modal) modal.style.display = 'none'; };

        const sections = [
            {
                title: '📱 聊天页面 · 整体结构',
                items: [
                    ['.chat-window', '聊天窗口（整个页面容器）'],
                    ['.chat-header', '顶栏（包含返回/标题/按钮）'],
                    ['.chat-back', '返回按钮（左上角 ←）'],
                    ['.chat-title', '标题（角色名字）'],
                    ['.chat-more', '右侧按钮（线下模式 / 聊天详情 ···）'],
                    ['.chat-body', '消息列表区域（中间滚动区）'],
                    ['.chat-footer', '底栏（输入框区域容器）'],
                ]
            },
            {
                title: '⌨️ 输入区域',
                items: [
                    ['.chat-input-bar', '输入栏（一行：魔法棒+输入框+按钮）'],
                    ['.chat-icon-btn', '图标按钮（接收回复🪄 / 表情😊 / 菜单⊕）'],
                    ['.chat-input', '文字输入框'],
                    ['.chat-send-btn', '发送按钮'],
                    ['.chat-panel-container', '底部面板容器（表情/菜单共用）'],
                    ['.emoji-panel', '表情面板（Emoji 列表）'],
                    ['.action-panel', '菜单面板（+号展开的功能面板）'],
                    ['.action-panel-page', '菜单面板分页'],
                    ['.action-item', '菜单功能项（语音/相册/转账等）'],
                    ['.action-icon-box', '菜单功能项图标容器'],
                    ['.action-name', '菜单功能项文字'],
                ]
            },
            {
                title: '💬 消息气泡',
                items: [
                    ['.message-row', '消息行（每条消息的容器）'],
                    ['.message-row.other', '对方消息行'],
                    ['.message-row.self', '我的消息行'],
                    ['.message-content', '消息气泡（文字内容区）'],
                    ['.ai-bubble', '对方气泡（用于角色单独CSS）'],
                    ['.user-bubble', '我的气泡（用于角色单独CSS）'],
                    ['.message-avatar', '消息头像'],
                    ['.message-timestamp', '时间戳（消息间的时间分隔）'],
                ]
            },
            {
                title: '🎤 语音气泡',
                items: [
                    ['.voice-bubble', '语音消息气泡（整个语音条）'],
                    ['.voice-bubble-header', '语音条头部（图标+波纹+时长）'],
                    ['.voice-icon', '语音图标'],
                    ['.voice-bars', '语音波纹动画'],
                    ['.voice-duration', '语音时长文字'],
                    ['.voice-text-content', '语音转文字内容（展开后显示）'],
                    ['.message-row.other .voice-bubble', '对方语音气泡'],
                    ['.message-row.self .voice-bubble', '我的语音气泡'],
                ]
            },
            {
                title: '💳 卡片消息',
                items: [
                    ['.transfer-card', '转账卡片'],
                    ['.transfer-card.done', '已收款的转账卡片'],
                    ['.transfer-card.returned', '已退回的转账卡片'],
                    ['.t-amount', '转账金额'],
                    ['.t-desc', '转账备注'],
                    ['.t-footer', '转账底部状态栏'],
                    ['.redpacket-card', '红包卡片'],
                    ['.family-card-msg', '亲属卡消息卡片'],
                    ['.spr-card', '专属红包 / 礼物卡片'],
                    ['.intimate-req-card', '亲密关系请求卡片'],
                    ['.location-card', '位置卡片（整体）'],
                    ['.location-card-text', '位置卡片文字区'],
                    ['.location-card-name', '位置名称'],
                    ['.location-card-map', '位置卡片地图区'],
                ]
            },
            {
                title: '💬 引用 & 其他',
                items: [
                    ['.quote-preview', '引用预览区（输入框上方）'],
                    ['.quote-preview-name', '引用的发送者名字'],
                    ['.quote-preview-msg', '引用的消息内容'],
                    ['.quoted-message', '气泡中的引用消息块'],
                    ['.quoted-message-name', '引用消息中的名字'],
                    ['#sticker-suggestion-bar', '智能表情推荐栏'],
                ]
            },
            {
                title: '📋 微信列表页',
                items: [
                    ['.wechat-page', '微信页面容器'],
                    ['.wechat-header', '微信页面顶栏'],
                    ['.wechat-tab-bar', '微信底部Tab栏'],
                    ['.wechat-tab-item', '底部Tab项'],
                    ['.wechat-list-item', '聊天列表项（会话条目）'],
                ]
            },
            {
                title: '🏠 桌面',
                items: [
                    ['.top-widget', '顶部磨砂小组件'],
                    ['.dock', '底部Dock栏'],
                    ['.app-icon', '应用图标'],
                    ['.app-icon .name', '应用图标文字'],
                ]
            },
        ];

        let html = '<div style="width:90%; max-width:420px; max-height:85vh; background:#fff; border-radius:20px; display:flex; flex-direction:column; overflow:hidden; box-shadow:0 10px 40px rgba(0,0,0,0.3);">';
        html += '<div style="padding:16px 20px; border-bottom:1px solid #eee; display:flex; align-items:center; justify-content:space-between; flex-shrink:0; background:#f8f8f8;">';
        html += '<div style="font-size:17px; font-weight:600; color:#333;">📋 CSS类名速查</div>';
        html += '<div onclick="document.getElementById(\'css-class-ref-modal\').style.display=\'none\'" style="width:30px; height:30px; display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:20px; color:#999; border-radius:50%; background:#f0f0f0;">×</div>';
        html += '</div>';
        html += '<div style="flex:1; overflow-y:auto; -webkit-overflow-scrolling:touch; padding:16px 20px;">';
        html += '<div style="font-size:11px; color:#999; margin-bottom:12px; line-height:1.5;">点击类名可复制。在自定义CSS中使用这些类名来修改对应元素的样式。</div>';

        for (const sec of sections) {
            html += '<div style="margin-bottom:16px;">';
            html += '<div style="font-size:14px; font-weight:600; color:#333; margin-bottom:8px; padding-bottom:6px; border-bottom:1px solid #f0f0f0;">' + sec.title + '</div>';
            for (const [cls, desc] of sec.items) {
                html += '<div style="display:flex; align-items:flex-start; gap:8px; margin-bottom:6px; line-height:1.4;">';
                html += '<code onclick="navigator.clipboard.writeText(\'' + cls + '\');this.style.background=\'#d4edda\';setTimeout(()=>{this.style.background=\'#f0f0f0\'},600)" style="background:#f0f0f0; padding:2px 6px; border-radius:4px; font-size:11px; color:#c7254e; cursor:pointer; flex-shrink:0; white-space:nowrap; transition:background 0.2s; user-select:all; -webkit-user-select:all;">' + cls + '</code>';
                html += '<span style="font-size:12px; color:#666;">' + desc + '</span>';
                html += '</div>';
            }
            html += '</div>';
        }

        html += '</div></div>';
        modal.innerHTML = html;
        document.body.appendChild(modal);
    }

    // 预览自定义CSS效果（聊天页面）
    function previewCustomCSS() {
        const cssCode = document.getElementById('custom-css-input').value;
        const modal = document.getElementById('css-preview-modal');
        if (!modal) return;
        
        // 显示模态框
        modal.style.display = 'flex';
        
        // 创建预览专用的style标签（只作用于预览区域）
        let previewStyleEl = document.getElementById('css-preview-style');
        if (!previewStyleEl) {
            previewStyleEl = document.createElement('style');
            previewStyleEl.id = 'css-preview-style';
            document.head.appendChild(previewStyleEl);
        }
        
        // 刷新预览
        refreshCSSPreview();
    }
    
    // 将CSS作用域限制在预览模态框内
    function scopeCSSForPreview(cssCode) {
        if (!cssCode) return '';
        
        // 简单的CSS作用域处理：在每个选择器前添加 #css-preview-modal
        // 处理 @规则（如 @media）和注释
        let scoped = cssCode;
        
        // 移除注释
        scoped = scoped.replace(/\/\*[\s\S]*?\*\//g, '');
        
        // 处理 @规则（保留原样，但内容需要作用域）
        const atRules = [];
        scoped = scoped.replace(/@[^{]+{[\s\S]*?}/g, (match) => {
            const id = `__AT_RULE_${atRules.length}__`;
            atRules.push({ id, content: match });
            return id;
        });
        
        // 为主要规则添加作用域
        scoped = scoped.replace(/([^{}]+){([^{}]+)}/g, (match, selector, rules) => {
            const trimmedSelector = selector.trim();
            // 跳过 @规则占位符
            if (trimmedSelector.startsWith('__AT_RULE_')) {
                return match;
            }
            // 为选择器添加作用域
            return `#css-preview-modal ${trimmedSelector}{${rules}}`;
        });
        
        // 恢复 @规则
        atRules.forEach(rule => {
            scoped = scoped.replace(rule.id, rule.content);
        });
        
        return scoped;
    }

    // 关闭CSS预览
    function closeCSSPreview() {
        const modal = document.getElementById('css-preview-modal');
        if (modal) {
            modal.style.display = 'none';
        }
        // 移除预览样式（可选，如果想保留预览效果可以注释掉）
        // const previewStyleEl = document.getElementById('css-preview-style');
        // if (previewStyleEl) {
        //     previewStyleEl.textContent = '';
        // }
    }

    // 刷新CSS预览
    function refreshCSSPreview() {
        const cssCode = document.getElementById('custom-css-input').value;
        const previewStyleEl = document.getElementById('css-preview-style');
        if (previewStyleEl) {
            // 直接应用CSS，因为预览区域已经有正确的类名结构
            // 不需要添加作用域，让CSS直接应用到预览元素上
            previewStyleEl.textContent = cssCode || '';
        }
    }

    // 从预览应用CSS
    function applyCSSFromPreview() {
        applyCustomCSS();
        closeCSSPreview();
        if (typeof showToast === 'function') showToast('CSS已应用');
    }

    // 实时更新CSS预览（当预览窗口打开时）
    function updateCSSPreview() {
        const modal = document.getElementById('css-preview-modal');
        if (modal && modal.style.display === 'flex') {
            refreshCSSPreview();
        }
    }

    // 点击模态框外部关闭
    document.addEventListener('click', function(e) {
        const modal = document.getElementById('css-preview-modal');
        if (modal && e.target === modal) {
            closeCSSPreview();
        }
    });


// ===== Section 5: 聊天主题管理功能 =====
// ================== 聊天主题管理功能 ==================

// 全局变量：当前选中的主题ID（用于主题选择器）
let selectedThemeIdForApply = null;

// 保存聊天主题
async function saveChatTheme() {
    try {
        const themeName = document.getElementById('chat-theme-name').value.trim();
        if (!themeName) {
            showToast('❌ 请输入主题名称');
            return;
        }

        const accountId = getCurrentAccountId() || 'offline';

        // URL字段优先从导入保护数据中获取真实值
        const isEditingImported = !!(window._editingImportedTheme && window._editingImportedTheme._isImported);

        const themeData = {
            name: themeName,
            accountId: accountId,
            time: Date.now(),
            // 背景（导入主题使用保护的真实URL）
            chatBackground: _getThemeUrlValue('chat-theme-bg'),
            headerBg: _getThemeUrlValue('chat-theme-header-bg'),
            headerColor: document.getElementById('chat-theme-header-color').value,
            titleColor: document.getElementById('chat-theme-title-color').value,
            footerBg: _getThemeUrlValue('chat-theme-footer-bg'),
            footerColor: document.getElementById('chat-theme-footer-color').value,
            // 顶栏按钮图标（导入主题使用保护的真实URL）
            iconBack: _getThemeUrlValue('chat-theme-icon-back'),
            iconOffline: _getThemeUrlValue('chat-theme-icon-offline'),
            iconDetail: _getThemeUrlValue('chat-theme-icon-detail'),
            // 底栏按钮图标（导入主题使用保护的真实URL）
            iconAi: _getThemeUrlValue('chat-theme-icon-ai'),
            iconEmoji: _getThemeUrlValue('chat-theme-icon-emoji'),
            iconMore: _getThemeUrlValue('chat-theme-icon-more'),
            iconSend: _getThemeUrlValue('chat-theme-icon-send'),
            // 图标大小
            iconBackSize: parseInt(document.getElementById('chat-theme-icon-back-size')?.value) || 24,
            iconOfflineSize: parseInt(document.getElementById('chat-theme-icon-offline-size')?.value) || 20,
            iconDetailSize: parseInt(document.getElementById('chat-theme-icon-detail-size')?.value) || 20,
            iconAiSize: parseInt(document.getElementById('chat-theme-icon-ai-size')?.value) || 22,
            iconEmojiSize: parseInt(document.getElementById('chat-theme-icon-emoji-size')?.value) || 22,
            iconMoreSize: parseInt(document.getElementById('chat-theme-icon-more-size')?.value) || 22,
            iconSendSize: parseInt(document.getElementById('chat-theme-icon-send-size')?.value) || 18
        };

        // 如果编辑的是导入主题，保留isImported标记
        if (isEditingImported) {
            themeData.isImported = true;
        }

        const themeId = await db.chat_themes.add(themeData);
        console.log('[ChatTheme] ✓ 主题已保存:', themeData);

        showToast('✅ 主题保存成功');

        // 清除导入主题编辑保护状态（恢复URL输入框为可编辑）
        _clearImportedThemeEditState();

        // 清空表单
        document.getElementById('chat-theme-name').value = '';
        document.getElementById('chat-theme-bg').value = '';
        document.getElementById('chat-theme-header-bg').value = '';
        document.getElementById('chat-theme-title-color').value = '#333333';
        document.getElementById('chat-theme-footer-bg').value = '';
        document.getElementById('chat-theme-icon-back').value = '';
        document.getElementById('chat-theme-icon-offline').value = '';
        document.getElementById('chat-theme-icon-detail').value = '';
        document.getElementById('chat-theme-icon-ai').value = '';
        document.getElementById('chat-theme-icon-emoji').value = '';
        document.getElementById('chat-theme-icon-more').value = '';
        document.getElementById('chat-theme-icon-send').value = '';
        // 重置图标大小滑块
        const defaultSizes = [
            { id: 'chat-theme-icon-back-size', val: 'chat-theme-icon-back-size-val', v: 24 },
            { id: 'chat-theme-icon-offline-size', val: 'chat-theme-icon-offline-size-val', v: 20 },
            { id: 'chat-theme-icon-detail-size', val: 'chat-theme-icon-detail-size-val', v: 20 },
            { id: 'chat-theme-icon-ai-size', val: 'chat-theme-icon-ai-size-val', v: 22 },
            { id: 'chat-theme-icon-emoji-size', val: 'chat-theme-icon-emoji-size-val', v: 22 },
            { id: 'chat-theme-icon-more-size', val: 'chat-theme-icon-more-size-val', v: 22 },
            { id: 'chat-theme-icon-send-size', val: 'chat-theme-icon-send-size-val', v: 18 }
        ];
        defaultSizes.forEach(f => {
            const slider = document.getElementById(f.id);
            const label = document.getElementById(f.val);
            if (slider) slider.value = f.v;
            if (label) label.textContent = f.v + 'px';
        });

        // 刷新预览
        previewChatTheme();

        // 刷新主题列表
        await loadChatThemeList();
    } catch (error) {
        console.error('[ChatTheme] ✗ 保存失败:', error);
        showToast('❌ 保存失败: ' + error.message);
    }
}

// 加载聊天主题列表
async function loadChatThemeList() {
    try {
        const accountId = getCurrentAccountId() || 'offline';
        const themes = await db.chat_themes.where('accountId').equals(accountId).reverse().sortBy('time');

        const listContainer = document.getElementById('chat-theme-list');
        if (!listContainer) return;

        if (themes.length === 0) {
            listContainer.innerHTML = '<div style="padding:20px; text-align:center; color:#999; font-size:13px;">暂无保存的主题<br>创建你的第一个主题吧</div>';
            return;
        }

        listContainer.innerHTML = themes.map(theme => {
            const iconCount = [theme.iconBack, theme.iconOffline, theme.iconDetail, theme.iconAi, theme.iconEmoji, theme.iconMore, theme.iconSend].filter(Boolean).length;
            return `
            <div style="padding:12px; background:#f8f8f8; border-radius:8px; border:1px solid #e8e8e8;">
                <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;">
                    <div style="font-size:15px; font-weight:600; color:#333;">${theme.name}${theme.isImported ? ' <span style="font-size:10px; color:#fff; background:#ff9500; padding:1px 5px; border-radius:3px; margin-left:4px; vertical-align:middle;">导入</span>' : ''}</div>
                    <div style="display:flex; gap:6px;">
                        <div onclick="exportSingleChatTheme(${theme.id})" style="padding:4px 10px; background:#fff; border:1px solid #ddd; border-radius:6px; font-size:12px; color:#007aff; cursor:pointer;">导出</div>
                        <div onclick="editChatTheme(${theme.id})" style="padding:4px 10px; background:#fff; border:1px solid #ddd; border-radius:6px; font-size:12px; color:#666; cursor:pointer;">编辑</div>
                        <div onclick="deleteChatTheme(${theme.id})" style="padding:4px 10px; background:#fff; border:1px solid #ddd; border-radius:6px; font-size:12px; color:#ff3b30; cursor:pointer;">删除</div>
                    </div>
                </div>
                <div style="display:flex; gap:8px; margin-bottom:6px; align-items:center;">
                    ${theme.chatBackground ? `<div style="width:60px; height:40px; border-radius:6px; background-image:url(${theme.chatBackground}); background-size:cover; background-position:center; border:1px solid #ddd;"></div>` : ''}
                    <div style="display:flex; gap:4px; flex-wrap:wrap; align-items:center;">
                        <div style="width:24px; height:24px; border-radius:4px; background:${theme.headerColor || '#ededed'}; border:1px solid #ddd;" title="顶栏色"></div>
                        <div style="width:24px; height:24px; border-radius:4px; background:${theme.footerColor || '#ffffff'}; border:1px solid #ddd;" title="底栏色"></div>
                    </div>
                    ${iconCount > 0 ? `<div style="font-size:11px; color:#999; margin-left:auto;">🎨 ${iconCount}个自定义图标</div>` : ''}
                </div>
                <div style="font-size:11px; color:#999;">${new Date(theme.time).toLocaleString('zh-CN')}</div>
            </div>
        `}).join('');
    } catch (error) {
        console.error('[ChatTheme] ✗ 加载主题列表失败:', error);
    }
}

// 编辑聊天主题
async function editChatTheme(themeId) {
    try {
        const theme = await db.chat_themes.get(themeId);
        if (!theme) {
            showToast('❌ 主题不存在');
            return;
        }

        // 先清除之前可能存在的导入保护状态
        _clearImportedThemeEditState();

        // 填充表单 - 背景
        document.getElementById('chat-theme-name').value = theme.name;
        document.getElementById('chat-theme-bg').value = theme.chatBackground || '';
        document.getElementById('chat-theme-header-bg').value = theme.headerBg || '';
        document.getElementById('chat-theme-header-color').value = theme.headerColor || '#ededed';
        document.getElementById('chat-theme-title-color').value = theme.titleColor || '#333333';
        document.getElementById('chat-theme-footer-bg').value = theme.footerBg || '';
        document.getElementById('chat-theme-footer-color').value = theme.footerColor || '#ffffff';
        // 填充表单 - 图标
        document.getElementById('chat-theme-icon-back').value = theme.iconBack || '';
        document.getElementById('chat-theme-icon-offline').value = theme.iconOffline || '';
        document.getElementById('chat-theme-icon-detail').value = theme.iconDetail || '';
        document.getElementById('chat-theme-icon-ai').value = theme.iconAi || '';
        document.getElementById('chat-theme-icon-emoji').value = theme.iconEmoji || '';
        document.getElementById('chat-theme-icon-more').value = theme.iconMore || '';
        document.getElementById('chat-theme-icon-send').value = theme.iconSend || '';
        // 填充表单 - 图标大小
        const sizeFields = [
            { id: 'chat-theme-icon-back-size', val: 'chat-theme-icon-back-size-val', v: theme.iconBackSize || 24 },
            { id: 'chat-theme-icon-offline-size', val: 'chat-theme-icon-offline-size-val', v: theme.iconOfflineSize || 20 },
            { id: 'chat-theme-icon-detail-size', val: 'chat-theme-icon-detail-size-val', v: theme.iconDetailSize || 20 },
            { id: 'chat-theme-icon-ai-size', val: 'chat-theme-icon-ai-size-val', v: theme.iconAiSize || 22 },
            { id: 'chat-theme-icon-emoji-size', val: 'chat-theme-icon-emoji-size-val', v: theme.iconEmojiSize || 22 },
            { id: 'chat-theme-icon-more-size', val: 'chat-theme-icon-more-size-val', v: theme.iconMoreSize || 22 },
            { id: 'chat-theme-icon-send-size', val: 'chat-theme-icon-send-size-val', v: theme.iconSendSize || 18 }
        ];
        sizeFields.forEach(f => {
            const slider = document.getElementById(f.id);
            const label = document.getElementById(f.val);
            if (slider) slider.value = f.v;
            if (label) label.textContent = f.v + 'px';
        });

        // 如果是导入的主题，保护URL字段不可见但保留功能
        if (theme.isImported) {
            window._editingImportedTheme = { _isImported: true };
            Object.entries(_IMPORTED_URL_FIELDS).forEach(([inputId, propName]) => {
                const val = theme[propName] || '';
                if (val) {
                    // 存储真实URL到保护数据中
                    window._editingImportedTheme[inputId] = val;
                    const input = document.getElementById(inputId);
                    if (input) {
                        input.value = '🔒 已导入图片（受保护）';
                        input.readOnly = true;
                        input.style.color = '#999';
                        input.style.background = '#f5f5f5';
                    }
                }
            });
        }

        // 更新预览
        previewChatTheme();

        // 滚动到表单顶部
        const expandEl = document.querySelector('#expand4') || document.querySelector('#expand5');
        if (expandEl) expandEl.scrollIntoView({ behavior: 'smooth' });

        // 删除旧主题
        await db.chat_themes.delete(themeId);
        await loadChatThemeList();

        showToast(theme.isImported
            ? '📝 导入主题已加载（图片链接受保护，可调整大小和颜色）'
            : '📝 主题已加载到编辑器，修改后点击保存');
    } catch (error) {
        console.error('[ChatTheme] ✗ 编辑主题失败:', error);
        showToast('❌ 编辑失败: ' + error.message);
    }
}

// 删除聊天主题
async function deleteChatTheme(themeId) {
    if (!confirm('确定要删除这个主题吗？')) return;

    try {
        await db.chat_themes.delete(themeId);
        showToast('✅ 主题已删除');
        await loadChatThemeList();
    } catch (error) {
        console.error('[ChatTheme] ✗ 删除主题失败:', error);
        showToast('❌ 删除失败: ' + error.message);
    }
}

// 预览聊天主题 - 完全按照实际聊天页面结构
function previewChatTheme() {
    // URL字段优先从导入保护数据中获取真实值
    const chatBg = _getThemeUrlValue('chat-theme-bg');
    const headerBg = _getThemeUrlValue('chat-theme-header-bg');
    const headerColor = document.getElementById('chat-theme-header-color')?.value || '#ededed';
    const titleColor = document.getElementById('chat-theme-title-color')?.value || '#333333';
    const footerBg = _getThemeUrlValue('chat-theme-footer-bg');
    const footerColor = document.getElementById('chat-theme-footer-color')?.value || '#ffffff';
    
    // 按钮图标URL（优先从导入保护数据获取）
    const iconBack = _getThemeUrlValue('chat-theme-icon-back');
    const iconOffline = _getThemeUrlValue('chat-theme-icon-offline');
    const iconDetail = _getThemeUrlValue('chat-theme-icon-detail');
    const iconAi = _getThemeUrlValue('chat-theme-icon-ai');
    const iconEmoji = _getThemeUrlValue('chat-theme-icon-emoji');
    const iconMore = _getThemeUrlValue('chat-theme-icon-more');
    const iconSend = _getThemeUrlValue('chat-theme-icon-send');
    
    // 按钮图标大小
    const sizeBack = parseInt(document.getElementById('chat-theme-icon-back-size')?.value) || 24;
    const sizeOffline = parseInt(document.getElementById('chat-theme-icon-offline-size')?.value) || 20;
    const sizeDetail = parseInt(document.getElementById('chat-theme-icon-detail-size')?.value) || 20;
    const sizeAi = parseInt(document.getElementById('chat-theme-icon-ai-size')?.value) || 22;
    const sizeEmoji = parseInt(document.getElementById('chat-theme-icon-emoji-size')?.value) || 22;
    const sizeMore = parseInt(document.getElementById('chat-theme-icon-more-size')?.value) || 22;
    const sizeSend = parseInt(document.getElementById('chat-theme-icon-send-size')?.value) || 18;

    const previewContainer = document.getElementById('chat-theme-preview-container');
    if (!previewContainer) return;

    // 有背景图时用 background 简写覆盖，并设 transparent 让透明PNG透出后面内容
    const headerBgStyle = headerBg ? `background: url(${headerBg}) center/cover no-repeat transparent;` : '';
    const footerBgStyle = footerBg ? `background: url(${footerBg}) center/cover no-repeat transparent;` : '';
    const chatBgStyle = chatBg ? `background: url(${chatBg}) center/cover no-repeat;` : '';

    // 图标渲染：有URL用图片，没有用默认SVG（使用自定义大小）
    const backIcon = iconBack
        ? `<img src="${iconBack}" style="width:${sizeBack}px; height:${sizeBack}px; object-fit:contain;">`
        : `<svg class="svg-icon" viewBox="0 0 24 24" style="width:${sizeBack}px; height:${sizeBack}px;"><polyline points="15 18 9 12 15 6"></polyline></svg>`;
    
    const offlineIcon = iconOffline
        ? `<img src="${iconOffline}" style="width:${sizeOffline}px; height:${sizeOffline}px; object-fit:contain;">`
        : `<svg class="svg-icon" viewBox="0 0 24 24" style="width:${sizeOffline}px; height:${sizeOffline}px;"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>`;
    
    const detailIcon = iconDetail
        ? `<img src="${iconDetail}" style="width:${sizeDetail}px; height:${sizeDetail}px; object-fit:contain;">`
        : `<svg class="svg-icon" viewBox="0 0 24 24" style="width:${sizeDetail}px; height:${sizeDetail}px;"><circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle><circle cx="5" cy="12" r="1"></circle></svg>`;
    
    const aiIcon = iconAi
        ? `<img src="${iconAi}" style="width:${sizeAi}px; height:${sizeAi}px; object-fit:contain;">`
        : `<svg class="svg-icon" viewBox="0 0 24 24" style="width:${sizeAi}px; height:${sizeAi}px;"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M9 5H1"/></svg>`;
    
    const emojiIcon = iconEmoji
        ? `<img src="${iconEmoji}" style="width:${sizeEmoji}px; height:${sizeEmoji}px; object-fit:contain;">`
        : `<svg class="svg-icon" viewBox="0 0 24 24" style="width:${sizeEmoji}px; height:${sizeEmoji}px;"><circle cx="12" cy="12" r="10"></circle><path d="M8 14s1.5 2 4 2 4-2 4-2"></path><line x1="9" y1="9" x2="9.01" y2="9"></line><line x1="15" y1="9" x2="15.01" y2="9"></line></svg>`;
    
    const moreIcon = iconMore
        ? `<img src="${iconMore}" style="width:${sizeMore}px; height:${sizeMore}px; object-fit:contain;">`
        : `<svg class="svg-icon" viewBox="0 0 24 24" style="width:${sizeMore}px; height:${sizeMore}px;"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>`;
    
    const sendIcon = iconSend
        ? `<img src="${iconSend}" style="width:${sizeSend}px; height:${sizeSend}px; object-fit:contain;">`
        : `<svg class="svg-icon" viewBox="0 0 24 24" style="width:${sizeSend}px; height:${sizeSend}px; stroke-width:3; transform:rotate(90deg) translateX(-2px);"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>`;

    previewContainer.innerHTML = `
        <div style="width:100%; height:100%; display:flex; flex-direction:column; overflow:hidden;">
            <!-- ===== 顶栏 chat-header ===== -->
            <div class="chat-header" style="height:54px; ${headerBgStyle} ${headerBg ? '' : 'background-color:' + headerColor + ';'} backdrop-filter:blur(10px); -webkit-backdrop-filter:blur(10px); padding:0 10px 0 10px; display:flex; align-items:center; border-bottom:1px solid rgba(0,0,0,0.05); flex-shrink:0; position:relative; z-index:10; box-sizing:border-box;">
                <!-- 返回按钮 -->
                <div class="chat-back" style="display:flex; align-items:center; justify-content:center; width:40px; height:40px; cursor:pointer; color:#333;">
                    ${backIcon}
                </div>
                <!-- 标题 -->
                <div class="chat-title" style="font-size:17px; font-weight:600; color:${titleColor}; flex:1; text-align:center; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; position:static; top:auto; height:auto; line-height:normal; transform:none; max-width:none; z-index:auto;">聊天对象</div>
                <!-- 线下模式按钮 -->
                <div class="chat-more" style="display:flex; align-items:center; justify-content:center; width:40px; height:40px; color:#333; cursor:pointer;">
                    ${offlineIcon}
                </div>
                <!-- 聊天详情按钮 -->
                <div class="chat-more" style="display:flex; align-items:center; justify-content:center; width:40px; height:40px; color:#333; cursor:pointer;">
                    ${detailIcon}
                </div>
            </div>
            
            <!-- ===== 聊天内容区 chat-body ===== -->
            <div class="chat-body" style="flex:1; overflow-y:auto; background:#ffffff; ${chatBgStyle}">
            </div>
            
            <!-- ===== 底栏 chat-footer ===== -->
            <div class="chat-footer" style="${footerBgStyle} ${footerBg ? '' : 'background-color:' + footerColor + ';'} border-top:1px solid rgba(0,0,0,0.05); display:flex; flex-direction:column; flex-shrink:0;">
                <div class="chat-input-bar" style="min-height:54px; padding:8px 12px; display:flex; align-items:center; gap:10px;">
                    <!-- AI接收回复按钮 -->
                    <div class="chat-icon-btn" style="width:32px; height:32px; color:#999; cursor:pointer; display:flex; align-items:center; justify-content:center; border-radius:50%; flex-shrink:0;">
                        ${aiIcon}
                    </div>
                    
                    <!-- 输入框 -->
                    <div style="flex:1; background:#f5f5f5; border:1px solid #e8e8e8; border-radius:20px; padding:8px 16px; font-size:15px; color:#999; min-height:20px;">
                        发送消息...
                    </div>
                    
                    <!-- 表情按钮 -->
                    <div class="chat-icon-btn" style="width:32px; height:32px; color:#999; cursor:pointer; display:flex; align-items:center; justify-content:center; border-radius:50%; flex-shrink:0;">
                        ${emojiIcon}
                    </div>
                    
                    <!-- 更多菜单按钮 -->
                    <div class="chat-icon-btn" style="width:32px; height:32px; color:#999; cursor:pointer; display:flex; align-items:center; justify-content:center; border-radius:50%; flex-shrink:0;">
                        ${moreIcon}
                    </div>
                    
                    <!-- 发送按钮 -->
                    <div class="chat-send-btn" style="display:flex; background:var(--ins-pink,#FF6B9D); color:#fff; border-radius:50%; width:32px; height:32px; align-items:center; justify-content:center; flex-shrink:0;">
                        ${sendIcon}
                    </div>
                </div>
            </div>
        </div>
    `;
}

// 显示聊天主题选择器
async function showChatThemeSelector() {
    try {
        const accountId = getCurrentAccountId() || 'offline';
        const themes = await db.chat_themes.where('accountId').equals(accountId).reverse().sortBy('time');

        const listContainer = document.getElementById('theme-selector-list');
        if (!listContainer) return;

        // 获取当前角色的主题ID
        const char = await db.characters.get(currentChatCharId);
        const currentThemeId = char?.chatThemeId || null;
        selectedThemeIdForApply = currentThemeId;

        // 更新默认主题的选中状态
        const defaultThemeOption = document.querySelector('#chat-theme-selector-modal .theme-option');
        if (currentThemeId === null) {
            defaultThemeOption.style.borderColor = 'var(--ins-pink)';
            defaultThemeOption.querySelector('.theme-selected-icon').style.display = 'block';
        } else {
            defaultThemeOption.style.borderColor = '#e0e0e0';
            defaultThemeOption.querySelector('.theme-selected-icon').style.display = 'none';
        }

        // 生成主题列表
        listContainer.innerHTML = themes.map(theme => {
            const bgStyle = theme.chatBackground ? `background-image:url(${theme.chatBackground}); background-size:cover; background-position:center;` : `background:linear-gradient(135deg, ${theme.headerColor || '#ededed'} 0%, ${theme.footerColor || '#ffffff'} 100%);`;
            const iconCount = [theme.iconBack, theme.iconOffline, theme.iconDetail, theme.iconAi, theme.iconEmoji, theme.iconMore, theme.iconSend].filter(Boolean).length;
            return `
            <div class="theme-option" onclick="selectChatTheme(${theme.id})" style="padding:16px; background:#fff; border:1px solid ${currentThemeId === theme.id ? 'var(--ins-pink)' : '#e0e0e0'}; border-radius:12px; cursor:pointer; transition:all 0.2s;">
                <div style="display:flex; align-items:center; gap:12px;">
                    <div style="width:60px; height:60px; border-radius:8px; ${bgStyle} border:1px solid #ddd; flex-shrink:0;"></div>
                    <div style="flex:1;">
                        <div style="font-size:16px; font-weight:600; margin-bottom:4px;">${theme.name}</div>
                        <div style="display:flex; gap:4px; margin-bottom:4px; align-items:center;">
                            <div style="width:16px; height:16px; border-radius:3px; background:${theme.headerColor || '#ededed'}; border:1px solid #ddd;" title="顶栏色"></div>
                            <div style="width:16px; height:16px; border-radius:3px; background:${theme.footerColor || '#ffffff'}; border:1px solid #ddd;" title="底栏色"></div>
                            ${iconCount > 0 ? `<span style="font-size:11px; color:#999; margin-left:4px;">🎨 ${iconCount}图标</span>` : ''}
                        </div>
                        <div style="font-size:11px; color:#999;">${new Date(theme.time).toLocaleDateString('zh-CN')}</div>
                    </div>
                    <div class="theme-selected-icon" style="display:${currentThemeId === theme.id ? 'block' : 'none'}; color:var(--ins-pink); font-size:20px;">✓</div>
                </div>
            </div>
        `;
        }).join('');

        // 显示弹窗
        document.getElementById('chat-theme-selector-modal').style.display = 'flex';
    } catch (error) {
        console.error('[ChatTheme] ✗ 显示主题选择器失败:', error);
        showToast('❌ 加载主题失败');
    }
}

// 隐藏聊天主题选择器
function hideChatThemeSelector() {
    document.getElementById('chat-theme-selector-modal').style.display = 'none';
    selectedThemeIdForApply = null;
}

// 选择聊天主题（仅标记选中状态）
function selectChatTheme(themeId) {
    selectedThemeIdForApply = themeId;

    // 更新所有主题选项的选中状态
    const modal = document.getElementById('chat-theme-selector-modal');
    const themeOptions = modal.querySelectorAll('.theme-option');
    
    themeOptions.forEach((option, index) => {
        const icon = option.querySelector('.theme-selected-icon');
        if (index === 0 && themeId === null) {
            // 默认主题被选中
            option.style.borderColor = 'var(--ins-pink)';
            if (icon) icon.style.display = 'block';
        } else if (index === 0) {
            // 默认主题未被选中
            option.style.borderColor = '#e0e0e0';
            if (icon) icon.style.display = 'none';
        } else {
            // 判断自定义主题是否被选中（需要从HTML中提取themeId）
            const onclickAttr = option.getAttribute('onclick');
            const match = onclickAttr && onclickAttr.match(/selectChatTheme\((\d+)\)/);
            const optionThemeId = match ? parseInt(match[1]) : null;
            
            if (optionThemeId === themeId) {
                option.style.borderColor = 'var(--ins-pink)';
                if (icon) icon.style.display = 'block';
            } else {
                option.style.borderColor = '#e0e0e0';
                if (icon) icon.style.display = 'none';
            }
        }
    });
}

// 应用聊天主题
async function applyChatTheme() {
    if (!currentChatCharId) {
        showToast('❌ 未打开聊天窗口');
        return;
    }

    try {
        const char = await db.characters.get(currentChatCharId);
        if (!char) {
            showToast('❌ 角色不存在');
            return;
        }

        // 🛡️ 使用 update() 只更新主题ID字段，防止覆盖设置
        char.chatThemeId = selectedThemeIdForApply;
        await db.characters.update(char.id, { chatThemeId: selectedThemeIdForApply });

        // 应用主题样式
        await applyThemeToChat(selectedThemeIdForApply);

        if (typeof window.applyChatShellCustomStyles === 'function') {
            await window.applyChatShellCustomStyles(char);
        }

        // 更新聊天详情页的主题显示
        await updateChatDetailThemeDisplay();

        // 关闭弹窗
        hideChatThemeSelector();

        showToast('✅ 主题已应用');
        console.log('[ChatTheme] ✓ 主题已应用:', selectedThemeIdForApply);
    } catch (error) {
        console.error('[ChatTheme] ✗ 应用主题失败:', error);
        showToast('❌ 应用失败: ' + error.message);
    }
}

// 应用主题样式到聊天窗口 - 完全匹配实际聊天页面
async function applyThemeToChat(themeId) {
    const chatWindow = document.getElementById('chat-window');
    const chatHeader = chatWindow?.querySelector('.chat-header');
    const chatBody = document.getElementById('chat-body');
    const chatFooter = chatWindow?.querySelector('.chat-footer');

    if (!chatWindow || !chatHeader || !chatBody || !chatFooter) {
        console.log('[ChatTheme] ⚠️ 聊天窗口元素未找到');
        return;
    }

    // 移除现有的主题样式
    chatWindow.removeAttribute('data-theme-id');
    const oldThemeStyle = document.getElementById('chat-theme-style');
    if (oldThemeStyle) oldThemeStyle.remove();

    // 恢复所有被替换的图标
    _restoreDefaultIcons(chatHeader, chatFooter);

    if (themeId === null || themeId === undefined) {
        // 恢复默认主题 - 清除 background 简写（因为应用主题时使用了 background 简写）
        chatBody.style.background = '';
        chatHeader.style.background = '';
        chatFooter.style.background = '';
        // 恢复标题颜色
        const chatTitle = chatHeader.querySelector('.chat-title');
        if (chatTitle) chatTitle.style.color = '';
        console.log('[ChatTheme] ✓ 已恢复默认主题');
        return;
    }

    try {
        const theme = await db.chat_themes.get(themeId);
        if (!theme) {
            console.log('[ChatTheme] ⚠️ 主题不存在:', themeId);
            return;
        }

        // ===== 背景 =====
        if (theme.chatBackground) {
            chatBody.style.background = `url(${theme.chatBackground}) center/cover no-repeat`;
        } else {
            chatBody.style.backgroundImage = '';
        }

        // ===== 顶栏背景 =====
        if (theme.headerBg) {
            // 有背景图时：用 background 简写一次性覆盖（解决样式表 background 简写冲突）
            // backgroundColor 设为 transparent，让透明PNG能透出后面的内容
            chatHeader.style.background = `url(${theme.headerBg}) center/cover no-repeat transparent`;
            chatHeader.style.backdropFilter = 'blur(10px)';
            chatHeader.style.webkitBackdropFilter = 'blur(10px)';
        } else {
            chatHeader.style.backgroundImage = '';
            if (theme.headerColor) chatHeader.style.backgroundColor = theme.headerColor;
        }

        // ===== 标题文字颜色 =====
        const chatTitle = chatHeader.querySelector('.chat-title');
        if (chatTitle) {
            chatTitle.style.color = theme.titleColor || '';
        }

        // ===== 底栏背景 =====
        if (theme.footerBg) {
            // 有背景图时：同理用 background 简写，transparent 让透明区域透出背景
            chatFooter.style.background = `url(${theme.footerBg}) center/cover no-repeat transparent`;
        } else {
            chatFooter.style.backgroundImage = '';
            if (theme.footerColor) chatFooter.style.backgroundColor = theme.footerColor;
        }

        // ===== 顶栏按钮图标替换 =====
        // 返回按钮
        if (theme.iconBack) {
            const backBtn = chatHeader.querySelector('.chat-back');
            if (backBtn) _replaceWithImg(backBtn, theme.iconBack, theme.iconBackSize || 24);
        }
        // 线下模式按钮（第一个 chat-more）
        const chatMores = chatHeader.querySelectorAll('.chat-more');
        if (theme.iconOffline && chatMores[0]) {
            _replaceWithImg(chatMores[0], theme.iconOffline, theme.iconOfflineSize || 20);
        }
        // 聊天详情按钮（第二个 chat-more，即三个点）
        if (theme.iconDetail && chatMores[1]) {
            _replaceWithImg(chatMores[1], theme.iconDetail, theme.iconDetailSize || 20);
        }

        // ===== 底栏按钮图标替换 =====
        const inputBar = chatFooter.querySelector('.chat-input-bar');
        if (inputBar) {
            const iconBtns = inputBar.querySelectorAll('.chat-icon-btn');
            // 第一个 chat-icon-btn = AI魔法棒
            if (theme.iconAi && iconBtns[0]) {
                _replaceWithImg(iconBtns[0], theme.iconAi, theme.iconAiSize || 22);
            }
            // 第二个 chat-icon-btn = 表情
            if (theme.iconEmoji && iconBtns[1]) {
                _replaceWithImg(iconBtns[1], theme.iconEmoji, theme.iconEmojiSize || 22);
            }
            // 第三个 chat-icon-btn = 更多(+号)
            if (theme.iconMore && iconBtns[2]) {
                _replaceWithImg(iconBtns[2], theme.iconMore, theme.iconMoreSize || 22);
            }
            // 发送按钮
            if (theme.iconSend) {
                const sendBtn = inputBar.querySelector('.chat-send-btn');
                if (sendBtn) _replaceWithImg(sendBtn, theme.iconSend, theme.iconSendSize || 18);
            }
        }

        chatWindow.setAttribute('data-theme-id', themeId);
        console.log('[ChatTheme] ✓ 主题样式已应用:', theme.name);
    } catch (error) {
        console.error('[ChatTheme] ✗ 应用主题样式失败:', error);
    }
}

// 辅助：替换元素内的SVG为图片
function _replaceWithImg(container, imgUrl, size) {
    if (!container || !imgUrl) return;
    const svg = container.querySelector('svg');
    if (svg) {
        // 保存原始SVG以便恢复
        if (!container.getAttribute('data-original-svg')) {
            container.setAttribute('data-original-svg', svg.outerHTML);
        }
        svg.style.display = 'none';
    }
    // 如果是发送按钮，隐藏原始背景色/圆形样式，防止透出
    if (container.classList.contains('chat-send-btn')) {
        if (!container.getAttribute('data-original-bg')) {
            container.setAttribute('data-original-bg', getComputedStyle(container).background);
        }
        container.style.background = 'transparent';
    }
    // 移除已有的主题图标
    const oldImg = container.querySelector('.theme-icon-img');
    if (oldImg) oldImg.remove();
    const img = document.createElement('img');
    img.src = imgUrl;
    img.className = 'theme-icon-img';
    img.style.cssText = `width:${size}px; height:${size}px; object-fit:contain;`;
    container.appendChild(img);
}

// 辅助：恢复所有被替换的图标为默认SVG
function _restoreDefaultIcons(chatHeader, chatFooter) {
    const allContainers = [
        ...chatHeader.querySelectorAll('.chat-back, .chat-more'),
        ...chatFooter.querySelectorAll('.chat-icon-btn, .chat-send-btn')
    ];
    allContainers.forEach(container => {
        // 移除主题图标
        const themeImg = container.querySelector('.theme-icon-img');
        if (themeImg) themeImg.remove();
        // 恢复SVG显示
        const svg = container.querySelector('svg');
        if (svg) svg.style.display = '';
        // 恢复发送按钮的原始背景样式
        if (container.classList.contains('chat-send-btn')) {
            container.style.background = '';
        }
    });
}

// 更新聊天详情页的主题显示
async function updateChatDetailThemeDisplay() {
    if (!currentChatCharId) return;

    try {
        const char = await db.characters.get(currentChatCharId);
        const themeId = char?.chatThemeId;
        
        const themeDisplay = document.getElementById('detail-current-theme');
        if (!themeDisplay) return;

        if (themeId === null || themeId === undefined) {
            themeDisplay.textContent = '默认主题';
        } else {
            const theme = await db.chat_themes.get(themeId);
            themeDisplay.textContent = theme ? theme.name : '默认主题';
        }
    } catch (error) {
        console.error('[ChatTheme] ✗ 更新主题显示失败:', error);
    }
}

// 显示群聊主题选择器
async function showGroupChatThemeSelector() {
    try {
        const accountId = getCurrentAccountId() || 'offline';
        const themes = await db.chat_themes.where('accountId').equals(accountId).reverse().sortBy('time');

        const listContainer = document.getElementById('theme-selector-list');
        if (!listContainer) return;

        // 获取当前群聊的主题ID
        const group = await getCachedGroupChat(window.currentGroupChatId);
        const currentThemeId = group?.chatThemeId || null;
        selectedThemeIdForApply = currentThemeId;

        // 更新默认主题的选中状态
        const defaultThemeOption = document.querySelector('#chat-theme-selector-modal .theme-option');
        if (currentThemeId === null) {
            defaultThemeOption.style.borderColor = 'var(--ins-pink)';
            defaultThemeOption.querySelector('.theme-selected-icon').style.display = 'block';
        } else {
            defaultThemeOption.style.borderColor = '#e0e0e0';
            defaultThemeOption.querySelector('.theme-selected-icon').style.display = 'none';
        }

        // 生成主题列表（群聊）
        listContainer.innerHTML = themes.map(theme => {
            const bgStyle = theme.chatBackground ? `background-image:url(${theme.chatBackground}); background-size:cover; background-position:center;` : `background:linear-gradient(135deg, ${theme.headerColor || '#ededed'} 0%, ${theme.footerColor || '#ffffff'} 100%);`;
            const iconCount = [theme.iconBack, theme.iconOffline, theme.iconDetail, theme.iconAi, theme.iconEmoji, theme.iconMore, theme.iconSend].filter(Boolean).length;
            return `
            <div class="theme-option" onclick="selectChatTheme(${theme.id})" style="padding:16px; background:#fff; border:1px solid ${currentThemeId === theme.id ? 'var(--ins-pink)' : '#e0e0e0'}; border-radius:12px; cursor:pointer; transition:all 0.2s;">
                <div style="display:flex; align-items:center; gap:12px;">
                    <div style="width:60px; height:60px; border-radius:8px; ${bgStyle} border:1px solid #ddd; flex-shrink:0;"></div>
                    <div style="flex:1;">
                        <div style="font-size:16px; font-weight:600; margin-bottom:4px;">${theme.name}</div>
                        <div style="display:flex; gap:4px; margin-bottom:4px; align-items:center;">
                            <div style="width:16px; height:16px; border-radius:3px; background:${theme.headerColor || '#ededed'}; border:1px solid #ddd;" title="顶栏色"></div>
                            <div style="width:16px; height:16px; border-radius:3px; background:${theme.footerColor || '#ffffff'}; border:1px solid #ddd;" title="底栏色"></div>
                            ${iconCount > 0 ? `<span style="font-size:11px; color:#999; margin-left:4px;">🎨 ${iconCount}图标</span>` : ''}
                        </div>
                        <div style="font-size:11px; color:#999;">${new Date(theme.time).toLocaleDateString('zh-CN')}</div>
                    </div>
                    <div class="theme-selected-icon" style="display:${currentThemeId === theme.id ? 'block' : 'none'}; color:var(--ins-pink); font-size:20px;">✓</div>
                </div>
            </div>
        `;
        }).join('');

        // 显示弹窗（使用群聊应用函数）
        const modal = document.getElementById('chat-theme-selector-modal');
        modal.style.display = 'flex';
        
        // 替换应用按钮的onclick事件为群聊版本
        const applyBtn = modal.querySelector('button[onclick="applyChatTheme()"]');
        if (applyBtn) {
            applyBtn.setAttribute('onclick', 'applyGroupChatTheme()');
        }
    } catch (error) {
        console.error('[GroupChatTheme] ✗ 显示主题选择器失败:', error);
        showToast('❌ 加载主题失败');
    }
}

// 应用群聊主题
async function applyGroupChatTheme() {
    if (!window.currentGroupChatId) {
        showToast('❌ 未打开群聊窗口');
        return;
    }

    try {
        const group = await getCachedGroupChat(window.currentGroupChatId);
        if (!group) {
            showToast('❌ 群聊不存在');
            return;
        }

        // 更新群聊的主题ID
        group.chatThemeId = selectedThemeIdForApply;
        await safeGroupChatPut(group);

        // 应用主题样式
        await applyThemeToChat(selectedThemeIdForApply);

        // 更新群聊详情页的主题显示
        await updateGroupChatDetailThemeDisplay();

        // 关闭弹窗并恢复按钮
        const modal = document.getElementById('chat-theme-selector-modal');
        modal.style.display = 'none';
        const applyBtn = modal.querySelector('button[onclick="applyGroupChatTheme()"]');
        if (applyBtn) {
            applyBtn.setAttribute('onclick', 'applyChatTheme()');
        }

        showToast('✅ 主题已应用');
        console.log('[GroupChatTheme] ✓ 主题已应用:', selectedThemeIdForApply);
    } catch (error) {
        console.error('[GroupChatTheme] ✗ 应用主题失败:', error);
        showToast('❌ 应用失败: ' + error.message);
    }
}

// 更新群聊详情页的主题显示
async function updateGroupChatDetailThemeDisplay() {
    if (!window.currentGroupChatId) return;

    try {
        const group = await getCachedGroupChat(window.currentGroupChatId);
        const themeId = group?.chatThemeId;
        
        const themeDisplay = document.getElementById('group-detail-current-theme');
        if (!themeDisplay) return;

        if (themeId === null || themeId === undefined) {
            themeDisplay.textContent = '默认主题';
        } else {
            const theme = await db.chat_themes.get(themeId);
            themeDisplay.textContent = theme ? theme.name : '默认主题';
        }
    } catch (error) {
        console.error('[GroupChatTheme] ✗ 更新主题显示失败:', error);
    }
}

// 暴露聊天主题相关函数到全局
window.saveChatTheme = saveChatTheme;
window.loadChatThemeList = loadChatThemeList;
window.editChatTheme = editChatTheme;
window.deleteChatTheme = deleteChatTheme;
window.previewChatTheme = previewChatTheme;
window.showChatThemeSelector = showChatThemeSelector;
window.hideChatThemeSelector = hideChatThemeSelector;
window.selectChatTheme = selectChatTheme;
window.applyChatTheme = applyChatTheme;
window.applyThemeToChat = applyThemeToChat;
window.updateChatDetailThemeDisplay = updateChatDetailThemeDisplay;
window.showGroupChatThemeSelector = showGroupChatThemeSelector;
window.applyGroupChatTheme = applyGroupChatTheme;
window.updateGroupChatDetailThemeDisplay = updateGroupChatDetailThemeDisplay;

// ========== 主题导出/导入 ==========

// ===== 导入主题URL保护机制 =====
// 导入主题URL字段映射（input ID → theme属性名）
const _IMPORTED_URL_FIELDS = {
    'chat-theme-bg': 'chatBackground',
    'chat-theme-header-bg': 'headerBg',
    'chat-theme-footer-bg': 'footerBg',
    'chat-theme-icon-back': 'iconBack',
    'chat-theme-icon-offline': 'iconOffline',
    'chat-theme-icon-detail': 'iconDetail',
    'chat-theme-icon-ai': 'iconAi',
    'chat-theme-icon-emoji': 'iconEmoji',
    'chat-theme-icon-more': 'iconMore',
    'chat-theme-icon-send': 'iconSend'
};

/**
 * 获取主题URL字段的真实值（优先从导入保护数据中获取）
 * @param {string} inputId - 输入框的DOM ID
 * @returns {string} 真实的URL值
 */
function _getThemeUrlValue(inputId) {
    if (window._editingImportedTheme && window._editingImportedTheme[inputId]) {
        return window._editingImportedTheme[inputId];
    }
    return document.getElementById(inputId)?.value?.trim() || '';
}

/**
 * 清除导入主题编辑保护状态，恢复所有URL输入框的可编辑状态
 */
function _clearImportedThemeEditState() {
    if (window._editingImportedTheme) {
        Object.keys(_IMPORTED_URL_FIELDS).forEach(inputId => {
            const input = document.getElementById(inputId);
            if (input) {
                input.readOnly = false;
                input.style.color = '';
                input.style.background = '';
            }
        });
        window._editingImportedTheme = null;
    }
}

// ===== 导出加密选择弹窗 =====
/**
 * 显示导出方式选择弹窗，让用户选择加密或明文导出
 * @returns {Promise<'encrypted'|'plain'|null>} 用户选择结果，null表示取消
 */
function _showExportEncryptDialog() {
    return new Promise(resolve => {
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.45);z-index:99999;display:flex;align-items:center;justify-content:center;';

        const dialog = document.createElement('div');
        dialog.style.cssText = 'background:#fff;border-radius:14px;padding:24px 20px 16px;width:300px;max-width:85vw;box-shadow:0 8px 32px rgba(0,0,0,0.2);text-align:center;';
        dialog.innerHTML = `
            <div style="font-size:16px;font-weight:600;color:#333;margin-bottom:8px;">选择导出方式</div>
            <div style="font-size:13px;color:#888;margin-bottom:20px;line-height:1.5;">
                加密导出：图片链接等数据将被加密保护，导入后编辑时不可查看链接<br>
                明文导出：数据不加密，导入后可以查看和编辑所有内容
            </div>
            <div style="display:flex;gap:8px;margin-bottom:8px;">
                <div id="_export-encrypted-btn" style="flex:1;padding:12px 0;background:#007aff;color:#fff;border-radius:10px;font-size:15px;font-weight:500;cursor:pointer;">🔒 加密导出</div>
                <div id="_export-plain-btn" style="flex:1;padding:12px 0;background:#34c759;color:#fff;border-radius:10px;font-size:15px;font-weight:500;cursor:pointer;">📄 明文导出</div>
            </div>
            <div id="_export-cancel-btn" style="padding:10px 0;color:#999;font-size:14px;cursor:pointer;">取消</div>
        `;

        overlay.appendChild(dialog);
        document.body.appendChild(overlay);

        const cleanup = () => document.body.removeChild(overlay);

        dialog.querySelector('#_export-encrypted-btn').onclick = () => { cleanup(); resolve('encrypted'); };
        dialog.querySelector('#_export-plain-btn').onclick = () => { cleanup(); resolve('plain'); };
        dialog.querySelector('#_export-cancel-btn').onclick = () => { cleanup(); resolve(null); };
        overlay.onclick = (e) => { if (e.target === overlay) { cleanup(); resolve(null); } };
    });
}

// ===== 主题加密/解密工具 =====
const _THEME_KEY = 'MxTheme@2026!Enc';

function _themeEncrypt(plainText) {
    // 1. 将明文转为UTF-8字节数组
    const encoder = new TextEncoder();
    const data = encoder.encode(plainText);
    const key = encoder.encode(_THEME_KEY);
    // 2. XOR混淆
    const encrypted = new Uint8Array(data.length);
    for (let i = 0; i < data.length; i++) {
        encrypted[i] = data[i] ^ key[i % key.length] ^ ((i * 7 + 13) & 0xFF);
    }
    // 3. 转Base64
    let binary = '';
    for (let i = 0; i < encrypted.length; i++) {
        binary += String.fromCharCode(encrypted[i]);
    }
    return btoa(binary);
}

function _themeDecrypt(cipherBase64) {
    // 1. Base64解码
    const binary = atob(cipherBase64);
    const encrypted = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        encrypted[i] = binary.charCodeAt(i);
    }
    // 2. XOR还原
    const encoder = new TextEncoder();
    const key = encoder.encode(_THEME_KEY);
    const decrypted = new Uint8Array(encrypted.length);
    for (let i = 0; i < encrypted.length; i++) {
        decrypted[i] = encrypted[i] ^ key[i % key.length] ^ ((i * 7 + 13) & 0xFF);
    }
    // 3. UTF-8字节还原为字符串
    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
}

// 导出单个主题（用户选择加密或明文，加密导入的主题强制加密）
async function exportSingleChatTheme(themeId) {
    try {
        const theme = await db.chat_themes.get(themeId);
        if (!theme) {
            showToast('❌ 主题不存在');
            return;
        }

        let choice;
        if (theme.isImported) {
            // 加密导入的主题只允许加密导出，防止通过明文导出泄露链接
            choice = 'encrypted';
            showToast('🔒 该主题为加密导入，将自动加密导出');
        } else {
            // 自建主题让用户选择导出方式
            choice = await _showExportEncryptDialog();
            if (!choice) return; // 取消
        }

        // 移除数据库自增ID和accountId及isImported标记
        const { id, accountId: _aid, isImported: _imp, ...rest } = theme;

        let jsonData;

        if (choice === 'encrypted') {
            // 加密导出
            const themesJson = JSON.stringify([rest]);
            const encryptedPayload = _themeEncrypt(themesJson);
            jsonData = {
                type: 'chat_themes_export',
                version: 2,
                encrypted: true,
                exportTime: new Date().toISOString(),
                count: 1,
                payload: encryptedPayload
            };
        } else {
            // 明文导出
            jsonData = {
                type: 'chat_themes_export',
                version: 2,
                encrypted: false,
                exportTime: new Date().toISOString(),
                count: 1,
                themes: [rest]
            };
        }

        const jsonStr = JSON.stringify(jsonData);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const isEnc = choice === 'encrypted';
        const safeName = (theme.name || 'theme').replace(/[^a-zA-Z0-9\u4e00-\u9fff_-]/g, '_');
        const a = document.createElement('a');
        a.href = url;
        a.download = `theme_${safeName}_${isEnc ? 'enc_' : ''}${new Date().toISOString().slice(0,10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showToast(`✅ 已导出主题「${theme.name}」${isEnc ? '（已加密）' : '（明文）'}`);
        console.log(`[ChatTheme] ✓ 单个主题导出成功(${isEnc ? '加密' : '明文'}):`, theme.name);
    } catch (error) {
        console.error('[ChatTheme] ✗ 导出失败:', error);
        showToast('❌ 导出失败: ' + error.message);
    }
}

// 导出全部主题（用户选择加密或明文，含加密导入主题时强制加密）
async function exportChatThemes() {
    try {
        const accountId = getCurrentAccountId() || 'offline';
        const themes = await db.chat_themes.where('accountId').equals(accountId).toArray();

        if (themes.length === 0) {
            showToast('❌ 暂无可导出的主题');
            return;
        }

        // 检查是否包含加密导入的主题
        const hasImportedTheme = themes.some(t => t.isImported);

        let choice;
        if (hasImportedTheme) {
            // 包含加密导入的主题，强制加密导出
            choice = 'encrypted';
            showToast('🔒 包含加密导入的主题，将自动加密导出');
        } else {
            // 全部是自建主题，让用户选择
            choice = await _showExportEncryptDialog();
            if (!choice) return; // 取消
        }

        // 移除数据库自增ID和accountId，导入时重新生成
        const exportData = themes.map(theme => {
            const { id, accountId: _aid, isImported: _imp, ...rest } = theme;
            return rest;
        });

        let jsonData;

        if (choice === 'encrypted') {
            // 加密导出
            const themesJson = JSON.stringify(exportData);
            const encryptedPayload = _themeEncrypt(themesJson);
            jsonData = {
                type: 'chat_themes_export',
                version: 2,
                encrypted: true,
                exportTime: new Date().toISOString(),
                count: exportData.length,
                payload: encryptedPayload
            };
        } else {
            // 明文导出
            jsonData = {
                type: 'chat_themes_export',
                version: 2,
                encrypted: false,
                exportTime: new Date().toISOString(),
                count: exportData.length,
                themes: exportData
            };
        }

        const jsonStr = JSON.stringify(jsonData);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const isEnc = choice === 'encrypted';
        const a = document.createElement('a');
        a.href = url;
        a.download = `chat_themes_${isEnc ? 'enc_' : ''}${new Date().toISOString().slice(0,10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showToast(`✅ 已导出 ${themes.length} 个主题${isEnc ? '（已加密）' : '（明文）'}`);
        console.log(`[ChatTheme] ✓ 主题导出成功(${isEnc ? '加密' : '明文'}):`, themes.length, '个');
    } catch (error) {
        console.error('[ChatTheme] ✗ 导出失败:', error);
        showToast('❌ 导出失败: ' + error.message);
    }
}

// 导入主题文件（兼容加密v2和旧版v1明文）
async function importChatThemes(event) {
    const file = event.target.files[0];
    if (!file) return;

    // 重置input以便下次可以选同一文件
    event.target.value = '';

    try {
        const text = await file.text();
        const jsonData = JSON.parse(text);

        // 校验格式
        if (jsonData.type !== 'chat_themes_export') {
            showToast('❌ 文件格式不正确，请选择主题导出文件');
            return;
        }

        let themesArr;
        let isEncryptedSource = false; // 标记来源是否为加密文件

        if (jsonData.version >= 2 && jsonData.payload) {
            // v2加密格式：解密payload
            isEncryptedSource = true;
            try {
                const decryptedJson = _themeDecrypt(jsonData.payload);
                themesArr = JSON.parse(decryptedJson);
            } catch (e) {
                showToast('❌ 主题解密失败，文件可能已损坏');
                console.error('[ChatTheme] 解密失败:', e);
                return;
            }
        } else if (Array.isArray(jsonData.themes)) {
            // v2明文格式 或 v1旧版明文格式：直接读取
            isEncryptedSource = false;
            themesArr = jsonData.themes;
        } else {
            showToast('❌ 文件格式不正确');
            return;
        }

        if (!Array.isArray(themesArr) || themesArr.length === 0) {
            showToast('❌ 没有找到可导入的主题数据');
            return;
        }

        const accountId = getCurrentAccountId() || 'offline';
        let importCount = 0;

        for (const theme of themesArr) {
            // 给每个主题绑定当前账号
            const themeData = {
                ...theme,
                accountId: accountId
            };
            // 仅加密来源的主题标记为导入（保护URL不可见）
            if (isEncryptedSource) {
                themeData.isImported = true;
            } else {
                delete themeData.isImported;
            }
            // 移除可能携带的旧id
            delete themeData.id;
            await db.chat_themes.add(themeData);
            importCount++;
        }

        const modeText = isEncryptedSource ? '（加密主题，图片链接受保护）' : '（明文主题）';
        showToast(`✅ 成功导入 ${importCount} 个主题${modeText}`);
        console.log(`[ChatTheme] ✓ 主题导入成功(${isEncryptedSource ? '加密' : '明文'}):`, importCount, '个');

        // 刷新主题列表
        await loadChatThemeList();
    } catch (error) {
        console.error('[ChatTheme] ✗ 导入失败:', error);
        if (error instanceof SyntaxError) {
            showToast('❌ 文件解析失败，请确认是有效的主题文件');
        } else {
            showToast('❌ 导入失败: ' + error.message);
        }
    }
}

window.exportSingleChatTheme = exportSingleChatTheme;
window.exportChatThemes = exportChatThemes;
window.importChatThemes = importChatThemes;