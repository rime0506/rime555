// ================== 闲鱼 App JS ==================
// 本文件包含闲鱼二手市场（#xianyu*）的所有 JS 逻辑
// 依赖：showToast, callAI 等全局变量（来自 script.js）
// ==================== 闲鱼App Logic ====================

const xianyuDb = new Dexie('XianyuDB_Internal');

xianyuDb.version(3).stores({
    goods: '++id, title, price, category, collected, viewCount, wantCount, createdAt, userId, sold, bought, originalPrice, sellerId',
    collections: '++id, goodsId, goodsTitle, goodsPrice, goodsCategory, collectedAt, userId',
    messages: '++id, goodsId, content, sender, createdAt, userId, senderId, role',
    chatSessions: '++id, goodsId, lastMessage, updatedAt, userId',
    users: '++id, username, avatar, createdAt, userId, role, blockedUsers',
    orders: '++id, goodsId, goodsTitle, goodsPrice, type, createdAt, userId',
    characters: '++id, userId, role, personality, worldView, createdAt'
});

// 版本4：清除旧的默认商品数据
xianyuDb.version(4).stores({
    goods: '++id, title, price, category, collected, viewCount, wantCount, createdAt, userId, sold, bought, originalPrice, sellerId',
    collections: '++id, goodsId, goodsTitle, goodsPrice, goodsCategory, collectedAt, userId',
    messages: '++id, goodsId, content, sender, createdAt, userId, senderId, role',
    chatSessions: '++id, goodsId, lastMessage, updatedAt, userId',
    users: '++id, username, avatar, createdAt, userId, role, blockedUsers',
    orders: '++id, goodsId, goodsTitle, goodsPrice, type, createdAt, userId',
    characters: '++id, userId, role, personality, worldView, createdAt'
}).upgrade(tx => {
    // 清除旧版本的默认商品、订单、用户数据
    tx.table('goods').clear();
    tx.table('orders').clear();
    tx.table('users').clear();
    tx.table('collections').clear();
    tx.table('messages').clear();
    tx.table('chatSessions').clear();
    tx.table('characters').clear();
});

// 闲鱼当前账号ID（从WeChat账号选择中获取，用于数据隔离）
let XY_CURRENT_USER_ID = null;
window.xianyuCurrentAccountId = null;
window.xianyuCurrentAccountName = '';

const XianyuAppState = {
    currentPage: 'xyHomePage',
    currentTab: 'xy-tab-home',
    currentGoods: null,
    pageHistory: [],
    
    navigateTo(pageId, tabId = null, addToHistory = true) {
        document.querySelectorAll('#xianyuAppPage .xy-page').forEach(page => {
            page.classList.remove('active');
        });
        
        const targetPage = document.getElementById(pageId);
        if (targetPage) {
            targetPage.classList.add('active');
            this.currentPage = pageId;
            
            if (addToHistory && pageId !== 'xyHomePage' && !this.pageHistory.includes(pageId)) {
                this.pageHistory.push(pageId);
            }
        }
        
        // 聊天页和详情页隐藏底部导航栏
        const tabBar = document.querySelector('#xyMainContent .xy-tab-bar');
        if (tabBar) {
            const hideTabPages = ['xyChatPage', 'xyDetailPage'];
            tabBar.style.display = hideTabPages.includes(pageId) ? 'none' : 'flex';
        }
        
        if (tabId) {
            this.updateTabBar(tabId);
        } else {
            const tabMap = {
                'xyHomePage': 'xy-tab-home',
                'xyDetailPage': 'xy-tab-home',
                'xyMessageListPage': 'xy-tab-message',
                'xyChatPage': 'xy-tab-message',
                'xyMyPage': 'xy-tab-mine',
                'xyMyGoodsPage': 'xy-tab-mine',
                'xyMySoldPage': 'xy-tab-mine',
                'xyMyBoughtPage': 'xy-tab-mine',
                'xyMyCollectionsPage': 'xy-tab-mine'
            };
            this.updateTabBar(tabMap[pageId] || 'xy-tab-home');
        }
        
        if (pageId === 'xyHomePage') {
            xianyuLoadGoods();
        } else if (pageId === 'xyChatPage' && this.currentGoods) {
            xianyuLoadChatMessages(this.currentGoods.id);
        } else if (pageId === 'xyMessageListPage') {
            xianyuLoadMessageList();
        } else if (pageId === 'xyMyPage') {
            xianyuLoadMyPageData();
        } else if (pageId === 'xyMyGoodsPage') {
            xianyuLoadMyGoods();
        } else if (pageId === 'xyMySoldPage') {
            xianyuLoadMySold();
        } else if (pageId === 'xyMyBoughtPage') {
            xianyuLoadMyBought();
        } else if (pageId === 'xyMyCollectionsPage') {
            xianyuLoadMyCollections();
        }
    },
    
    updateTabBar(tabId) {
        document.querySelectorAll('#xianyuAppPage .xy-tab-item').forEach(tab => {
            tab.classList.remove('active');
        });
        
        const targetTab = document.getElementById(tabId);
        if (targetTab) {
            targetTab.classList.add('active');
            this.currentTab = tabId;
        }
    },
    
    goBack() {
        if (this.pageHistory.length > 0) {
            this.pageHistory.pop();
            if (this.pageHistory.length > 0) {
                const previousPage = this.pageHistory[this.pageHistory.length - 1];
                this.navigateTo(previousPage, null, false);
            } else {
                this.navigateTo('xyHomePage', 'xy-tab-home', false);
            }
        } else {
            this.navigateTo('xyHomePage', 'xy-tab-home', false);
        }
    },
    
    goBackToMyPage() {
        this.navigateTo('xyMyPage', 'xy-tab-mine', false);
    },
    
    switchTab(pageId, tabId) {
        this.navigateTo(pageId, tabId, false);
    }
};

async function xianyuInitializeUser() {
    if (!XY_CURRENT_USER_ID) return;
    // 检查当前账号是否已有闲鱼用户记录
    const existingUser = await xianyuDb.users.get(XY_CURRENT_USER_ID);
    if (!existingUser) {
        // 从WeChat角色获取账号信息
        let username = window.xianyuCurrentAccountName || '用户';
        let avatar = 'fa-user';
        try {
            const accountChar = await db.characters.get(XY_CURRENT_USER_ID);
            if (accountChar) {
                username = accountChar.nick || accountChar.name || '用户';
            }
        } catch(e) {}
        await xianyuDb.users.add({
            id: XY_CURRENT_USER_ID,
            username: username,
            avatar: avatar,
            createdAt: new Date()
        });
    }
    xianyuLoadUserInfo();
}

