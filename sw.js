// Service Worker - 纯前端 PWA 版本
// 用于离线缓存和 PWA 功能，不依赖后端推送

console.log('[SW] Service Worker loaded (纯前端模式)');

// 缓存名称（更新版本号以触发CDN资源缓存）
const CACHE_NAME = 'ins-desktop-v7';

// 需要缓存的资源
const CACHE_URLS = [
    './',
    './index.html',
    './style.css',
    './script.js',
    './manifest.json'
];

// 🔧 关键CDN资源：这些资源在fetch时会被自动缓存，离线时可用
const CRITICAL_CDN_PATTERNS = [
    'dexie',
    'jszip',
    'sortablejs',
    'font-awesome'
];

// 安装：预缓存资源
self.addEventListener('install', (event) => {
    console.log('[SW] Installing...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('[SW] Caching app shell');
                return cache.addAll(CACHE_URLS).catch(err => {
                    console.log('[SW] Cache failed for some resources:', err);
                });
            })
    );
    self.skipWaiting();
});

// 激活：清理旧缓存
self.addEventListener('activate', (event) => {
    console.log('[SW] Activated');
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.filter(name => name !== CACHE_NAME)
                    .map(name => caches.delete(name))
            );
        }).then(() => clients.claim())
    );
});

// 请求拦截：CDN资源缓存优先，其他资源网络优先
self.addEventListener('fetch', (event) => {
    // 跳过非 GET 请求和 API 请求
    if (event.request.method !== 'GET') return;
    if (event.request.url.includes('/api/')) return;
    
    const url = event.request.url;
    
    // 🔧 关键CDN资源使用「缓存优先」策略（版本锁定的CDN资源内容不变，优先用缓存，加载更快更稳定）
    const isCriticalCDN = CRITICAL_CDN_PATTERNS.some(pattern => url.includes(pattern));
    
    if (isCriticalCDN) {
        // 缓存优先：先查缓存，命中则直接返回；未命中则网络请求并缓存
        event.respondWith(
            caches.match(event.request).then(cached => {
                if (cached) {
                    console.log('[SW] CDN缓存命中:', url.split('/').pop());
                    return cached;
                }
                return fetch(event.request).then(response => {
                    if (response.status === 200) {
                        const responseClone = response.clone();
                        caches.open(CACHE_NAME).then(cache => {
                            cache.put(event.request, responseClone);
                            console.log('[SW] CDN资源已缓存:', url.split('/').pop());
                        });
                    }
                    return response;
                }).catch(() => {
                    console.warn('[SW] CDN资源请求失败且无缓存:', url);
                    return new Response('', { status: 503 });
                });
            })
        );
        return;
    }
    
    // 其他资源：网络优先，失败时使用缓存
    event.respondWith(
        fetch(event.request)
            .then(response => {
                // 缓存成功的响应
                if (response.status === 200) {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, responseClone);
                    });
                }
                return response;
            })
            .catch(() => {
                // 网络失败时使用缓存
                return caches.match(event.request);
            })
    );
});

// 点击通知（本地通知点击处理）
self.addEventListener('notificationclick', (event) => {
    console.log('[SW] Notification clicked');
    event.notification.close();
    
    // 打开或聚焦应用
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((clientList) => {
                // 先尝试聚焦已有窗口
                for (let client of clientList) {
                    if ('focus' in client) {
                        return client.focus();
                    }
                }
                // 否则打开新窗口
                if (clients.openWindow) {
                    return clients.openWindow('./');
                }
            })
    );
});

console.log('[SW] Ready (纯前端 PWA 模式)');

