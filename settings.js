// ================== 系统设置 JS ==================
// 本文件包含系统设置页面（#setting-page）的所有 JS 逻辑
// 依赖：db, showToast 等全局变量（来自 script.js）
// ===== Section A: 手动推送订阅 =====
        // 手动触发推送订阅（新增函数）
        async function manualSubscribePush() {
            console.log('[Manual] 手动触发推送订阅...');
            showDebugToast('正在注册推送...', true);
            
            try {
                await registerServiceWorkerAndSubscribe();
                alert('✅ 推送订阅成功！请查看诊断面板确认状态。');
            } catch (err) {
                console.error('[Manual] 订阅失败:', err);
                alert('❌ 订阅失败: ' + err.message);
            }
        }

// ===== Section B: 通知 / 调试 / 保活 / 诊断 / 显示设置页 =====
        // 切换通知权限
        function toggleNotification(checkbox) {
            const enabled = checkbox.checked;
            localStorage.setItem('notification_enabled', enabled);
            if (enabled) {
                // 请求浏览器系统通知权限
                if ("Notification" in window) {
                    Notification.requestPermission().then(permission => {
                        if (permission === "granted") {
                            new Notification("系统通知已开启", { body: "即使在后台，您也能收到新消息提醒了~" });
                        } else {
                            alert("请在浏览器弹窗中点击【允许】，否则无法收到系统通知哦！");
                        }
                    });
                }
                startNotificationLoop(15); // 15秒检查
            } else {
                if (notifTimer) clearInterval(notifTimer);
                document.getElementById('notif-badge').style.display = 'none';
            }
        }

        // 测试通知功能
        function testNotification() {
            console.log('[Test] Testing notification system...');
            console.log('[Test] Browser supports Notification:', "Notification" in window);
            console.log('[Test] Current permission:', Notification.permission);
            console.log('[Test] Page visibility:', document.visibilityState);
            console.log('[Test] Page hidden:', document.hidden);
            
            if (!("Notification" in window)) {
                alert("你的浏览器不支持系统通知功能");
                return;
            }
            
            if (Notification.permission === "denied") {
                alert("通知权限已被拒绝，请在浏览器设置中允许通知权限后刷新页面");
                return;
            }
            
            if (Notification.permission === "granted") {
                // 立即发送第一条通知
                new Notification("测试通知", {
                    body: "如果你能看到这条通知，说明系统通知功能正常！",
                    icon: 'https://img.heliar.top/file/1770541813634_无标题434_20260208170943.png'
                });
                showDebugToast("✓ 立即发送通知！5秒后再发一条", true);
                
                // 5秒后发送第二条通知
                setTimeout(() => {
                    new Notification("延迟测试通知", {
                        body: "这是5秒后发送的通知，如果在后台也能收到，说明后台推送正常！",
                        icon: 'https://img.heliar.top/file/1770541813634_无标题434_20260208170943.png',
                        tag: 'delayed-test'
                    });
                    showDebugToast("✓ 5秒延迟通知已发送！", true);
                    console.log('[Test] 5秒延迟通知已发送');
                }, 5000);
                
            } else {
                Notification.requestPermission().then(permission => {
                    console.log('[Test] Permission request result:', permission);
                    if (permission === "granted") {
                        new Notification("测试通知", {
                            body: "权限已授予！系统通知功能正常工作",
                            icon: 'https://img.heliar.top/file/1770541813634_无标题434_20260208170943.png'
                        });
                        showDebugToast("✓ 权限已授予！通知已发送", true);
                    } else {
                        alert("通知权限被拒绝，无法发送通知");
                    }
                });
            }
        }

        // 切换调试模式
        function toggleDebugMode(checkbox) {
            const enabled = checkbox.checked;
            localStorage.setItem('debug_mode_enabled', enabled);
            if (enabled) {
                showDebugToast('调试模式已开启');
            }
        }

        // --- Web Worker 保活机制 ---
        // 通过 Blob 创建内联 Worker，后台时 Worker 的 setInterval 不受浏览器节流限制
        let keepAliveWorker = null;
        try {
            const workerCode = `
                let tickInterval = null;
                self.onmessage = function(e) {
                    if (e.data === 'start') {
                        if (tickInterval) clearInterval(tickInterval);
                        console.log('[Worker] 保活心跳已启动');
                        tickInterval = setInterval(() => {
                            self.postMessage('tick');
                        }, 5000); // 5秒心跳，Worker 不受后台节流
                    } else if (e.data === 'stop') {
                        if (tickInterval) { clearInterval(tickInterval); tickInterval = null; }
                    }
                };
            `;
            const blob = new Blob([workerCode], {type: 'application/javascript'});
            const workerUrl = URL.createObjectURL(blob);
            keepAliveWorker = new Worker(workerUrl);
            
            // Worker 每5秒发一个 tick，仅作为后台保活心跳
            // 🔧 不再在 Worker 中重复调用 checkAutoChat 等函数
            //    这些检查由 syncTimer（startAutoChatLoop 中的 setInterval）统一驱动
            //    避免两个定时器交叉调用导致检查频率翻倍
            keepAliveWorker.onmessage = function(e) {
                // Worker tick 仅用于保持页面活跃，防止浏览器后台节流
                // 实际的主动聊天检查由 syncTimer 负责
            };
            
            keepAliveWorker.postMessage('start');
            console.log('[KeepAlive] ✅ Worker 保活心跳已启动（后台不被节流）');
        } catch (e) {
            console.warn('[KeepAlive] ❌ 无法启动 Worker 保活:', e);
        }

        // --- 强力保活功能 ---
        let keepAliveAudio = null;

        // 切换保活功能
        function toggleKeepAlive(checkbox) {
            const enabled = checkbox.checked;
            localStorage.setItem('keepalive_enabled', enabled);
            
            if (enabled) {
                startKeepAlive();
            } else {
                stopKeepAlive();
            }
        }

        // 启动保活
        async function startKeepAlive() {
            if (!keepAliveAudio) {
                keepAliveAudio = document.getElementById('keepalive-audio');
            }
            
            try {
                // 设置音量为0（静音）
                keepAliveAudio.volume = 0;
                
                // 尝试播放
                await keepAliveAudio.play();
                console.log('[KeepAlive] ✓ 保活音频已启动');
                showDebugToast('✓ 强力保活已启动', true);
                addLog('success', '强力保活已启动');
                
                // 监听播放错误
                keepAliveAudio.onerror = (e) => {
                    console.error('[KeepAlive] 音频播放错误:', e);
                    showDebugToast('✗ 保活音频加载失败');
                    addLog('error', '保活音频加载失败', e);
                };
                
            } catch (err) {
                console.error('[KeepAlive] 启动失败:', err);
                showDebugToast('⚠️ 需要用户交互才能启动');
                addLog('warning', '保活启动失败，需要用户交互', err);
                
                // 等待用户点击后重试
                document.addEventListener('click', function retryKeepAlive() {
                    startKeepAlive();
                    document.removeEventListener('click', retryKeepAlive);
                }, { once: true });
            }
        }

        // 停止保活
        function stopKeepAlive() {
            if (keepAliveAudio) {
                keepAliveAudio.pause();
                keepAliveAudio.currentTime = 0;
                console.log('[KeepAlive] ✓ 保活已停止');
                showDebugToast('✓ 保活已停止');
                addLog('info', '强力保活已停止');
            }
        }

        // 显示调试Toast（在手机上可见）
        let toastTimer = null;
        function showDebugToast(message, forceShow = false) {
            // 检查是否开启调试模式（测试通知时强制显示）
            const debugEnabled = localStorage.getItem('debug_mode_enabled') === 'true';
            if (!debugEnabled && !forceShow) {
                return;
            }
            
            // 创建或获取toast元素
            let toast = document.getElementById('debug-toast');
            if (!toast) {
                toast = document.createElement('div');
                toast.id = 'debug-toast';
                toast.className = 'debug-toast';
                document.body.appendChild(toast);
            }
            
            // 清除之前的定时器
            if (toastTimer) clearTimeout(toastTimer);
            
            // 显示消息
            toast.innerText = message;
            toast.classList.add('show');
            
            // 3秒后隐藏
            toastTimer = setTimeout(() => {
                toast.classList.remove('show');
            }, 3000);
        }

        // API 错误提示弹窗
        let apiErrorTimer = null;
        function showApiErrorToast(errorMessage) {
            // 创建或获取弹窗元素
            let toast = document.getElementById('api-error-toast');
            if (!toast) {
                toast = document.createElement('div');
                toast.id = 'api-error-toast';
                toast.className = 'api-error-toast';
                document.body.appendChild(toast);
            }
            
            // 清除之前的定时器
            if (apiErrorTimer) clearTimeout(apiErrorTimer);
            
            // 构建错误提示内容
            toast.innerHTML = `
                <div class="error-icon">⚠️</div>
                <div class="error-title">请求失败</div>
                <div class="error-msg">${errorMessage}</div>
            `;
            toast.classList.add('show');
            toast.style.pointerEvents = 'auto';
            
            // 4秒后自动隐藏
            apiErrorTimer = setTimeout(() => {
                toast.classList.remove('show');
                toast.style.pointerEvents = 'none'; // 🔧 修复：隐藏后必须恢复pointer-events，否则透明toast会拦截屏幕中央的点击
            }, 4000);
            
            // 点击关闭
            toast.onclick = () => {
                toast.classList.remove('show');
                toast.style.pointerEvents = 'none'; // 🔧 修复：点击关闭后也要恢复
                if (apiErrorTimer) clearTimeout(apiErrorTimer);
            };
        }

        // 全局日志系统
        const systemLogs = [];
        const MAX_LOGS = 100;
        
        function addLog(type, message, data = null) {
            const log = {
                time: new Date().toLocaleTimeString(),
                type: type, // 'info', 'success', 'warning', 'error'
                message: message,
                data: data
            };
            systemLogs.unshift(log);
            if (systemLogs.length > MAX_LOGS) systemLogs.pop();
            
            // 如果诊断面板打开，实时更新
            const logContainer = document.getElementById('diagnostic-logs');
            if (logContainer) {
                renderLogs();
            }
        }
        
        function renderLogs() {
            const container = document.getElementById('diagnostic-logs');
            if (!container) return;
            
            container.innerHTML = systemLogs.map(log => {
                const colors = {
                    info: '#007aff',
                    success: '#34c759',
                    warning: '#ff9500',
                    error: '#ff3b30'
                };
                const icons = {
                    info: 'ℹ️',
                    success: '✅',
                    warning: '⚠️',
                    error: '❌'
                };
                
                return `
                    <div style="padding:8px; border-bottom:1px solid #eee; font-size:12px;">
                        <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                            <span style="color:${colors[log.type]}; font-weight:bold;">${icons[log.type]} ${log.type.toUpperCase()}</span>
                            <span style="color:#999;">${log.time}</span>
                        </div>
                        <div style="color:#333;">${log.message}</div>
                        ${log.data ? `<pre style="background:#f5f5f5; padding:4px; border-radius:4px; margin-top:4px; font-size:10px; overflow-x:auto;">${JSON.stringify(log.data, null, 2)}</pre>` : ''}
                    </div>
                `;
            }).join('');
        }
        
        // 显示诊断面板
        async function showDiagnosticPanel() {
            const panel = document.createElement('div');
            panel.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.8);
                z-index: 9999;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
            `;
            
            const content = document.createElement('div');
            content.style.cssText = `
                background: white;
                border-radius: 12px;
                padding: 20px;
                max-width: 500px;
                width: 100%;
                max-height: 80vh;
                overflow-y: auto;
            `;
            
            // 获取诊断信息
            let diagnosticInfo = `<h2 style="margin-top:0; color:#333;">🔍 诊断信息</h2>`;
            
            // 1. User ID
            diagnosticInfo += `<div style="margin-bottom:20px; padding:10px; background:#f5f5f5; border-radius:8px;">
                <strong style="color:#007aff;">User ID:</strong><br>
                <code style="background:#fff; padding:5px; border-radius:4px; display:block; margin-top:5px; word-break:break-all;">${currentUserId}</code>
            </div>`;
            
            // 2. 检查 Service Worker
            let swStatus = '❌ 未注册';
            if ('serviceWorker' in navigator) {
                const registration = await navigator.serviceWorker.getRegistration();
                if (registration) {
                    swStatus = '✅ 已注册';
                    if (registration.active) {
                        swStatus += ' (激活)';
                    }
                }
            }
            diagnosticInfo += `<div style="margin-bottom:20px; padding:10px; background:#f5f5f5; border-radius:8px;">
                <strong style="color:#007aff;">Service Worker:</strong><br>
                <span style="margin-top:5px; display:block;">${swStatus}</span>
            </div>`;
            
            // 3. 推送订阅状态
            let subStatus = '❌ 未订阅';
            let subEndpoint = '无';
            if ('serviceWorker' in navigator && 'PushManager' in window) {
                const registration = await navigator.serviceWorker.getRegistration();
                if (registration) {
                    const subscription = await registration.pushManager.getSubscription();
                    if (subscription) {
                        subStatus = '✅ 已订阅';
                        subEndpoint = subscription.endpoint.substring(0, 50) + '...';
                    }
                }
            }
            diagnosticInfo += `<div style="margin-bottom:20px; padding:10px; background:#f5f5f5; border-radius:8px;">
                <strong style="color:#007aff;">推送订阅:</strong><br>
                <span style="margin-top:5px; display:block;">${subStatus}</span>
                <code style="background:#fff; padding:5px; border-radius:4px; display:block; margin-top:5px; font-size:10px; word-break:break-all;">${subEndpoint}</code>
            </div>`;
            
            // 4. 通知权限
            const notifPerm = Notification.permission;
            const permIcon = notifPerm === 'granted' ? '✅' : notifPerm === 'denied' ? '❌' : '⚠️';
            diagnosticInfo += `<div style="margin-bottom:20px; padding:10px; background:#f5f5f5; border-radius:8px;">
                <strong style="color:#007aff;">通知权限:</strong><br>
                <span style="margin-top:5px; display:block;">${permIcon} ${notifPerm}</span>
            </div>`;
            
            // 5. 环境信息
            diagnosticInfo += `<div style="margin-bottom:20px; padding:10px; background:#f5f5f5; border-radius:8px;">
                <strong style="color:#007aff;">环境信息:</strong><br>
                <span style="margin-top:5px; display:block;">协议: ${location.protocol}</span>
                <span style="display:block;">域名: ${location.hostname}</span>
                <span style="display:block;">模式: 纯前端（无需后端）</span>
            </div>`;
            
            // 6. 开启主动聊天的角色
            const autoChars = await db.characters
                .filter(c => c.auto_reply_enabled === true && c.auto_reply_interval > 0)
                .toArray();
            diagnosticInfo += `<div style="margin-bottom:20px; padding:10px; background:#f5f5f5; border-radius:8px;">
                <strong style="color:#007aff;">主动聊天角色:</strong><br>
                <span style="margin-top:5px; display:block;">${autoChars.length} 个角色已启用</span>
                ${autoChars.map(c => `<div style="margin-top:5px; padding:5px; background:#fff; border-radius:4px;">
                    ${c.name} (${c.auto_reply_interval}分钟)
                </div>`).join('')}
            </div>`;
            
            // 7. 实时日志区域
            diagnosticInfo += `<div style="margin-bottom:20px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                    <strong style="color:#007aff;">📋 实时日志 (最近${systemLogs.length}条)</strong>
                    <button onclick="systemLogs.length=0; renderLogs();" style="padding:4px 8px; background:#ff3b30; color:#fff; border:none; border-radius:4px; font-size:11px;">清空</button>
                </div>
                <div id="diagnostic-logs" style="max-height:300px; overflow-y:auto; background:#f9f9f9; border-radius:8px; padding:10px;">
                    ${systemLogs.length === 0 ? '<div style="text-align:center; color:#999; padding:20px;">暂无日志</div>' : ''}
                </div>
            </div>`;
            
            content.innerHTML = diagnosticInfo;
            
            // 渲染日志
            renderLogs();
            
            // 关闭按钮
            const closeBtn = document.createElement('button');
            closeBtn.innerText = '关闭';
            closeBtn.style.cssText = `
                width: 100%;
                padding: 12px;
                background: var(--ins-pink);
                color: white;
                border: none;
                border-radius: 8px;
                font-size: 16px;
                cursor: pointer;
                margin-top: 10px;
            `;
            closeBtn.onclick = () => document.body.removeChild(panel);
            content.appendChild(closeBtn);
            
            panel.appendChild(content);
            document.body.appendChild(panel);
            
            // 点击背景关闭
            panel.onclick = (e) => {
                if (e.target === panel) {
                    document.body.removeChild(panel);
                }
            };
        }

        // 显示设置页面
        function showSettingPage() {
            document.getElementById('setting-page').style.display = 'flex';
        }
        function hideSettingPage() {
            document.getElementById('setting-page').style.display = 'none';
        }

        // 兼容 index.html 的内联 onclick（确保全局可访问）
        window.showSettingPage = showSettingPage;
        window.hideSettingPage = hideSettingPage;

        // ✅ 设置页 - 手动保存所有设置
        async function saveSettingPage() {
            try {
                // 1. 保存系统通知相关开关
                const notifSwitch = document.getElementById('notif-switch');
                const debugSwitch = document.getElementById('debug-switch');
                const keepaliveSwitch = document.getElementById('keepalive-switch');
                if (notifSwitch) localStorage.setItem('notification_enabled', notifSwitch.checked);
                if (debugSwitch) localStorage.setItem('debug_mode_enabled', debugSwitch.checked);
                if (keepaliveSwitch) localStorage.setItem('keepalive_enabled', keepaliveSwitch.checked);

                // 2. 保存主API设置
                await autoSaveApi();

                // 3. 保存副API设置
                await autoSaveSecondaryApi();

                // 4. 保存 MinMax 设置
                await autoSaveMinMax();

                // 5. 保存图片生成设置（GPT / NovelAI）
                await autoSaveGPTImage();
                await autoSaveNovelAI();

                // 6. 保存联机设置
                saveOnlineSettings();

                // 7. 同步localStorage备份
                const url = document.getElementById('ai-url-input')?.value?.trim();
                const key = document.getElementById('ai-key-input')?.value?.trim();
                const model = document.getElementById('ai-model-select')?.value;
                const temp = document.getElementById('ai-temp-slider')?.value;
                if (url) localStorage.setItem('aiBaseUrl', url);
                if (key) localStorage.setItem('aiApiKey', key);
                if (model) localStorage.setItem('aiCurrentModel', model);
                if (temp) localStorage.setItem('aiTemperature', temp);

                showToast('✅ 设置已保存');
            } catch (e) {
                console.error('[saveSettingPage] 保存设置失败:', e);
                showToast('❌ 保存失败: ' + e.message);
            }
        }

        // 兼容旧调用名：历史代码使用 autoSaveMinMax，当前实现为 autoSaveMinimaxVoice
        async function autoSaveMinMax() {
            if (typeof autoSaveMinimaxVoice === 'function') {
                return autoSaveMinimaxVoice();
            }
            if (typeof window.autoSaveMinimaxVoice === 'function') {
                return window.autoSaveMinimaxVoice();
            }
            console.warn('[saveSettingPage] 未找到 autoSaveMinimaxVoice，跳过 Minimax 保存');
        }

// ===== Section C: API 设置 / 副API / NovelAI / 预设管理 =====
        // --- API 设置逻辑 (折叠版) ---
        function toggleApiSetting() {
            const body = document.getElementById('api-setting-body');
            const arrow = document.getElementById('api-setting-arrow');
            if (body.style.display === 'block') {
                body.style.display = 'none';
                arrow.classList.remove('expanded');
            } else {
                body.style.display = 'block';
                arrow.classList.add('expanded');
                loadAiConfig(); // 展开时加载
            }
        }

        function toggleKeyVis() {
            const input = document.getElementById('ai-key-input');
            // 找到对应的eye-icon（在同一个api-input-group中）
            const inputGroup = input.closest('.api-input-group');
            const icon = inputGroup ? inputGroup.querySelector('.eye-icon') : null;
            if (input && icon) {
                if (input.type === 'password') {
                    input.type = 'text';
                    icon.textContent = '隐藏';
                } else {
                    input.type = 'password';
                    icon.textContent = '显示';
                }
            }
        }

        function updateTempDisplay(val) {
            document.getElementById('temp-val-display').innerText = val;
        }
        
        // 加载 API 配置
        async function loadAiConfig() {
            try {
                const urlItem = await db.dexiData.get('aiBaseUrl');
                const keyItem = await db.dexiData.get('aiApiKey');
                const modelItem = await db.dexiData.get('aiCurrentModel');
                const listItem = await db.dexiData.get('aiModelList');
                const tempItem = await db.dexiData.get('aiTemperature');

                if (urlItem) document.getElementById('ai-url-input').value = urlItem.value;
                if (keyItem) document.getElementById('ai-key-input').value = keyItem.value;
                if (tempItem) {
                    document.getElementById('ai-temp-slider').value = tempItem.value;
                    updateTempDisplay(tempItem.value);
                }
                
                // 恢复下拉框
                const select = document.getElementById('ai-model-select');
                if (listItem && listItem.value) {
                    const models = JSON.parse(listItem.value);
                    select.innerHTML = '<option value="" disabled>请选择模型</option>';
                    models.forEach(m => {
                        const opt = document.createElement('option');
                        opt.value = m.id;
                        opt.text = m.id;
                        select.appendChild(opt);
                    });
                }
                
                if (modelItem) {
                    select.value = modelItem.value;
                }
                
                // 🔧 同步内存缓存
                _apiConfigCache = {
                    url: urlItem?.value || _apiConfigCache.url,
                    key: keyItem?.value || _apiConfigCache.key,
                    model: modelItem?.value || _apiConfigCache.model,
                    temp: tempItem?.value || _apiConfigCache.temp
                };
                
                // 加载预设列表
                await loadApiPresetList();
            } catch (e) {
                console.error("加载 API 配置失败", e);
            }
        }
        
        // 🔧 API配置内存缓存（防止IndexedDB偶发读取失败导致配置丢失）
        let _apiConfigCache = { url: '', key: '', model: '', temp: '0.7' };
        
        // 🔧 副API配置内存缓存
        let _secondaryApiConfigCache = { url: '', key: '', model: '' };

        // --- 副API 设置逻辑 ---
        function toggleSecondaryApiSetting() {
            const body = document.getElementById('secondary-api-setting-body');
            const arrow = document.getElementById('secondary-api-setting-arrow');
            if (body.style.display === 'block') {
                body.style.display = 'none';
                arrow.classList.remove('expanded');
            } else {
                body.style.display = 'block';
                arrow.classList.add('expanded');
                loadSecondaryAiConfig();
            }
        }

        function toggleSecondaryKeyVis() {
            const input = document.getElementById('secondary-ai-key-input');
            const inputGroup = input.closest('.api-input-group');
            const icon = inputGroup ? inputGroup.querySelector('.eye-icon') : null;
            if (input && icon) {
                if (input.type === 'password') {
                    input.type = 'text';
                    icon.textContent = '隐藏';
                } else {
                    input.type = 'password';
                    icon.textContent = '显示';
                }
            }
        }

        async function loadSecondaryAiConfig() {
            try {
                const urlItem = await db.dexiData.get('secondaryAiBaseUrl');
                const keyItem = await db.dexiData.get('secondaryAiApiKey');
                const modelItem = await db.dexiData.get('secondaryAiModel');
                const listItem = await db.dexiData.get('secondaryAiModelList');

                if (urlItem) document.getElementById('secondary-ai-url-input').value = urlItem.value;
                if (keyItem) document.getElementById('secondary-ai-key-input').value = keyItem.value;

                const select = document.getElementById('secondary-ai-model-select');
                if (listItem && listItem.value) {
                    const models = JSON.parse(listItem.value);
                    select.innerHTML = '<option value="" disabled>留空则使用主API模型</option>';
                    models.forEach(m => {
                        const opt = document.createElement('option');
                        opt.value = m.id;
                        opt.text = m.id;
                        select.appendChild(opt);
                    });
                }
                if (modelItem) {
                    select.value = modelItem.value;
                }

                _secondaryApiConfigCache = {
                    url: urlItem?.value || '',
                    key: keyItem?.value || '',
                    model: modelItem?.value || ''
                };
            } catch (e) {
                console.warn('[loadSecondaryAiConfig] 加载副API配置失败:', e);
            }
        }

        async function autoSaveSecondaryApi() {
            const url = document.getElementById('secondary-ai-url-input')?.value?.trim() || '';
            const key = document.getElementById('secondary-ai-key-input')?.value?.trim() || '';
            const model = document.getElementById('secondary-ai-model-select')?.value || '';

            // 🔧 防御：如果URL有值但Key为空，可能是DOM异常，不要用空Key覆盖数据库中的有效Key
            if (url && !key) {
                console.warn('[SecondaryAPI] ⚠️ URL有值但Key为空，跳过保存Key（防止覆盖有效密钥）');
                await db.dexiData.put({ key: 'secondaryAiBaseUrl', value: url });
                await db.dexiData.put({ key: 'secondaryAiModel', value: model });
                // 只更新缓存中的url和model，保留已有的key
                if (_secondaryApiConfigCache) {
                    _secondaryApiConfigCache.url = url;
                    _secondaryApiConfigCache.model = model;
                }
                return;
            }
            // 🔧 防御：如果URL和Key都为空，可能是DOM未加载好，不要覆盖
            if (!url && !key) {
                console.warn('[SecondaryAPI] ⚠️ URL和Key均为空，跳过保存（防止覆盖有效配置）');
                return;
            }

            await db.dexiData.put({ key: 'secondaryAiBaseUrl', value: url });
            await db.dexiData.put({ key: 'secondaryAiApiKey', value: key });
            await db.dexiData.put({ key: 'secondaryAiModel', value: model });

            _secondaryApiConfigCache = { url, key, model };
            console.log('[SecondaryAPI] ✅ 副API配置已保存');
        }

        async function clearSecondaryApi() {
            await db.dexiData.put({ key: 'secondaryAiBaseUrl', value: '' });
            await db.dexiData.put({ key: 'secondaryAiApiKey', value: '' });
            await db.dexiData.put({ key: 'secondaryAiModel', value: '' });
            await db.dexiData.put({ key: 'secondaryAiModelList', value: '' });

            _secondaryApiConfigCache = { url: '', key: '', model: '' };

            const urlInput = document.getElementById('secondary-ai-url-input');
            const keyInput = document.getElementById('secondary-ai-key-input');
            const modelSelect = document.getElementById('secondary-ai-model-select');
            if (urlInput) urlInput.value = '';
            if (keyInput) keyInput.value = '';
            if (modelSelect) modelSelect.innerHTML = '<option value="" disabled selected>留空则使用主API模型</option>';

            showToast('副API已清空，将使用主API');
        }

        async function fetchSecondaryModels() {
            const url = document.getElementById('secondary-ai-url-input').value.trim();
            const key = document.getElementById('secondary-ai-key-input').value.trim();
            if (!url || !key) {
                showToast('请先填写副API地址和密钥');
                return;
            }

            const spinner = document.getElementById('secondary-fetch-spinner');
            const text = document.getElementById('secondary-fetch-text');
            spinner.style.display = 'block';
            text.textContent = '拉取中...';

            try {
                const modelsUrl = getSmartUrl(url, '/models');
                const res = await fetch(modelsUrl, {
                    headers: { 'Authorization': `Bearer ${key}` }
                });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json();
                const models = (data.data || []).map(m => ({ id: m.id }));

                await db.dexiData.put({ key: 'secondaryAiModelList', value: JSON.stringify(models) });

                const select = document.getElementById('secondary-ai-model-select');
                select.innerHTML = '<option value="" disabled>留空则使用主API模型</option>';
                models.forEach(m => {
                    const opt = document.createElement('option');
                    opt.value = m.id;
                    opt.text = m.id;
                    select.appendChild(opt);
                });

                showToast(`已拉取 ${models.length} 个模型`);
            } catch (e) {
                console.error('[SecondaryAPI] 拉取模型失败:', e);
                showToast('拉取模型失败: ' + e.message);
            } finally {
                spinner.style.display = 'none';
                text.textContent = '拉取模型';
            }
        }

        async function testSecondaryConnection() {
            const btnText = document.getElementById('secondary-test-btn-text');
            btnText.textContent = '测试中...';
            try {
                const result = await callAI([
                    { role: 'user', content: '请回复"连接成功"' }
                ], { _useSecondary: true });
                btnText.textContent = '✅ 连接成功';
                showToast('副API连接成功');
            } catch (e) {
                btnText.textContent = '❌ 连接失败';
                showToast('副API连接失败: ' + e.message);
            }
            setTimeout(() => { btnText.textContent = '测试副API连接'; }, 3000);
        }

        // 自动保存 API 配置 (每次输入变更时)
        async function autoSaveApi() {
            const url = document.getElementById('ai-url-input').value.trim();
            const key = document.getElementById('ai-key-input').value.trim();
            const model = document.getElementById('ai-model-select').value;
            const temp = document.getElementById('ai-temp-slider').value;
            
            // 🔧 防御：如果URL和Key都为空，可能是DOM还没加载好，不要覆盖数据库
            if (!url && !key) {
                console.warn('[autoSaveApi] URL和Key均为空，跳过保存（防止覆盖有效配置）');
                return;
            }
            
            // 🔧 防御：如果URL有值但Key为空，不覆盖已保存的Key（手机浏览器可能自动清空密码框）
            if (url && !key && _apiConfigCache.key) {
                console.warn('[autoSaveApi] ⚠️ URL有值但Key为空，跳过Key保存（防止密码框被浏览器清空后覆盖有效密钥）');
                await db.dexiData.put({ key: 'aiBaseUrl', value: url });
                await db.dexiData.put({ key: 'aiCurrentModel', value: model });
                await db.dexiData.put({ key: 'aiTemperature', value: temp });
                // 只更新非Key字段的缓存
                _apiConfigCache = { url, key: _apiConfigCache.key, model, temp };
                return;
            }
            
            await db.dexiData.put({ key: 'aiBaseUrl', value: url });
            await db.dexiData.put({ key: 'aiApiKey', value: key });
            await db.dexiData.put({ key: 'aiCurrentModel', value: model });
            await db.dexiData.put({ key: 'aiTemperature', value: temp });
            
            // 同步更新内存缓存
            _apiConfigCache = { url, key, model, temp };
        }
        
        // ========== API 预设管理 ==========
        
        // 加载预设列表到下拉框
        async function loadApiPresetList() {
            const select = document.getElementById('api-preset-select');
            if (!select) return;
            
            try {
                const presetsData = await db.dexiData.get('apiPresets');
                const presets = presetsData?.value ? JSON.parse(presetsData.value) : [];
                const currentPresetData = await db.dexiData.get('currentApiPreset');
                const currentPresetName = currentPresetData?.value || '';
                
                select.innerHTML = '<option value="">-- 选择预设 --</option>';
                presets.forEach(preset => {
                    const opt = document.createElement('option');
                    opt.value = preset.name;
                    opt.textContent = preset.name;
                    if (preset.name === currentPresetName) {
                        opt.selected = true;
                    }
                    select.appendChild(opt);
                });
            } catch (e) {
                console.error('加载API预设列表失败:', e);
            }
        }
        
        // 保存当前配置为预设
        async function saveApiPreset() {
            const name = prompt('请输入预设名称：');
            if (!name || !name.trim()) return;
            
            const presetName = name.trim();
            const url = document.getElementById('ai-url-input').value.trim();
            const key = document.getElementById('ai-key-input').value.trim();
            const model = document.getElementById('ai-model-select').value;
            const temp = document.getElementById('ai-temp-slider').value;
            const modelListData = await db.dexiData.get('aiModelList');
            const modelList = modelListData?.value || '[]';
            
            const newPreset = {
                name: presetName,
                url: url,
                key: key,
                model: model,
                temperature: temp,
                modelList: modelList
            };
            
            try {
                const presetsData = await db.dexiData.get('apiPresets');
                let presets = presetsData?.value ? JSON.parse(presetsData.value) : [];
                
                // 检查是否已存在同名预设
                const existingIndex = presets.findIndex(p => p.name === presetName);
                if (existingIndex >= 0) {
                    if (!confirm(`预设"${presetName}"已存在，是否覆盖？`)) return;
                    presets[existingIndex] = newPreset;
                } else {
                    presets.push(newPreset);
                }
                
                await db.dexiData.put({ key: 'apiPresets', value: JSON.stringify(presets) });
                await db.dexiData.put({ key: 'currentApiPreset', value: presetName });
                
                await loadApiPresetList();
                alert(`预设"${presetName}"已保存！`);
            } catch (e) {
                console.error('保存API预设失败:', e);
                alert('保存预设失败：' + e.message);
            }
        }
        
        // 加载选中的预设
        async function loadApiPreset(presetName) {
            if (!presetName) return;
            
            try {
                const presetsData = await db.dexiData.get('apiPresets');
                const presets = presetsData?.value ? JSON.parse(presetsData.value) : [];
                const preset = presets.find(p => p.name === presetName);
                
                if (!preset) {
                    alert('预设不存在');
                    return;
                }
                
                // 应用预设到输入框
                document.getElementById('ai-url-input').value = preset.url || '';
                document.getElementById('ai-key-input').value = preset.key || '';
                document.getElementById('ai-temp-slider').value = preset.temperature || '0.7';
                updateTempDisplay(preset.temperature || '0.7');
                
                // 恢复模型列表和选择
                const select = document.getElementById('ai-model-select');
                if (preset.modelList) {
                    try {
                        const models = JSON.parse(preset.modelList);
                        select.innerHTML = '<option value="" disabled>请选择模型</option>';
                        models.forEach(m => {
                            const opt = document.createElement('option');
                            opt.value = m.id;
                            opt.text = m.id;
                            select.appendChild(opt);
                        });
                    } catch (e) {
                        select.innerHTML = '<option value="" disabled>请拉取</option>';
                    }
                }
                if (preset.model) {
                    select.value = preset.model;
                }
                
                // 保存到数据库
                await db.dexiData.put({ key: 'aiBaseUrl', value: preset.url || '' });
                await db.dexiData.put({ key: 'aiApiKey', value: preset.key || '' });
                await db.dexiData.put({ key: 'aiCurrentModel', value: preset.model || '' });
                await db.dexiData.put({ key: 'aiTemperature', value: preset.temperature || '0.7' });
                await db.dexiData.put({ key: 'aiModelList', value: preset.modelList || '[]' });
                await db.dexiData.put({ key: 'currentApiPreset', value: presetName });
                
                // 🔧 同步更新内存缓存
                _apiConfigCache = {
                    url: preset.url || '',
                    key: preset.key || '',
                    model: preset.model || '',
                    temp: preset.temperature || '0.7'
                };
                
            } catch (e) {
                console.error('加载API预设失败:', e);
                alert('加载预设失败：' + e.message);
            }
        }
        
        // 删除当前选中的预设
        async function deleteApiPreset() {
            const select = document.getElementById('api-preset-select');
            const presetName = select.value;
            
            if (!presetName) {
                alert('请先选择要删除的预设');
                return;
            }
            
            if (!confirm(`确定要删除预设"${presetName}"吗？`)) return;
            
            try {
                const presetsData = await db.dexiData.get('apiPresets');
                let presets = presetsData?.value ? JSON.parse(presetsData.value) : [];
                
                presets = presets.filter(p => p.name !== presetName);
                await db.dexiData.put({ key: 'apiPresets', value: JSON.stringify(presets) });
                
                // 如果删除的是当前预设，清空当前预设标记
                const currentPresetData = await db.dexiData.get('currentApiPreset');
                if (currentPresetData?.value === presetName) {
                    await db.dexiData.put({ key: 'currentApiPreset', value: '' });
                }
                
                await loadApiPresetList();
                alert(`预设"${presetName}"已删除`);
            } catch (e) {
                console.error('删除API预设失败:', e);
                alert('删除预设失败：' + e.message);
            }
        }

        // ===== 图片生成提供方：GPT / NovelAI =====
        let _gptImageConfigCache = { url: '', key: '', model: '', size: '1024x1536', quality: 'auto', promptPrefix: '' };

        function updateImageProviderUI(gptEnabled) {
            const gptBody = document.getElementById('gpt-image-config-body');
            const novelBody = document.getElementById('novelai-config-body');
            const hint = document.getElementById('image-provider-hint');
            if (gptBody) gptBody.style.display = gptEnabled ? 'block' : 'none';
            if (novelBody) novelBody.style.display = gptEnabled ? 'none' : 'block';
            if (hint) hint.textContent = `角色发送图片卡片时自动调用 ${gptEnabled ? 'GPT' : 'NovelAI'} 生成图片`;
        }

        async function isGPTImageEnabled() {
            try {
                const item = await db.dexiData.get('gptImageEnabled');
                return item ? !!item.value : false;
            } catch (_) {
                return false;
            }
        }

        async function toggleGPTImageEnabled(el) {
            const enabled = !!el.checked;
            await db.dexiData.put({ key: 'gptImageEnabled', value: enabled });
            updateImageProviderUI(enabled);
            if (enabled) await autoSaveGPTImage();
            showToast(enabled ? '已启用 GPT 生图' : '已切回 NovelAI 生图');
        }

        function toggleGPTImageKeyVis() {
            const input = document.getElementById('gpt-image-api-key');
            const icon = input?.closest('.api-input-group')?.querySelector('.eye-icon');
            if (!input || !icon) return;
            input.type = input.type === 'password' ? 'text' : 'password';
            icon.textContent = input.type === 'password' ? '显示' : '隐藏';
        }

        function buildGPTImageEndpoint(baseUrl, endpoint) {
            let url = (baseUrl || '').trim().replace(/\/+$/, '');
            if (!url) return '';

            const knownEndpoint = /\/(?:v1\/)?(?:models|images\/generations)$/i;
            if (knownEndpoint.test(url)) {
                const isRequestedEndpoint = endpoint === '/models'
                    ? /\/models$/i.test(url)
                    : /\/images\/generations$/i.test(url);
                if (isRequestedEndpoint) return url;
                const root = url.replace(knownEndpoint, '');
                const hadV1 = /\/v1\/(?:models|images\/generations)$/i.test(url);
                return `${root}${hadV1 ? '/v1' : ''}${endpoint}`;
            }
            if (/\/v1$/i.test(url)) return url + endpoint;
            return url + '/v1' + endpoint;
        }

        function populateGPTImageModels(models, selectedModel = '') {
            const select = document.getElementById('gpt-image-model-select');
            if (!select) return;
            select.innerHTML = '<option value="" disabled>请选择生图模型</option>';
            models.forEach(model => {
                const id = typeof model === 'string' ? model : model?.id;
                if (!id) return;
                const opt = document.createElement('option');
                opt.value = id;
                opt.textContent = id;
                select.appendChild(opt);
            });
            if (selectedModel && !models.some(m => (typeof m === 'string' ? m : m?.id) === selectedModel)) {
                const opt = document.createElement('option');
                opt.value = selectedModel;
                opt.textContent = selectedModel;
                select.appendChild(opt);
            }
            if (selectedModel) select.value = selectedModel;
        }

        async function loadGPTImageConfig() {
            try {
                const [enabledItem, urlItem, keyItem, modelItem, listItem, sizeItem, qualityItem, promptItem] = await Promise.all([
                    db.dexiData.get('gptImageEnabled'),
                    db.dexiData.get('gptImageBaseUrl'),
                    db.dexiData.get('gptImageApiKey'),
                    db.dexiData.get('gptImageModel'),
                    db.dexiData.get('gptImageModelList'),
                    db.dexiData.get('gptImageSize'),
                    db.dexiData.get('gptImageQuality'),
                    db.dexiData.get('gptImagePromptPrefix')
                ]);
                const enabled = !!enabledItem?.value;
                const url = urlItem?.value || '';
                const key = keyItem?.value || '';
                const model = modelItem?.value || '';
                const size = sizeItem?.value || '1024x1536';
                const quality = qualityItem?.value || 'auto';
                const promptPrefix = promptItem?.value || '';
                let models = [];
                try { models = listItem?.value ? JSON.parse(listItem.value) : []; } catch (_) {}

                const enabledSwitch = document.getElementById('gpt-image-enabled-switch');
                if (enabledSwitch) enabledSwitch.checked = enabled;
                if (document.getElementById('gpt-image-base-url')) document.getElementById('gpt-image-base-url').value = url;
                if (document.getElementById('gpt-image-api-key')) document.getElementById('gpt-image-api-key').value = key;
                if (document.getElementById('gpt-image-size')) document.getElementById('gpt-image-size').value = size;
                if (document.getElementById('gpt-image-quality')) document.getElementById('gpt-image-quality').value = quality;
                if (document.getElementById('gpt-image-prompt-prefix')) document.getElementById('gpt-image-prompt-prefix').value = promptPrefix;
                populateGPTImageModels(models, model);
                updateImageProviderUI(enabled);
                _gptImageConfigCache = { url, key, model, size, quality, promptPrefix };
            } catch (e) {
                console.error('[GPT-Image] 加载配置失败:', e);
            }
        }

        async function autoSaveGPTImage() {
            const url = document.getElementById('gpt-image-base-url')?.value?.trim() || '';
            const key = document.getElementById('gpt-image-api-key')?.value?.trim() || '';
            const model = document.getElementById('gpt-image-model-select')?.value || '';
            const size = document.getElementById('gpt-image-size')?.value || '1024x1536';
            const quality = document.getElementById('gpt-image-quality')?.value || 'auto';
            const promptPrefix = document.getElementById('gpt-image-prompt-prefix')?.value?.trim() || '';

            if (!url && !key && !_gptImageConfigCache.url && !_gptImageConfigCache.key) return;
            await db.dexiData.put({ key: 'gptImageBaseUrl', value: url || _gptImageConfigCache.url });
            if (key || !_gptImageConfigCache.key) {
                await db.dexiData.put({ key: 'gptImageApiKey', value: key });
            }
            await db.dexiData.put({ key: 'gptImageModel', value: model });
            await db.dexiData.put({ key: 'gptImageSize', value: size });
            await db.dexiData.put({ key: 'gptImageQuality', value: quality });
            await db.dexiData.put({ key: 'gptImagePromptPrefix', value: promptPrefix });
            _gptImageConfigCache = { url: url || _gptImageConfigCache.url, key: key || _gptImageConfigCache.key, model, size, quality, promptPrefix };
        }

        async function fetchGPTImageModels() {
            const url = document.getElementById('gpt-image-base-url')?.value?.trim() || '';
            const key = document.getElementById('gpt-image-api-key')?.value?.trim() || '';
            if (!url || !key) {
                showToast('请先填写 GPT 生图反代地址和密钥');
                return;
            }
            const spinner = document.getElementById('gpt-image-fetch-spinner');
            const text = document.getElementById('gpt-image-fetch-text');
            if (spinner) spinner.style.display = 'block';
            if (text) text.textContent = '拉取中...';
            try {
                const response = await fetch(buildGPTImageEndpoint(url, '/models'), {
                    headers: { 'Authorization': `Bearer ${key}` }
                });
                if (!response.ok) {
                    const detail = (await response.text()).substring(0, 200);
                    throw new Error(`HTTP ${response.status}${detail ? ': ' + detail : ''}`);
                }
                const payload = await response.json();
                const rawModels = Array.isArray(payload) ? payload : (payload.data || payload.models || []);
                const allIds = rawModels.map(m => typeof m === 'string' ? m : m?.id).filter(Boolean);
                const likelyImageIds = allIds.filter(id => /(gpt.*image|image|dall[\s._-]*e|imagen|flux)/i.test(id));
                const modelIds = [...new Set(likelyImageIds.length ? likelyImageIds : allIds)].sort();
                if (!modelIds.length) throw new Error('接口没有返回可用模型');
                const current = document.getElementById('gpt-image-model-select')?.value || '';
                const selected = modelIds.includes(current) ? current : modelIds[0];
                populateGPTImageModels(modelIds, selected);
                await db.dexiData.put({ key: 'gptImageModelList', value: JSON.stringify(modelIds) });
                await autoSaveGPTImage();
                showToast(`已拉取 ${modelIds.length} 个${likelyImageIds.length ? '生图' : ''}模型`);
            } catch (e) {
                console.error('[GPT-Image] 拉取模型失败:', e);
                showToast('GPT 生图模型拉取失败: ' + e.message);
            } finally {
                if (spinner) spinner.style.display = 'none';
                if (text) text.textContent = '拉取模型';
            }
        }

        // NovelAI 设置相关函数
        function toggleNovelAISettings() {
            const body = document.getElementById('novelai-setting-body');
            const arrow = document.getElementById('novelai-setting-arrow');
            if (body.style.display === 'none') {
                body.style.display = 'block';
                arrow.textContent = '▲';
                loadNovelAIConfig(); // 展开时加载
            } else {
                body.style.display = 'none';
                arrow.textContent = '▼';
            }
        }

        // 切换NovelAI密钥显示
        function toggleNovelAIKeyVis() {
            const input = document.getElementById('novelai-api-key');
            const inputGroup = input.closest('.api-input-group');
            const icon = inputGroup ? inputGroup.querySelector('.eye-icon') : null;
            if (input && icon) {
                if (input.type === 'password') {
                    input.type = 'text';
                    icon.textContent = '隐藏';
                } else {
                    input.type = 'password';
                    icon.textContent = '显示';
                }
            }
        }

        // 更新NovelAI采样步数显示
        function updateNovelAIStepsDisplay(val) {
            const display = document.getElementById('novelai-steps-value');
            if (display) display.textContent = val;
        }

        // 更新NovelAI引导强度显示
        function updateNovelAIScaleDisplay(val) {
            const display = document.getElementById('novelai-scale-value');
            if (display) display.textContent = val;
        }

        // 切换 NovelAI Image2Image 开关
        async function toggleNovelAIImg2Img(el) {
            const enabled = !!el.checked;
            const body = document.getElementById('novelai-img2img-body');
            if (body) body.style.display = enabled ? 'block' : 'none';
            await db.dexiData.put({ key: 'novelaiImg2ImgEnabled', value: enabled });
            console.log('[NovelAI] Image2Image:', enabled ? '开启' : '关闭');
        }

        // 处理 Image2Image 参考图上传
        async function handleNovelAIImg2ImgUpload(inputEl) {
            try {
                const file = inputEl?.files?.[0];
                if (!file) return;
                if (!file.type.startsWith('image/')) {
                    showToast('请选择图片文件');
                    return;
                }

                const dataUrl = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                });

                await db.dexiData.put({ key: 'novelaiImg2ImgImage', value: dataUrl });

                const preview = document.getElementById('novelai-img2img-preview');
                const wrap = document.getElementById('novelai-img2img-preview-wrap');
                if (preview) preview.src = dataUrl;
                if (wrap) wrap.style.display = 'block';

                // 上传后弹出“导入面板”（模拟官网导入页）
                const metadataText = await extractNovelAIMetadataText(file);
                showNovelAIImportPanel({ dataUrl, metadataText });

                showToast('参考图已保存');
            } catch (e) {
                console.error('[NovelAI] 上传参考图失败:', e);
                showToast('参考图保存失败: ' + e.message);
            }
        }

        // 读取 PNG 文本元数据（简化版）
        async function extractNovelAIMetadataText(file) {
            try {
                const isPng = file.type === 'image/png' || /\.png$/i.test(file.name || '');
                if (!isPng) return '';

                const buf = await file.arrayBuffer();
                const bytes = new Uint8Array(buf);
                // PNG signature
                const sig = [137, 80, 78, 71, 13, 10, 26, 10];
                for (let i = 0; i < sig.length; i++) {
                    if (bytes[i] !== sig[i]) return '';
                }

                let offset = 8;
                let textParts = [];
                const decoder = new TextDecoder('latin1');

                while (offset + 12 <= bytes.length) {
                    const length = (bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3];
                    const type = String.fromCharCode(bytes[offset + 4], bytes[offset + 5], bytes[offset + 6], bytes[offset + 7]);
                    const dataStart = offset + 8;
                    const dataEnd = dataStart + length;
                    if (dataEnd > bytes.length) break;

                    if (type === 'tEXt' || type === 'iTXt') {
                        const chunkText = decoder.decode(bytes.slice(dataStart, dataEnd));
                        textParts.push(chunkText);
                    }

                    offset = dataEnd + 4; // skip CRC
                    if (type === 'IEND') break;
                }

                const combined = textParts.join('\n');
                return combined || '';
            } catch (e) {
                console.warn('[NovelAI] 读取元数据失败:', e);
                return '';
            }
        }

        // 解析 NovelAI 元数据（统一入口）
        function parseNovelAIMetadata(mdRaw) {
            const md = (mdRaw || '').replace(/\0/g, '\n');
            if (!md.trim()) return null;

            const promptMatch = md.match(/["']?prompt["']?\s*[:=]\s*([\s\S]*?)(?:["']?negative prompt["']?\s*[:=]|["']?steps["']?\s*[:=]|$)/i);
            const negativeMatch = md.match(/["']?negative prompt["']?\s*[:=]\s*([\s\S]*?)(?:["']?steps["']?\s*[:=]|["']?sampler["']?\s*[:=]|["']?(?:cfg scale|scale)["']?\s*[:=]|["']?seed["']?\s*[:=]|["']?size["']?\s*[:=]|["']?model["']?\s*[:=]|$)/i);
            const stepsMatch = md.match(/["']?steps["']?\s*[:=]\s*(\d+)/i);
            const samplerMatch = md.match(/["']?sampler["']?\s*[:=]\s*["']?([^,\n"'}]+)/i);
            const scaleMatch = md.match(/["']?(?:cfg scale|scale)["']?\s*[:=]\s*([\d.]+)/i);
            const sizeMatch = md.match(/["']?size["']?\s*[:=]\s*["']?(\d{3,4})\s*[xX]\s*(\d{3,4})["']?/i);
            const modelMatch = md.match(/["']?model["']?\s*[:=]\s*["']?([^,\n"'}]+)/i);
            const seedMatch = md.match(/["']?seed["']?\s*[:=]\s*(\d+)/i);

            return {
                prompt: promptMatch?.[1]?.trim() || '',
                negative: negativeMatch?.[1]?.trim() || '',
                steps: stepsMatch?.[1] || '',
                sampler: samplerMatch?.[1]?.trim() || '',
                scale: scaleMatch?.[1] || '',
                size: (sizeMatch?.[1] && sizeMatch?.[2]) ? `${sizeMatch[1]}x${sizeMatch[2]}` : '',
                model: modelMatch?.[1]?.trim() || '',
                seed: seedMatch?.[1] || '',
                raw: md
            };
        }

        // 显示导入面板（上传参考图后）
        async function showNovelAIImportPanel({ dataUrl, metadataText }) {
            let panel = document.getElementById('novelai-import-panel');
            if (!panel) {
                panel = document.createElement('div');
                panel.id = 'novelai-import-panel';
                panel.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,0.55); z-index:10020; display:flex; align-items:center; justify-content:center; padding:16px;';
                panel.innerHTML = `
                    <div style="width:min(560px, 96vw); max-height:90vh; overflow:auto; background:#f8e8f0; border-radius:14px; padding:14px; position:relative;">
                        <button id="novelai-import-close" style="position:absolute; right:10px; top:8px; border:none; background:transparent; font-size:22px; color:#c06090; cursor:pointer;">×</button>
                        <div style="display:flex; justify-content:center; margin-top:12px;">
                            <img id="novelai-import-preview" style="width:220px; height:220px; object-fit:cover; border-radius:8px; border:1px solid #ead6df; background:#fff;" />
                        </div>
                        <div style="display:flex; gap:8px; flex-wrap:wrap; justify-content:center; margin-top:12px;">
                            <button id="novelai-mode-img2img" style="padding:8px 12px; border:none; border-radius:8px; background:#4f8f5e; color:#fff; cursor:pointer;">Image2Image</button>
                            <button id="novelai-mode-vibe" style="padding:8px 12px; border:none; border-radius:8px; background:#6ea17a; color:#fff; cursor:pointer;">Vibe Transfer</button>
                            <button id="novelai-mode-precise" style="padding:8px 12px; border:none; border-radius:8px; background:#6ea17a; color:#fff; cursor:pointer;">Precise Reference</button>
                        </div>
                        <div id="novelai-mode-hint" style="margin-top:8px; text-align:center; font-size:12px; color:#666;">当前模式：Image2Image</div>

                        <div id="novelai-mode-params" style="margin-top:12px; padding:10px; border-radius:10px; background:#f4dce7;">
                            <div id="novelai-params-img2img" style="display:block;">
                                <div style="font-size:12px; color:#7a4a61; margin-bottom:6px;">Image2Image 强度</div>
                                <input id="novelai-import-img2img-strength" type="range" min="0" max="1" step="0.05" value="0.6" style="width:100%;">
                                <div style="font-size:12px; color:#7a4a61; margin-top:6px;">Noise</div>
                                <input id="novelai-import-img2img-noise" type="range" min="0" max="1" step="0.05" value="0.2" style="width:100%;">
                            </div>
                            <div id="novelai-params-vibe" style="display:none;">
                                <div style="font-size:12px; color:#7a4a61; margin-bottom:6px;">Vibe Strength</div>
                                <input id="novelai-import-vibe-strength" type="range" min="0" max="1" step="0.05" value="0.45" style="width:100%;">
                                <div style="font-size:11px; color:#8d5d74; margin-top:6px;">用于风格迁移（当前实现会映射为导图参数）</div>
                            </div>
                            <div id="novelai-params-precise" style="display:none;">
                                <div style="font-size:12px; color:#7a4a61; margin-bottom:6px;">Reference Strength</div>
                                <input id="novelai-import-precise-strength" type="range" min="0" max="1" step="0.05" value="0.8" style="width:100%;">
                                <div style="font-size:11px; color:#8d5d74; margin-top:6px;">用于更贴近参考图（当前实现会映射为导图参数）</div>
                            </div>
                        </div>

                        <div id="novelai-metadata-wrap" style="margin-top:14px; padding:10px; background:#f5dde8; border-radius:10px; font-size:13px; color:#8c4f69;"></div>
                        <div style="margin-top:10px; display:grid; grid-template-columns:1fr 1fr; gap:8px; font-size:13px; color:#5a5a5a;">
                            <label><input type="checkbox" id="nai-import-prompt" checked> Prompt</label>
                            <label><input type="checkbox" id="nai-import-negative" checked> Undesired Content</label>
                            <label><input type="checkbox" id="nai-import-settings"> Settings</label>
                            <label><input type="checkbox" id="nai-import-seed"> Seed</label>
                        </div>
                        <button id="novelai-import-metadata-btn" style="margin-top:12px; width:100%; padding:11px; border:none; border-radius:10px; background:#ffffff; color:#bd5d86; font-weight:600; cursor:pointer;">Import Metadata</button>
                    </div>
                `;
                document.body.appendChild(panel);

                panel.querySelector('#novelai-import-close').onclick = () => panel.style.display = 'none';
                panel.onclick = (e) => { if (e.target === panel) panel.style.display = 'none'; };
            }

            panel.style.display = 'flex';
            const preview = panel.querySelector('#novelai-import-preview');
            if (preview) preview.src = dataUrl;

            const metadataWrap = panel.querySelector('#novelai-metadata-wrap');
            const parsedMeta = parseNovelAIMetadata(metadataText);
            const hasMetadata = !!parsedMeta;
            metadataWrap.innerHTML = hasMetadata
                ? `
                    <div style="font-weight:600; margin-bottom:6px;">检测到元数据（可导入并全局沿用）</div>
                    <div style="font-size:12px; line-height:1.6; color:#7a4a61;">
                        <div>Model: ${parsedMeta.model || '-'}</div>
                        <div>Size: ${parsedMeta.size || '-'}</div>
                        <div>Steps: ${parsedMeta.steps || '-'} | Sampler: ${parsedMeta.sampler || '-'} | Scale: ${parsedMeta.scale || '-'}</div>
                        <div>Seed: ${parsedMeta.seed || '-'}</div>
                    </div>
                    <details style="margin-top:8px;">
                        <summary style="cursor:pointer; font-size:12px; color:#8d5d74;">查看原始元数据</summary>
                        <pre style="white-space:pre-wrap; word-break:break-all; background:#fff; border-radius:8px; padding:8px; margin-top:6px; font-size:11px; max-height:180px; overflow:auto;">${parsedMeta.raw.replace(/</g, '&lt;')}</pre>
                    </details>
                `
                : '未检测到可读取元数据（仍可正常使用参考图导图）';

            const savedModeItem = await db.dexiData.get('novelaiReferenceMode');
            let mode = savedModeItem?.value || 'image2image';

            const img2imgStrengthItem = await db.dexiData.get('novelaiImg2ImgStrength');
            const img2imgNoiseItem = await db.dexiData.get('novelaiImg2ImgNoise');
            const vibeStrengthItem = await db.dexiData.get('novelaiVibeStrength');
            const preciseStrengthItem = await db.dexiData.get('novelaiPreciseStrength');

            const img2imgStrengthInput = panel.querySelector('#novelai-import-img2img-strength');
            const img2imgNoiseInput = panel.querySelector('#novelai-import-img2img-noise');
            const vibeStrengthInput = panel.querySelector('#novelai-import-vibe-strength');
            const preciseStrengthInput = panel.querySelector('#novelai-import-precise-strength');

            if (img2imgStrengthInput && img2imgStrengthItem?.value != null) img2imgStrengthInput.value = String(img2imgStrengthItem.value);
            if (img2imgNoiseInput && img2imgNoiseItem?.value != null) img2imgNoiseInput.value = String(img2imgNoiseItem.value);
            if (vibeStrengthInput && vibeStrengthItem?.value != null) vibeStrengthInput.value = String(vibeStrengthItem.value);
            if (preciseStrengthInput && preciseStrengthItem?.value != null) preciseStrengthInput.value = String(preciseStrengthItem.value);

            const refreshMode = () => {
                panel.querySelector('#novelai-mode-img2img').style.background = mode === 'image2image' ? '#4f8f5e' : '#6ea17a';
                panel.querySelector('#novelai-mode-vibe').style.background = mode === 'vibe' ? '#4f8f5e' : '#6ea17a';
                panel.querySelector('#novelai-mode-precise').style.background = mode === 'precise' ? '#4f8f5e' : '#6ea17a';
                panel.querySelector('#novelai-mode-hint').textContent = `当前模式：${mode === 'image2image' ? 'Image2Image' : mode === 'vibe' ? 'Vibe Transfer' : 'Precise Reference'}`;

                panel.querySelector('#novelai-params-img2img').style.display = mode === 'image2image' ? 'block' : 'none';
                panel.querySelector('#novelai-params-vibe').style.display = mode === 'vibe' ? 'block' : 'none';
                panel.querySelector('#novelai-params-precise').style.display = mode === 'precise' ? 'block' : 'none';
            };
            refreshMode();

            const persistModeAndParams = async () => {
                await db.dexiData.put({ key: 'novelaiReferenceMode', value: mode });
                await db.dexiData.put({ key: 'novelaiImg2ImgStrength', value: img2imgStrengthInput?.value || '0.6' });
                await db.dexiData.put({ key: 'novelaiImg2ImgNoise', value: img2imgNoiseInput?.value || '0.2' });
                await db.dexiData.put({ key: 'novelaiVibeStrength', value: vibeStrengthInput?.value || '0.45' });
                await db.dexiData.put({ key: 'novelaiPreciseStrength', value: preciseStrengthInput?.value || '0.8' });
            };

            panel.querySelector('#novelai-mode-img2img').onclick = async () => {
                mode = 'image2image';
                refreshMode();
                await persistModeAndParams();
            };
            panel.querySelector('#novelai-mode-vibe').onclick = async () => {
                mode = 'vibe';
                refreshMode();
                await persistModeAndParams();
            };
            panel.querySelector('#novelai-mode-precise').onclick = async () => {
                mode = 'precise';
                refreshMode();
                await persistModeAndParams();
            };

            [img2imgStrengthInput, img2imgNoiseInput, vibeStrengthInput, preciseStrengthInput].forEach(el => {
                if (!el) return;
                el.onchange = persistModeAndParams;
            });

            panel.querySelector('#novelai-import-metadata-btn').onclick = async () => {
                const importPrompt = !!panel.querySelector('#nai-import-prompt')?.checked;
                const importNegative = !!panel.querySelector('#nai-import-negative')?.checked;
                const importSettings = !!panel.querySelector('#nai-import-settings')?.checked;
                const importSeed = !!panel.querySelector('#nai-import-seed')?.checked;

                const parsed = parseNovelAIMetadata(metadataText);
                if (!parsed) {
                    showToast('未找到可导入元数据');
                    return;
                }

                if (importPrompt && parsed.prompt) {
                    const sysPromptEl = document.getElementById('novelai-system-prompt');
                    if (sysPromptEl) sysPromptEl.value = parsed.prompt;
                    await db.dexiData.put({ key: 'novelaiImportedPrompt', value: parsed.prompt });
                }
                if (importNegative && parsed.negative) {
                    const negEl = document.getElementById('novelai-negative-prompt');
                    if (negEl) negEl.value = parsed.negative;
                    await db.dexiData.put({ key: 'novelaiImportedNegative', value: parsed.negative });
                }
                await db.dexiData.put({ key: 'novelaiUseImportedMetadata', value: true });
                if (importSettings) {
                    if (parsed.steps) {
                        const sEl = document.getElementById('novelai-steps');
                        if (sEl) sEl.value = parsed.steps;
                        updateNovelAIStepsDisplay(parsed.steps);
                        await db.dexiData.put({ key: 'novelaiSteps', value: parsed.steps });
                    }
                    if (parsed.sampler) {
                        const samplerRaw = parsed.sampler.toLowerCase();
                        const smEl = document.getElementById('novelai-sampler');
                        if (smEl) {
                            if (samplerRaw.includes('euler') && samplerRaw.includes('ancestral')) smEl.value = 'k_euler_ancestral';
                            else if (samplerRaw.includes('euler')) smEl.value = 'k_euler';
                            else if (samplerRaw.includes('lms')) smEl.value = 'k_lms';
                            else if (samplerRaw.includes('plms')) smEl.value = 'plms';
                            else if (samplerRaw.includes('ddim')) smEl.value = 'ddim';
                            await db.dexiData.put({ key: 'novelaiSampler', value: smEl.value });
                        }
                    }
                    if (parsed.scale) {
                        const cEl = document.getElementById('novelai-scale');
                        if (cEl) cEl.value = parsed.scale;
                        updateNovelAIScaleDisplay(parsed.scale);
                        await db.dexiData.put({ key: 'novelaiScale', value: parsed.scale });
                    }
                    if (parsed.size) {
                        const sizeEl = document.getElementById('novelai-size');
                        if (sizeEl) {
                            const hasOption = Array.from(sizeEl.options || []).some(opt => opt.value === parsed.size);
                            if (!hasOption) {
                                const opt = document.createElement('option');
                                opt.value = parsed.size;
                                opt.textContent = `${parsed.size}（导入）`;
                                sizeEl.appendChild(opt);
                            }
                            sizeEl.value = parsed.size;
                            await db.dexiData.put({ key: 'novelaiSize', value: parsed.size });
                        }
                    }
                    if (parsed.model) {
                        const importedModel = parsed.model.trim();
                        const modelEl = document.getElementById('novelai-model');
                        if (modelEl && importedModel) {
                            const hasModel = Array.from(modelEl.options || []).some(opt => opt.value === importedModel);
                            if (!hasModel) {
                                const opt = document.createElement('option');
                                opt.value = importedModel;
                                opt.textContent = `${importedModel}（导入）`;
                                modelEl.appendChild(opt);
                            }
                            modelEl.value = importedModel;
                            await db.dexiData.put({ key: 'novelaiModel', value: importedModel });
                        }
                    }
                }
                if (importSeed && parsed.seed) {
                    await db.dexiData.put({ key: 'novelaiImportedSeed', value: parsed.seed });
                } else {
                    await db.dexiData.put({ key: 'novelaiImportedSeed', value: '' });
                }

                // 保存“原始元数据 + 结构化元数据”，后续所有生成可沿用/追踪
                await db.dexiData.put({ key: 'novelaiLastImportedMetadataRaw', value: parsed.raw });
                await db.dexiData.put({ key: 'novelaiLastImportedMetadataParsed', value: JSON.stringify(parsed) });

                await persistModeAndParams();
                await autoSaveNovelAI();
                showToast('Metadata 导入完成（已全局生效）');
            };
        }

        // 清空 Image2Image 参考图
        async function clearNovelAIImg2ImgImage() {
            await db.dexiData.put({ key: 'novelaiImg2ImgImage', value: '' });
            const fileInput = document.getElementById('novelai-img2img-file');
            const preview = document.getElementById('novelai-img2img-preview');
            const wrap = document.getElementById('novelai-img2img-preview-wrap');
            if (fileInput) fileInput.value = '';
            if (preview) preview.src = '';
            if (wrap) wrap.style.display = 'none';
            showToast('参考图已清空');
        }

        // 切换 NovelAI 自动生图开关
        async function toggleNovelAIAutoGenerate(el) {
            const enabled = el.checked;
            await db.dexiData.put({ key: 'novelaiAutoGenerate', value: enabled });
            console.log('[NovelAI] 自动生图:', enabled ? '开启' : '关闭');
        }

        // 加载 NovelAI 配置
        async function loadNovelAIConfig() {
            try {
                await loadGPTImageConfig();
                const apiKeyItem = await db.dexiData.get('novelaiApiKey');
                const proxyUrlItem = await db.dexiData.get('novelaiProxyUrl');
                const modelItem = await db.dexiData.get('novelaiModel');
                const stepsItem = await db.dexiData.get('novelaiSteps');
                const scaleItem = await db.dexiData.get('novelaiScale');
                const samplerItem = await db.dexiData.get('novelaiSampler');
                const sizeItem = await db.dexiData.get('novelaiSize');
                const systemPromptItem = await db.dexiData.get('novelaiSystemPrompt');
                const negativePromptItem = await db.dexiData.get('novelaiNegativePrompt');
                const img2imgEnabledItem = await db.dexiData.get('novelaiImg2ImgEnabled');
                const img2imgStrengthItem = await db.dexiData.get('novelaiImg2ImgStrength');
                const img2imgNoiseItem = await db.dexiData.get('novelaiImg2ImgNoise');
                const img2imgImageItem = await db.dexiData.get('novelaiImg2ImgImage');

                if (apiKeyItem) document.getElementById('novelai-api-key').value = apiKeyItem.value;
                if (proxyUrlItem) document.getElementById('novelai-proxy-url').value = proxyUrlItem.value;
                if (modelItem) document.getElementById('novelai-model').value = modelItem.value;
                if (stepsItem) {
                    document.getElementById('novelai-steps').value = stepsItem.value;
                    updateNovelAIStepsDisplay(stepsItem.value);
                }
                if (scaleItem) {
                    document.getElementById('novelai-scale').value = scaleItem.value;
                    updateNovelAIScaleDisplay(scaleItem.value);
                }
                if (samplerItem) document.getElementById('novelai-sampler').value = samplerItem.value;
                if (sizeItem) document.getElementById('novelai-size').value = sizeItem.value;
                if (systemPromptItem) document.getElementById('novelai-system-prompt').value = systemPromptItem.value;
                if (negativePromptItem) document.getElementById('novelai-negative-prompt').value = negativePromptItem.value;

                // 加载 Image2Image 配置
                const img2imgSwitch = document.getElementById('novelai-img2img-enabled');
                const img2imgBody = document.getElementById('novelai-img2img-body');
                const img2imgStrengthInput = document.getElementById('novelai-img2img-strength');
                const img2imgNoiseInput = document.getElementById('novelai-img2img-noise');
                const img2imgPreviewWrap = document.getElementById('novelai-img2img-preview-wrap');
                const img2imgPreview = document.getElementById('novelai-img2img-preview');

                const img2imgEnabled = img2imgEnabledItem ? !!img2imgEnabledItem.value : false;
                if (img2imgSwitch) img2imgSwitch.checked = img2imgEnabled;
                if (img2imgBody) img2imgBody.style.display = img2imgEnabled ? 'block' : 'none';
                if (img2imgStrengthInput && img2imgStrengthItem?.value != null) img2imgStrengthInput.value = img2imgStrengthItem.value;
                if (img2imgNoiseInput && img2imgNoiseItem?.value != null) img2imgNoiseInput.value = img2imgNoiseItem.value;
                if (img2imgImageItem?.value && img2imgPreview && img2imgPreviewWrap) {
                    img2imgPreview.src = img2imgImageItem.value;
                    img2imgPreviewWrap.style.display = 'block';
                } else if (img2imgPreviewWrap) {
                    img2imgPreviewWrap.style.display = 'none';
                }
                
                // 加载画师串
                const artistTagsItem = await db.dexiData.get('novelaiArtistTags');
                if (artistTagsItem) document.getElementById('novelai-artist-tags').value = artistTagsItem.value;
                
                // 加载自动生图开关状态
                const autoGenItem = await db.dexiData.get('novelaiAutoGenerate');
                const autoGenSwitch = document.getElementById('novelai-auto-generate-switch');
                if (autoGenSwitch) {
                    autoGenSwitch.checked = autoGenItem ? !!autoGenItem.value : false;
                }
            } catch (e) {
                console.error("加载 NovelAI 配置失败", e);
            }
        }

        // 自动保存 NovelAI 配置
        async function autoSaveNovelAI() {
            const apiKey = document.getElementById('novelai-api-key').value.trim();
            const proxyUrl = document.getElementById('novelai-proxy-url').value.trim();
            const modelRaw = document.getElementById('novelai-model').value;
            const model = (modelRaw || '').trim() || 'nai-diffusion-4-5-full';
            const steps = document.getElementById('novelai-steps').value;
            const scale = document.getElementById('novelai-scale').value;
            const sampler = document.getElementById('novelai-sampler').value;
            const size = document.getElementById('novelai-size').value;
            const systemPrompt = document.getElementById('novelai-system-prompt').value.trim();
            const negativePrompt = document.getElementById('novelai-negative-prompt').value.trim();
            const img2imgEnabled = !!document.getElementById('novelai-img2img-enabled')?.checked;
            const img2imgStrength = document.getElementById('novelai-img2img-strength')?.value || '0.6';
            const img2imgNoise = document.getElementById('novelai-img2img-noise')?.value || '0.2';
            const referenceMode = await db.dexiData.get('novelaiReferenceMode');
            const vibeStrengthItem = await db.dexiData.get('novelaiVibeStrength');
            const preciseStrengthItem = await db.dexiData.get('novelaiPreciseStrength');

            // 🔧 防御：如果API Key为空，可能是面板未展开导致DOM未加载数据，不要覆盖数据库
            if (!apiKey && !proxyUrl) {
                console.warn('[autoSaveNovelAI] API Key和代理地址均为空，跳过保存（防止覆盖有效配置）');
                return;
            }

            await db.dexiData.put({ key: 'novelaiApiKey', value: apiKey });
            await db.dexiData.put({ key: 'novelaiProxyUrl', value: proxyUrl });
            await db.dexiData.put({ key: 'novelaiModel', value: model });
            await db.dexiData.put({ key: 'novelaiSteps', value: steps });
            await db.dexiData.put({ key: 'novelaiScale', value: scale });
            await db.dexiData.put({ key: 'novelaiSampler', value: sampler });
            await db.dexiData.put({ key: 'novelaiSize', value: size });
            await db.dexiData.put({ key: 'novelaiSystemPrompt', value: systemPrompt });
            await db.dexiData.put({ key: 'novelaiNegativePrompt', value: negativePrompt });
            await db.dexiData.put({ key: 'novelaiImg2ImgEnabled', value: img2imgEnabled });
            await db.dexiData.put({ key: 'novelaiImg2ImgStrength', value: img2imgStrength });
            await db.dexiData.put({ key: 'novelaiImg2ImgNoise', value: img2imgNoise });
            await db.dexiData.put({ key: 'novelaiReferenceMode', value: referenceMode?.value || 'image2image' });
            await db.dexiData.put({ key: 'novelaiVibeStrength', value: vibeStrengthItem?.value || '0.45' });
            await db.dexiData.put({ key: 'novelaiPreciseStrength', value: preciseStrengthItem?.value || '0.8' });
            
            // 保存画师串
            const artistTags = document.getElementById('novelai-artist-tags').value.trim();
            await db.dexiData.put({ key: 'novelaiArtistTags', value: artistTags });
        }

        // 测试 NovelAI 连接（自动跟随当前模型/端点，并显示测试出图）
        async function testNovelAIConnection() {
            const apiKey = document.getElementById('novelai-api-key').value.trim();
            const proxyUrl = document.getElementById('novelai-proxy-url').value.trim();
            const model = (document.getElementById('novelai-model')?.value || 'nai-diffusion-4-5-full').trim();
            const steps = parseInt(document.getElementById('novelai-steps')?.value || '1', 10);
            const scale = parseFloat(document.getElementById('novelai-scale')?.value || '5');
            const sampler = (document.getElementById('novelai-sampler')?.value || 'k_euler').trim();
            const sizeStr = (document.getElementById('novelai-size')?.value || '832x1216').trim();
            const resultDiv = document.getElementById('novelai-test-result');
            const btnText = document.getElementById('test-novelai-btn-text');

            if (!apiKey) {
                resultDiv.textContent = '❌ 请先输入 NovelAI API Key';
                resultDiv.style.color = '#ff3b30';
                return;
            }

            btnText.textContent = '测试中...';
            resultDiv.textContent = '⏳ 正在测试连接并生成测试图...';
            resultDiv.style.color = '#999';

            try {
                const isV4 = model.includes('nai-diffusion-4');

                // 先保存当前面板配置，确保测试与正式生图走同一套逻辑
                await autoSaveNovelAI();

                // 直接复用正式生图函数，避免测试解析逻辑和实际逻辑不一致
                const imageDataUrl = await generateNovelAIImage('simple portrait, looking at viewer, soft light', {
                    skipSystemPrompt: false,
                    debugThrow: true,
                    forceText2Img: true
                });

                if (imageDataUrl) {
                    resultDiv.style.color = '#34C759';
                    resultDiv.innerHTML = `
                        <div style="margin-bottom:8px;">✅ NovelAI 连接成功（${isV4 ? 'V4' : 'V3'}）</div>
                        <div style="font-size:11px; color:#888; margin-bottom:6px;">测试图预览：</div>
                        <img src="${imageDataUrl}" alt="novelai-test-preview" style="width:100%; max-width:240px; border-radius:10px; border:1px solid #e5e5e5; display:block;" />
                    `;
                } else {
                    resultDiv.style.color = '#ff9500';
                    resultDiv.textContent = '⚠️ 连接请求已发出，但未拿到可展示图片。请检查代理返回格式或查看控制台日志。';
                }
            } catch (err) {
                resultDiv.innerHTML = `
                    <div style="color:#ff3b30;">❌ 连接错误: ${err.message}</div>
                    <div style="margin-top:6px; font-size:11px; color:#999; line-height:1.4; word-break:break-all;">
                        调试信息：
                        <div>model=${model}</div>
                        <div>proxy=${proxyUrl || '(默认官方端点)'}</div>
                        <div>steps=${steps}, scale=${scale}, sampler=${sampler}, size=${sizeStr}</div>
                    </div>
                `;
                resultDiv.style.color = '#ff3b30';
            } finally {
                btnText.textContent = '测试 NovelAI 连接';
            }
        }

        // ========== NovelAI 自动生图功能 ==========
        
        // Blob 转 DataURL 辅助函数
        function blobToDataUrl(blob) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        }
        
        // 从 ZIP Blob 中提取图片，返回 DataURL
        async function extractPngFromZipBlob(zipBlob) {
            const arrayBuffer = await zipBlob.arrayBuffer();
            const uint8 = new Uint8Array(arrayBuffer);
            
            // 在 zip 字节流中定位 PNG 签名 (89 50 4E 47 0D 0A 1A 0A)
            let pngStart = -1;
            for (let i = 0; i < uint8.length - 8; i++) {
                if (uint8[i] === 0x89 && uint8[i+1] === 0x50 && uint8[i+2] === 0x4E && uint8[i+3] === 0x47) {
                    pngStart = i;
                    break;
                }
            }
            
            if (pngStart >= 0) {
                // 找到 PNG IEND 标记来精确截取
                let pngEnd = uint8.length;
                for (let i = pngStart + 8; i < uint8.length - 8; i++) {
                    // IEND chunk: 00 00 00 00 49 45 4E 44 AE 42 60 82
                    if (uint8[i] === 0x49 && uint8[i+1] === 0x45 && uint8[i+2] === 0x4E && uint8[i+3] === 0x44) {
                        pngEnd = i + 8; // IEND(4) + CRC(4)
                        break;
                    }
                }
                const pngBlob = new Blob([uint8.slice(pngStart, pngEnd)], { type: 'image/png' });
                return await blobToDataUrl(pngBlob);
            }
            
            // 没找到 PNG，尝试找 JPEG 签名 (FF D8 FF)
            for (let i = 0; i < uint8.length - 3; i++) {
                if (uint8[i] === 0xFF && uint8[i+1] === 0xD8 && uint8[i+2] === 0xFF) {
                    const jpgBlob = new Blob([uint8.slice(i)], { type: 'image/jpeg' });
                    return await blobToDataUrl(jpgBlob);
                }
            }
            
            // 都找不到，直接当整个文件转
            return await blobToDataUrl(zipBlob);
        }
        
        // 从 base64 字符串解析为图片 DataURL
        function resolveBase64Image(b64) {
            if (!b64) return null;
            if (b64.startsWith('http')) return b64; // 是 URL
            if (b64.startsWith('data:image')) return b64; // 已经是 DataURL
            // 常见图片签名
            if (b64.startsWith('iVBOR')) return `data:image/png;base64,${b64}`;
            if (b64.startsWith('/9j/')) return `data:image/jpeg;base64,${b64}`;
            if (b64.startsWith('R0lGOD')) return `data:image/gif;base64,${b64}`;
            if (b64.startsWith('UklGR')) return `data:image/webp;base64,${b64}`;
            // 未知格式（很多是 zip 的 base64），返回 null 交给上层走 zip 提取兜底
            return null;
        }

        function extractGPTImageValue(payload) {
            if (!payload) return null;
            if (typeof payload === 'string') return payload;
            const candidates = [
                payload.data?.[0], payload.output?.[0], payload.images?.[0],
                payload.result, payload.image, payload
            ].filter(Boolean);
            for (const item of candidates) {
                if (typeof item === 'string') return item;
                const value = item.b64_json || item.base64 || item.b64 || item.url || item.image_url ||
                    (typeof item.image === 'string' ? item.image : null) ||
                    (typeof item.data === 'string' ? item.data : null);
                if (value) return value;
            }
            return null;
        }

        async function generateGPTImage(description, options = {}) {
            const { debugThrow = false } = options;
            try {
                const [urlItem, keyItem, modelItem, sizeItem, qualityItem, prefixItem] = await Promise.all([
                    db.dexiData.get('gptImageBaseUrl'),
                    db.dexiData.get('gptImageApiKey'),
                    db.dexiData.get('gptImageModel'),
                    db.dexiData.get('gptImageSize'),
                    db.dexiData.get('gptImageQuality'),
                    db.dexiData.get('gptImagePromptPrefix')
                ]);
                const baseUrl = (urlItem?.value || '').trim();
                const apiKey = (keyItem?.value || '').trim().replace(/[^\x20-\x7E]/g, '');
                const model = (modelItem?.value || '').trim();
                const size = sizeItem?.value || '1024x1536';
                const quality = qualityItem?.value || 'auto';
                const promptPrefix = (prefixItem?.value || '').trim();
                if (!baseUrl || !apiKey || !model) {
                    throw new Error('请先配置 GPT 生图地址、密钥并拉取选择模型');
                }

                const prompt = [promptPrefix, description].filter(Boolean).join('\n');
                const apiUrl = buildGPTImageEndpoint(baseUrl, '/images/generations');
                const requestBody = { model, prompt, n: 1, size, quality };
                console.log(`[GPT-Image] 🎨 开始生成 | model=${model} | "${String(description).substring(0, 80)}"`);
                const response = await fetch(apiUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}`
                    },
                    body: JSON.stringify(requestBody)
                });
                if (!response.ok) {
                    let detail = '';
                    try {
                        const errorPayload = await response.json();
                        detail = errorPayload?.error?.message || errorPayload?.message || JSON.stringify(errorPayload);
                    } catch (_) {
                        try { detail = await response.text(); } catch (_) {}
                    }
                    throw new Error(`HTTP ${response.status}${detail ? ': ' + detail.substring(0, 240) : ''}`);
                }

                const contentType = response.headers.get('content-type') || '';
                let imageDataUrl = null;
                if (contentType.startsWith('image/')) {
                    imageDataUrl = await blobToDataUrl(await response.blob());
                } else {
                    const payload = await response.json();
                    const imageValue = extractGPTImageValue(payload);
                    imageDataUrl = resolveBase64Image(imageValue);
                    if (!imageDataUrl && typeof imageValue === 'string' && imageValue.length > 100) {
                        imageDataUrl = `data:image/png;base64,${imageValue}`;
                    }
                }
                if (!imageDataUrl) throw new Error('接口返回成功，但响应中没有找到图片数据');

                if (/^https?:\/\//i.test(imageDataUrl)) {
                    try {
                        const imageResponse = await fetch(imageDataUrl, {
                            headers: { 'Authorization': `Bearer ${apiKey}` }
                        });
                        if (imageResponse.ok) imageDataUrl = await blobToDataUrl(await imageResponse.blob());
                    } catch (e) {
                        console.warn('[GPT-Image] 图片直链转 DataURL 失败，将直接使用 URL:', e.message);
                    }
                }
                console.log('[GPT-Image] ✅ 图片生成成功');
                return imageDataUrl;
            } catch (err) {
                console.error('[GPT-Image] 生成异常:', err);
                if (debugThrow) throw err;
                return null;
            }
        }

        async function generateConfiguredImage(description, options = {}) {
            return await isGPTImageEnabled()
                ? generateGPTImage(description, options)
                : generateNovelAIImage(description, options);
        }

        async function testGPTImageConnection() {
            const resultDiv = document.getElementById('gpt-image-test-result');
            const btnText = document.getElementById('test-gpt-image-btn-text');
            if (btnText) btnText.textContent = '测试中...';
            if (resultDiv) {
                resultDiv.textContent = '⏳ 正在调用所选模型生成测试图...';
                resultDiv.style.color = '#999';
            }
            try {
                await autoSaveGPTImage();
                const imageDataUrl = await generateGPTImage('A warm, natural portrait, soft light, looking at the viewer', { debugThrow: true });
                if (resultDiv) {
                    resultDiv.style.color = '#34C759';
                    resultDiv.innerHTML = `
                        <div style="margin-bottom:8px;">✅ GPT 生图连接成功</div>
                        <div style="font-size:11px; color:#888; margin-bottom:6px;">测试图预览：</div>
                        <img src="${imageDataUrl}" alt="gpt-image-test-preview" style="width:100%; max-width:240px; border-radius:10px; border:1px solid #e5e5e5; display:block;" />
                    `;
                }
            } catch (err) {
                if (resultDiv) {
                    resultDiv.textContent = '❌ GPT 生图连接失败：' + err.message;
                    resultDiv.style.color = '#ff3b30';
                }
            } finally {
                if (btnText) btnText.textContent = '测试 GPT 生图';
            }
        }
        
        // 调用 NovelAI API 生成图片，返回 DataURL 或 null
        /**
         * 调用 NovelAI API 生成图片
         * @param {string} description - 图片描述/tag
         * @param {object} [options] - 可选参数
         * @param {boolean} [options.skipSystemPrompt=false] - 是否跳过系统基础 Prompt（视频通话等场景使用，避免性别冲突）
         * @returns {Promise<string|null>} - 生成的图片 DataURL，失败返回 null
         */
        async function generateNovelAIImage(description, options = {}) {
            try {
                const { skipSystemPrompt = false, debugThrow = false, forceText2Img = false } = options;
                
                const apiKeyItem = await db.dexiData.get('novelaiApiKey');
                const proxyUrlItem = await db.dexiData.get('novelaiProxyUrl');
                const modelItem = await db.dexiData.get('novelaiModel');
                const stepsItem = await db.dexiData.get('novelaiSteps');
                const scaleItem = await db.dexiData.get('novelaiScale');
                const samplerItem = await db.dexiData.get('novelaiSampler');
                const sizeItem = await db.dexiData.get('novelaiSize');
                const systemPromptItem = await db.dexiData.get('novelaiSystemPrompt');
                const negativePromptItem = await db.dexiData.get('novelaiNegativePrompt');
                const artistTagsItem = await db.dexiData.get('novelaiArtistTags');
                const img2imgEnabledItem = await db.dexiData.get('novelaiImg2ImgEnabled');
                const img2imgStrengthItem = await db.dexiData.get('novelaiImg2ImgStrength');
                const img2imgNoiseItem = await db.dexiData.get('novelaiImg2ImgNoise');
                const img2imgImageItem = await db.dexiData.get('novelaiImg2ImgImage');
                const referenceModeItem = await db.dexiData.get('novelaiReferenceMode');
                const vibeStrengthItem = await db.dexiData.get('novelaiVibeStrength');
                const preciseStrengthItem = await db.dexiData.get('novelaiPreciseStrength');
                const importedSeedItem = await db.dexiData.get('novelaiImportedSeed');
                
                const rawApiKey = apiKeyItem ? apiKeyItem.value : '';
                if (!rawApiKey) {
                    console.warn('[NovelAI-AutoGen] 未配置 API Key，跳过');
                    return null;
                }
                // 清理 Key 中可能的特殊字符
                const apiKey = rawApiKey.trim().replace(/[^\x20-\x7E]/g, '');
                
                const userProxyUrl = proxyUrlItem ? proxyUrlItem.value.trim() : '';
                let model = (modelItem?.value || '').trim() || 'nai-diffusion-4-5-full';
                const steps = stepsItem ? parseInt(stepsItem.value) : 28;
                const scale = scaleItem ? parseFloat(scaleItem.value) : 5;
                const sampler = samplerItem ? samplerItem.value : 'k_euler';
                const sizeStr = sizeItem ? sizeItem.value : '832x1216';
                const systemPrompt = systemPromptItem ? systemPromptItem.value : '';
                const negativePrompt = negativePromptItem ? negativePromptItem.value : 'lowres, bad anatomy, bad hands, text, error, missing fingers, extra digit, fewer digits, cropped, worst quality, low quality, normal quality, jpeg artifacts, signature, watermark, username, blurry';
                const importedPromptItem = await db.dexiData.get('novelaiImportedPrompt');
                const importedNegativeItem = await db.dexiData.get('novelaiImportedNegative');
                const useImportedMetadataItem = await db.dexiData.get('novelaiUseImportedMetadata');
                const artistTags = artistTagsItem ? artistTagsItem.value.trim() : '';
                const img2imgEnabled = img2imgEnabledItem ? !!img2imgEnabledItem.value : false;
                const img2imgStrength = img2imgStrengthItem ? parseFloat(img2imgStrengthItem.value) : 0.6;
                const img2imgNoise = img2imgNoiseItem ? parseFloat(img2imgNoiseItem.value) : 0.2;
                const img2imgImage = img2imgImageItem ? (img2imgImageItem.value || '') : '';
                const referenceMode = referenceModeItem?.value || 'image2image';
                const vibeStrength = vibeStrengthItem ? parseFloat(vibeStrengthItem.value) : 0.45;
                const preciseStrength = preciseStrengthItem ? parseFloat(preciseStrengthItem.value) : 0.8;
                const importedSeed = importedSeedItem?.value ? parseInt(importedSeedItem.value, 10) : null;
                
                let effectiveStrength = img2imgStrength;
                let effectiveNoise = img2imgNoise;
                if (referenceMode === 'vibe') {
                    effectiveStrength = Math.max(0, Math.min(1, vibeStrength));
                    effectiveNoise = Math.max(0, Math.min(1, Math.max(0.05, vibeStrength * 0.7)));
                } else if (referenceMode === 'precise') {
                    effectiveStrength = Math.max(0, Math.min(1, preciseStrength));
                    effectiveNoise = Math.max(0, Math.min(1, Math.max(0.01, (1 - preciseStrength) * 0.25)));
                }
                
                const isInpaintingModel = model === 'nai-diffusion-3-inpainting';
                const baseUseImg2Img = forceText2Img ? false : !!(img2imgEnabled && img2imgImage);
                const useImg2Img = isInpaintingModel ? true : baseUseImg2Img;

                // 选择了 inpainting 模型但没提供参考图时，直接报错，避免偷偷切模型
                if (isInpaintingModel && !img2imgImage) {
                    const errMsg = '当前模型是 nai-diffusion-3-inpainting，必须先上传 Base Img / 参考图';
                    console.warn('[NovelAI-AutoGen] ' + errMsg);
                    if (debugThrow) throw new Error(errMsg);
                    return null;
                }
                
                const isV4 = model.includes('nai-diffusion-4');
                const [width, height] = sizeStr.split('x').map(Number);
                
                // 导入元数据优先（按官网思路：导入后应显著影响后续出图风格）
                const useImportedMetadata = !!(useImportedMetadataItem && useImportedMetadataItem.value);
                const importedPrompt = importedPromptItem?.value?.trim() || '';
                const importedNegative = importedNegativeItem?.value?.trim() || '';

                // 拼接最终 prompt：视频通话等场景跳过系统 Prompt，避免 1girl 等性别/风格冲突
                // 画师串始终添加（如果有配置的话）
                const promptParts = [];
                if (useImportedMetadata && importedPrompt) {
                    promptParts.push(importedPrompt);
                } else if (!skipSystemPrompt && systemPrompt) {
                    promptParts.push(systemPrompt);
                }
                if (artistTags) {
                    promptParts.push(artistTags);
                }
                promptParts.push(description);
                const fullPrompt = promptParts.filter(Boolean).join(', ');
                const effectiveNegativePrompt = (useImportedMetadata && importedNegative) ? importedNegative : negativePrompt;
                
                console.log(`[NovelAI-AutoGen] 🎨 开始生成 | model=${model} (V4=${isV4}) | "${description}"`);
                
                // 根据模型版本选择端点
                let apiUrl;
                if (userProxyUrl && !userProxyUrl.includes('novelai.net')) {
                    // 用户自定义代理，直接用
                    apiUrl = userProxyUrl;
                } else {
                    apiUrl = isV4
                        ? 'https://image.novelai.net/ai/generate-image-stream'
                        : 'https://image.novelai.net/ai/generate-image';
                }
                
                // 根据模型版本构建不同的请求体
                let requestBody;
                const commonSeed = Number.isFinite(importedSeed) ? importedSeed : Math.floor(Math.random() * 9999999999);
                
                if (isV4) {
                    requestBody = {
                        input: fullPrompt,
                        model: model,
                        action: useImg2Img ? 'img2img' : 'generate',
                        parameters: {
                            params_version: 3,
                            width, height, scale, sampler, steps,
                            seed: commonSeed,
                            n_samples: 1,
                            ucPreset: 0,
                            qualityToggle: true,
                            autoSmea: false,
                            dynamic_thresholding: false,
                            controlnet_strength: 1,
                            legacy: false,
                            add_original_image: true,
                            cfg_rescale: 0,
                            noise_schedule: 'karras',
                            legacy_v3_extend: false,
                            skip_cfg_above_sigma: null,
                            use_coords: false,
                            legacy_uc: false,
                            normalize_reference_strength_multiple: true,
                            inpaintImg2ImgStrength: 1,
                            characterPrompts: [],
                            v4_prompt: {
                                caption: { base_caption: fullPrompt, char_captions: [] },
                                use_coords: false,
                                use_order: true
                            },
                            v4_negative_prompt: {
                                caption: { base_caption: effectiveNegativePrompt, char_captions: [] },
                                legacy_uc: false
                            },
                            negative_prompt: effectiveNegativePrompt,
                            deliberate_euler_ancestral_bug: false,
                            prefer_brownian: true
                        }
                    };

                    // Image2Image（V4）：注入参考图和强度参数
                    if (useImg2Img) {
                        requestBody.parameters.image = img2imgImage;
                        requestBody.parameters.strength = Math.max(0, Math.min(1, effectiveStrength || 0.6));
                        requestBody.parameters.noise = Math.max(0, Math.min(1, effectiveNoise || 0.2));
                    }
                } else {
                    // V3 请求格式
                    requestBody = {
                        input: fullPrompt,
                        model: model,
                        action: useImg2Img ? 'img2img' : 'generate',
                        parameters: {
                            width, height, scale, sampler, steps,
                            seed: commonSeed,
                            n_samples: 1,
                            ucPreset: 0,
                            qualityToggle: true,
                            sm: false,
                            sm_dyn: false,
                            dynamic_thresholding: false,
                            controlnet_strength: 1,
                            legacy: false,
                            add_original_image: false,
                            cfg_rescale: 0,
                            noise_schedule: 'native',
                            negative_prompt: negativePrompt
                        }
                    };

                    // Image2Image（V3）：注入参考图和强度参数
                    if (useImg2Img) {
                        requestBody.parameters.image = img2imgImage;
                        requestBody.parameters.strength = Math.max(0, Math.min(1, effectiveStrength || 0.6));
                        requestBody.parameters.noise = Math.max(0, Math.min(1, effectiveNoise || 0.2));
                    }
                }
                
                console.log('[NovelAI-AutoGen] 请求:', { url: apiUrl, model, isV4, prompt: fullPrompt.substring(0, 80) + '...' });
                
                const response = await fetch(apiUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}`
                    },
                    body: JSON.stringify(requestBody)
                });
                const responseClone = response.clone();
                
                console.log(`[NovelAI-AutoGen] 响应状态: ${response.status}`);
                
                if (!response.ok) {
                    // 尝试读取错误信息
                    let errDetail = '';
                    try {
                        const errText = await response.text();
                        const errObj = JSON.parse(errText);
                        errDetail = errObj.message || errObj.error || errText.substring(0, 150);
                    } catch (e) {
                        try { errDetail = await response.text(); } catch (_) {}
                        errDetail = errDetail.substring(0, 150);
                    }
                    console.error(`[NovelAI-AutoGen] API 错误 (${response.status}): ${errDetail}`);
                    if (debugThrow) throw new Error(`HTTP ${response.status}: ${errDetail}`);
                    return null;
                }
                
                // === 根据响应 Content-Type 选择解析策略 ===
                const contentType = response.headers.get('content-type') || '';
                let imageDataUrl = null;
                
                if (contentType.includes('text/event-stream') || contentType.includes('application/x-ndjson')) {
                    // V4 SSE 流式响应
                    const sseText = await response.text();
                    const lines = sseText.trim().split('\n');
                    
                    // 从后往前扫描，找到最终的图片数据
                    for (let i = lines.length - 1; i >= 0; i--) {
                        const line = lines[i].trim();
                        if (!line.startsWith('data: ') || line === 'data: [DONE]') continue;
                        
                        const payload = line.substring(6);
                        try {
                            const obj = JSON.parse(payload);
                            // 检查是否有 URL 字段
                            if (obj.output && Array.isArray(obj.output) && obj.output[0]?.url) {
                                imageDataUrl = obj.output[0].url; break;
                            }
                            if (obj.url) { imageDataUrl = obj.url; break; }
                            // 检查 base64 字段
                            const b64 = (obj.event_type === 'final' && obj.image) ? obj.image : (obj.data || obj.image);
                            if (b64) {
                                imageDataUrl = resolveBase64Image(b64);
                                if (!imageDataUrl) {
                                    // 可能是 zip 的 base64，解码后提取
                                    const raw = atob(b64);
                                    const bytes = new Uint8Array(raw.length);
                                    for (let j = 0; j < raw.length; j++) bytes[j] = raw.charCodeAt(j);
                                    imageDataUrl = await extractPngFromZipBlob(new Blob([bytes]));
                                }
                                break;
                            }
                            // 一些代理会把 base64 放到 output[0].data
                            if (obj.output && Array.isArray(obj.output) && obj.output[0]?.data) {
                                const outB64 = obj.output[0].data;
                                imageDataUrl = resolveBase64Image(outB64);
                                if (!imageDataUrl) {
                                    const raw = atob(outB64);
                                    const bytes = new Uint8Array(raw.length);
                                    for (let j = 0; j < raw.length; j++) bytes[j] = raw.charCodeAt(j);
                                    imageDataUrl = await extractPngFromZipBlob(new Blob([bytes]));
                                }
                                break;
                            }
                        } catch (e) {
                            // 非 JSON，当成原始 base64 尝试
                            if (payload.length > 100) {
                                imageDataUrl = resolveBase64Image(payload);
                                break;
                            }
                        }
                    }
                    
                    if (!imageDataUrl) {
                        // SSE 最终兜底：按二进制再次提取，兼容非标准代理返回
                        try {
                            const fallbackBlob = await responseClone.blob();
                            if (fallbackBlob.type && fallbackBlob.type.startsWith('image/')) {
                                imageDataUrl = await blobToDataUrl(fallbackBlob);
                            } else {
                                imageDataUrl = await extractPngFromZipBlob(fallbackBlob);
                            }
                        } catch (_) {}
                    }

                    if (!imageDataUrl) {
                        console.error('[NovelAI-AutoGen] SSE 响应中未找到图片数据');
                        if (debugThrow) throw new Error(`SSE未找到图片 | content-type=${contentType}`);
                        return null;
                    }
                    
                } else if (contentType.includes('application/json')) {
                    // JSON 响应（某些代理会返回 JSON 包裹的数据）
                    const jsonData = await response.json();
                    if (jsonData.output?.[0]?.url) {
                        imageDataUrl = jsonData.output[0].url;
                    } else if (jsonData.url) {
                        imageDataUrl = jsonData.url;
                    } else {
                        const b64 = jsonData.image || jsonData.data || jsonData.output?.[0]?.data;
                        if (b64) {
                            imageDataUrl = resolveBase64Image(b64);
                            if (!imageDataUrl) {
                                // 不是直接图片 base64，尝试按 zip base64 解码提图
                                try {
                                    const raw = atob(b64);
                                    const bytes = new Uint8Array(raw.length);
                                    for (let j = 0; j < raw.length; j++) bytes[j] = raw.charCodeAt(j);
                                    imageDataUrl = await extractPngFromZipBlob(new Blob([bytes]));
                                } catch (_) {}
                            }
                        }
                    }
                    if (!imageDataUrl) {
                        console.error('[NovelAI-AutoGen] JSON 响应中未找到图片');
                        if (debugThrow) throw new Error(`JSON未找到图片 | content-type=${contentType}`);
                        return null;
                    }
                    
                } else {
                    // 默认当 ZIP / 二进制 Blob 处理（V3 常见）
                    const blob = await response.blob();
                    if (blob.type && blob.type.startsWith('image/')) {
                        imageDataUrl = await blobToDataUrl(blob);
                    } else {
                        imageDataUrl = await extractPngFromZipBlob(blob);
                    }
                }
                
                if (imageDataUrl && /^https?:\/\//i.test(imageDataUrl)) {
                    // 参考你给的 pwa 逻辑：最终统一转成 blob/dataurl，避免 <img> 直链权限问题
                    try {
                        const imgRes = await fetch(imageDataUrl, {
                            headers: { 'Authorization': `Bearer ${apiKey}` }
                        });
                        if (imgRes.ok) {
                            const imgBlob = await imgRes.blob();
                            imageDataUrl = await blobToDataUrl(imgBlob);
                        }
                    } catch (_) {}
                }

                if (imageDataUrl) {
                    console.log(`[NovelAI-AutoGen] ✅ 图片生成成功`);
                }
                return imageDataUrl || null;
                
            } catch (err) {
                console.error('[NovelAI-AutoGen] 生成异常:', err);
                if (debugThrow) throw err;
                return null;
            }
        }
        
        // 用 LLM 将中文 imgcard 描述翻译成英文 NovelAI tag
        async function translateImgcardToEnglishTags(chineseDesc, charId) {
            try {
                // 获取角色信息，提取外貌/性别线索
                let charHint = '';
                if (charId) {
                    const char = await db.characters.get(charId);
                    if (char) {
                        const desc = (char.description || '').substring(0, 300);
                        charHint = `角色名: ${char.name}\n角色设定摘要: ${desc}`;
                    }
                }
                
                const sysPrompt = `你是一个 NovelAI 图像生成的 prompt 翻译专家。
用户会给你一段中文的图片描述（来自聊天中角色发送的图片），你需要将它转换为 NovelAI 风格的英文 tag。

规则：
1. 输出纯英文 tag，用逗号分隔，不要输出任何解释
2. 根据角色信息判断性别：男性用 1boy，女性用 1girl，不要搞错
3. 包含人物外貌特征（发色、发型、瞳色、体型等）、服装、表情、动作、场景
4. 使用 NovelAI/Danbooru 常用的 tag 风格（如 black hair, blue eyes, smile, sitting 等）
5. 不要加质量词（如 masterpiece, best quality），系统会自动添加
6. 只输出 tag，不要有其他内容`;

                const userMsg = charHint
                    ? `${charHint}\n\n图片描述: ${chineseDesc}`
                    : `图片描述: ${chineseDesc}`;
                
                const result = await callAI([
                    { role: 'system', content: sysPrompt },
                    { role: 'user', content: userMsg }
                ], { max_tokens: 200 });
                
                if (result && result.trim()) {
                    const tags = result.trim().replace(/^["']|["']$/g, '').replace(/\n/g, ', ');
                    console.log(`[NovelAI-AutoGen] 🔄 翻译结果: "${chineseDesc}" → "${tags}"`);
                    return tags;
                }
            } catch (err) {
                console.warn('[NovelAI-AutoGen] LLM 翻译失败，将直接使用原始描述:', err.message);
            }
            // 翻译失败回退：返回原始描述
            return chineseDesc;
        }
        
        /**
         * 视频通话 NovelAI 生图：将视频通话中角色的回复翻译成 NovelAI tag 并生成图片
         * @param {string} videoReplyText - 角色在视频通话中的回复文本
         * @param {number} charId - 角色ID
         * @returns {Promise<string|null>} - 生成的图片 DataURL，失败返回 null
         */
        async function generateVideoCallNovelAIImage(videoReplyText, charId) {
            try {
                // 1. 检查当前图片提供方是否配置完整
                const providerStatus = await getImageProviderStatus();
                if (!providerStatus.ready) {
                    console.log(`[VideoCall-Image] ${providerStatus.message}，跳过生图`);
                    return null;
                }

                // 2. 获取角色信息用于更精准的 tag 生成
                let charHint = '';
                if (charId) {
                    const char = await db.characters.get(charId);
                    if (char) {
                        const desc = (char.description || '').substring(0, 400);
                        charHint = `角色名: ${char.name}\n角色设定摘要: ${desc}`;
                    }
                }

                // 3. 用 LLM 将视频通话回复文本翻译为英文 NovelAI tag
                const sysPrompt = `你是一个 NovelAI 图像生成的 prompt 翻译专家。
用户会给你一段视频通话中角色的回复文本（包含动作描写和对话），你需要从中提取视觉信息并转换为 NovelAI 风格的英文 tag。

规则：
1. 输出纯英文 tag，用逗号分隔，不要输出任何解释
2. 根据角色信息**严格判断性别**：男性角色必须用 1boy，女性角色必须用 1girl，这是最重要的规则，绝对不能搞错！
3. 重点提取：表情（smile, blush, wink等）、动作（waving, peace sign, leaning forward等）、姿态、环境/背景
4. 包含人物外貌特征（发色、发型、瞳色、体型等）、服装
5. 场景标签：只加 looking at viewer, upper body 即可，表示面对镜头的半身像
6. **禁止**加入以下标签：smartphone, phone, screen, video call, pov, UI, button, icon, interface, device, frame —— 这些会导致画出手机界面
7. 使用 NovelAI/Danbooru 常用的 tag 风格
8. 不要加质量词（如 masterpiece, best quality），系统会自动添加
9. 只输出 tag，不要有其他内容
10. 总共不超过 30 个 tag`;

                const userMsg = charHint
                    ? `${charHint}\n\n视频通话回复内容: ${videoReplyText}`
                    : `视频通话回复内容: ${videoReplyText}`;

                let englishTags = videoReplyText;
                try {
                    const result = await callAI([
                        { role: 'system', content: sysPrompt },
                        { role: 'user', content: userMsg }
                    ], { max_tokens: 250 });

                    if (result && result.trim()) {
                        englishTags = result.trim().replace(/^["']|["']$/g, '').replace(/\n/g, ', ');
                        console.log(`[VideoCall-NovelAI] 🔄 Tag翻译: "${videoReplyText.substring(0, 50)}..." → "${englishTags}"`);
                    }
                } catch (translateErr) {
                    console.warn('[VideoCall-NovelAI] Tag翻译失败，使用原文:', translateErr.message);
                }

                // 4. 调用当前启用的图片提供方
                const imageDataUrl = await generateConfiguredImage(englishTags, { skipSystemPrompt: true });
                if (imageDataUrl) {
                    console.log('[VideoCall-NovelAI] ✅ 视频通话图片生成成功');
                }
                return imageDataUrl;

            } catch (err) {
                console.error('[VideoCall-NovelAI] 生成异常:', err);
                return null;
            }
        }

        /**
         * 在视频通话中更新角色背景图片（NovelAI 生图后调用）
         * @param {string} imageDataUrl - 生成的图片 DataURL
         */
        function updateVideoCallBackground(imageDataUrl) {
            const bgDiv = document.getElementById('video-call-bg');
            if (bgDiv && imageDataUrl) {
                // 使用渐变过渡效果更新背景
                bgDiv.style.transition = 'opacity 0.5s ease';
                bgDiv.style.opacity = '0.3';
                setTimeout(() => {
                    bgDiv.style.backgroundImage = `url(${imageDataUrl})`;
                    bgDiv.style.opacity = '1';
                }, 300);
                console.log('[VideoCall-NovelAI] 🖼️ 角色背景已更新');
            }
        }

        /**
         * 视频通话中处理 NovelAI 生图（在 AI 回复后调用）
         * 返回生成的图片 dataUrl，由调用方决定何时展示
         * @param {string} replyText - AI 回复的文本
         * @param {number} charId - 角色ID
         * @param {string} [preGeneratedTags] - 预生成的英文 NovelAI tags（如果有，跳过翻译步骤）
         * @returns {Promise<string|null>} 图片 dataUrl 或 null
         */
        async function processVideoCallNovelAI(replyText, charId, preGeneratedTags) {
            try {
                // 检查角色是否开启了视频通话 NovelAI 生图
                const char = await db.characters.get(charId);
                if (!char || !char.video_novelai_enabled) {
                    return null;
                }

                // 检查当前图片提供方是否配置完整
                const providerStatus = await getImageProviderStatus();
                if (!providerStatus.ready) {
                    console.log(`[VideoCall-Image] ${providerStatus.message}，跳过`);
                    return null;
                }

                console.log('[VideoCall-NovelAI] 🎬 开始为视频通话回复生成图片...');

                let imageDataUrl = null;
                
                if (preGeneratedTags && preGeneratedTags.trim()) {
                    // ✅ 使用 AI 主回复中一并生成的 tags，不再单独调用翻译 API
                    console.log(`[VideoCall-NovelAI] 🚀 使用预生成 tags: "${preGeneratedTags.substring(0, 80)}..."`);
                    imageDataUrl = await generateConfiguredImage(preGeneratedTags.trim(), { skipSystemPrompt: true });
                } else {
                    console.error('[VideoCall-NovelAI] ❌ 无预生成 tags，跳过生图');
                    return null;
                }

                if (imageDataUrl) {
                    console.log('[VideoCall-NovelAI] ✅ 视频通话图片生成成功');
                    return imageDataUrl;
                } else {
                    console.log('[VideoCall-NovelAI] 生图失败或返回空');
                    return null;
                }
            } catch (err) {
                console.error('[VideoCall-NovelAI] 处理异常:', err);
                return null;
            }
        }

        // 检查是否启用了 NovelAI 自动生图
        async function isNovelAIAutoGenerateEnabled() {
            try {
                const item = await db.dexiData.get('novelaiAutoGenerate');
                return item ? !!item.value : false;
            } catch (e) {
                return false;
            }
        }

        async function getImageProviderStatus() {
            if (await isGPTImageEnabled()) {
                const [urlItem, keyItem, modelItem] = await Promise.all([
                    db.dexiData.get('gptImageBaseUrl'),
                    db.dexiData.get('gptImageApiKey'),
                    db.dexiData.get('gptImageModel')
                ]);
                const ready = !!(urlItem?.value && keyItem?.value && modelItem?.value);
                return {
                    provider: 'gpt',
                    label: 'GPT',
                    ready,
                    message: ready ? '' : 'GPT 生图地址、密钥或模型未配置完整'
                };
            }
            const apiKeyItem = await db.dexiData.get('novelaiApiKey');
            const ready = !!apiKeyItem?.value;
            return {
                provider: 'novelai',
                label: 'NovelAI',
                ready,
                message: ready ? '' : 'NovelAI API Key 未配置'
            };
        }
        
        // 在 AI 回复完成后，检测所有 imgcard 消息并自动生成图片
        async function processImgCardsWithNovelAI(charId, accountId) {
            // 检查开关是否开启
            const enabled = await isNovelAIAutoGenerateEnabled();
            if (!enabled) {
                console.log('[NovelAI-AutoGen] 自动生图未开启，跳过');
                return;
            }
            
            // 检查当前图片提供方是否配置完整
            const providerStatus = await getImageProviderStatus();
            if (!providerStatus.ready) {
                console.log(`[Image-AutoGen] ${providerStatus.message}，跳过`);
                return;
            }
            
            const char = await db.characters.get(charId);
            if (!char) return;
            
            let history = getChatHistory(char, accountId);
            if (!history || history.length === 0) return;
            
            // 从最后往前找最近的 imgcard 消息（只检查最近一批 AI 消息，到遇到 user 消息为止）
            const imgcardMessages = [];
            for (let i = history.length - 1; i >= 0; i--) {
                const msg = history[i];
                if (msg.role === 'user') break; // 遇到用户消息就停止
                if (msg.role === 'char' && msg.content && msg.content.startsWith('[imgcard:') && !msg.novelai_generated) {
                    imgcardMessages.push({ index: i, msg: msg });
                }
            }
            
            if (imgcardMessages.length === 0) {
                console.log('[NovelAI-AutoGen] 未检测到需要生成的 imgcard 消息');
                return;
            }
            
            console.log(`[NovelAI-AutoGen] 检测到 ${imgcardMessages.length} 条 imgcard 消息，开始生成...`);
            
            for (const { index, msg } of imgcardMessages) {
                const rawCardText = msg.content.substring(9, msg.content.length - 1).trim();
                
                // 🔧 从 imgcard 内容中提取 AI 直接输出的英文 tags（格式：中文描述{{english,tags}}）
                let cardText = rawCardText;
                let englishTags = rawCardText;
                const tagsMatch = rawCardText.match(/\{\{(.+?)\}\}/);
                if (tagsMatch) {
                    // 提取 {{}} 内的英文 tags
                    englishTags = tagsMatch[1].trim();
                    // 剥离 {{}} 部分，保留纯中文描述用于UI显示
                    cardText = rawCardText.replace(/\s*\{\{.+?\}\}/, '').trim();
                    console.log(`[NovelAI-AutoGen] ✅ 使用 AI 内联 tags: "${cardText}" → "${englishTags}"`);
                } else {
                    // 🔧 兜底：检查历史记录中下一条消息是否是泄漏的 {{tags}}（AI有时把tags放在imgcard外面）
                    let foundNeighborTags = false;
                    if (index + 1 < history.length) {
                        const nextMsg = history[index + 1];
                        if (nextMsg && nextMsg.role === 'char' && nextMsg.content) {
                            const neighborTagsMatch = nextMsg.content.match(/^\s*\{\{([\s\S]+?)\}\}\s*$/);
                            if (neighborTagsMatch) {
                                englishTags = neighborTagsMatch[1].trim();
                                foundNeighborTags = true;
                                console.log(`[NovelAI-AutoGen] ✅ 从下一条消息获取泄漏的 tags: "${englishTags.substring(0, 60)}..."`);
                            }
                        }
                    }
                    if (!foundNeighborTags) {
                        console.log(`[NovelAI-AutoGen] ⚠️ 未找到内联 tags，直接使用原始描述: "${cardText}"`);
                    }
                }
                
                // 更新 UI 显示加载状态（如果当前正在查看该聊天）
                if (currentChatCharId === charId) {
                    const chatBody = document.getElementById('chat-body');
                    if (chatBody) {
                        const messageRows = chatBody.querySelectorAll('.message-row');
                        if (messageRows[index]) {
                            const imgBubble = messageRows[index].querySelector('.img-card-bubble');
                            if (imgBubble) {
                                imgBubble.innerHTML = `
                                    <div class="img-card-placeholder" style="position:relative;">
                                        <div style="display:flex; flex-direction:column; align-items:center; gap:6px;">
                                            <div class="novelai-loading-spinner" style="width:24px; height:24px; border:3px solid #e0e0e0; border-top-color:var(--deep-pink, #ff4081); border-radius:50%; animation:spin 0.8s linear infinite;"></div>
                                            <div class="img-card-hint" style="font-size:11px; color:#999;">${providerStatus.label} 生成中...</div>
                                        </div>
                                    </div>
                                `;
                                imgBubble.onclick = null; // 生成过程中禁用点击
                            }
                        }
                    }
                }
                
                // 调用当前启用的图片提供方
                const imageDataUrl = await generateConfiguredImage(englishTags);
                
                if (imageDataUrl) {
                    // 生成成功：更新历史记录中的消息
                    const freshChar = await db.characters.get(charId);
                    let freshHistory = getChatHistory(freshChar, accountId);
                    
                    if (freshHistory[index] && freshHistory[index].content === msg.content) {
                        // 保留原始 imgcard 内容（剥离{{tags}}），添加生成的图片
                        freshHistory[index].content = `[imgcard:${cardText}]`; // 清理掉 {{tags}}，只保留中文描述
                        freshHistory[index].novelai_generated = true;
                        freshHistory[index].novelai_image = imageDataUrl;
                        freshHistory[index].novelai_description = cardText;
                        
                        // 🔧 清理泄漏的 {{tags}} 消息（如果下一条消息是纯 {{...}} 标签则删除）
                        if (index + 1 < freshHistory.length) {
                            const nextMsg = freshHistory[index + 1];
                            if (nextMsg && nextMsg.role === 'char' && nextMsg.content && /^\s*\{\{[\s\S]+?\}\}\s*$/.test(nextMsg.content)) {
                                freshHistory.splice(index + 1, 1);
                                console.log(`[NovelAI-AutoGen] 🧹 已清理泄漏的 {{tags}} 消息 (index: ${index + 1})`);
                            }
                        }
                        
                        await setChatHistory(freshChar, accountId, freshHistory);
                        
                        console.log(`[NovelAI-AutoGen] ✅ 图片已保存到历史记录 (index: ${index})`);
                    }
                } else {
                    // 生成失败
                    console.warn(`[NovelAI-AutoGen] ❌ 图片生成失败: "${cardText}"`);
                }
            }
            
            // 🔧 所有 imgcard 处理完成后，统一刷新 UI（比逐个 DOM 操作更可靠）
            if (currentChatCharId === charId) {
                const freshCharFinal = await db.characters.get(charId);
                if (freshCharFinal) {
                    renderChatBody(freshCharFinal);
                }
            }
            
            console.log(`[NovelAI-AutoGen] 🎉 所有 imgcard 处理完成`);
        }

        // 🔧 群聊版 NovelAI 自动生图：扫描群聊历史中的 imgcard 消息并生成图片
        async function processGroupImgCardsWithNovelAI(groupId) {
            // 检查开关是否开启
            const enabled = await isNovelAIAutoGenerateEnabled();
            if (!enabled) {
                console.log('[NovelAI-GroupGen] 自动生图未开启，跳过');
                return;
            }
            
            // 检查当前图片提供方是否配置完整
            const providerStatus = await getImageProviderStatus();
            if (!providerStatus.ready) {
                console.log(`[Image-GroupGen] ${providerStatus.message}，跳过`);
                return;
            }
            
            const group = await getCachedGroupChat(groupId);
            if (!group || !group.chat_history || group.chat_history.length === 0) return;
            
            const history = group.chat_history;
            
            // 从最后往前找最近的 imgcard 消息（只检查最近一批角色消息，到遇到 user 消息为止）
            const imgcardMessages = [];
            for (let i = history.length - 1; i >= 0; i--) {
                const msg = history[i];
                if (msg.role === 'user') break; // 遇到用户消息就停止
                if (msg.role === 'char' && msg.content && msg.content.startsWith('[imgcard:') && !msg.novelai_generated) {
                    imgcardMessages.push({ index: i, msg: msg });
                }
            }
            
            if (imgcardMessages.length === 0) {
                console.log('[NovelAI-GroupGen] 未检测到需要生成的 imgcard 消息');
                return;
            }
            
            console.log(`[NovelAI-GroupGen] 检测到 ${imgcardMessages.length} 条群聊 imgcard 消息，开始生成...`);
            
            for (const { index, msg } of imgcardMessages) {
                const rawCardText = msg.content.substring(9, msg.content.length - 1).trim();
                
                // 从 imgcard 内容中提取 AI 直接输出的英文 tags（格式：中文描述{{english,tags}}）
                let cardText = rawCardText;
                let englishTags = rawCardText;
                const tagsMatch = rawCardText.match(/\{\{(.+?)\}\}/);
                if (tagsMatch) {
                    englishTags = tagsMatch[1].trim();
                    cardText = rawCardText.replace(/\s*\{\{.+?\}\}/, '').trim();
                    console.log(`[NovelAI-GroupGen] ✅ 使用 AI 内联 tags: "${cardText}" → "${englishTags}"`);
                } else {
                    // 兜底：检查历史记录中下一条消息是否是泄漏的 {{tags}}
                    let foundNeighborTags = false;
                    if (index + 1 < history.length) {
                        const nextMsg = history[index + 1];
                        if (nextMsg && nextMsg.role === 'char' && nextMsg.content) {
                            const neighborTagsMatch = nextMsg.content.match(/^\s*\{\{([\s\S]+?)\}\}\s*$/);
                            if (neighborTagsMatch) {
                                englishTags = neighborTagsMatch[1].trim();
                                foundNeighborTags = true;
                                console.log(`[NovelAI-GroupGen] ✅ 从下一条消息获取泄漏的 tags: "${englishTags.substring(0, 60)}..."`);
                            }
                        }
                    }
                    if (!foundNeighborTags) {
                        console.log(`[NovelAI-GroupGen] ⚠️ 未找到内联 tags，直接使用原始描述: "${cardText}"`);
                    }
                }
                
                // 更新 UI 显示加载状态（如果当前正在查看该群聊）
                if (window.currentGroupChatId === groupId) {
                    const chatBody = document.getElementById('chat-body');
                    if (chatBody) {
                        // 找到对应的 imgcard 气泡并显示加载状态
                        const allMsgRows = chatBody.querySelectorAll('.group-message-row');
                        for (const row of allMsgRows) {
                            const imgBubble = row.querySelector('.img-card-bubble');
                            if (imgBubble && imgBubble.dataset.text === cardText) {
                                imgBubble.innerHTML = `
                                    <div class="img-card-placeholder" style="position:relative;">
                                        <div style="display:flex; flex-direction:column; align-items:center; gap:6px;">
                                            <div class="novelai-loading-spinner" style="width:24px; height:24px; border:3px solid #e0e0e0; border-top-color:var(--deep-pink, #ff4081); border-radius:50%; animation:spin 0.8s linear infinite;"></div>
                                            <div class="img-card-hint" style="font-size:11px; color:#999;">${providerStatus.label} 生成中...</div>
                                        </div>
                                    </div>
                                `;
                                imgBubble.onclick = null;
                                break;
                            }
                        }
                    }
                }
                
                // 调用当前启用的图片提供方
                const imageDataUrl = await generateConfiguredImage(englishTags);
                
                if (imageDataUrl) {
                    // 生成成功：更新群聊历史记录中的消息
                    const freshGroup = await getCachedGroupChat(groupId);
                    if (freshGroup && freshGroup.chat_history && freshGroup.chat_history[index]) {
                        freshGroup.chat_history[index].content = `[imgcard:${cardText}]`; // 清理掉 {{tags}}
                        freshGroup.chat_history[index].novelai_generated = true;
                        freshGroup.chat_history[index].novelai_image = imageDataUrl;
                        freshGroup.chat_history[index].novelai_description = cardText;
                        
                        // 清理泄漏的 {{tags}} 消息
                        if (index + 1 < freshGroup.chat_history.length) {
                            const nextMsg = freshGroup.chat_history[index + 1];
                            if (nextMsg && nextMsg.role === 'char' && nextMsg.content && /^\s*\{\{[\s\S]+?\}\}\s*$/.test(nextMsg.content)) {
                                freshGroup.chat_history.splice(index + 1, 1);
                                console.log(`[NovelAI-GroupGen] 🧹 已清理泄漏的 {{tags}} 消息 (index: ${index + 1})`);
                            }
                        }
                        
                        await safeGroupChatPut(freshGroup);
                        console.log(`[NovelAI-GroupGen] ✅ 图片已保存到群聊历史记录 (index: ${index})`);
                    }
                } else {
                    console.warn(`[NovelAI-GroupGen] ❌ 图片生成失败: "${cardText}"`);
                }
            }
            
            // 所有 imgcard 处理完成后，统一刷新 UI
            if (window.currentGroupChatId === groupId) {
                const freshGroupFinal = await getCachedGroupChat(groupId);
                if (freshGroupFinal) {
                    await renderGroupChatBody(freshGroupFinal);
                }
            }
            
            console.log(`[NovelAI-GroupGen] 🎉 所有群聊 imgcard 处理完成`);
        }

        // 构造智能 URL (自动补全 /v1)
        function getSmartUrl(baseUrl, endpoint) {
            let url = baseUrl;
            if (url.endsWith('/')) url = url.slice(0, -1);
            // 如果用户没有写 /v1，且不是直接请求完整路径，自动补全 /v1
            if (!url.includes('/v1')) {
                url += '/v1';
            }
            return url + endpoint;
        }

        // 拉取模型列表
        async function fetchModels() {
            const url = document.getElementById('ai-url-input').value.trim();
            const key = document.getElementById('ai-key-input').value.trim();
            
            if (!url) {
                alert("请先填写API地址");
                return;
            }

            const spinner = document.getElementById('fetch-spinner');
            const btnText = document.getElementById('fetch-text');
            spinner.style.display = 'inline-block';
            btnText.style.display = 'none';
            
            // 构造请求 URL: 自动补全 /v1/models
            const requestUrl = getSmartUrl(url, '/models');

            try {
                const res = await fetch(requestUrl, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${key}`,
                        'Content-Type': 'application/json'
                    }
                });
                
                if (!res.ok) {
                    throw new Error(`HTTP Error ${res.status}`);
                }
                
                const data = await res.json();
                let models = [];
                if (Array.isArray(data)) {
                    models = data;
                } else if (data.data && Array.isArray(data.data)) {
                    models = data.data;
                }
                
                const select = document.getElementById('ai-model-select');
                select.innerHTML = '<option value="" disabled selected>请选择模型</option>';
                models.forEach(m => {
                    const opt = document.createElement('option');
                    opt.value = m.id;
                    opt.text = m.id;
                    select.appendChild(opt);
                });
                
                await db.dexiData.put({ key: 'aiModelList', value: JSON.stringify(models) });
                alert(`成功获取 ${models.length} 个模型！`);
                
            } catch (err) {
                console.error(err);
                alert(`拉取失败: ${err.message}\n尝试请求: ${requestUrl}`);
            } finally {
                spinner.style.display = 'none';
                btnText.style.display = 'inline';
            }
        }

        // 测试连接
        async function testConnection() {
            const url = document.getElementById('ai-url-input').value.trim();
            const key = document.getElementById('ai-key-input').value.trim();
            const model = document.getElementById('ai-model-select').value;
            
            if (!url || !model) {
                alert("请先完善配置并选择模型");
                return;
            }

            const btn = document.querySelector('.test-btn');
            const originalText = document.getElementById('test-btn-text').innerText;
            document.getElementById('test-btn-text').innerText = "测试中...";
            btn.style.opacity = "0.7";

            // 构造简单的 Chat 请求
            const requestUrl = getSmartUrl(url, '/chat/completions');
            
            try {
                const res = await fetch(requestUrl, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${key}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        model: model,
                        messages: [{ role: "user", content: "Hi" }],
                        max_tokens: 5
                    })
                });

                if (res.ok) {
                    alert("✅ 连接成功！API 配置有效。");
                } else {
                    const errText = await res.text();
                    alert(`❌ 连接失败 (${res.status}):\n${errText}`);
                }
            } catch (e) {
                alert(`❌ 网络错误: ${e.message}`);
            } finally {
                document.getElementById('test-btn-text').innerText = originalText;
                btn.style.opacity = "1";
            }
        }

