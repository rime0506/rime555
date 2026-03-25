// ================== 世界书 (Lorebook) JS ==================
// 本文件包含世界书模块的所有 JS 逻辑
// 依赖：db, showToast, callAI 等全局变量（来自 script.js）
// ===== Block 1: getLorebookContext 工具函数 =====
        // 辅助：获取世界书上下文 (简单的关键词匹配)
        // 支持单个ID或ID数组，自动包含全局世界书
        async function getLorebookContext(lorebookIdOrIds, keywords) {
            // 兼容旧数据：如果是单个ID，转换为数组
            let ids = [];
            if (lorebookIdOrIds) {
                ids = Array.isArray(lorebookIdOrIds) ? [...lorebookIdOrIds] : [lorebookIdOrIds];
            }
            
            // 🔥 自动加载所有全局世界书
            try {
                const allBooks = await db.lorebooks.toArray();
                const globalIds = allBooks.filter(b => b.scope === 'global').map(b => b.id);
                globalIds.forEach(gid => {
                    if (!ids.includes(gid)) ids.push(gid);
                });
            } catch (e) {
                console.warn('[世界书] 加载全局世界书失败:', e);
            }
            
            if (ids.length === 0) return "";
            
            let allContext = [];
            const checkText = keywords ? keywords.toLowerCase() : "";
            
            // 遍历所有世界书
            for (const id of ids) {
                const book = await db.lorebooks.get(id);
                if (!book || !book.content || !book.content.entries) continue;
                
                const entries = Object.values(book.content.entries);
                
                entries.forEach(entry => {
                    if (entry.enabled === false) return; // 只加载启用的条目
                    
                    // 挂载了就直接加载所有启用的条目
                    allContext.push(entry.content);
                });
            }
            
            if (allContext.length > 0) {
                console.log(`[世界书] ✅ 成功加载 ${allContext.length} 个条目`);
                // 简单截断，防止爆 Token
                const fullText = allContext.join('\n\n');
                const safeText = fullText.length > 10000 ? fullText.slice(0, 10000) + '...(已截断)' : fullText;
                return `【世界书设定】:\n${safeText}\n`;
            } else {
                console.log('[世界书] ℹ️ 没有启用的条目或条目为空');
            }
            return "";
        }

// ===== Block 2: 群聊世界书列表切换 =====
        // 切换群聊世界书列表
        function toggleGroupLorebookList() {
            const list = document.getElementById('group-detail-lorebook-list');
            const toggle = document.getElementById('group-detail-lorebook-toggle');
            if (list.style.display === 'none' || !list.style.display) {
                list.style.display = 'block';
                toggle.textContent = '∨';
            } else {
                list.style.display = 'none';
                toggle.textContent = '›';
            }
        }
        
        // 更新群聊世界书计数
        function updateGroupLorebookCount() {
            const checkboxes = document.querySelectorAll('#group-detail-lorebook-list input[type="checkbox"]:checked');
            const count = checkboxes.length;
            document.getElementById('group-detail-lorebook-count').textContent = `${count}个`;
        }

// ===== Block 3: 聊天详情世界书列表切换 =====
        function toggleLorebookList() {
            const list = document.getElementById('detail-lorebook-list');
            const toggle = document.getElementById('detail-lorebook-toggle');
            if (list.style.display === 'none' || !list.style.display) {
                list.style.display = 'block';
                toggle.textContent = '收起';
            } else {
                list.style.display = 'none';
                toggle.textContent = '展开';
            }
        }

        function updateLorebookCount() {
            const checkboxes = document.querySelectorAll('#detail-lorebook-list input[type="checkbox"]:checked');
            const count = checkboxes.length;
            document.getElementById('detail-lorebook-count').textContent = `${count}个`;
        }

// ===== Block 4: 世界书页面主逻辑 =====
        // --- 世界书 (Lorebook) 逻辑 ---
