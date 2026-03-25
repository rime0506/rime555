// ================== icity 日记应用 JS ==================
// 本文件包含 icity 日记应用（#icity*）的所有 JS 逻辑
// 依赖：icityDb, showToast, callAI 等全局变量（来自 script.js）
// ==================== icity 日记应用 ====================

// icity 当前选中的账号ID和角色信息
window.icityCurrentAccountId = null;
window.icityCurrentAccountName = '';

function openIcityApp() {
    document.getElementById('icityAppPage').classList.add('active');
    // 重置到账号选择页面
    document.getElementById('icitySelectAccountPage').style.display = 'flex';
    document.getElementById('icityMainContent').style.display = 'none';
    window.icityCurrentAccountId = null;
    window.icityCurrentAccountName = '';
    window.icitySelectedRole = null;
    // 加载账号列表
    loadIcityAccountList();
}

function closeIcityApp() {
    document.getElementById('icityAppPage').classList.remove('active');
    window.icityCurrentAccountId = null;
    window.icityCurrentAccountName = '';
    window.icitySelectedRole = null;
}

// 退出icity主界面，回到账号选择
function exitIcityToSelect() {
    document.getElementById('icityMainContent').style.display = 'none';
    document.getElementById('icitySelectAccountPage').style.display = 'flex';
    
    // 重置页面状态：确保下次进入时从列表页开始
    const listPage = document.getElementById('icityListPage');
    const detailPage = document.getElementById('icityDetailPage');
    const publishPage = document.getElementById('icityPublishPage');
    const myPage = document.getElementById('icityMyPage');
    if (listPage) listPage.classList.add('active');
    if (detailPage) detailPage.classList.remove('active');
    if (publishPage) publishPage.classList.remove('active');
    if (myPage) myPage.classList.remove('active');
    
    // 重置Tab状态
    const tabDiary = document.getElementById('icityTabDiary');
    const tabMy = document.getElementById('icityTabMy');
    if (tabDiary) tabDiary.classList.add('active');
    if (tabMy) tabMy.classList.remove('active');
    
    // 清除全局状态
    window.icityCurrentAccountId = null;
    window.icityCurrentAccountName = '';
    window.icityCurrentAccountAvatar = '';
    window.icitySelectedRole = null;
    window.icityInitialized = false;
    
    loadIcityAccountList();
}

// 加载微信账号列表（user类型的角色）
async function loadIcityAccountList() {
    const accounts = await db.characters.where('type').equals('user').toArray();
    const listContainer = document.getElementById('icityAccountList');
    listContainer.innerHTML = '';
    
    if (accounts.length === 0) {
        listContainer.innerHTML = '<div class="icity-select-empty">暂无微信账号<div class="empty-hint">请先创建 User 档案并注册微信</div></div>';
        return;
    }
    
    accounts.forEach(account => {
        const item = document.createElement('div');
        item.className = 'icity-account-item';
        item.onclick = () => selectIcityAccount(account.id, account.name);
        
        const avatarHtml = account.avatar 
            ? `<img src="${account.avatar}" alt="">` 
            : account.name.charAt(0);
        
        item.innerHTML = `
            <div class="icity-account-avatar">${avatarHtml}</div>
            <div class="icity-account-info">
                <div class="icity-account-name">${account.name}</div>
                <div class="icity-account-desc">${account.identity?.phone || account.identity?.wechat_id || 'WeChat用户'}</div>
            </div>
            <div class="icity-account-arrow">›</div>
        `;
        
        listContainer.appendChild(item);
    });
}

// 选择微信账号 → 直接进入日记主界面
async function selectIcityAccount(accountId, accountName) {
    window.icityCurrentAccountId = accountId;
    window.icityCurrentAccountName = accountName;
    window.icitySelectedRole = null;
    
    // 直接进入主界面
    await enterIcityMainPage();
}

// 进入 icity 主界面
async function enterIcityMainPage() {
    document.getElementById('icitySelectAccountPage').style.display = 'none';
    document.getElementById('icityMainContent').style.display = '';
    
    // 更新页面标题显示当前账号
    const pageTitle = document.querySelector('#icityListPage .page-title');
    if (pageTitle && window.icityCurrentAccountName) {
        pageTitle.textContent = `${window.icityCurrentAccountName} · 日记`;
    }
    
    // 更新"我的"页面的用户信息为当前账号
    if (window.icityCurrentAccountId) {
        try {
            const accountChar = await db.characters.get(window.icityCurrentAccountId);
            if (accountChar) {
                const accountName = accountChar.nick || accountChar.name || 'user';
                const accountWechatId = accountChar.identity?.wechat_id || accountChar.name || 'user';
                const accountAvatar = accountChar.avatar || '';
                
                // 更新"我的"页面头像、名字、ID
                const profileName = document.querySelector('#icityMyPage .profile-name');
                const profileId = document.querySelector('#icityMyPage .profile-id');
                const profileAvatar = document.querySelector('#icityMyPage .profile-avatar');
                if (profileName) profileName.textContent = accountName;
                if (profileId) profileId.textContent = `@${accountWechatId}`;
                if (profileAvatar) {
                    if (accountAvatar) {
                        profileAvatar.style.backgroundImage = `url(${accountAvatar})`;
                        profileAvatar.style.backgroundSize = 'cover';
                        profileAvatar.style.backgroundPosition = 'center';
                        profileAvatar.textContent = '';
                    } else {
                        // 没有头像时清除旧头像，显示名字首字
                        profileAvatar.style.backgroundImage = '';
                        profileAvatar.textContent = accountName.charAt(0);
                    }
                }
                
                // 更新"我的"页面标题
                const myPageTitle = document.querySelector('#icityMyPage .page-title');
                if (myPageTitle) myPageTitle.textContent = `${accountName} · 我的`;
                
                // 更新详情页头像和名字
                const detailAvatar = document.querySelector('#icityDetailPage .detail-avatar, #icityDetailPage .avatar');
                const detailUserName = document.querySelector('#icityDetailPage .user-name');
                const detailUserId = document.querySelector('#icityDetailPage .user-id');
                if (detailAvatar && accountAvatar) {
                    detailAvatar.src = accountAvatar;
                }
                
                // 保存到全局，方便其他地方使用
                window.icityCurrentAccountAvatar = accountAvatar;
                window.icityCurrentAccountName = accountName;
            }
        } catch(e) { console.warn(e); }
    }
    
    // 初始化或刷新 icity 功能
    if (!window.icityInitialized) {
        initIcityApp();
        window.icityInitialized = true;
    } else {
        // 重新加载当前账号的日记
        loadIcityDiariesFromStorage().catch(console.error);
        updateIcityMyDiaryList();
    }
}