async function xianyuLoadUserInfo() {
    if (!XY_CURRENT_USER_ID) return;
    const user = await xianyuDb.users.get(XY_CURRENT_USER_ID);
    if (user) {
        const nameEl = document.getElementById('xyUserName');
        const avatarEl = document.getElementById('xyUserAvatar');
        if (nameEl) nameEl.textContent = user.username;
        if (avatarEl) {
            // 尝试显示WeChat账号头像
            try {
                const accountChar = await db.characters.get(XY_CURRENT_USER_ID);
                if (accountChar && accountChar.avatar) {
                    avatarEl.innerHTML = `<img src="${accountChar.avatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
                } else {
                    avatarEl.innerHTML = `<i class="fa ${user.avatar}"></i>`;
                }
            } catch(e) {
                avatarEl.innerHTML = `<i class="fa ${user.avatar}"></i>`;
            }
        }
    }
    await xianyuUpdateMyPageStats();
}

async function xianyuUpdateMyPageStats() {
    if (!XY_CURRENT_USER_ID) return;
    const myGoodsCount = await xianyuDb.goods.where('userId').equals(XY_CURRENT_USER_ID).count();
    const el1 = document.getElementById('xyMyGoodsCount');
    if (el1) el1.textContent = myGoodsCount;
    
    const mySoldCount = await xianyuDb.goods.where('userId').equals(XY_CURRENT_USER_ID).filter(g => g.sold === 1).count();
    const el2 = document.getElementById('xyMySoldCount');
    if (el2) el2.textContent = mySoldCount;
    
    const myBoughtCount = await xianyuDb.orders.where('userId').equals(XY_CURRENT_USER_ID).filter(o => o.type === 'buy').count();
    const el3 = document.getElementById('xyMyBoughtCount');
    if (el3) el3.textContent = myBoughtCount;
}

function xianyuShowDataStatus(message) {
    const statusEl = document.getElementById('xyDataStatus');
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.style.display = 'block';
    setTimeout(() => {
        statusEl.style.display = 'none';
    }, 2000);
}

async function xianyuInitializeDefaultGoods() {
    // 不再初始化默认商品，商品由用户自行发布或AI生成
}

// 统一生成商品卡片HTML
function xianyuGoodsCardHTML(goodsItem, extraBadge = '') {
    const sellerDisplay = goodsItem.sellerName || '匿名卖家';
    return `
        <div class="xy-goods-img"><i class="fa fa-image"></i></div>
        <div class="xy-goods-info">
            <div class="xy-goods-title">${goodsItem.title}</div>
            <div class="xy-goods-price">¥${goodsItem.price}${extraBadge}</div>
            <div class="xy-goods-seller-row">
                <span class="xy-goods-seller-name"><i class="fa fa-user" style="margin-right:3px;font-size:10px;"></i>${sellerDisplay}</span>
                <span class="xy-goods-category-tag">${goodsItem.category}</span>
            </div>
        </div>
    `;
}

async function xianyuLoadGoods(category = null) {
    const container = document.getElementById('xyGoodsListContainer');
    if (!container) return;
    let goods;
    if (category) {
        goods = await xianyuDb.goods.where('category').equals(category).toArray();
    } else {
        goods = await xianyuDb.goods.toArray();
    }
    goods.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    container.innerHTML = '';
    if (goods.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 50px; color: #ccc;">暂无商品，快去发布吧！</div>';
        return;
    }
    goods.forEach(goodsItem => {
        const item = document.createElement('div');
        item.className = 'xy-goods-item';
        item.onclick = () => xianyuGoToDetail(goodsItem.id);
        item.innerHTML = xianyuGoodsCardHTML(goodsItem);
        container.appendChild(item);
    });
}

async function xianyuLoadMyGoods() {
    const container = document.getElementById('xyMyGoodsListContainer');
    if (!container) return;
    const goods = await xianyuDb.goods.where('userId').equals(XY_CURRENT_USER_ID).toArray();
    goods.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    container.innerHTML = '';
    if (goods.length === 0) {
        container.innerHTML = `
            <div class="xy-empty-state">
                <div class="xy-empty-icon"><i class="fa fa-box-open"></i></div>
                <div class="xy-empty-text">你还没有发布过商品</div>
                <button onclick="xianyuShowPublishDialog()" style="margin-top: 15px; padding: 8px 20px; background-color: #e89ab0; color: white; border: none; border-radius: 5px; cursor: pointer;">去发布</button>
            </div>
        `;
        return;
    }
    goods.forEach(goodsItem => {
        const item = document.createElement('div');
        item.className = 'xy-goods-item';
        item.onclick = () => xianyuGoToDetail(goodsItem.id);
        const soldBadge = goodsItem.sold ? '<span style="font-size: 10px; color: #ff6666; margin-left: 5px;">已售出</span>' : '';
        item.innerHTML = xianyuGoodsCardHTML(goodsItem, ` ${soldBadge}`);
        container.appendChild(item);
    });
}

async function xianyuLoadMySold() {
    const container = document.getElementById('xyMySoldListContainer');
    if (!container) return;
    const goods = await xianyuDb.goods.where('userId').equals(XY_CURRENT_USER_ID).filter(g => g.sold === 1).toArray();
    container.innerHTML = '';
    if (goods.length === 0) {
        container.innerHTML = `
            <div class="xy-empty-state">
                <div class="xy-empty-icon"><i class="fa fa-shopping-bag"></i></div>
                <div class="xy-empty-text">你还没有卖出过商品</div>
            </div>
        `;
        return;
    }
    goods.forEach(goodsItem => {
        const item = document.createElement('div');
        item.className = 'xy-goods-item';
        item.onclick = () => xianyuGoToDetail(goodsItem.id);
        item.innerHTML = xianyuGoodsCardHTML(goodsItem);
        container.appendChild(item);
    });
}

async function xianyuLoadMyBought() {
    const container = document.getElementById('xyMyBoughtListContainer');
    if (!container) return;
    const orders = await xianyuDb.orders.where('userId').equals(XY_CURRENT_USER_ID).filter(o => o.type === 'buy').toArray();
    container.innerHTML = '';
    if (orders.length === 0) {
        container.innerHTML = `
            <div class="xy-empty-state">
                <div class="xy-empty-icon"><i class="fa fa-shopping-cart"></i></div>
                <div class="xy-empty-text">你还没有买到过商品</div>
            </div>
        `;
        return;
    }
    for (const order of orders) {
        const goodsItem = await xianyuDb.goods.get(order.goodsId);
        if (goodsItem) {
            const item = document.createElement('div');
            item.className = 'xy-goods-item';
            item.onclick = () => xianyuGoToDetail(goodsItem.id);
            item.innerHTML = xianyuGoodsCardHTML(goodsItem);
            container.appendChild(item);
        }
    }
}

async function xianyuLoadMyCollections() {
    const container = document.getElementById('xyMyCollectionsListContainer');
    if (!container) return;
    const collections = await xianyuDb.collections.where('userId').equals(XY_CURRENT_USER_ID).toArray();
    container.innerHTML = '';
    if (collections.length === 0) {
        container.innerHTML = `
            <div class="xy-empty-state">
                <div class="xy-empty-icon"><i class="fa fa-star"></i></div>
                <div class="xy-empty-text">你还没有收藏过商品</div>
            </div>
        `;
        return;
    }
    for (const collection of collections) {
        const goodsItem = await xianyuDb.goods.get(collection.goodsId);
        if (goodsItem) {
            const item = document.createElement('div');
            item.className = 'xy-goods-item';
            item.onclick = () => xianyuGoToDetail(goodsItem.id);
            item.innerHTML = xianyuGoodsCardHTML(goodsItem);
            container.appendChild(item);
        }
    }
}

async function xianyuLoadMyPageData() {
    await xianyuUpdateMyPageStats();
}

async function xianyuLoadMessageList() {
    const container = document.getElementById('xyChatListContent');
    if (!container) return;
    container.innerHTML = '';
    
    const sessions = await xianyuDb.chatSessions.toArray();
    
    if (sessions.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 50px; color: #ccc;">暂无消息</div>';
        return;
    }
    
    sessions.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    
    for (const session of sessions) {
        const goods = await xianyuDb.goods.get(session.goodsId);
        if (!goods) continue;
        
        const lastMessage = await xianyuDb.messages.where('goodsId').equals(session.goodsId).sortBy('createdAt');
        const lastMsg = lastMessage[lastMessage.length - 1];
        let senderName = '未知用户';
        
        if (lastMsg) {
            if (lastMsg.sender === 'buyer' || (lastMsg.userId !== XY_CURRENT_USER_ID && lastMsg.role === 'buyer')) {
                const buyer = await xianyuDb.users.where('userId').equals(lastMsg.senderId).first();
                senderName = buyer ? buyer.username : lastMsg.senderId;
            } else if (lastMsg.sender === 'seller' || lastMsg.role === 'seller') {
                const seller = await xianyuDb.users.get(goods.userId);
                senderName = seller ? seller.username : lastMsg.senderId;
            }
        }
        
        const time = new Date(session.updatedAt);
        const timeStr = `${time.getMonth() + 1}/${time.getDate()} ${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}`;
        
        const item = document.createElement('div');
        item.className = 'xy-msg-list-item';
        item.style.cursor = 'pointer';
        item.onclick = () => {
            XianyuAppState.currentGoods = goods;
            xianyuGoToChat();
        };
        
        item.innerHTML = `
            <div class="xy-msg-avatar" style="background-color: #e89ab0; color: white;">
                <i class="fa fa-user"></i>
            </div>
            <div class="xy-msg-info">
                <div class="xy-msg-top">
                    <div class="xy-msg-name">${goods.title} - ${senderName}</div>
                    <div class="xy-msg-time">${timeStr}</div>
                </div>
                <div class="xy-msg-content">${session.lastMessage || '暂无消息'}</div>
            </div>
        `;
        
        container.appendChild(item);
    }
}

async function xianyuSearchGoods(keyword) {
    const container = document.getElementById('xyGoodsListContainer');
    if (!container) return;
    const allGoods = await xianyuDb.goods.toArray();
    const filteredGoods = allGoods.filter(goodsItem => 
        goodsItem.title.toLowerCase().includes(keyword.toLowerCase()) ||
        goodsItem.category.toLowerCase().includes(keyword.toLowerCase()) ||
        (goodsItem.description && goodsItem.description.toLowerCase().includes(keyword.toLowerCase()))
    );
    container.innerHTML = '';
    if (filteredGoods.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 50px; color: #ccc;">未找到相关商品</div>';
        return;
    }
    filteredGoods.forEach(goodsItem => {
        const item = document.createElement('div');
        item.className = 'xy-goods-item';
        item.onclick = () => xianyuGoToDetail(goodsItem.id);
        item.innerHTML = xianyuGoodsCardHTML(goodsItem);
        container.appendChild(item);
    });
}

async function xianyuGoToDetail(goodsId) {
    const goods = await xianyuDb.goods.get(goodsId);
    if (!goods) return;
    
    goods.viewCount = (goods.viewCount || 0) + 1;
    await xianyuDb.goods.update(goodsId, { viewCount: goods.viewCount });
    
    document.getElementById('xyDetailTitle').textContent = goods.title;
    document.getElementById('xyDetailPrice').textContent = `¥${goods.price}`;
    document.getElementById('xyDetailPostage').textContent = goods.postage || '包邮';
    document.getElementById('xyDetailMeta').textContent = `想要${goods.wantCount || 0} | 浏览${goods.viewCount || 0}`;
    document.getElementById('xyDetailMeta1Key').textContent = goods.metaKey || '类别';
    document.getElementById('xyDetailMeta1Val').textContent = goods.metaVal || goods.category;
    document.getElementById('xyDetailDescTitle').textContent = goods.title;
    document.getElementById('xyDetailDescContent').textContent = goods.description;
    document.getElementById('xyDetailTipsTitle').textContent = '小贴士';
    document.getElementById('xyDetailTipsContent').textContent = goods.tips || '温馨提示内容';
    
    // 显示卖家名字
    const sellerNameEl = document.querySelector('#xyDetailPage .xy-seller-name');
    if (sellerNameEl) {
        const sellerDisplay = goods.sellerName || '匿名卖家';
        sellerNameEl.innerHTML = `${sellerDisplay} <span class="xy-credit-tag">卖家信用极好</span>`;
    }
    // 显示卖家头像
    const sellerAvatarEl = document.querySelector('#xyDetailPage .xy-seller-avatar');
    if (sellerAvatarEl) {
        if (goods.sellerAvatar && goods.sellerAvatar.startsWith('http')) {
            sellerAvatarEl.innerHTML = `<img src="${goods.sellerAvatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
        } else {
            sellerAvatarEl.innerHTML = `<i class="fa ${goods.sellerAvatar || 'fa-user'}"></i>`;
        }
    }
    
    if (goods.category === '美妆' || goods.category === '女装') {
        document.getElementById('xySellerLocation').textContent = '7小时前前来过 | 泉州';
        document.getElementById('xySellerService').textContent = '230+已服务(次) | 2年服务经验';
    } else {
        document.getElementById('xySellerLocation').textContent = '刚刚来过 | 河北·张家口';
        document.getElementById('xySellerService').textContent = '83+已服务(次) | 1年服务经验';
    }
    
    xianyuUpdateCollectButton(goodsId);
    XianyuAppState.currentGoods = goods;
    XianyuAppState.navigateTo('xyDetailPage');
}

async function xianyuUpdateCollectButton(goodsId) {
    const collectBtn = document.getElementById('xyCollectBtn');
    const detailCollectBtn = document.getElementById('xyDetailCollectBtn');
    if (!collectBtn || !detailCollectBtn) return;
    
    const collection = await xianyuDb.collections.where('goodsId').equals(goodsId).filter(c => c.userId === XY_CURRENT_USER_ID).first();
    
    if (collection) {
        collectBtn.innerHTML = '<i class="fa fa-star"></i> 已收藏';
        detailCollectBtn.className = 'fa fa-star';
        detailCollectBtn.title = '取消收藏';
    } else {
        collectBtn.innerHTML = '<i class="fa fa-star-o"></i> 收藏';
        detailCollectBtn.className = 'fa fa-star-o';
        detailCollectBtn.title = '收藏';
    }
}

async function xianyuToggleCollect(goodsId) {
    const goods = await xianyuDb.goods.get(goodsId);
    if (!goods) return;
    
    const collection = await xianyuDb.collections.where('goodsId').equals(goodsId).filter(c => c.userId === XY_CURRENT_USER_ID).first();
    
    if (collection) {
        await xianyuDb.collections.delete(collection.id);
        xianyuShowDataStatus('已取消收藏');
    } else {
        await xianyuDb.collections.add({
            goodsId: goodsId,
            goodsTitle: goods.title,
            goodsPrice: goods.price,
            goodsCategory: goods.category,
            userId: XY_CURRENT_USER_ID,
            collectedAt: new Date()
        });
        xianyuShowDataStatus('已收藏');
    }
    xianyuUpdateCollectButton(goodsId);
    await xianyuUpdateMyPageStats();
}

async function xianyuLoadChatMessages(goodsId) {
    const container = document.getElementById('xyChatContent');
    if (!container) return;
    const messages = await xianyuDb.messages.where('goodsId').equals(goodsId).toArray();
    
    messages.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    
    container.innerHTML = '';
    if (messages.length > 0) {
        messages.forEach(msg => {
            const messageDiv = document.createElement('div');
            const isUser = msg.sender === 'user' || (msg.userId === XY_CURRENT_USER_ID && msg.sender !== 'seller' && msg.sender !== 'buyer');
            const isSystem = msg.sender === 'system';
            
            messageDiv.className = `xy-message-item ${isUser ? 'xy-message-user' : isSystem ? 'xy-message-system' : 'xy-message-seller'}`;
            
            const time = new Date(msg.createdAt);
            const timeStr = `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}`;
            
            let senderName = '';
            if (!isUser && !isSystem) {
                const goodsData = XianyuAppState.currentGoods;
                const displayName = (goodsData && goodsData.sellerName) ? goodsData.sellerName : (msg.senderId || '卖家');
                senderName = `<div style="font-size: 11px; color: #999; margin-bottom: 3px;">${displayName}</div>`;
            }
            
            messageDiv.innerHTML = `
                ${senderName}
                <div class="xy-message-bubble">${msg.content}</div>
                <div class="xy-message-time">${timeStr}</div>
            `;
            container.appendChild(messageDiv);
        });
    } else {
        container.innerHTML = '<div style="text-align: center; padding: 50px; color: #ccc;">还没有消息，开始聊天吧！</div>';
    }
    
    container.scrollTop = container.scrollHeight;
}

// 获取闲鱼的API配置（使用项目的db.dexiData）
async function getXianyuApiConfig() {
    const urlItem = await db.dexiData.get('aiBaseUrl');
    const keyItem = await db.dexiData.get('aiApiKey');
    const modelItem = await db.dexiData.get('aiCurrentModel');
    const tempItem = await db.dexiData.get('aiTemperature');

    let baseUrl = urlItem?.value || 'https://api.openai.com/v1';
    if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);
    if (!baseUrl.includes('/v1')) {
        baseUrl += '/v1';
    }
    const apiUrl = baseUrl + '/chat/completions';

    return {
        apiUrl: apiUrl,
        apiKey: keyItem?.value || '',
        model: modelItem?.value || 'gpt-3.5-turbo',
        temperature: parseFloat(tempItem?.value) || 0.8
    };
}

async function xianyuSendMessage() {
    const input = document.getElementById('xyChatInput');
    if (!input) return;
    const content = input.value.trim();
    if (!content || !XianyuAppState.currentGoods) return;
    
    const goods = XianyuAppState.currentGoods;
    const seller = await xianyuDb.users.get(goods.userId);
    const currentUser = await xianyuDb.users.get(XY_CURRENT_USER_ID);
    const currentUserId = currentUser ? (currentUser.userId || `user_${XY_CURRENT_USER_ID}`) : `user_${XY_CURRENT_USER_ID}`;
    
    if (seller && seller.blockedUsers && seller.blockedUsers.includes(currentUserId)) {
        alert('您已被卖家拉黑，无法发送消息');
        return;
    }
    
    await xianyuDb.messages.add({
        goodsId: goods.id,
        content: content,
        sender: 'user',
        userId: XY_CURRENT_USER_ID,
        senderId: XY_CURRENT_USER_ID,
        role: 'buyer',
        createdAt: new Date()
    });
    
    const existingSession = await xianyuDb.chatSessions.where('goodsId').equals(goods.id).first();
    if (existingSession) {
        await xianyuDb.chatSessions.update(existingSession.id, {
            lastMessage: content,
            updatedAt: new Date()
        });
    } else {
        await xianyuDb.chatSessions.add({
            goodsId: goods.id,
            lastMessage: content,
            updatedAt: new Date(),
            userId: XY_CURRENT_USER_ID
        });
    }
    
    input.value = '';
    xianyuLoadChatMessages(goods.id);
    
    if (XianyuAppState.currentPage === 'xyMessageListPage') {
        xianyuLoadMessageList();
    }
}

// 接收回复按钮 - 手动触发AI回复
async function xianyuReceiveReply() {
    const goods = XianyuAppState.currentGoods;
    if (!goods) {
        alert('当前没有商品信息');
        return;
    }
    
    // 获取最后一条用户消息作为上下文
    const messages = await xianyuDb.messages
        .where('goodsId').equals(goods.id)
        .toArray();
    
    const userMessages = messages.filter(m => m.sender === 'user');
    const lastUserMessage = userMessages.length > 0 ? userMessages[userMessages.length - 1].content : '你好';
    
    // 按钮loading状态
    const btn = document.querySelector('.xy-chat-receive-btn');
    if (btn) {
        btn.classList.add('loading');
        btn.textContent = '等待回复...';
    }
    
    try {
        await xianyuGenerateAIResponse(goods.id, lastUserMessage, goods);
    } catch (e) {
        console.error('接收回复失败:', e);
        alert('接收回复失败，请重试');
    } finally {
        if (btn) {
            btn.classList.remove('loading');
            btn.textContent = '接收回复';
        }
    }
}

async function xianyuGenerateAIResponse(goodsId, userMessage, goods) {
    try {
        const config = await getXianyuApiConfig();
        const worldView = localStorage.getItem('xyWorldView') || '';
        
        if (!config.apiKey) {
            xianyuDefaultResponse(goodsId, userMessage, goods);
            return;
        }
        
        const seller = await xianyuDb.users.get(goods.userId);
        const sellerId = seller ? seller.userId : `seller_${goods.userId}`;
        const sellerName = goods.sellerName || '卖家';
        
        // 尝试从db.characters中查找同名角色，获取人设
        let sellerPersonality = '';
        try {
            const allChars = await db.characters.toArray();
            const matchedChar = allChars.find(c => 
                (c.nick === sellerName || c.name === sellerName) && c.type !== 'user'
            );
            if (matchedChar) {
                sellerPersonality = `\n【你的角色人设】\n名字：${matchedChar.name}${matchedChar.nick ? `\n昵称：${matchedChar.nick}` : ''}${matchedChar.description ? `\n设定：${matchedChar.description}` : ''}`;
            }
        } catch(e) { console.log('获取角色人设失败:', e); }
        
        // 获取聊天历史作为上下文
        const allMessages = await xianyuDb.messages
            .where('goodsId').equals(goodsId)
            .toArray();
        allMessages.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        
        // 构建对话历史
        const chatHistory = allMessages.slice(-10).map(m => {
            return m.sender === 'user' ? `买家：${m.content}` : `${sellerName}：${m.content}`;
        }).join('\n');
        
        // 获取买家名字
        const buyerName = window.xianyuCurrentAccountName || '买家';
        
        const systemPrompt = `你是闲鱼卖家"${sellerName}"，正在和买家"${buyerName}"聊天。${worldView ? `世界观：${worldView}。` : ''}
商品信息：${goods.title}，当前价格：¥${goods.price}。
${sellerPersonality}

请以"${sellerName}"的身份和语气回复。如果你有角色人设，必须严格按照人设的性格来回复。
你可能会也可能不会意识到买家是谁，这取决于你的判断。`;

        const userPrompt = `以下是聊天记录：
${chatHistory}

回复规则：
1. 如果买家砍价，你不一定要同意。拒绝时不要提到具体价格数字
2. 如果你主动同意降价，用这个特殊格式标记新价格：【改价:数字】，例如【改价:85】
3. 如果不同意降价，就正常拒绝，绝对不要出现【改价:】标记
4. 回复要自然、口语化，符合你的人设
5. 你可以分多条消息回复，每条消息用 ||| 分隔。比如"你好|||这个还在的|||要的话拍下吧"
6. 每条消息要短小精悍，像真实聊天一样

请只回复消息内容，不要加任何前缀。`;
        
        const response = await fetch(config.apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.apiKey}`
            },
            body: JSON.stringify({
                model: config.model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                temperature: config.temperature
            })
        });
        
        if (!response.ok) {
            throw new Error('API调用失败');
        }
        
        const data = await response.json();
        const aiResponse = data.choices[0].message.content.trim();
        
        // 只在AI明确标记【改价:数字】时才改价
        const priceMatch = aiResponse.match(/【改价[:：](\d+(?:\.\d+)?)】/);
        if (priceMatch) {
            const newPrice = parseFloat(priceMatch[1]);
            if (newPrice < goods.price && newPrice > 0) {
                await xianyuDb.goods.update(goodsId, { 
                    price: newPrice,
                    originalPrice: goods.originalPrice || goods.price
                });
                XianyuAppState.currentGoods.price = newPrice;
                const priceEl1 = document.getElementById('xyChatGoodsPrice');
                const priceEl2 = document.getElementById('xyDetailPrice');
                if (priceEl1) priceEl1.textContent = `¥${newPrice}`;
                if (priceEl2) priceEl2.textContent = `¥${newPrice}`;
            }
        }
        
        // 清理回复中的特殊标记
        const cleanResponse = aiResponse.replace(/【改价[:：]\d+(?:\.\d+)?】/g, '').trim();
        
        // 将回复按 ||| 分隔为多条消息，逐条发送
        const messageParts = cleanResponse.split('|||').map(s => s.trim()).filter(s => s.length > 0);
        
        if (messageParts.length === 0) {
            messageParts.push(cleanResponse || '嗯嗯');
        }
        
        // 逐条发送消息，每条之间有延迟
        for (let i = 0; i < messageParts.length; i++) {
            const msgContent = messageParts[i];
            
            if (i > 0) {
                // 非首条消息，等待一段时间模拟打字
                await new Promise(resolve => setTimeout(resolve, 600 + Math.random() * 800));
            }
            
            await xianyuDb.messages.add({
                goodsId: goodsId,
                content: msgContent,
                sender: 'seller',
                userId: goods.userId,
                senderId: sellerId,
                role: 'seller',
                createdAt: new Date()
            });
            
            // 更新会话
            const existingSession = await xianyuDb.chatSessions.where('goodsId').equals(goodsId).first();
            if (existingSession) {
                await xianyuDb.chatSessions.update(existingSession.id, {
                    lastMessage: msgContent,
                    updatedAt: new Date()
                });
            } else {
                await xianyuDb.chatSessions.add({
                    goodsId: goodsId,
                    lastMessage: msgContent,
                    updatedAt: new Date(),
                    userId: XY_CURRENT_USER_ID
                });
            }
            
            // 每条消息发送后立即刷新聊天界面
            xianyuLoadChatMessages(goodsId);
        }
        
        if (XianyuAppState.currentPage === 'xyMessageListPage') {
            xianyuLoadMessageList();
        }
    } catch (error) {
        console.error('AI回复生成失败:', error);
        xianyuDefaultResponse(goodsId, userMessage, goods);
    }
}

async function xianyuDefaultResponse(goodsId, userMessage, goods) {
    const lowerMessage = userMessage.toLowerCase();
    let responses = [];
    
    if (lowerMessage.includes('便宜') || lowerMessage.includes('降价') || lowerMessage.includes('砍价')) {
        // 默认回复不改价，只是口头回应
        responses = ['这个价格已经很实惠了', '不好意思，不太能降了'];
    } else if (lowerMessage.includes('包邮') || lowerMessage.includes('运费')) {
        responses = ['包邮的，放心购买～'];
    } else if (lowerMessage.includes('质量') || lowerMessage.includes('新旧')) {
        responses = ['质量很好的', '几乎全新，可以放心'];
    } else {
        const defaultReplies = [
            ['您好，有什么可以帮您的？'],
            ['在的', '这个商品还有哦'],
            ['感兴趣的话可以直接拍下哦'],
            ['有现货', '今天可以发货']
        ];
        responses = defaultReplies[Math.floor(Math.random() * defaultReplies.length)];
    }
    
    const seller = await xianyuDb.users.get(goods.userId);
    const sellerId = seller ? seller.userId : `seller_${goods.userId}`;
    
    for (let i = 0; i < responses.length; i++) {
        if (i > 0) {
            await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 500));
        }
        
        await xianyuDb.messages.add({
            goodsId: goodsId,
            content: responses[i],
            sender: 'seller',
            userId: goods.userId,
            senderId: sellerId,
            role: 'seller',
            createdAt: new Date()
        });
        
        const existingSession = await xianyuDb.chatSessions.where('goodsId').equals(goodsId).first();
        if (existingSession) {
            await xianyuDb.chatSessions.update(existingSession.id, {
                lastMessage: responses[i],
                updatedAt: new Date()
            });
        } else {
            await xianyuDb.chatSessions.add({
                goodsId: goodsId,
                lastMessage: responses[i],
                updatedAt: new Date(),
                userId: XY_CURRENT_USER_ID
            });
        }
        
        xianyuLoadChatMessages(goodsId);
    }
    
    if (XianyuAppState.currentPage === 'xyMessageListPage') {
        xianyuLoadMessageList();
    }
}

function xianyuSendQuickMessage(content) {
    const input = document.getElementById('xyChatInput');
    if (input) input.value = content;
    xianyuSendMessage();
}

async function xianyuPublishGoods() {
    const title = document.getElementById('xyPublishTitle').value;
    const price = document.getElementById('xyPublishPrice').value;
    const category = document.getElementById('xyPublishCategory').value;
    const description = document.getElementById('xyPublishDesc').value;
    
    if (!title || !price) {
        alert('请填写标题和价格');
        return;
    }
    
    // 获取当前账号名字作为卖家名
    let mySellerName = window.xianyuCurrentAccountName || '我';
    try {
        const accountChar = await db.characters.get(XY_CURRENT_USER_ID);
        if (accountChar) mySellerName = accountChar.nick || accountChar.name || mySellerName;
    } catch(e) {}
    
    const newGoods = {
        title: title,
        price: parseFloat(price),
        category: category,
        description: description || '商品描述',
        sellerName: mySellerName,
        tips: '具体请私聊咨询',
        postage: '包邮',
        metaKey: '类别',
        metaVal: category,
        viewCount: 0,
        wantCount: 0,
        collected: false,
        userId: XY_CURRENT_USER_ID,
        sellerId: `seller_${XY_CURRENT_USER_ID}`,
        originalPrice: parseFloat(price),
        sold: 0,
        bought: 0,
        createdAt: new Date()
    };
    
    const goodsId = await xianyuDb.goods.add(newGoods);
    xianyuHidePublishDialog();
    xianyuLoadGoods();
    xianyuShowDataStatus('商品发布成功');
    await xianyuUpdateMyPageStats();
    
    setTimeout(() => {
        xianyuGenerateBuyerMessage(goodsId, newGoods);
    }, 2000);
}

async function xianyuGenerateBuyerMessage(goodsId, goods) {
    try {
        const config = await getXianyuApiConfig();
        const worldView = localStorage.getItem('xyWorldView') || '';
        
        const buyerId = `buyer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        await xianyuDb.characters.add({
            userId: buyerId,
            role: 'buyer',
            personality: '普通买家',
            worldView: worldView,
            createdAt: new Date()
        });
        
        const buyerUserId = await xianyuDb.users.add({
            username: `买家${Math.random().toString(36).substr(2, 6)}`,
            avatar: 'fa-user',
            userId: buyerId,
            role: 'buyer',
            blockedUsers: [],
            createdAt: new Date()
        });
        
        let buyerMessage = '';
        
        if (config.apiUrl && config.apiKey) {
            const prompt = `你是一个闲鱼买家，看到商品"${goods.title}"，价格¥${goods.price}。${worldView ? `世界观：${worldView}` : ''}

请生成一条买家私信，可以是：
1. 询问商品详情
2. 砍价
3. 询问发货时间
4. 其他合理的问题

请只回复消息内容，要自然、符合闲鱼买家的语气。`;
            
            try {
                const response = await fetch(config.apiUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${config.apiKey}`
                    },
                    body: JSON.stringify({
                        model: config.model,
                        messages: [
                            { role: 'system', content: '你是一个闲鱼买家，正在询问商品信息。' },
                            { role: 'user', content: prompt }
                        ],
                        temperature: config.temperature
                    })
                });
                
                if (response.ok) {
                    const data = await response.json();
                    buyerMessage = data.choices[0].message.content.trim();
                }
            } catch (e) {
                console.error('生成买家消息API失败:', e);
            }
        }
        
        if (!buyerMessage) {
            const messages = [
                `你好，这个${goods.title}还在吗？`,
                `可以便宜点吗？`,
                `这个商品包邮吗？`,
                `什么时候可以发货？`,
                `商品是全新的吗？`
            ];
            buyerMessage = messages[Math.floor(Math.random() * messages.length)];
        }
        
        await xianyuDb.messages.add({
            goodsId: goodsId,
            content: buyerMessage,
            sender: 'buyer',
            userId: buyerUserId,
            senderId: buyerId,
            role: 'buyer',
            createdAt: new Date()
        });
        
        const existingSession = await xianyuDb.chatSessions.where('goodsId').equals(goodsId).first();
        if (existingSession) {
            await xianyuDb.chatSessions.update(existingSession.id, {
                lastMessage: buyerMessage,
                updatedAt: new Date()
            });
        } else {
            await xianyuDb.chatSessions.add({
                goodsId: goodsId,
                lastMessage: buyerMessage,
                updatedAt: new Date(),
                userId: XY_CURRENT_USER_ID
            });
        }
        
        xianyuShowDataStatus('有买家来私信了！');
        
        if (XianyuAppState.currentPage === 'xyMessageListPage') {
            xianyuLoadMessageList();
        }
    } catch (error) {
        console.error('生成买家消息失败:', error);
    }
}

function xianyuShowMyGoods() { XianyuAppState.navigateTo('xyMyGoodsPage'); }
function xianyuShowMySold() { XianyuAppState.navigateTo('xyMySoldPage'); }
function xianyuShowMyBought() { XianyuAppState.navigateTo('xyMyBoughtPage'); }
function xianyuShowMyCollections() { XianyuAppState.navigateTo('xyMyCollectionsPage'); }
function xianyuShowMyChats() { alert('我的聊天功能待开发'); }
function xianyuShowMyOrders() { alert('我的订单功能待开发'); }
function xianyuShowMyWallet() { alert('我的钱包功能待开发'); }
function xianyuShowDataManagement() { xianyuShowSettingsDialog(); }

async function xianyuExportData() {
    try {
        const allData = {
            goods: await xianyuDb.goods.toArray(),
            collections: await xianyuDb.collections.toArray(),
            messages: await xianyuDb.messages.toArray(),
            users: await xianyuDb.users.toArray(),
            orders: await xianyuDb.orders.toArray(),
            exportDate: new Date().toISOString()
        };
        const dataStr = JSON.stringify(allData, null, 2);
        // 使用 Blob + URL.createObjectURL 替代 data URI，避免大数据量导致浏览器崩溃
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const linkElement = document.createElement('a');
        linkElement.href = url;
        linkElement.download = 'xianyu_data.json';
        document.body.appendChild(linkElement);
        linkElement.click();
        document.body.removeChild(linkElement);
        URL.revokeObjectURL(url);
        xianyuShowDataStatus('数据已导出');
    } catch (error) {
        console.error('闲鱼数据导出失败:', error);
        alert('数据导出失败: ' + error.message);
    }
}

function xianyuImportData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const data = JSON.parse(event.target.result);
                await xianyuDb.goods.clear();
                await xianyuDb.collections.clear();
                await xianyuDb.messages.clear();
                await xianyuDb.users.clear();
                await xianyuDb.orders.clear();
                if (data.goods) await xianyuDb.goods.bulkAdd(data.goods);
                if (data.collections) await xianyuDb.collections.bulkAdd(data.collections);
                if (data.messages) await xianyuDb.messages.bulkAdd(data.messages);
                if (data.users) await xianyuDb.users.bulkAdd(data.users);
                if (data.orders) await xianyuDb.orders.bulkAdd(data.orders);
                xianyuShowDataStatus('数据导入成功');
                xianyuLoadGoods();
                xianyuLoadUserInfo();
                xianyuHideSettingsDialog();
            } catch (error) {
                alert('数据导入失败，请检查文件格式');
            }
        };
        reader.readAsText(file);
    };
    input.click();
}

async function xianyuClearAllData() {
    if (confirm('确定要清空所有数据吗？此操作不可恢复！')) {
        await xianyuDb.goods.clear();
        await xianyuDb.collections.clear();
        await xianyuDb.messages.clear();
        await xianyuDb.orders.clear();
        xianyuShowDataStatus('数据已清空');
        xianyuLoadGoods();
        xianyuLoadUserInfo();
        xianyuHideSettingsDialog();
    }
}

async function xianyuResetToDefault() {
    if (confirm('确定要清空并重置数据吗？当前数据将会被清空！')) {
        await xianyuDb.goods.clear();
        await xianyuDb.collections.clear();
        await xianyuDb.messages.clear();
        await xianyuDb.orders.clear();
        await xianyuDb.users.clear();
        await xianyuInitializeUser();
        xianyuShowDataStatus('数据已重置');
        xianyuLoadGoods();
        xianyuLoadUserInfo();
        xianyuHideSettingsDialog();
    }
}

function xianyuShowGenerateDialog() {
    const dialog = document.getElementById('xyGenerateDialog');
    if (!dialog) return;
    const savedWorldView = localStorage.getItem('xyWorldView') || '';
    const input = document.getElementById('xyWorldViewInput');
    if (input) input.value = savedWorldView;
    dialog.style.display = 'flex';
}

function xianyuHideGenerateDialog() {
    const el = document.getElementById('xyGenerateDialog');
    if (el) el.style.display = 'none';
}

async function xianyuGenerateGoods() {
    const worldViewInput = document.getElementById('xyWorldViewInput');
    const worldView = worldViewInput ? worldViewInput.value.trim() : '';
    
    const config = await getXianyuApiConfig();
    
    if (!config.apiKey) {
        alert('请先在桌面设置中配置API密钥');
        return;
    }
    
    if (worldView) {
        localStorage.setItem('xyWorldView', worldView);
    }
    
    xianyuShowDataStatus('正在生成商品...');
    
    try {
        // 获取非user类型的角色，用于随机分配为卖家（排除所有用户账号）
        let allCharacters = [];
        try {
            const allChars = await db.characters.toArray();
            allCharacters = allChars.filter(c => c.type !== 'user');
        } catch(e) { console.error('获取角色列表失败:', e); }
        
        // 构建角色名单提示
        let characterHint = '';
        if (allCharacters.length > 0) {
            const charNames = allCharacters.map(c => c.nick || c.name).filter(Boolean);
            if (charNames.length > 0) {
                characterHint = `\n\n可用的卖家角色名单：${charNames.join('、')}。可以从这些角色中随机选择作为卖家，也可以自创一些有个性的卖家名字，两者混搭。每个角色可以卖多个商品，要符合角色的性格和身份。`;
            }
        }
        
        const prompt = `请生成至少10个闲鱼商品信息。${worldView ? `世界观：${worldView}。请根据这个世界观生成符合的商品。` : ''}${characterHint}

每个商品需要包含：
- title: 商品标题（简短吸引人，像真实闲鱼用户发的）
- price: 价格（合理范围，数字）
- category: 类别（女装/美妆/数码/图书/其他）
- description: 商品描述（简短）
- sellerName: 卖家名字（从角色名单中选择，或自创一个有个性的名字，随机混搭，不要出现"用户"二字）

请以JSON格式返回，格式如下：
[
  {"title": "商品标题", "price": 价格数字, "category": "类别", "description": "商品描述", "sellerName": "卖家名字"},
  ...
]

至少生成10个商品。`;
        
        const response = await fetch(config.apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.apiKey}`
            },
            body: JSON.stringify({
                model: config.model,
                messages: [
                    { role: 'system', content: '你是一个商品生成助手，专门生成闲鱼商品信息。每个商品都必须有一个卖家名字。' },
                    { role: 'user', content: prompt }
                ],
                temperature: config.temperature
            })
        });
        
        if (!response.ok) {
            throw new Error('API调用失败');
        }
        
        const data = await response.json();
        let goodsList = [];
        
        try {
            const content = data.choices[0].message.content.trim();
            const jsonMatch = content.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                goodsList = JSON.parse(jsonMatch[0]);
            } else {
                throw new Error('无法解析JSON');
            }
        } catch (parseError) {
            console.error('解析失败，使用默认商品:', parseError);
            goodsList = xianyuGenerateDefaultGoods(worldView);
        }
        
        if (goodsList.length < 10) {
            const defaultGoods = xianyuGenerateDefaultGoods(worldView);
            goodsList = goodsList.concat(defaultGoods.slice(0, 10 - goodsList.length));
        }
        
        for (const item of goodsList.slice(0, Math.max(10, goodsList.length))) {
            const sellerName = item.sellerName || `用户${Math.random().toString(36).substr(2, 6)}`;
            const sellerId = `seller_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            // 查找是否有匹配的角色
            let sellerAvatar = 'fa-user';
            let matchedChar = null;
            if (allCharacters.length > 0) {
                matchedChar = allCharacters.find(c => 
                    (c.nick && c.nick === sellerName) || (c.name && c.name === sellerName)
                );
            }
            if (matchedChar && matchedChar.avatar) {
                sellerAvatar = matchedChar.avatar;
            }
            
            await xianyuDb.characters.add({
                userId: sellerId,
                role: 'seller',
                personality: sellerName,
                worldView: worldView,
                createdAt: new Date()
            });
            
            const sellerUserId = await xianyuDb.users.add({
                username: sellerName,
                avatar: sellerAvatar,
                userId: sellerId,
                role: 'seller',
                blockedUsers: [],
                createdAt: new Date()
            });
            
            await xianyuDb.goods.add({
                title: item.title || '商品标题',
                price: item.price || Math.floor(Math.random() * 500) + 10,
                category: item.category || '其他',
                description: item.description || '商品描述',
                sellerName: sellerName,
                sellerAvatar: sellerAvatar,
                tips: '具体请私聊咨询',
                postage: '包邮',
                metaKey: '类别',
                metaVal: item.category || '其他',
                viewCount: Math.floor(Math.random() * 100),
                wantCount: Math.floor(Math.random() * 10),
                collected: false,
                userId: sellerUserId,
                sellerId: sellerId,
                originalPrice: item.price || Math.floor(Math.random() * 500) + 10,
                sold: 0,
                bought: 0,
                createdAt: new Date()
            });
        }
        
        xianyuHideGenerateDialog();
        xianyuLoadGoods();
        xianyuShowDataStatus(`成功生成${Math.max(10, goodsList.length)}个商品！`);
    } catch (error) {
        console.error('生成商品失败:', error);
        alert('生成商品失败，请检查API设置');
    }
}

function xianyuGenerateDefaultGoods(worldView) {
    const categories = ['女装', '美妆', '数码', '图书', '其他'];
    const defaultNames = ['小甜甜', '闲置达人', '二手小王子', '清仓少女', '宝藏卖家', '杂货铺老板', '甜蜜小铺', '文艺青年', '数码控', '时尚辣妈'];
    const goods = [];
    
    for (let i = 0; i < 10; i++) {
        const category = categories[Math.floor(Math.random() * categories.length)];
        goods.push({
            title: `${category}商品${i + 1}`,
            price: Math.floor(Math.random() * 500) + 10,
            category: category,
            description: `这是一个${category}商品，${worldView ? `符合${worldView}世界观` : '质量很好'}`,
            sellerName: defaultNames[i % defaultNames.length]
        });
    }
    
    return goods;
}

function xianyuShowPublishDialog() { 
    const el = document.getElementById('xyPublishDialog');
    if (el) el.style.display = 'flex'; 
}
function xianyuHidePublishDialog() {
    const el = document.getElementById('xyPublishDialog');
    if (el) el.style.display = 'none';
    const t = document.getElementById('xyPublishTitle');
    const p = document.getElementById('xyPublishPrice');
    const d = document.getElementById('xyPublishDesc');
    if (t) t.value = '';
    if (p) p.value = '';
    if (d) d.value = '';
}
function xianyuShowSettings() { xianyuShowSettingsDialog(); }
function xianyuShowSettingsDialog() { 
    const el = document.getElementById('xySettingsDialog');
    if (el) el.style.display = 'flex'; 
}
function xianyuHideSettingsDialog() { 
    const el = document.getElementById('xySettingsDialog');
    if (el) el.style.display = 'none'; 
}

function xianyuEditProfile() {
    xianyuDb.users.get(XY_CURRENT_USER_ID).then(user => {
        if (user) {
            const nameEl = document.getElementById('xyEditUserName');
            const avatarEl = document.getElementById('xyEditUserAvatar');
            if (nameEl) nameEl.value = user.username;
            if (avatarEl) avatarEl.value = user.avatar;
        }
    });
    const el = document.getElementById('xyEditProfileDialog');
    if (el) el.style.display = 'flex';
}

function xianyuHideEditProfileDialog() { 
    const el = document.getElementById('xyEditProfileDialog');
    if (el) el.style.display = 'none'; 
}

async function xianyuSaveProfile() {
    const nameEl = document.getElementById('xyEditUserName');
    const avatarEl = document.getElementById('xyEditUserAvatar');
    const username = nameEl ? nameEl.value : '';
    const avatar = avatarEl ? avatarEl.value : 'fa-user';
    if (!username.trim()) {
        alert('请输入用户名');
        return;
    }
    await xianyuDb.users.update(XY_CURRENT_USER_ID, {
        username: username,
        avatar: avatar
    });
    xianyuHideEditProfileDialog();
    xianyuLoadUserInfo();
    xianyuShowDataStatus('资料已更新');
}

function xianyuFilterByCategory(category) { xianyuLoadGoods(category); }
function xianyuShowAllGoods() { xianyuLoadGoods(); }
function xianyuSwitchTab(pageId, tabId) { XianyuAppState.switchTab(pageId, tabId); }
function xianyuGoBack() { XianyuAppState.goBack(); }
function xianyuGoBackToMyPage() { XianyuAppState.goBackToMyPage(); }

async function xianyuGoToChat() {
    if (XianyuAppState.currentGoods) {
        const goods = XianyuAppState.currentGoods;
        const priceEl = document.getElementById('xyChatGoodsPrice');
        const descEl = document.getElementById('xyChatGoodsDesc');
        const locEl = document.getElementById('xyChatGoodsLocation');
        if (priceEl) priceEl.textContent = `¥${goods.price}`;
        if (descEl) descEl.textContent = goods.postage || '包邮';
        if (locEl) locEl.textContent = goods.metaVal || '未知地区';
        
        const seller = await xianyuDb.users.get(goods.userId);
        const sellerName = goods.sellerName || (seller ? seller.username : '卖家');
        const roleTag = goods.userId === XY_CURRENT_USER_ID ? '买家' : '卖家';
        const headerEl = document.getElementById('xyChatHeaderName');
        if (headerEl) headerEl.innerHTML = `${sellerName} <span class="xy-credit-tag">${roleTag}</span>`;
        
        XianyuAppState.navigateTo('xyChatPage');
    } else {
        alert('请先选择商品');
    }
}

function xianyuBuyNow() {
    if (XianyuAppState.currentGoods) {
        if (confirm(`确定购买商品：${XianyuAppState.currentGoods.title} 价格：¥${XianyuAppState.currentGoods.price}？`)) {
            xianyuDb.goods.update(XianyuAppState.currentGoods.id, { sold: 1 });
            xianyuDb.orders.add({
                goodsId: XianyuAppState.currentGoods.id,
                goodsTitle: XianyuAppState.currentGoods.title,
                goodsPrice: XianyuAppState.currentGoods.price,
                type: 'buy',
                userId: XY_CURRENT_USER_ID,
                createdAt: new Date()
            });
            xianyuShowDataStatus('购买成功！');
            alert('购买成功！');
            xianyuUpdateMyPageStats();
        }
    }
}

function xianyuBuyFromChat() { xianyuBuyNow(); }

function xianyuShowChatMenu() {
    const menu = document.getElementById('xyChatMenu');
    if (menu) menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
}

document.addEventListener('click', (e) => {
    const menu = document.getElementById('xyChatMenu');
    if (menu && !menu.contains(e.target) && !e.target.closest('.fa-ellipsis-v')) {
        menu.style.display = 'none';
    }
});

function xianyuShowPriceEditDialog() {
    const goods = XianyuAppState.currentGoods;
    if (!goods) return;
    
    const newPrice = prompt(`当前价格：¥${goods.price}\n请输入新价格：`, goods.price);
    if (newPrice && !isNaN(newPrice) && parseFloat(newPrice) > 0) {
        xianyuUpdatePrice(goods.id, parseFloat(newPrice));
    }
    const menu = document.getElementById('xyChatMenu');
    if (menu) menu.style.display = 'none';
}

async function xianyuUpdatePrice(goodsId, newPrice) {
    const goods = await xianyuDb.goods.get(goodsId);
    if (!goods) return;
    
    await xianyuDb.goods.update(goodsId, {
        price: newPrice,
        originalPrice: goods.originalPrice || goods.price
    });
    
    XianyuAppState.currentGoods.price = newPrice;
    const priceEl1 = document.getElementById('xyChatGoodsPrice');
    const priceEl2 = document.getElementById('xyDetailPrice');
    if (priceEl1) priceEl1.textContent = `¥${newPrice}`;
    if (priceEl2) priceEl2.textContent = `¥${newPrice}`;
    
    const seller = await xianyuDb.users.get(goods.userId);
    const sellerId = seller ? seller.userId : `seller_${goods.userId}`;
    
    await xianyuDb.messages.add({
        goodsId: goodsId,
        content: `价格已更新为¥${newPrice}`,
        sender: 'seller',
        userId: goods.userId,
        senderId: sellerId,
        role: 'seller',
        createdAt: new Date()
    });
    
    xianyuLoadChatMessages(goodsId);
    xianyuShowDataStatus('价格已更新');
}

async function xianyuBlockUser() {
    const goods = XianyuAppState.currentGoods;
    if (!goods) return;
    
    const isUserAsSeller = goods.userId === XY_CURRENT_USER_ID;
    let targetUserId = null;
    let targetSenderId = null;
    
    if (isUserAsSeller) {
        const buyerMessage = await xianyuDb.messages.where('goodsId').equals(goods.id).filter(m => m.sender !== 'user' && m.role === 'buyer').first();
        if (buyerMessage) {
            targetUserId = buyerMessage.userId;
            targetSenderId = buyerMessage.senderId;
        }
    } else {
        const seller = await xianyuDb.users.get(goods.userId);
        targetUserId = goods.userId;
        targetSenderId = seller ? seller.userId : `seller_${goods.userId}`;
    }
    
    if (!targetUserId) {
        alert('无法确定要拉黑的用户');
        const menu = document.getElementById('xyChatMenu');
        if (menu) menu.style.display = 'none';
        return;
    }
    
    if (confirm('确定要拉黑该用户吗？')) {
        const currentUser = await xianyuDb.users.get(XY_CURRENT_USER_ID);
        if (!currentUser) {
            alert('用户信息不存在');
            const menu = document.getElementById('xyChatMenu');
            if (menu) menu.style.display = 'none';
            return;
        }
        
        const blockedUsers = currentUser.blockedUsers || [];
        
        if (!blockedUsers.includes(targetSenderId)) {
            blockedUsers.push(targetSenderId);
            await xianyuDb.users.update(XY_CURRENT_USER_ID, {
                blockedUsers: blockedUsers
            });
            
            xianyuShowDataStatus('已拉黑该用户');
            
            await xianyuDb.messages.add({
                goodsId: goods.id,
                content: '您已被拉黑',
                sender: 'system',
                userId: XY_CURRENT_USER_ID,
                senderId: `system_${XY_CURRENT_USER_ID}`,
                role: 'system',
                createdAt: new Date()
            });
            
            xianyuLoadChatMessages(goods.id);
        } else {
            xianyuShowDataStatus('该用户已被拉黑');
        }
    }
    
    const menu = document.getElementById('xyChatMenu');
    if (menu) menu.style.display = 'none';
}

// 闲鱼初始化 - 仅绑定事件，数据初始化在选择账号后进行
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await xianyuDb.open();
        
        const searchInput = document.getElementById('xySearchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                if (e.target.value.trim()) {
                    xianyuSearchGoods(e.target.value.trim());
                } else {
                    xianyuLoadGoods();
                }
            });
        }
        
        const collectBtn = document.getElementById('xyCollectBtn');
        if (collectBtn) {
            collectBtn.addEventListener('click', function() {
                if (XianyuAppState.currentGoods) {
                    xianyuToggleCollect(XianyuAppState.currentGoods.id);
                }
            });
        }
        
        const detailCollectBtn = document.getElementById('xyDetailCollectBtn');
        if (detailCollectBtn) {
            detailCollectBtn.addEventListener('click', function() {
                if (XianyuAppState.currentGoods) {
                    xianyuToggleCollect(XianyuAppState.currentGoods.id);
                }
            });
        }
        
        console.log('[闲鱼] 事件绑定完成，等待账号选择');
    } catch (error) {
        console.error('[闲鱼] 初始化失败:', error);
    }
});

// 闲鱼账号选择相关函数
function openXianyuApp() {
    document.getElementById('xianyuAppPage').classList.add('active');
    // 重置到账号选择页面
    document.getElementById('xySelectAccountPage').style.display = 'flex';
    document.getElementById('xyMainContent').style.display = 'none';
    XY_CURRENT_USER_ID = null;
    window.xianyuCurrentAccountId = null;
    window.xianyuCurrentAccountName = '';
    // 加载账号列表
    loadXianyuAccountList();
}

function closeXianyuApp() {
    document.getElementById('xianyuAppPage').classList.remove('active');
    XY_CURRENT_USER_ID = null;
    window.xianyuCurrentAccountId = null;
    window.xianyuCurrentAccountName = '';
}

// 退出闲鱼主界面，回到账号选择
function exitXianyuToSelect() {
    document.getElementById('xyMainContent').style.display = 'none';
    document.getElementById('xySelectAccountPage').style.display = 'flex';
    
    // 重置页面状态
    document.querySelectorAll('#xianyuAppPage .xy-page').forEach(page => {
        page.classList.remove('active');
    });
    const homePage = document.getElementById('xyHomePage');
    if (homePage) homePage.classList.add('active');
    
    // 重置Tab状态
    document.querySelectorAll('#xianyuAppPage .xy-tab-item').forEach(tab => {
        tab.classList.remove('active');
    });
    const homeTab = document.getElementById('xy-tab-home');
    if (homeTab) homeTab.classList.add('active');
    
    // 重置XianyuAppState
    XianyuAppState.currentPage = 'xyHomePage';
    XianyuAppState.currentTab = 'xy-tab-home';
    XianyuAppState.pageHistory = ['xyHomePage'];
    XianyuAppState.currentGoods = null;
    
    // 清除全局状态
    XY_CURRENT_USER_ID = null;
    window.xianyuCurrentAccountId = null;
    window.xianyuCurrentAccountName = '';
    
    loadXianyuAccountList();
}

// 加载微信账号列表
async function loadXianyuAccountList() {
    const accounts = await db.characters.where('type').equals('user').toArray();
    const listContainer = document.getElementById('xyAccountList');
    listContainer.innerHTML = '';
    
    if (accounts.length === 0) {
        listContainer.innerHTML = '<div class="xy-select-empty">暂无微信账号<div class="empty-hint">请先创建 User 档案并注册微信</div></div>';
        return;
    }
    
    accounts.forEach(account => {
        const item = document.createElement('div');
        item.className = 'xy-account-item';
        item.onclick = () => selectXianyuAccount(account.id, account.name);
        
        const avatarHtml = account.avatar 
            ? `<img src="${account.avatar}" alt="">` 
            : account.name.charAt(0);
        
        item.innerHTML = `
            <div class="xy-account-avatar">${avatarHtml}</div>
            <div class="xy-account-info">
                <div class="xy-account-name">${account.name}</div>
                <div class="xy-account-desc">${account.identity?.phone || account.identity?.wechat_id || 'WeChat用户'}</div>
            </div>
            <div class="xy-account-arrow">›</div>
        `;
        
        listContainer.appendChild(item);
    });
}

// 选择微信账号 → 直接进入闲鱼主界面
async function selectXianyuAccount(accountId, accountName) {
    XY_CURRENT_USER_ID = accountId;
    window.xianyuCurrentAccountId = accountId;
    window.xianyuCurrentAccountName = accountName;
    
    // 进入主界面
    await enterXianyuMainPage();
}

// 进入闲鱼主界面
async function enterXianyuMainPage() {
    document.getElementById('xySelectAccountPage').style.display = 'none';
    document.getElementById('xyMainContent').style.display = 'block';
    
    // 更新"我的"页面的用户信息为当前账号
    if (window.xianyuCurrentAccountId) {
        try {
            const accountChar = await db.characters.get(window.xianyuCurrentAccountId);
            if (accountChar) {
                const accountName = accountChar.nick || accountChar.name || '用户';
                const accountAvatar = accountChar.avatar || '';
                
                const nameEl = document.getElementById('xyUserName');
                const avatarEl = document.getElementById('xyUserAvatar');
                if (nameEl) nameEl.textContent = accountName;
                if (avatarEl) {
                    if (accountAvatar) {
                        avatarEl.innerHTML = `<img src="${accountAvatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
                    } else {
                        avatarEl.innerHTML = `<span style="font-size:24px;color:#e89ab0;">${accountName.charAt(0)}</span>`;
                    }
                }
            }
        } catch(e) {
            console.error('[闲鱼] 加载账号信息失败:', e);
        }
    }
    
    // 初始化当前账号的数据
    try {
        await xianyuDb.open().catch(() => {});
        await xianyuInitializeUser();
        await xianyuInitializeDefaultGoods();
        await xianyuLoadGoods();
        
        XianyuAppState.pageHistory = ['xyHomePage'];
        console.log('[闲鱼] 账号', window.xianyuCurrentAccountName, '初始化完成');
    } catch (error) {
        console.error('[闲鱼] 初始化失败:', error);
    }
}