function showLorebookPage() {
    document.getElementById('lorebook-page').style.display = 'flex';
    loadLorebookList();
}

        function hideLorebookPage() {
            const page = document.getElementById('lorebook-page');
            page.style.transform = 'scale(0.95)';
            page.style.opacity = '0';
            setTimeout(() => {
                page.style.display = 'none';
                page.style.transform = ''; 
                page.style.opacity = '';
            }, 200);
        }

        async function loadLorebookList() {
            const list = await db.lorebooks.toArray();
            const container = document.getElementById('lorebook-list');
            container.innerHTML = '';
            
            if (list.length === 0) {
                container.innerHTML = `
                    <div style="text-align:center; color:#999; margin-top:40px; font-size:14px; display:flex; flex-direction:column; align-items:center; gap:10px;">
                        <svg class="svg-icon" style="width:40px; height:40px; stroke:#ccc;" viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
                        <div>空空如也<br>点击上方导入或新建</div>
                    </div>
                `;
                return;
            }

            list.forEach(book => {
                const count = book.content && book.content.entries ? Object.keys(book.content.entries).length : 0;
                const scope = book.scope || 'personal';
                const scopeLabel = scope === 'global' ? '全局' : '单人';
                const scopeColor = scope === 'global' ? '#34c759' : '#007aff';
                
                const div = document.createElement('div');
                div.className = 'lorebook-card';
                div.innerHTML = `
                    <div class="lorebook-info">
                        <div style="display:flex; align-items:center; gap:6px;">
                            <h3 style="margin:0;">${book.name}</h3>
                            <span class="lb-scope-badge" style="background:${scopeColor};" onclick="event.stopPropagation(); toggleLorebookScope(${book.id})" title="点击切换">${scopeLabel}</span>
                        </div>
                        <p>${count} 个词条</p>
                    </div>
                    <div class="lorebook-actions">
                        <div class="lorebook-btn lb-edit" onclick="editLorebook(${book.id})">编辑</div>
                        <div class="lorebook-btn lb-del" onclick="deleteLorebook(${book.id})">删除</div>
                    </div>
                `;
                container.appendChild(div);
            });
        }

        // 世界书导入加锁
        function requestImportLorebook() {
            if (sessionStorage.getItem('import_lorebook_unlocked') === '1') {
                document.getElementById('lorebook-import').click();
                return;
            }
            // 创建密码验证弹窗
            const existing = document.getElementById('import-lock-modal');
            if (existing) existing.remove();
            
            const overlay = document.createElement('div');
            overlay.id = 'import-lock-modal';
            overlay.dataset.target = 'lorebook';
            overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;z-index:99999;';
            overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
            
            overlay.innerHTML = `
                <div style="background:#fff;border-radius:14px;padding:28px 24px;width:280px;box-shadow:0 8px 30px rgba(0,0,0,0.08);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
                    <div style="text-align:center;margin-bottom:20px;">
                        <svg viewBox="0 0 24 24" style="width:32px;height:32px;fill:none;stroke:#333;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round;margin-bottom:8px;"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                        <div style="font-size:15px;font-weight:600;color:#262626;letter-spacing:0.3px;">导入需要验证</div>
                        <div style="font-size:12px;color:#8e8e8e;margin-top:4px;">请输入密码以解锁导入功能</div>
                    </div>
                    <input type="password" id="import-lock-pwd" placeholder="请输入密码" 
                        style="width:100%;padding:12px 14px;border:1px solid #efefef;border-radius:10px;font-size:14px;outline:none;box-sizing:border-box;background:#fafafa;transition:border 0.2s;"
                        onfocus="this.style.borderColor='#333'" onblur="this.style.borderColor='#efefef'">
                    <div id="import-lock-error" style="color:#ff3b30;font-size:12px;margin-top:6px;text-align:center;min-height:16px;"></div>
                    <div style="display:flex;gap:10px;margin-top:14px;">
                        <div onclick="this.closest('#import-lock-modal').remove()" 
                            style="flex:1;text-align:center;padding:11px;border-radius:10px;font-size:14px;color:#8e8e8e;background:#f5f5f5;cursor:pointer;">取消</div>
                        <div onclick="verifyImportPassword()" 
                            style="flex:1;text-align:center;padding:11px;border-radius:10px;font-size:14px;color:#fff;background:#262626;cursor:pointer;font-weight:500;">确认</div>
                    </div>
                </div>
            `;
            
            document.body.appendChild(overlay);
            setTimeout(() => {
                const pwdInput = document.getElementById('import-lock-pwd');
                if (pwdInput) {
                    pwdInput.focus();
                    pwdInput.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter') verifyImportPassword();
                    });
                }
            }, 100);
        }

        // 导入世界书文件（支持 .json 和 .txt）
        function importLorebookFile(input) {
            const file = input.files[0];
            if (!file) return;
            
            const fileName = file.name.toLowerCase();
            const isTxt = fileName.endsWith('.txt');
            
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    let name = file.name.replace(/\.(json|txt)$/i, '');
                    
                    if (isTxt) {
                        // TXT 格式：按行解析为词条
                        const text = e.target.result;
                        const lines = text.split(/\r?\n/).filter(l => l.trim());
                        
                        if (lines.length === 0) {
                            alert('❌ 文件为空');
                            input.value = '';
                            return;
                        }
                        
                        // 构建 entries 对象
                        const entries = {};
                        let entryIndex = 0;
                        let currentKey = '';
                        let currentContent = '';
                        
                        for (const line of lines) {
                            // 支持格式1：key: content（冒号分隔的键值对）
                            // 支持格式2：key:: content（双冒号分隔，SillyTavern风格）
                            // 支持格式3：纯文本，每行作为一个词条
                            const colonMatch = line.match(/^(.+?)::?\s+(.+)$/);
                            
                            if (colonMatch) {
                                // 有键值对格式
                                const key = colonMatch[1].trim();
                                const content = colonMatch[2].trim();
                                entries[String(entryIndex)] = {
                                    uid: entryIndex,
                                    key: key.split(/[,，、]/).map(k => k.trim()).filter(k => k),
                                    content: content,
                                    comment: key,
                                    enabled: true
                                };
                                entryIndex++;
                            } else {
                                // 纯文本行，整行作为 content，第一个词作为 key
                                const trimmed = line.trim();
                                const firstWord = trimmed.split(/[\s,，、]/)[0];
                                entries[String(entryIndex)] = {
                                    uid: entryIndex,
                                    key: [firstWord],
                                    content: trimmed,
                                    comment: `词条 #${entryIndex}`,
                                    enabled: true
                                };
                                entryIndex++;
                            }
                        }
                        
                        const newId = await db.lorebooks.add({
                            name: name,
                            content: { entries: entries },
                            scope: 'personal',
                            created_at: Date.now()
                        });
                        
                        alert(`✅ 成功导入: ${name}（${Object.keys(entries).length} 个词条）`);
                        loadLorebookList();
                        showLorebookDetail(newId);
                        
                    } else {
                        // JSON 格式
                        const json = JSON.parse(e.target.result);
                        // 简单的格式校验：通常有 entries
                        if (!json.entries && !Array.isArray(json)) {
                            if(!confirm("这似乎不是标准的 SillyTavern 格式，确定要导入吗？")) {
                                input.value = '';
                                return;
                            }
                        }
                        
                        if (json.name) name = json.name;

                        const newId = await db.lorebooks.add({
                            name: name,
                            content: json,
                            scope: 'personal',
                            created_at: Date.now()
                        });
                        
                        alert(`✅ 成功导入: ${name}`);
                        loadLorebookList();
                        showLorebookDetail(newId);
                    }
                } catch (err) {
                    alert('❌ 解析失败: ' + err.message);
                }
            };
            reader.readAsText(file);
            input.value = '';
        }

        async function createNewLorebook() {
            const name = prompt("请输入新世界书名称：", "新世界书");
            if (!name) return;
            
            // 初始化空结构，默认为单人
            const newBook = {
                entries: {}
            };
            
            const newId = await db.lorebooks.add({
                name: name,
                content: newBook,
                scope: 'personal',
                created_at: Date.now()
            });
            loadLorebookList();
            // 创建后直接打开编辑页，可在里面设置作用域
            showLorebookDetail(newId);
        }

        async function deleteLorebook(id) {
            if (confirm("确定要删除这本世界书吗？此操作无法撤销。")) {
                await db.lorebooks.delete(id);
                loadLorebookList();
            }
        }

        // 切换世界书作用域（全局 <-> 单人）—— 从卡片上点击徽章
        async function toggleLorebookScope(id) {
            const book = await db.lorebooks.get(id);
            if (!book) return;
            const currentScope = book.scope || 'personal';
            book.scope = currentScope === 'global' ? 'personal' : 'global';
            await db.lorebooks.put(book);
            loadLorebookList();
        }

        // 在详情页中切换世界书作用域
        async function saveLorebookScope(scope) {
            if (!currentBookId) return;
            const book = await db.lorebooks.get(currentBookId);
            if (!book) return;
            book.scope = scope;
            await db.lorebooks.put(book);
            // 更新标题
            const scopeLabel = scope === 'global' ? ' [全局]' : ' [单人]';
            document.getElementById('lb-detail-title').innerText = book.name + scopeLabel;
            // 更新选中状态
            document.querySelectorAll('.lb-scope-option').forEach(el => {
                el.classList.toggle('active', el.dataset.scope === scope);
            });
        }

        // 全局变量：当前操作的世界书ID和词条ID
        let currentBookId = null;
        let currentEntryId = null;

        function editLorebook(id) {
            showLorebookDetail(id);
        }

        // 显示世界书详情 (词条列表)
        async function showLorebookDetail(id) {
            currentBookId = id;
            const book = await db.lorebooks.get(id);
            if (!book) return;

            const scope = book.scope || 'personal';
            const scopeLabel = scope === 'global' ? ' [全局]' : ' [单人]';
            document.getElementById('lb-detail-title').innerText = book.name + scopeLabel;
            document.getElementById('lb-detail-page').style.display = 'flex';
            
            // 设置作用域选择器状态
            document.querySelectorAll('.lb-scope-option').forEach(el => {
                el.classList.toggle('active', el.dataset.scope === scope);
            });
            
            renderEntryList(book.content.entries);
        }

        function hideLorebookDetail() {
            const page = document.getElementById('lb-detail-page');
            page.style.display = 'none';
            currentBookId = null;
            loadLorebookList(); // 返回时刷新列表
        }

        // 修改世界书大标题名称
        async function renameLorebookTitle() {
            if (!currentBookId) return;
            const book = await db.lorebooks.get(currentBookId);
            if (!book) return;
            const newName = prompt('请输入新的世界书名称：', book.name);
            if (newName === null || newName.trim() === '') return;
            book.name = newName.trim();
            await db.lorebooks.put(book);
            const scope = book.scope || 'personal';
            const scopeLabel = scope === 'global' ? ' [全局]' : ' [单人]';
            document.getElementById('lb-detail-title').innerText = book.name + scopeLabel;
        }

        // 保存按钮：刷新列表并提示
        async function saveAndRefreshLorebook() {
            await loadLorebookList();
            // 短暂提示
            const btn = event.target;
            const origText = btn.innerText;
            btn.innerText = '已保存 ✓';
            btn.style.color = '#34c759';
            setTimeout(() => {
                btn.innerText = origText;
                btn.style.color = '';
            }, 1200);
        }

        // 渲染词条列表
        function renderEntryList(entries) {
            const container = document.getElementById('lb-entry-list');
            container.innerHTML = '';
            
            if (!entries || Object.keys(entries).length === 0) {
                container.innerHTML = `<div style="text-align:center; color:#999; margin-top:40px;">暂无词条</div>`;
                return;
            }

            // 按 key 排序 (通常是数字索引，但也可能是随机字符串)
            const keys = Object.keys(entries).sort((a,b) => parseInt(a) - parseInt(b));

            keys.forEach(key => {
                const entry = entries[key];
                const title = entry.comment || entry.key?.join(', ') || `词条 #${key}`;
                const keysText = entry.key ? entry.key.join(', ') : '无关键字';
                const isEnabled = entry.enabled !== false; // 默认启用
                
                const div = document.createElement('div');
                div.className = 'lb-entry-item';
                div.style.opacity = isEnabled ? '1' : '0.5';
                div.innerHTML = `
                    <label class="lb-entry-toggle" onclick="event.stopPropagation();">
                        <input type="checkbox" ${isEnabled ? 'checked' : ''} onchange="toggleEntryEnabled('${key}', this.checked)">
                        <span class="lb-toggle-slider"></span>
                    </label>
                    <div style="flex:1; overflow:hidden; cursor:pointer;" onclick="showEntryEditor(currentBookId, '${key}')">
                        <div class="lb-entry-title">${title}</div>
                        <div class="lb-entry-keys">${keysText}</div>
                    </div>
                    <div style="color:#c7c7cc; cursor:pointer;" onclick="showEntryEditor(currentBookId, '${key}')">›</div>
                `;
                container.appendChild(div);
            });
        }

        // 显示词条编辑器
        async function showEntryEditor(bookId, entryId) {
            currentEntryId = entryId;
            const page = document.getElementById('lb-entry-page');
            const titleDom = document.getElementById('lb-entry-title');
            const keysInput = document.getElementById('entry-keys');
            const contentInput = document.getElementById('entry-content');
            
            // 清空输入
            keysInput.value = '';
            contentInput.value = '';

            if (entryId !== null) {
                // 编辑现有词条
                titleDom.innerText = "编辑词条";
                const book = await db.lorebooks.get(bookId);
                const entry = book.content.entries[entryId];
                if (entry) {
                    keysInput.value = entry.key ? entry.key.join(', ') : '';
                    contentInput.value = entry.content || '';
                }
            } else {
                // 新建词条
                titleDom.innerText = "新建词条";
            }

            page.style.display = 'flex';
        }

        function hideEntryEditor() {
            document.getElementById('lb-entry-page').style.display = 'none';
            currentEntryId = null;
        }

        // 保存词条
        async function saveEntry() {
            if (!currentBookId) return;

            const keysStr = document.getElementById('entry-keys').value.trim();
            const content = document.getElementById('entry-content').value;
            
            // 简单的校验
            if (!content && !keysStr) {
                alert("请填写内容或关键字");
                return;
            }

            // 处理关键字数组
            const keys = keysStr.split(/[,，]/).map(k => k.trim()).filter(k => k);

            try {
                const book = await db.lorebooks.get(currentBookId);
                if (!book) return;

                // 确保 entries 对象存在
                if (!book.content.entries) book.content.entries = {};

                let entryId = currentEntryId;
                if (entryId === null) {
                    // 生成新ID：找到最大ID + 1
                    const existingIds = Object.keys(book.content.entries).map(k => parseInt(k)).filter(n => !isNaN(n));
                    const maxId = existingIds.length > 0 ? Math.max(...existingIds) : -1;
                    entryId = (maxId + 1).toString();
                }

                // 构造词条对象 (保留其他未修改字段如果存在)
                const oldEntry = book.content.entries[entryId] || {};
                book.content.entries[entryId] = {
                    ...oldEntry,
                    uid: oldEntry.uid !== undefined ? oldEntry.uid : entryId, // SillyTavern 常用 uid
                    key: keys,
                    content: content,
                    comment: keys[0] || `词条 #${entryId}`, // 用第一个关键字做注释名
                    enabled: true
                };

                await db.lorebooks.put(book);
                
                // 刷新列表并关闭编辑器
                renderEntryList(book.content.entries);
                hideEntryEditor();

            } catch (err) {
                alert("保存失败: " + err.message);
            }
        }

        // 删除词条
        async function deleteEntry() {
            if (!currentBookId || currentEntryId === null) return;
            
            if (!confirm("确定要删除此词条吗？")) return;

            try {
                const book = await db.lorebooks.get(currentBookId);
                if (book && book.content.entries) {
                    delete book.content.entries[currentEntryId];
                    await db.lorebooks.put(book);
                    
                    renderEntryList(book.content.entries);
                    hideEntryEditor();
                }
            } catch (err) {
                alert("删除失败: " + err.message);
            }
        }

        // 切换条目启用/禁用
        async function toggleEntryEnabled(entryKey, enabled) {
            if (!currentBookId) return;
            try {
                const book = await db.lorebooks.get(currentBookId);
                if (book && book.content && book.content.entries && book.content.entries[entryKey]) {
                    book.content.entries[entryKey].enabled = enabled;
                    await db.lorebooks.put(book);
                    renderEntryList(book.content.entries);
                }
            } catch (err) {
                console.error('切换条目状态失败:', err);
            }
        }

        async function exportLorebook(id) {
            const book = await db.lorebooks.get(id);
            if (!book) return;
            
            const blob = new Blob([JSON.stringify(book.content, null, 2)], {type: 'application/json'});
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${book.name}.json`;
            a.click();
            URL.revokeObjectURL(url);
        }