function initIcityApp() {
    // DOM元素获取
    const listPage = document.getElementById('icityListPage');
    const detailPage = document.getElementById('icityDetailPage');
    const publishPage = document.getElementById('icityPublishPage');
    const myPage = document.getElementById('icityMyPage');
    const detailBackBtn = document.getElementById('icityDetailBackBtn');
    const detailContent = document.getElementById('icityDetailContent');
    const detailTime = document.getElementById('icityDetailTime');
    const tabPublishBtn = document.getElementById('icityTabPublishBtn');
    const publishCloseBtn = document.getElementById('icityPublishCloseBtn');
    const publishSubmit = document.getElementById('icityPublishSubmit');
    const tabDiary = document.getElementById('icityTabDiary');
    const tabMy = document.getElementById('icityTabMy');
    const myTabDiary = document.getElementById('icityMyTabDiary');
    const myTabPublishBtn = document.getElementById('icityMyTabPublishBtn');
    const myTabMy = document.getElementById('icityMyTabMy');
    const commentInput = document.querySelector('#icityContent .comment-input');
    const sendBtn = document.getElementById('icitySendBtn');
    const likeBtn = document.getElementById('icityLikeBtn');
    const profileEdit = document.getElementById('icityProfileEdit');

    // 1. 日记列表 -> 详情页（使用事件委托，因为列表是动态的）
    const diaryList = document.getElementById('icityDiaryList');
    if (diaryList) {
        diaryList.addEventListener('click', (e) => {
            const diaryItem = e.target.closest('.diary-item');
            if (diaryItem) {
                detailPage.dataset.fromPage = 'list';
                listPage.classList.remove('active');
                detailPage.classList.add('active');
                renderDiaryContentWithAnnotations(diaryItem.dataset.id, diaryItem.dataset.content).catch(console.error);
                detailTime.textContent = diaryItem.dataset.time;
                detailPage.dataset.currentDiaryId = diaryItem.dataset.id;
                detailPage.dataset.isUserPublished = diaryItem.dataset.isUserPublished;
                const roleName = diaryItem.querySelector('.user-name')?.textContent || 'user';
                const wechatId = diaryItem.querySelector('.user-id')?.textContent?.replace('@', '') || 'user';
                const avatarImg = diaryItem.querySelector('.avatar');
                const avatarUrl = avatarImg?.src || '';
                document.querySelector('#icityDetailPage .page-title').textContent = `${roleName} · 日记`;
                const detailAvatar = document.querySelector('#icityDetailPage .detail-avatar');
                const detailUsername = document.querySelector('#icityDetailPage .detail-username');
                const detailUserid = document.querySelector('#icityDetailPage .detail-userid');
                if (detailAvatar) {
                    if (avatarUrl && !avatarUrl.includes('data:image/svg')) {
                        detailAvatar.style.backgroundImage = `url(${avatarUrl})`;
                        detailAvatar.style.backgroundSize = 'cover';
                        detailAvatar.style.backgroundPosition = 'center';
                    } else {
                        detailAvatar.style.backgroundImage = '';
                        detailAvatar.textContent = roleName.charAt(0);
                    }
                }
                if (detailUsername) detailUsername.textContent = roleName;
                if (detailUserid) detailUserid.textContent = `@${wechatId}`;
            }
        });
    }

    // 2. 我的日记列表 -> 详情页
    const myDiaryList = document.querySelector('#icityMyPage .my-diary-list');
    if (myDiaryList) {
        myDiaryList.addEventListener('click', (e) => {
            const myDiaryItem = e.target.closest('.my-diary-item');
            if (myDiaryItem) {
                detailPage.dataset.fromPage = 'my';
                const diaryId = myDiaryItem.dataset.id;
                const diaryItem = document.querySelector(`#icityDiaryList .diary-item[data-id="${diaryId}"]`);
                myPage.classList.remove('active');
                detailPage.classList.add('active');
                renderDiaryContentWithAnnotations(myDiaryItem.dataset.id, myDiaryItem.dataset.content).catch(console.error);
                detailTime.textContent = myDiaryItem.dataset.time;
                detailPage.dataset.currentDiaryId = myDiaryItem.dataset.id;
                detailPage.dataset.isUserPublished = myDiaryItem.dataset.isUserPublished;
                if (diaryItem) {
                    const roleName = diaryItem.querySelector('.user-name')?.textContent || 'user';
                    const wechatId = diaryItem.querySelector('.user-id')?.textContent?.replace('@', '') || 'user';
                    const avatarImg = diaryItem.querySelector('.avatar');
                    const avatarUrl = avatarImg?.src || '';
                    document.querySelector('#icityDetailPage .page-title').textContent = `${roleName} · 日记`;
                    const detailAvatar = document.querySelector('#icityDetailPage .detail-avatar');
                    const detailUsername = document.querySelector('#icityDetailPage .detail-username');
                    const detailUserid = document.querySelector('#icityDetailPage .detail-userid');
                    if (detailAvatar) {
                        if (avatarUrl && !avatarUrl.includes('data:image/svg')) {
                            detailAvatar.style.backgroundImage = `url(${avatarUrl})`;
                            detailAvatar.style.backgroundSize = 'cover';
                            detailAvatar.style.backgroundPosition = 'center';
                        } else {
                            detailAvatar.style.backgroundImage = '';
                            detailAvatar.textContent = roleName.charAt(0);
                        }
                    }
                    if (detailUsername) detailUsername.textContent = roleName;
                    if (detailUserid) detailUserid.textContent = `@${wechatId}`;
                }
            }
        });
    }

    // 3. 详情页 -> 列表页/我的页
    if (detailBackBtn) detailBackBtn.addEventListener('click', () => {
        detailPage.classList.remove('active');
        if (detailPage.dataset.fromPage === 'my') {
            myPage.classList.add('active');
        } else {
            listPage.classList.add('active');
        }
    });

    // 4. 列表页底部Tab切换
    if (tabDiary) tabDiary.addEventListener('click', () => {
        listPage.classList.add('active');
        myPage.classList.remove('active');
        tabDiary.classList.add('active');
        if (tabMy) tabMy.classList.remove('active');
        if (myTabDiary) myTabDiary.classList.add('active');
        if (myTabMy) myTabMy.classList.remove('active');
    });

    if (tabMy) tabMy.addEventListener('click', () => {
        listPage.classList.remove('active');
        myPage.classList.add('active');
        if (tabDiary) tabDiary.classList.remove('active');
        tabMy.classList.add('active');
        if (myTabDiary) myTabDiary.classList.remove('active');
        if (myTabMy) myTabMy.classList.add('active');
    });

    // 5. 我的页面底部Tab切换
    if (myTabDiary) myTabDiary.addEventListener('click', () => {
        myPage.classList.remove('active');
        listPage.classList.add('active');
        myTabDiary.classList.add('active');
        if (myTabMy) myTabMy.classList.remove('active');
        if (tabDiary) tabDiary.classList.add('active');
        if (tabMy) tabMy.classList.remove('active');
    });

    if (myTabMy) myTabMy.addEventListener('click', () => {
        listPage.classList.remove('active');
        myPage.classList.add('active');
        if (myTabDiary) myTabDiary.classList.remove('active');
        myTabMy.classList.add('active');
        if (tabDiary) tabDiary.classList.remove('active');
        if (tabMy) tabMy.classList.add('active');
    });

    // 6. 发布按钮点击
    if (tabPublishBtn) tabPublishBtn.addEventListener('click', () => {
        listPage.classList.remove('active');
        publishPage.classList.add('active');
    });

    if (myTabPublishBtn) myTabPublishBtn.addEventListener('click', () => {
        myPage.classList.remove('active');
        publishPage.classList.add('active');
    });

    // 7. 关闭发布页
    if (publishCloseBtn) publishCloseBtn.addEventListener('click', () => {
        publishPage.classList.remove('active');
        if (listPage.classList.contains('active')) {
            listPage.classList.add('active');
        } else {
            myPage.classList.add('active');
        }
    });

    // 8. 发布日记功能
    if (publishSubmit) publishSubmit.addEventListener('click', async () => {
        const title = document.getElementById('icityTitleInput').value;
        const content = document.getElementById('icityContentInput').value.trim();
        if (content === '') {
            alert('请输入日记内容～');
            return;
        }
        
        // 获取当前账号信息
        let userName = 'user';
        let userWechatId = 'user';
        let userAvatar = '';
        if (window.icityCurrentAccountId) {
            try {
                const accountChar = await db.characters.get(window.icityCurrentAccountId);
                if (accountChar) {
                    userName = accountChar.nick || accountChar.name || 'user';
                    userWechatId = accountChar.identity?.wechat_id || accountChar.name || 'user';
                    userAvatar = accountChar.avatar || '';
                }
            } catch(e) {
                console.warn('获取账号信息失败:', e);
            }
        }
        const currentPersona = JSON.parse(localStorage.getItem('currentMyPersona') || 'null');
        if (!window.icityCurrentAccountId && currentPersona) {
            userName = currentPersona.nickname || userName;
            userWechatId = currentPersona.wechatId || userWechatId;
            userAvatar = currentPersona.avatarUrl || userAvatar;
        }
        
        const today = new Date();
        const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        const timeStr = `${String(today.getHours()).padStart(2, '0')}:${String(today.getMinutes()).padStart(2, '0')}`;
        
        const diaryId = Date.now();
        const fullContent = title ? `${title}\n\n${content}` : content;
        
        addIcityDiary({
            id: diaryId,
            content: fullContent,
            time: `${dateStr} ${timeStr}`,
            roleName: userName,
            role: {
                name: userName,
                realName: currentPersona?.realName || userName,
                wechatId: userWechatId,
                friend: {
                    avatar: userAvatar
                }
            },
            isUserPublished: true
        });
        
        document.getElementById('icityTitleInput').value = '';
        document.getElementById('icityContentInput').value = '';
        publishPage.classList.remove('active');
        listPage.classList.add('active');
        showIcityGenerateStatus('日记发布成功！', 'success');
    });

    // 9. 评论发送功能
    if (sendBtn) sendBtn.addEventListener('click', () => {
        const comment = commentInput ? commentInput.value.trim() : '';
        if (comment === '') {
            alert('请输入评论内容～');
            return;
        }
        alert(`评论发送成功：${comment}`);
        if (commentInput) commentInput.value = '';
    });

    // 10. 详情页点赞交互
    let isLiked = false;
    if (likeBtn) likeBtn.addEventListener('click', () => {
        isLiked = !isLiked;
        if (isLiked) {
            likeBtn.style.color = '#ff4d6d';
            likeBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5 22 12.28 18.6 15.36 13.45 20.04L12 21.35z"/></svg> 已喜欢';
        } else {
            likeBtn.style.color = '#999';
            likeBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M16.5 3c-1.74 0-3.41.81-4.5 2.09C10.91 3.81 9.24 3 7.5 3 4.42 3 2 5.42 2 8.5c0 3.78 3.4 6.86 8.55 11.54L12 21.35l1.45-1.32C18.6 15.36 22 12.28 22 8.5 22 5.42 19.58 3 16.5 3zM12.1 18.55l-.1.1-.1-.1C7.14 14.24 4 11.39 4 8.5 4 6.5 5.5 5 7.5 5c1.54 0 3.04.99 3.57 2.36h1.87C13.46 5.99 14.96 5 16.5 5c2 0 3.5 1.5 3.5 3.5 0 2.89-3.14 5.74-7.9 10.05z"/></svg> 喜欢';
        }
    });

    // 11. 我的页面编辑资料点击
    if (profileEdit) {
        profileEdit.addEventListener('click', () => {
            openIcityEditProfileModal();
        });
    }
    
    // 12. 删除日记按钮点击
    const deleteBtn = document.getElementById('icityDeleteBtn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', async () => {
            const diaryId = detailPage.dataset.currentDiaryId;
            if (!diaryId) {
                alert('无法获取日记ID');
                return;
            }
            
            if (confirm('确定要删除这篇日记吗？删除后无法恢复！')) {
                try {
                    await icityDb.diaries.delete(parseInt(diaryId));
                    await icityDb.annotations.where('diaryId').equals(parseInt(diaryId)).delete();
                    
                    const diaryItem = document.querySelector(`#icityDiaryList .diary-item[data-id="${diaryId}"]`);
                    if (diaryItem) diaryItem.remove();
                    
                    const myDiaryItem2 = document.querySelector(`.my-diary-item[data-id="${diaryId}"]`);
                    if (myDiaryItem2) myDiaryItem2.remove();
                    
                    updateIcityMyDiaryList();
                    
                    const remainingDiaries = document.querySelectorAll('#icityDiaryList .diary-item');
                    if (remainingDiaries.length === 0) {
                        document.getElementById('icityDiaryList').innerHTML = '<div style="text-align: center; padding: 40px 20px; color: #999; font-size: 14px;">还没有日记<br><div style="font-size: 12px; margin-top: 8px; color: #ccc;">点击右上角发布或生成日记</div></div>';
                    }
                    
                    showIcityGenerateStatus('日记已删除', 'success');
                    
                    detailPage.classList.remove('active');
                    if (detailPage.dataset.fromPage === 'my') {
                        myPage.classList.add('active');
                    } else {
                        listPage.classList.add('active');
                    }
                } catch (error) {
                    console.error('删除日记失败:', error);
                    showIcityGenerateStatus('删除失败: ' + error.message, 'error');
                }
            }
        });
    }

    // 从Dexie加载日记
    loadIcityDiariesFromStorage().catch(console.error);
    
    // 初始化"我的日记"列表
    updateIcityMyDiaryList();
    
    // 初始化文本标注功能
    initIcityAnnotation();

    // 13. 角色选择按钮点击
    const selectRoleBtn = document.getElementById('icitySelectRoleBtn');
    if (selectRoleBtn) selectRoleBtn.addEventListener('click', () => {
        openIcityRoleModal();
    });

    // 14. 生成日记按钮点击
    const generateBtn = document.getElementById('icityGenerateBtn');
    if (generateBtn) generateBtn.addEventListener('click', () => {
        generateIcityDiary();
    });
}

