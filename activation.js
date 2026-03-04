/**
 * 前端激活码验证模块（独立文件）
 * 
 * 功能：
 * 1. 页面加载时检查本地是否已激活
 * 2. 如果本地有缓存，联网验证该激活码是否仍然有效（防止被新码替代）
 * 3. 未激活或已失效则弹出全屏激活码输入界面，阻止使用
 * 4. 激活成功后保存到 localStorage
 * 
 * 使用方式：在 index.html 中引入（必须在其他脚本之前）
 *   <link rel="stylesheet" href="activation.css">
 *   <script src="activation.js"></script>
 */

(function () {
    'use strict';

    // ==================== 配置（只需要改这里）====================
    
    // ★ 你的后端服务器地址（就是 server.js 部署的那个地址）
    // 如果前端和后端在同一个域名下，留空字符串 '' 即可
    // 如果不同域名，填完整地址，如 'https://xxx.zeabur.app' （末尾不要加 /）
    const SERVER_URL = 'https://27131.zeabur.app';
    
    // 拼接出完整的 API 地址（你不用管这行）
    const VERIFY_API = SERVER_URL + '/api/activation/verify';
    
    // localStorage 存储键名
    const STORAGE_KEY = 'activation_verified';
    const STORAGE_CODE_KEY = 'activation_code';
    const DEVICE_ID_KEY = 'activation_device_id';
    
    // ==================== 工具函数 ====================
    
    /**
     * 生成或获取设备唯一ID（确保每个浏览器实例都有唯一标识）
     * 使用UUID v4格式，存储在localStorage中，确保同一浏览器实例总是使用同一个ID
     * 
     * 安全性说明：
     * 1. UUID存储在localStorage，用户可以清除，但清除后需要重新激活
     * 2. 即使复制UUID到其他设备，由于结合了浏览器特征，也无法通过验证
     * 3. 真正的安全防护在后端，前端只是辅助验证
     */
    function getOrCreateDeviceId() {
        try {
            let deviceId = localStorage.getItem(DEVICE_ID_KEY);
            if (deviceId && deviceId.length > 0) {
                // 验证UUID格式（基本格式检查）
                if (/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(deviceId)) {
                    return deviceId;
                }
                // 如果格式不对，清除并重新生成
                localStorage.removeItem(DEVICE_ID_KEY);
            }
            
            // 生成UUID v4（简化版，不依赖外部库）
            // 格式：xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
            function generateUUID() {
                return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                    const r = Math.random() * 16 | 0;
                    const v = c === 'x' ? r : (r & 0x3 | 0x8);
                    return v.toString(16);
                });
            }
            
            deviceId = generateUUID();
            localStorage.setItem(DEVICE_ID_KEY, deviceId);
            return deviceId;
        } catch (e) {
            // 如果localStorage不可用，使用时间戳+随机数作为后备方案
            // 注意：这个后备方案不够安全，但至少能工作
            return 'fallback-' + Date.now() + '-' + Math.random().toString(36).substring(2, 15);
        }
    }
    
    /**
     * 生成设备指纹（结合设备ID和浏览器特征，确保唯一性）
     * 设备ID确保每个浏览器实例唯一，浏览器特征用于额外验证
     * 
     * 兼容性：根据激活时使用的格式来决定验证时使用的格式
     * 确保验证时使用的格式与激活时完全一致，避免刷新后验证失败
     */
    function generateDeviceFingerprint() {
        // 检查是否有激活记录，以及激活时使用的格式
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            if (data) {
                const parsed = JSON.parse(data);
                // 如果激活时使用的是旧格式（没有记录useNewFormat或为false）
                if (!parsed.useNewFormat) {
                    // 使用旧格式（仅User-Agent），与激活时保持一致
                    return (navigator.userAgent || '').substring(0, 200);
                }
                // 如果激活时使用的是新格式，继续使用新格式
            }
        } catch (e) {
            // 解析失败，检查是否有UUID来决定格式
            // 如果没有UUID，可能是旧用户，使用旧格式
            const hasDeviceId = localStorage.getItem(DEVICE_ID_KEY);
            if (!hasDeviceId) {
                return (navigator.userAgent || '').substring(0, 200);
            }
        }
        
        // 新格式：使用UUID + 浏览器特征
        const deviceId = getOrCreateDeviceId();
        const parts = [
            deviceId,
            navigator.userAgent || '',
            navigator.language || '',
            navigator.platform || '',
            screen.width + 'x' + screen.height,
            new Date().getTimezoneOffset().toString(),
            navigator.hardwareConcurrency || '',
            navigator.deviceMemory || ''
        ];
        // 组合所有特征，确保唯一性
        const fingerprint = parts.join('|');
        // 截取前255个字符（数据库字段限制）
        return fingerprint.substring(0, 255);
    }
    
    /**
     * 生成新格式的设备指纹（用于新激活）
     */
    function generateNewDeviceFingerprint() {
        const deviceId = getOrCreateDeviceId();
        const parts = [
            deviceId,
            navigator.userAgent || '',
            navigator.language || '',
            navigator.platform || '',
            screen.width + 'x' + screen.height,
            new Date().getTimezoneOffset().toString(),
            navigator.hardwareConcurrency || '',
            navigator.deviceMemory || ''
        ];
        const fingerprint = parts.join('|');
        return fingerprint.substring(0, 255);
    }
    
    function getStoredCode() {
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            if (!data) return null;
            const parsed = JSON.parse(data);
            if (parsed && parsed.activated === true && parsed.code) {
                return parsed.code;
            }
            return null;
        } catch (e) {
            return null;
        }
    }
    
    function saveActivation(code, qq) {
        // 记录激活时使用的设备指纹格式（是否有UUID）
        const hasDeviceId = !!localStorage.getItem(DEVICE_ID_KEY);
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            activated: true,
            code: code,
            qq: qq || null,
            time: Date.now(),
            useNewFormat: hasDeviceId  // 记录是否使用新格式
        }));
        localStorage.setItem(STORAGE_CODE_KEY, code);
    }
    
    function clearActivation() {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(STORAGE_CODE_KEY);
    }
    
    // ==================== 主逻辑 ====================
    
    const storedCode = getStoredCode();
    
    if (storedCode) {
        // 本地有缓存，联网验证是否还有效
        console.log('[激活码] 本地有缓存，联网验证中...');
        onlineVerify(storedCode);
    } else {
        // 没有缓存，直接显示激活界面
        console.log('[激活码] 未激活，显示激活界面');
        showActivationUI();
    }
    
    // ==================== 联网验证已缓存的激活码 ====================
    
    function onlineVerify(code) {
        fetch(VERIFY_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: code, device: generateDeviceFingerprint() })
        })
        .then(r => r.json())
        .then(result => {
            if (result.success) {
                console.log('[激活码] 在线验证通过，放行');
                // 码还有效，不做任何事
            } else {
                // 码已失效（被新码替代、被禁用、已过期等）
                console.log('[激活码] 码已失效:', result.message);
                clearActivation();
                showActivationUI();
            }
        })
        .catch(err => {
            // 网络错误时，仍然放行（避免服务器挂了用户就用不了）
            console.warn('[激活码] 在线验证网络错误，暂时放行:', err.message);
        });
    }
    
    // ==================== 显示激活码输入界面 ====================
    
    function showActivationUI() {
        // 创建遮罩层（阻止操作页面）
        const overlay = document.createElement('div');
        overlay.id = 'activation-overlay';
        
        overlay.innerHTML = `
            <div class="activation-card">
                <div class="activation-icon">
                    <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                    </svg>
                </div>
                <h2 class="activation-title">请输入激活码</h2>
                <div class="activation-divider">
                    <span class="activation-divider-dot"></span>
                </div>
                <p class="activation-desc">输入激活码以解锁使用</p>
                <div class="activation-input-wrap">
                    <input 
                        type="text" 
                        id="activation-code-input" 
                        class="activation-input" 
                        placeholder="XXXX-XXXX-XXXX-XXXX" 
                        maxlength="19"
                        autocomplete="off"
                        spellcheck="false"
                    >
                </div>
                <button id="activation-submit-btn" class="activation-btn">验 证</button>
                <div id="activation-message" class="activation-message"></div>
                <p class="activation-hint">激活码请去群聊私信唧唧人 指令"获取激活码"</p>
            </div>
        `;
        
        // 等 DOM 就绪后插入
        function mountOverlay() {
            document.body.appendChild(overlay);
            
            const input = document.getElementById('activation-code-input');
            const btn = document.getElementById('activation-submit-btn');
            const msg = document.getElementById('activation-message');
            
            // 自动格式化输入（每4位加横杠）
            input.addEventListener('input', function () {
                let val = this.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
                if (val.length > 16) val = val.substring(0, 16);
                let formatted = val.replace(/(.{4})/g, '$1-');
                if (formatted.endsWith('-')) formatted = formatted.slice(0, -1);
                this.value = formatted;
            });
            
            // 回车提交
            input.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    doVerify();
                }
            });
            
            // 点击按钮提交
            btn.addEventListener('click', doVerify);
            
            // 自动聚焦
            setTimeout(() => input.focus(), 300);
            
            // 验证逻辑
            async function doVerify() {
                const code = input.value.trim();
                if (!code) {
                    showMsg('请输入激活码', 'error');
                    shakeInput();
                    return;
                }
                
                btn.disabled = true;
                btn.textContent = '验证中...';
                msg.textContent = '';
                msg.className = 'activation-message';
                
                try {
                    // 新激活时使用新格式的设备指纹
                    const device = generateNewDeviceFingerprint();
                    
                    const response = await fetch(VERIFY_API, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ code: code, device: device })
                    });
                    
                    const result = await response.json();
                    
                    if (result.success) {
                        showMsg('✅ ' + (result.message || '激活成功！'), 'success');
                        saveActivation(code, result.qq);
                        
                        const card = overlay.querySelector('.activation-card');
                        card.style.transform = 'scale(0.8)';
                        card.style.opacity = '0';
                        overlay.style.opacity = '0';
                        
                        setTimeout(() => {
                            overlay.remove();
                        }, 500);
                    } else {
                        showMsg('❌ ' + (result.message || '激活码无效'), 'error');
                        shakeInput();
                        btn.disabled = false;
                        btn.textContent = '验 证';
                    }
                    
                } catch (error) {
                    console.error('[激活码] 验证请求失败:', error);
                    showMsg('❌ 网络错误，请检查服务器连接', 'error');
                    btn.disabled = false;
                    btn.textContent = '验 证';
                }
            }
            
            function showMsg(text, type) {
                msg.textContent = text;
                msg.className = 'activation-message ' + (type || '');
            }
            
            function shakeInput() {
                input.classList.add('shake');
                setTimeout(() => input.classList.remove('shake'), 500);
            }
        }
        
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', mountOverlay);
        } else {
            mountOverlay();
        }
    }
    
})();