// ===== Section D: 联机设置面板 =====
// 切换联机设置面板
function toggleOnlineSettings() {
    const body = document.getElementById('online-setting-body');
    const arrow = document.getElementById('online-setting-arrow');
    if (body.style.display === 'none') {
        body.style.display = 'block';
        arrow.textContent = '▲';
        loadOnlineSettings();
    } else {
        body.style.display = 'none';
        arrow.textContent = '▼';
    }
}

// ✅ 自动初始化联机系统（页面加载时调用）
async function initOnlineSystem() {
    const serverUrl = localStorage.getItem('online_server_url') || '';
    
    // 加载已保存的token
    onlineToken = localStorage.getItem('online_token');
    const savedUserData = localStorage.getItem('online_user_data');
    if (savedUserData) {
        try {
            onlineUserData = JSON.parse(savedUserData);
        } catch (e) {
            onlineUserData = null;
        }
    }
    
    // 启动自动同步定时器
    startAutoSync();
    
    // 如果有服务器地址，自动连接
    if (serverUrl) {
        console.log('[Online] 自动连接服务器:', serverUrl);
        try {
            await connectToOnlineServer();
            console.log('[Online] 服务器连接成功');
        } catch (e) {
            console.warn('[Online] 自动连接失败:', e.message);
        }
    }
}

// 加载联机设置（打开设置面板时调用）
function loadOnlineSettings() {
    const serverUrl = localStorage.getItem('online_server_url') || '';
    const serverUrlInput = document.getElementById('online-server-url');
    if (serverUrlInput) {
        serverUrlInput.value = serverUrl;
    }
    
    updateOnlineStatus();
}

// 保存联机设置
function saveOnlineSettings() {
    const serverUrl = document.getElementById('online-server-url').value.trim();
    localStorage.setItem('online_server_url', serverUrl);
}