// icity 角色选择模态框（在app内切换角色，按账号过滤好友）
async function openIcityRoleModal() {
    // 从数据库获取角色列表，按当前账号过滤好友（排除联机好友）
    const allChars = await db.characters.toArray();
    const currentAccountId = window.icityCurrentAccountId;
    const friends = allChars.filter(c => {
        if (c.type === 'user') return false;
        if (c.isOnlineFriend === true) return false; // 排除联机好友
        if (currentAccountId) {
            const status = getFriendStatus(c, currentAccountId);
            return status === 'friend';
        }
        return c.type === 'char' || c.type === 'npc';
    });
    const roleList = document.getElementById('icityRoleList');
    
    if (friends.length === 0) {
        roleList.innerHTML = '<div style="text-align: center; padding: 40px 20px; color: #999; font-size: 14px;">还没有创建角色<br><div style="font-size: 12px; margin-top: 8px; color: #ccc;">请先创建角色</div></div>';
    } else {
        roleList.innerHTML = '';
        friends.forEach((friend, index) => {
            const roleItem = document.createElement('div');
            roleItem.className = 'icity-role-item';
            roleItem.setAttribute('data-index', index);
            
            const friendName = friend.nick || friend.name;
            const friendPersona = friend.description || friend.personality || '暂无详细人设';
            
            const prompt = `你是一个真实的人，名字叫${friendName}。${friendPersona}`;
            
            roleItem.setAttribute('data-role', friendName);
            roleItem.setAttribute('data-prompt', prompt);
            roleItem.setAttribute('data-name', friend.name);
            
            roleItem.innerHTML = `
                <div style="display: flex; align-items: center; gap: 12px;">
                    ${friend.avatar ? `<img src="${friend.avatar}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover;" alt="">` : `<div style="width: 40px; height: 40px; border-radius: 50%; background: #eee; display: flex; align-items: center; justify-content: center; color: #999; font-size: 16px;">${friendName.charAt(0)}</div>`}
                    <div style="flex: 1;">
                        <div class="icity-role-name">${friendName}</div>
                        <div class="icity-role-desc">${friendPersona.length > 50 ? friendPersona.substring(0, 50) + '...' : friendPersona}</div>
                    </div>
                </div>
            `;
            
            roleItem.addEventListener('click', () => {
                document.querySelectorAll('.icity-role-item').forEach(r => r.classList.remove('selected'));
                roleItem.classList.add('selected');
                window.icitySelectedRole = {
                    name: friendName,
                    realName: friendName,
                    wechatId: friend.id || friendName.toLowerCase().replace(/\s/g, ''),
                    prompt: prompt,
                    persona: friendPersona,
                    friend: friend
                };
                setTimeout(() => {
                    closeIcityRoleModal();
                }, 300);
            });
            
            roleList.appendChild(roleItem);
        });
    }
    
    document.getElementById('icityRoleModal').style.display = 'flex';
}

function closeIcityRoleModal() {
    document.getElementById('icityRoleModal').style.display = 'none';
}

// 打开编辑资料模态框
async function openIcityEditProfileModal() {
    const modal = document.getElementById('icityEditProfileModal');
    
    let nickname = '';
    let wechatId = '';
    if (window.icityCurrentAccountId) {
        try {
            const accountChar = await db.characters.get(window.icityCurrentAccountId);
            if (accountChar) {
                nickname = accountChar.nick || accountChar.name || '';
                wechatId = accountChar.identity?.wechat_id || '';
            }
        } catch(e) { console.warn(e); }
    } else {
        const currentPersona = JSON.parse(localStorage.getItem('currentMyPersona') || 'null');
        nickname = currentPersona?.nickname || '';
        wechatId = currentPersona?.wechatId || '';
    }
    
    document.getElementById('icityEditUsername').value = nickname;
    document.getElementById('icityEditWechatId').value = wechatId;
    
    modal.style.display = 'flex';
}

function closeIcityEditProfileModal() {
    document.getElementById('icityEditProfileModal').style.display = 'none';
}

function saveIcityProfile() {
    const username = document.getElementById('icityEditUsername').value.trim();
    const wechatId = document.getElementById('icityEditWechatId').value.trim();
    
    if (!username) {
        alert('请输入用户名');
        return;
    }
    
    if (!wechatId) {
        alert('请输入微信ID');
        return;
    }
    
    const currentPersona = JSON.parse(localStorage.getItem('currentMyPersona') || '{}');
    currentPersona.nickname = username;
    currentPersona.wechatId = wechatId;
    localStorage.setItem('currentMyPersona', JSON.stringify(currentPersona));
    
    const profileName = document.querySelector('#icityMyPage .profile-name');
    const profileId = document.querySelector('#icityMyPage .profile-id');
    if (profileName) profileName.textContent = username;
    if (profileId) profileId.textContent = `@${wechatId}`;
    
    closeIcityEditProfileModal();
    showIcityGenerateStatus('资料保存成功！', 'success');
}

// 显示生成进度提示
function showIcityGenerateStatus(message, type = 'info') {
    const oldToast = document.getElementById('icityGenerateToast');
    if (oldToast) oldToast.remove();
    
    const toast = document.createElement('div');
    toast.id = 'icityGenerateToast';
    toast.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: ${type === 'error' ? '#ff4d4f' : type === 'success' ? '#52c41a' : 'rgba(0,0,0,0.8)'};
        color: white;
        padding: 20px 30px;
        border-radius: 10px;
        z-index: 10002;
        font-size: 14px;
        max-width: 300px;
        text-align: center;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    if (type === 'success' || type === 'error') {
        setTimeout(() => {
            toast.remove();
        }, 3000);
    }
}

// 获取AI API配置（从Dexie）
async function getIcityApiConfig() {
    const urlItem = await db.dexiData.get('aiBaseUrl');
    const keyItem = await db.dexiData.get('aiApiKey');
    const modelItem = await db.dexiData.get('aiCurrentModel');
    const tempItem = await db.dexiData.get('aiTemperature');
    
    let baseUrl = (urlItem?.value || 'https://api.openai.com/v1').trim();
    if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);
    if (!baseUrl.includes('/v1')) baseUrl += '/v1';
    const apiUrl = baseUrl + '/chat/completions';
    
    return {
        apiUrl: apiUrl,
        apiKey: keyItem?.value || '',
        model: modelItem?.value || 'gpt-3.5-turbo',
        temperature: parseFloat(tempItem?.value) || 0.8
    };
}

// 生成 icity 日记
async function generateIcityDiary() {
    if (!window.icitySelectedRole) {
        showIcityGenerateStatus('请先选择角色', 'error');
        openIcityRoleModal();
        return;
    }

    const config = await getIcityApiConfig();

    if (!config.apiKey) {
        showIcityGenerateStatus('请先在设置中配置 API 密钥', 'error');
        return;
    }

    const generateBtn = document.getElementById('icityGenerateBtn');
    const originalHTML = generateBtn.innerHTML;
    generateBtn.innerHTML = '<svg class="icon-svg" viewBox="0 0 24 24"><path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/></svg>';
    generateBtn.style.pointerEvents = 'none';
    showIcityGenerateStatus('正在生成日记并处理任务...', 'info');

    try {
        const today = new Date();
        const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        const timeStr = `${String(today.getHours()).padStart(2, '0')}:${String(today.getMinutes()).padStart(2, '0')}`;

        // 获取聊天记录
        let recentChatHistory = '';
        try {
            const friendChar = window.icitySelectedRole.friend;
            if (friendChar) {
                const accountId = typeof getCurrentAccountId === 'function' ? getCurrentAccountId() : null;
                const chatHistory = typeof getChatHistory === 'function' ? getChatHistory(friendChar, accountId) : [];
                if (chatHistory && chatHistory.length > 0) {
                    const recentMessages = chatHistory.slice(-10).map(msg => {
                        const sender = msg.isSelf ? '我' : (friendChar.nick || friendChar.name);
                        return `${sender}: ${msg.content || msg.text || ''}`;
                    }).join('\n');
                    if (recentMessages) {
                        recentChatHistory = `\n\n最近的聊天记录：\n${recentMessages}`;
                    }
                }
            }
        } catch (e) {
            console.warn('获取聊天记录失败:', e);
        }
        
        // 收集任务信息
        let myLastDiaryWithAnnotations = null;
        let myLastDiaryId = null; // 保存上一篇AI日记的ID，用于后续保存回复
        let userRecentDiary = null;
        
        try {
            const currentAccountId = window.icityCurrentAccountId || 0;
            let allDiaries;
            if (currentAccountId) {
                allDiaries = await icityDb.diaries.where('accountId').equals(currentAccountId).reverse().sortBy('createdAt');
                allDiaries = allDiaries.slice(0, 10);
            } else {
                allDiaries = await icityDb.diaries.orderBy('createdAt').reverse().limit(10).toArray();
            }
            
            const myLastDiary = allDiaries.find(d => d.isUserPublished === 0 || d.isUserPublished === false);
            if (myLastDiary) {
                myLastDiaryId = myLastDiary.id; // 记住这个ID，后面要用
                // 同时用数字和字符串查询标注
                const annotations = await getIcityAnnotations(myLastDiary.id);
                const userAnnotations = annotations.filter(ann => !ann.isAI && !ann.isReply);
                if (userAnnotations.length > 0) {
                    myLastDiaryWithAnnotations = {
                        content: myLastDiary.content,
                        annotations: userAnnotations
                    };
                }
            }
            
            userRecentDiary = allDiaries.find(d => d.isUserPublished === 1 || d.isUserPublished === true);
        } catch (e) {
            console.warn('获取日记数据失败:', e);
        }

        const roleName = window.icitySelectedRole.name || window.icitySelectedRole.realName || '角色';
        const rolePersona = window.icitySelectedRole.persona || '';

        // 构建自然的 system prompt
        const systemPrompt = `你现在是${roleName}，一个真实存在的人。以下是关于你的信息：
${rolePersona}

你正在写自己的私人日记。要求：
- 完全以${roleName}的第一人称视角书写，像真人在手机备忘录里随手写的日记
- 语气自然随意，可以有口语化表达、语气词、省略号、感叹号
- 不要写得像作文或文学作品，要像真人的碎碎念、流水账、心情记录
- 可以写今天发生的小事、突然想到的事、对某件事的吐槽、纠结、开心、难过等等
- 内容要有细节和画面感，比如具体吃了什么、看到了什么、和谁说了什么话
- 可以有前后跳跃、想到哪写到哪的感觉，不需要严格的逻辑结构
- 可以夹杂一些内心独白、自问自答
- 字数在800-2000字左右，不要太短也不要刻意凑字数
- 【重要】不要在日记正文开头或任何位置写日期、时间、标题（如"2025年1月1日"、"周一"、"Day X"等），系统会自动添加日期，你只需要写日记内容本身`;

        // 构建 user prompt
        let userPromptParts = [];
        
        userPromptParts.push(`请以${roleName}的身份写一篇今天的日记。`);
        
        if (recentChatHistory) {
            userPromptParts.push(`\n参考最近和别人的聊天内容，可以在日记里自然地提到相关的事（不要照搬聊天记录，用日记的口吻去写感受和想法）：${recentChatHistory}`);
        }

        // 标注任务
        let hasExtraTasks = false;
        if (myLastDiaryWithAnnotations || userRecentDiary) {
            hasExtraTasks = true;
            userPromptParts.push(`\n除了日记之外，还有额外任务：`);
            if (myLastDiaryWithAnnotations) {
                userPromptParts.push(`- 用户对你上一篇日记进行了标注评论，请以${roleName}的口吻对每条给出简短回应（像朋友之间回复留言一样自然，15-30字）：`);
                myLastDiaryWithAnnotations.annotations.forEach(ann => {
                    userPromptParts.push(`  · 标注内容："${ann.text}" → 用户评论：${ann.comment}`);
                });
            }
            if (userRecentDiary) {
                userPromptParts.push(`- 用户写了一篇日记，请以${roleName}的口吻对其中2-4处内容进行标注评论（像朋友在旁边写批注一样，真实自然，15-40字）：`);
                userPromptParts.push(`  用户的日记内容：${userRecentDiary.content.substring(0, 1500)}`);
            }
        }

        userPromptParts.push(`\n请严格按以下JSON格式输出，不要输出其他任何内容：
{
  "diary": "日记正文（纯文本，用\\n换行）",
  "repliesToUserAnnotations": ${myLastDiaryWithAnnotations ? '[{"text": "你日记中被标注的原文片段", "comment": "你的回应"}]' : '[]'},
  "annotationsForUserDiary": ${userRecentDiary ? '[{"text": "用户日记中的原文片段", "comment": "你的标注评论"}]' : '[]'}
}`);

        const userPrompt = userPromptParts.join('\n');

        const response = await fetch(config.apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.apiKey}` },
            body: JSON.stringify({
                model: config.model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                temperature: config.temperature || 0.9,
                max_tokens: 8000
            })
        });

        if (!response.ok) throw new Error(`API请求失败: ${response.status}`);

        const data = await response.json();
        const responseContent = data.choices?.[0]?.message?.content?.trim() || '';
        
        let jsonStr = responseContent;
        if (jsonStr.startsWith('```json')) {
            jsonStr = jsonStr.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (jsonStr.startsWith('```')) {
            jsonStr = jsonStr.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }
        
        const parsed = JSON.parse(jsonStr);
        const diaryContent = parsed.diary || '';
        const replies = parsed.repliesToUserAnnotations || [];
        const annotationsFromAI = parsed.annotationsForUserDiary || [];
        
        console.log('[icity生成] 日记长度:', diaryContent.length, '回复标注数:', replies.length, '标注用户日记数:', annotationsFromAI.length);
        console.log('[icity生成] myLastDiaryId:', myLastDiaryId, 'myLastDiaryWithAnnotations:', !!myLastDiaryWithAnnotations, 'userRecentDiary:', !!userRecentDiary);
        
        if (!diaryContent || diaryContent.length < 50) throw new Error('生成的日记内容过短');
        
        const diaryId = Date.now();
        addIcityDiary({
            id: diaryId,
            content: diaryContent,
            time: `${dateStr} ${timeStr}`,
            roleName: window.icitySelectedRole.name || window.icitySelectedRole.realName || 'user',
            role: window.icitySelectedRole,
            isUserPublished: false
        });
        
        // 保存对我上一篇日记的回复标注（使用之前记住的myLastDiaryId，不再重新查询）
        if (replies.length > 0 && myLastDiaryWithAnnotations && myLastDiaryId) {
            console.log('[icity] 保存回复标注到日记ID:', myLastDiaryId, '回复数量:', replies.length);
            const replyAnnotations = replies.map((reply, idx) => ({
                id: Date.now() + idx + 1000,
                diaryId: myLastDiaryId,
                text: reply.text,
                comment: reply.comment,
                createdAt: new Date().toISOString(),
                isAI: true,
                aiRole: window.icitySelectedRole.name,
                isReply: true,
                accountId: window.icityCurrentAccountId || 0
            }));
            for (const ann of replyAnnotations) {
                await icityDb.annotations.put(ann);
            }
        }
        
        // 保存对用户日记的标注
        if (annotationsFromAI.length > 0 && userRecentDiary) {
            const annotationsToSave = annotationsFromAI.map((ann, idx) => ({
                id: Date.now() + idx + 2000,
                diaryId: userRecentDiary.id,
                text: ann.text,
                comment: ann.comment,
                createdAt: new Date().toISOString(),
                isAI: true,
                aiRole: window.icitySelectedRole.name,
                accountId: window.icityCurrentAccountId || 0
            }));
            for (const ann of annotationsToSave) {
                await icityDb.annotations.put(ann);
            }
        }
        
        showIcityGenerateStatus(`完成！${replies.length > 0 ? `回复了${replies.length}条标注，` : ''}${annotationsFromAI.length > 0 ? `标注了你的日记${annotationsFromAI.length}处` : ''}`, 'success');
        
    } catch (error) {
        console.error('生成失败:', error);
        showIcityGenerateStatus(`生成失败：${error.message}`, 'error');
    } finally {
        generateBtn.innerHTML = originalHTML;
        generateBtn.style.pointerEvents = 'auto';
    }
}

// 添加日记到列表
function addIcityDiary(diary) {
    const diaryList = document.getElementById('icityDiaryList');
    const date = new Date(diary.time);
    const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
    const weekDays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
    const dateStr = `${monthNames[date.getMonth()]}${date.getDate()}日 · ${weekDays[date.getDay()]} ${date.getFullYear()}`;
    const timeStr = diary.time.split(' ')[1] || '00:00';
    
    const role = diary.role || window.icitySelectedRole || {};
    const avatarUrl = role.friend?.avatar || `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Crect width='40' height='40' fill='%23ddd'/%3E%3Ccircle cx='20' cy='20' r='15' fill='%23ccc'/%3E%3C/svg%3E`;
    const wechatId = role.wechatId || role.friend?.id || 'user';
    const roleName = diary.roleName || role.name || role.realName || 'user';
    
    const preview = diary.content.replace(/\n/g, ' ').substring(0, 50) + (diary.content.length > 50 ? '...' : '');

    const diaryItem = document.createElement('div');
    diaryItem.className = 'diary-item';
    diaryItem.setAttribute('data-id', diary.id);
    diaryItem.setAttribute('data-content', diary.content);
    diaryItem.setAttribute('data-time', diary.time);
    diaryItem.setAttribute('data-role-name', roleName);
    diaryItem.setAttribute('data-wechat-id', wechatId);
    diaryItem.setAttribute('data-avatar-url', avatarUrl);
    diaryItem.setAttribute('data-is-user-published', diary.isUserPublished ? 'true' : 'false');
    
    diaryItem.innerHTML = `
        <div class="diary-header">
            <div class="user-info">
                <img src="${avatarUrl}" alt="头像" class="avatar" style="border-radius: 50%; object-fit: cover;">
                <div class="user-name-box">
                    <div class="user-name">${roleName}</div>
                    <div class="user-id">@${wechatId}</div>
                </div>
            </div>
            <div class="diary-date">${dateStr}</div>
        </div>
        <div class="diary-content">${preview}</div>
        <div class="diary-actions">
            <div class="action-item">
                <svg viewBox="0 0 24 24"><path d="M16.5 3c-1.74 0-3.41.81-4.5 2.09C10.91 3.81 9.24 3 7.5 3 4.42 3 2 5.42 2 8.5c0 3.78 3.4 6.86 8.55 11.54L12 21.35l1.45-1.32C18.6 15.36 22 12.28 22 8.5 22 5.42 19.58 3 16.5 3zM12.1 18.55l-.1.1-.1-.1C7.14 14.24 4 11.39 4 8.5 4 6.5 5.5 5 7.5 5c1.54 0 3.04.99 3.57 2.36h1.87C13.46 5.99 14.96 5 16.5 5c2 0 3.5 1.5 3.5 3.5 0 2.89-3.14 5.74-7.9 10.05z"/></svg>
                0
            </div>
            <div class="action-item">
                <svg viewBox="0 0 24 24"><path d="M21.99 4c0-1.1-.89-2-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4-.01-18zM18 14H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/></svg>
                0
            </div>
            <div class="action-item">
                <svg viewBox="0 0 24 24"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg>
                ${timeStr}
            </div>
            <div class="more-btn">
                <svg viewBox="0 0 24 24"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>
            </div>
        </div>
    `;

    const firstChild = diaryList.firstElementChild;
    if (firstChild && firstChild.style && firstChild.style.textAlign === 'center') {
        diaryList.innerHTML = '';
    }
    
    if (diaryList.firstChild) {
        diaryList.insertBefore(diaryItem, diaryList.firstChild);
    } else {
        diaryList.appendChild(diaryItem);
    }

    updateIcityMyDiaryList();
    
    saveIcityDiaryToDexie(diary.id, {
        content: diary.content,
        time: diary.time,
        roleName: roleName,
        wechatId: wechatId,
        avatarUrl: avatarUrl,
        isUserPublished: diary.isUserPublished ? 1 : 0,
        createdAt: new Date().toISOString(),
        accountId: window.icityCurrentAccountId || 0
    });
}

// 保存单个日记到Dexie
async function saveIcityDiaryToDexie(diaryId, diaryData) {
    try {
        await icityDb.diaries.put({
            id: diaryId,
            accountId: window.icityCurrentAccountId || 0,
            ...diaryData
        });
    } catch (error) {
        console.error('保存日记到Dexie失败:', error);
    }
}

// 从Dexie加载所有日记（按accountId过滤）
async function loadIcityDiariesFromStorage() {
    const diaryList = document.getElementById('icityDiaryList');
    if (!diaryList) return;
    
    const currentAccountId = window.icityCurrentAccountId || 0;
    
    try {
        const savedDiaries = localStorage.getItem('icity_diaries');
        if (savedDiaries) {
            try {
                const diaries = JSON.parse(savedDiaries);
                for (const diary of diaries) {
                    await icityDb.diaries.put({
                        id: diary.id,
                        content: diary.content,
                        time: diary.time,
                        roleName: diary.roleName || 'user',
                        wechatId: diary.wechatId || 'user',
                        avatarUrl: diary.avatarUrl || '',
                        isUserPublished: diary.isUserPublished ? 1 : 0,
                        createdAt: new Date().toISOString(),
                        accountId: currentAccountId
                    });
                }
                localStorage.removeItem('icity_diaries');
            } catch (e) {
                console.error('迁移localStorage数据失败:', e);
            }
        }
        
        // 按 accountId 过滤日记
        let diaries;
        if (currentAccountId) {
            diaries = (await icityDb.diaries.where('accountId').equals(currentAccountId).reverse().toArray());
        } else {
            diaries = await icityDb.diaries.orderBy('id').reverse().toArray();
        }
        
        if (diaries.length === 0) {
            diaryList.innerHTML = '<div style="text-align: center; padding: 40px 20px; color: #999; font-size: 14px;">还没有日记<br><div style="font-size: 12px; margin-top: 8px; color: #ccc;">点击右上角发布或生成日记</div></div>';
            return;
        }
        
        diaryList.innerHTML = '';
        
        diaries.sort((a, b) => {
            const timeA = new Date(a.time.replace(/-/g, '/'));
            const timeB = new Date(b.time.replace(/-/g, '/'));
            return timeB - timeA;
        });
        
        diaries.forEach(diary => {
            const diaryItem = document.createElement('div');
            diaryItem.className = 'diary-item';
            diaryItem.setAttribute('data-id', diary.id);
            diaryItem.setAttribute('data-content', diary.content);
            diaryItem.setAttribute('data-time', diary.time);
            diaryItem.setAttribute('data-role-name', diary.roleName || 'user');
            diaryItem.setAttribute('data-wechat-id', diary.wechatId || 'user');
            diaryItem.setAttribute('data-avatar-url', diary.avatarUrl || '');
            diaryItem.setAttribute('data-is-user-published', diary.isUserPublished ? 'true' : 'false');
            
            const date = new Date(diary.time.replace(/-/g, '/'));
            const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
            const weekDays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
            const dateStr = `${monthNames[date.getMonth()]}${date.getDate()}日 · ${weekDays[date.getDay()]} ${date.getFullYear()}`;
            const timeStr = diary.time.split(' ')[1] || '00:00';
            const preview = diary.content.replace(/\n/g, ' ').substring(0, 50) + (diary.content.length > 50 ? '...' : '');
            
            diaryItem.innerHTML = `
                <div class="diary-header">
                    <div class="user-info">
                        <img src="${diary.avatarUrl || ''}" alt="头像" class="avatar" style="border-radius: 50%; object-fit: cover;">
                        <div class="user-name-box">
                            <div class="user-name">${diary.roleName || 'user'}</div>
                            <div class="user-id">@${diary.wechatId || 'user'}</div>
                        </div>
                    </div>
                    <div class="diary-date">${dateStr}</div>
                </div>
                <div class="diary-content">${preview}</div>
                <div class="diary-actions">
                    <div class="action-item">
                        <svg viewBox="0 0 24 24"><path d="M16.5 3c-1.74 0-3.41.81-4.5 2.09C10.91 3.81 9.24 3 7.5 3 4.42 3 2 5.42 2 8.5c0 3.78 3.4 6.86 8.55 11.54L12 21.35l1.45-1.32C18.6 15.36 22 12.28 22 8.5 22 5.42 19.58 3 16.5 3zM12.1 18.55l-.1.1-.1-.1C7.14 14.24 4 11.39 4 8.5 4 6.5 5.5 5 7.5 5c1.54 0 3.04.99 3.57 2.36h1.87C13.46 5.99 14.96 5 16.5 5c2 0 3.5 1.5 3.5 3.5 0 2.89-3.14 5.74-7.9 10.05z"/></svg>
                        0
                    </div>
                    <div class="action-item">
                        <svg viewBox="0 0 24 24"><path d="M21.99 4c0-1.1-.89-2-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4-.01-18zM18 14H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/></svg>
                        0
                    </div>
                    <div class="action-item">
                        <svg viewBox="0 0 24 24"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg>
                        ${timeStr}
                    </div>
                    <div class="more-btn">
                        <svg viewBox="0 0 24 24"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>
                    </div>
                </div>
            `;
            
            diaryList.appendChild(diaryItem);
        });
        
        updateIcityMyDiaryList();
    } catch (error) {
        console.error('加载日记失败:', error);
        diaryList.innerHTML = '<div style="text-align: center; padding: 40px 20px; color: #999; font-size: 14px;">加载日记失败</div>';
    }
}

// 更新"我的日记"列表
function updateIcityMyDiaryList() {
    const allDiaryItems = document.querySelectorAll('#icityContent .diary-item');
    const userPublishedItems = Array.from(allDiaryItems).filter(item => 
        item.dataset.isUserPublished === 'true'
    );
    const myDiaryList = document.querySelector('#icityMyPage .my-diary-list');
    
    if (!myDiaryList) return;
    
    myDiaryList.innerHTML = '';
    
    if (userPublishedItems.length === 0) {
        myDiaryList.innerHTML = '<div style="text-align: center; padding: 40px 20px; color: #999; font-size: 14px;">还没有日记<br><div style="font-size: 12px; margin-top: 8px; color: #ccc;">在发布页面发布日记后才会显示在这里</div></div>';
    } else {
        userPublishedItems.forEach(item => {
            const myDiaryItem = document.createElement('div');
            myDiaryItem.className = 'my-diary-item';
            myDiaryItem.setAttribute('data-id', item.dataset.id);
            myDiaryItem.setAttribute('data-content', item.dataset.content);
            myDiaryItem.setAttribute('data-time', item.dataset.time);
            myDiaryItem.setAttribute('data-role-name', item.dataset.roleName || '');
            myDiaryItem.setAttribute('data-wechat-id', item.dataset.wechatId || '');
            myDiaryItem.setAttribute('data-avatar-url', item.dataset.avatarUrl || '');
            
            const preview = item.dataset.content.replace(/\n/g, ' ').substring(0, 100) + (item.dataset.content.length > 100 ? '...' : '');
            
            myDiaryItem.innerHTML = `
                <div class="my-diary-time">${item.dataset.time}</div>
                <div class="my-diary-content">${preview}</div>
            `;
            
            myDiaryList.appendChild(myDiaryItem);
        });
    }

    const statElement = document.querySelector('#icityMyPage .my-diary-stat');
    if (statElement) {
        statElement.textContent = `我的日记（${userPublishedItems.length}篇）`;
    }
}

// ==================== icity 文本标注功能 ====================

function initIcityAnnotation() {
    const detailPage = document.getElementById('icityDetailPage');
    if (!detailPage) return;

    let selectionTimer = null;
    
    // 统一的选区检查函数
    function checkAndShowAnnotation() {
        if (selectionTimer) clearTimeout(selectionTimer);
        selectionTimer = setTimeout(() => {
            const selection = window.getSelection();
            if (!selection || selection.rangeCount === 0) return;
            const text = selection.toString().trim();
            if (text.length === 0) return;
            
            const detailContent = document.getElementById('icityDetailContent');
            if (!detailContent) return;
            
            const range = selection.getRangeAt(0);
            if (detailContent.contains(range.commonAncestorContainer) || 
                detailContent.contains(range.startContainer) ||
                detailContent.contains(selection.anchorNode)) {
                showAnnotationPopup(range, text);
            }
        }, 300);
    }
    
    // 方式1：selectionchange（桌面浏览器）
    document.addEventListener('selectionchange', checkAndShowAnnotation);
    
    // 方式2：mouseup（鼠标拖选释放时检查）
    document.addEventListener('mouseup', function(e) {
        const detailContent = document.getElementById('icityDetailContent');
        if (detailContent && (detailContent.contains(e.target) || detailContent === e.target)) {
            setTimeout(checkAndShowAnnotation, 50);
        }
    });
    
    // 方式3：touchend（触屏长按选择释放时检查）
    document.addEventListener('touchend', function(e) {
        const detailContent = document.getElementById('icityDetailContent');
        if (detailContent && (detailContent.contains(e.target) || detailContent === e.target)) {
            // 触屏选择需要更长的延迟，等待系统选区稳定
            setTimeout(checkAndShowAnnotation, 500);
        }
    });
    
    // 点击外部关闭弹窗
    document.addEventListener('mousedown', function(e) {
        const popup = document.getElementById('icityAnnotationPopup');
        const detailContent = document.getElementById('icityDetailContent');
        if (popup && !popup.contains(e.target) && 
            !e.target.closest('.annotation-highlight') &&
            !(detailContent && detailContent.contains(e.target))) {
            closeAnnotationPopup();
        }
    });
    
    // 触屏点击外部关闭弹窗
    document.addEventListener('touchstart', function(e) {
        const popup = document.getElementById('icityAnnotationPopup');
        if (!popup) return;
        if (popup.contains(e.target)) return;
        if (e.target.closest && e.target.closest('.annotation-highlight')) return;
        const detailContent = document.getElementById('icityDetailContent');
        if (detailContent && detailContent.contains(e.target)) return;
        closeAnnotationPopup();
    }, { passive: true });
}

function showAnnotationPopup(range, selectedText) {
    const oldPopup = document.getElementById('icityAnnotationPopup');
    if (oldPopup) oldPopup.remove();
    
    const popup = document.createElement('div');
    popup.id = 'icityAnnotationPopup';
    popup.className = 'icity-annotation-popup';
    popup.dataset.selectedText = selectedText;
    
    popup.innerHTML = `
        <div class="annotation-text">已选择：${selectedText.length > 30 ? selectedText.substring(0, 30) + '...' : selectedText}</div>
        <textarea class="annotation-input" id="icityAnnotationInput" placeholder="添加标注评论..."></textarea>
        <div class="annotation-buttons">
            <button class="annotation-btn annotation-btn-cancel" onclick="closeAnnotationPopup()">取消</button>
            <button class="annotation-btn annotation-btn-save" onclick="saveIcityAnnotation()">保存</button>
        </div>
    `;
    
    document.body.appendChild(popup);
    
    let rect;
    if (range instanceof Range) {
        rect = range.getBoundingClientRect();
    } else if (range && range.target) {
        rect = range.target.getBoundingClientRect();
    } else {
        return;
    }

    popup.style.left = (rect.left + rect.width / 2 - 150) + 'px';
    popup.style.top = (rect.bottom + 10) + 'px';
    
    const popupRect = popup.getBoundingClientRect();
    if (popupRect.left < 10) popup.style.left = '10px';
    if (popupRect.right > window.innerWidth - 10) popup.style.left = (window.innerWidth - popupRect.width - 10) + 'px';
    
    if (popupRect.bottom > window.innerHeight - 10) {
        popup.style.top = (rect.top - popupRect.height - 10) + 'px';
    }
    
    setTimeout(() => {
        document.getElementById('icityAnnotationInput')?.focus();
    }, 100);
}

function closeAnnotationPopup() {
    const popup = document.getElementById('icityAnnotationPopup');
    if (popup) popup.remove();
    window.getSelection().removeAllRanges();
}

async function saveIcityAnnotation() {
    const input = document.getElementById('icityAnnotationInput');
    const comment = input?.value.trim() || '';
    const detailContentEl = document.getElementById('icityDetailContent');
    const diaryId = detailContentEl?.dataset.diaryId;
    const popup = document.getElementById('icityAnnotationPopup');
    
    if (!diaryId) {
        closeAnnotationPopup();
        return;
    }
    
    let selectedText = popup?.dataset.selectedText;
    
    if (!selectedText) {
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            selectedText = selection.toString().trim();
        }
    }
    
    if (!selectedText) {
        closeAnnotationPopup();
        return;
    }
    
    showIcityGenerateStatus('正在保存标注...', 'info');
    
    try {
        const annotations = await getIcityAnnotations(diaryId);
        const annotation = {
            id: Date.now(),
            text: selectedText,
            comment: comment,
            createdAt: new Date().toISOString(),
            isAI: false
        };
        
        annotations.push(annotation);
        await saveIcityAnnotations(diaryId, annotations);
        
        const originalContent = detailContentEl.dataset.originalContent || detailContentEl.textContent;
        await renderDiaryContentWithAnnotations(diaryId, originalContent);
        
        closeAnnotationPopup();
        showIcityGenerateStatus('标注已保存', 'success');
    } catch (error) {
        console.error('保存标注失败:', error);
        showIcityGenerateStatus('保存标注失败: ' + error.message, 'error');
        closeAnnotationPopup();
    }
}

// 获取标注数据（从Dexie）- 同时查询数字和字符串类型的diaryId
async function getIcityAnnotations(diaryId) {
    try {
        const key = `icity_annotations_${diaryId}`;
        const numId = parseInt(diaryId);
        const strId = String(diaryId);
        
        const oldData = localStorage.getItem(key);
        if (oldData) {
            try {
                const annotations = JSON.parse(oldData);
                for (const ann of annotations) {
                    await icityDb.annotations.put({
                        id: ann.id,
                        diaryId: numId || strId,
                        text: ann.text,
                        comment: ann.comment || '',
                        createdAt: ann.createdAt || new Date().toISOString(),
                        accountId: window.icityCurrentAccountId || 0
                    });
                }
                localStorage.removeItem(key);
            } catch (e) {
                console.error('迁移标注数据失败:', e);
            }
        }
        
        // 同时查数字ID和字符串ID，解决类型不匹配问题
        let annotations = [];
        try {
            const byNum = numId ? await icityDb.annotations.where('diaryId').equals(numId).toArray() : [];
            const byStr = await icityDb.annotations.where('diaryId').equals(strId).toArray();
            // 合并去重
            const idSet = new Set();
            for (const ann of [...byNum, ...byStr]) {
                if (!idSet.has(ann.id)) {
                    idSet.add(ann.id);
                    annotations.push(ann);
                }
            }
        } catch (e) {
            annotations = await icityDb.annotations.where('diaryId').equals(diaryId).toArray();
        }
        return annotations;
    } catch (error) {
        console.error('获取标注失败:', error);
        return [];
    }
}

// 保存标注数据（到Dexie）- 统一使用数字类型diaryId
async function saveIcityAnnotations(diaryId, annotations) {
    try {
        const numId = parseInt(diaryId);
        const strId = String(diaryId);
        // 删除数字和字符串类型的旧标注
        await icityDb.annotations.where('diaryId').equals(numId || strId).delete();
        if (numId) {
            await icityDb.annotations.where('diaryId').equals(strId).delete();
        }
        for (const ann of annotations) {
            await icityDb.annotations.put({
                id: ann.id,
                diaryId: numId || diaryId,
                text: ann.text,
                comment: ann.comment || '',
                createdAt: ann.createdAt || new Date().toISOString(),
                isAI: ann.isAI || false,
                aiRole: ann.aiRole || '',
                isReply: ann.isReply || false,
                accountId: window.icityCurrentAccountId || 0
            });
        }
    } catch (error) {
        console.error('保存标注失败:', error);
    }
}

// 渲染带标注的日记内容
async function renderDiaryContentWithAnnotations(diaryId, content) {
    const detailContentEl = document.getElementById('icityDetailContent');
    if (!detailContentEl) return;
    
    detailContentEl.dataset.diaryId = diaryId;
    detailContentEl.dataset.originalContent = content;
    
    const annotations = await getIcityAnnotations(diaryId);
    const annotationsArray = Array.isArray(annotations) ? annotations : [];
    
    if (annotationsArray.length === 0) {
        detailContentEl.textContent = content;
    } else {
        // 在原始纯文本上定位每个标注的位置
        let segments = [];
        for (const ann of annotationsArray) {
            if (!ann.text) continue;
            const idx = content.indexOf(ann.text);
            if (idx !== -1) {
                segments.push({
                    start: idx,
                    end: idx + ann.text.length,
                    ann: ann
                });
            }
        }
        
        // 按位置排序
        segments.sort((a, b) => a.start - b.start);
        
        // 去除重叠的标注（保留先出现的）
        let filtered = [];
        let lastEnd = 0;
        for (const seg of segments) {
            if (seg.start >= lastEnd) {
                filtered.push(seg);
                lastEnd = seg.end;
            }
        }
        
        // 一次性构建HTML，不做多轮字符串替换
        let html = '';
        let pos = 0;
        for (const seg of filtered) {
            // 添加标注前的普通文本
            if (seg.start > pos) {
                html += icityEscapeHtml(content.substring(pos, seg.start));
            }
            // 添加高亮标注（用 icityEscapeAttr 转义属性值，防止引号破坏HTML）
            html += `<span class="annotation-highlight" data-annotation-id="${seg.ann.id}" title="${icityEscapeAttr(seg.ann.comment || '无评论')}">${icityEscapeHtml(seg.ann.text)}</span>`;
            pos = seg.end;
        }
        // 添加最后剩余的文本
        if (pos < content.length) {
            html += icityEscapeHtml(content.substring(pos));
        }
        
        detailContentEl.innerHTML = html;
        
        detailContentEl.querySelectorAll('.annotation-highlight').forEach(highlight => {
            highlight.addEventListener('click', function(e) {
                e.stopPropagation();
                const annId = this.dataset.annotationId;
                const annotation = annotationsArray.find(a => a.id == annId);
                if (annotation) {
                    showIcityAnnotationTooltip(e, annotation);
                }
            });
        });
    }
    
    await updateIcityAnnotationList(diaryId);
}

// 更新标注列表
async function updateIcityAnnotationList(diaryId) {
    const annotationList = document.getElementById('icityAnnotationList');
    if (!annotationList) return;
    
    const annotations = await getIcityAnnotations(diaryId);
    
    if (annotations.length === 0) {
        annotationList.style.display = 'none';
    } else {
        annotationList.style.display = 'block';
        annotationList.innerHTML = '';
        
        annotations.forEach(ann => {
            const item = document.createElement('div');
            item.className = 'icity-annotation-item';
            const roleTag = ann.isAI ? `<span style="color: #e67e22; font-size: 11px; font-weight: bold;">[${ann.aiRole || 'AI'}${ann.isReply ? ' 回复' : ' 标注'}]</span> ` : '';
            item.innerHTML = `
                <div class="annotation-quote">"${icityEscapeHtml(ann.text)}"</div>
                <div class="annotation-comment">${roleTag}${icityEscapeHtml(ann.comment || '无评论')}</div>
                <div style="font-size: 11px; color: #999; margin-top: 6px;">${new Date(ann.createdAt).toLocaleString('zh-CN')}</div>
            `;
            annotationList.appendChild(item);
        });
    }
}

// 显示标注提示
function showIcityAnnotationTooltip(event, annotation) {
    const oldTooltip = document.getElementById('icityAnnotationTooltip');
    if (oldTooltip) oldTooltip.remove();
    
    const tooltip = document.createElement('div');
    tooltip.id = 'icityAnnotationTooltip';
    tooltip.className = 'icity-annotation-tooltip';
    tooltip.textContent = annotation.comment || '无评论';
    
    document.body.appendChild(tooltip);
    
    const rect = event.target.getBoundingClientRect();
    tooltip.style.left = (rect.left + rect.width / 2 - tooltip.offsetWidth / 2) + 'px';
    tooltip.style.top = (rect.top - tooltip.offsetHeight - 8) + 'px';
    
    setTimeout(() => {
        tooltip.remove();
    }, 3000);
}

// icity HTML转义（使用不同名称避免冲突）
function icityEscapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 转义HTML属性值（包括引号）
function icityEscapeAttr(text) {
    return String(text || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// 暴露 icity 全局函数
window.openIcityApp = openIcityApp;
window.closeIcityApp = closeIcityApp;
window.exitIcityToSelect = exitIcityToSelect;
window.openIcityRoleModal = openIcityRoleModal;
window.closeIcityRoleModal = closeIcityRoleModal;
window.openIcityEditProfileModal = openIcityEditProfileModal;
window.closeIcityEditProfileModal = closeIcityEditProfileModal;
window.saveIcityProfile = saveIcityProfile;
window.closeAnnotationPopup = closeAnnotationPopup;
window.saveIcityAnnotation = saveIcityAnnotation;