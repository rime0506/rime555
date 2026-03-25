// ================== 小屋功能 JS ==================
// 本文件包含小屋扭蛋机（#cabin*）的所有 JS 逻辑
// 依赖：db, showToast 等全局变量（来自 script.js）
// ==================== 小屋功能 ====================
let currentCabinMachine = 'furniture'; // furniture 或 clothes
let cabinCoinCount = 200;

// 小屋扭蛋状态管理
window.cabinGachaState = {
    coins: 200,
    customItems: {},  // 物品库
    catalog: {},      // 图鉴记录
    inventory: {},    // 背包库存
    gachaPool: {
        furniture: [],
        clothes: []
    }
};

function showCabinPage() {
    document.getElementById('home-page').style.display = 'none';
    document.getElementById('cabin-page').style.display = 'flex';
    
    // 首次打开时初始化数据
    if (!window.cabinInitialized) {
        // 尝试从本地存储加载数据
        const loaded = loadCabinGachaData();
        
        // 如果没有保存的数据，初始化默认物品
        if (!loaded) {
            initDefaultItems();
        }
        
        window.cabinInitialized = true;
    }
    
    updateCabinCoinDisplay();
    updateCabinUI();
}

function hideCabinPage() {
    document.getElementById('cabin-page').style.display = 'none';
    document.getElementById('home-page').style.display = 'flex';
}

function updateCabinCoinDisplay() {
    const state = window.cabinGachaState;
    const coinElement = document.getElementById('cabin-coin-count');
    if (coinElement) {
        coinElement.textContent = state.coins;
    }
    // 同步全局变量
    cabinCoinCount = state.coins;
}

// 保存小屋扭蛋数据到本地存储
function saveCabinGachaData() {
    try {
        const state = window.cabinGachaState;
        localStorage.setItem('cabinGachaState', JSON.stringify(state));
        console.log('小屋数据已保存');
    } catch (e) {
        console.error('保存小屋数据失败:', e);
    }
}

// 从本地存储加载小屋扭蛋数据
function loadCabinGachaData() {
    try {
        const saved = localStorage.getItem('cabinGachaState');
        if (saved) {
            const state = JSON.parse(saved);
            window.cabinGachaState = state;
            cabinCoinCount = state.coins;
            console.log('小屋数据已加载');
            return true;
        }
    } catch (e) {
        console.error('加载小屋数据失败:', e);
    }
    return false;
}

// 更新小屋UI（刷新所有相关显示）
function updateCabinUI() {
    // 更新金币显示
    updateCabinCoinDisplay();
    
    // 如果图鉴弹窗打开，刷新图鉴
    const catalogModal = document.getElementById('catalog-modal');
    if (catalogModal && catalogModal.style.display === 'flex') {
        renderCatalogItems();
    }
    
    // 更新背包显示（如果有背包UI）
    updateCabinInventoryDisplay();
}

function switchCabinScreen(screenName) {
    // 移除所有active类
    document.querySelectorAll('.cabin-screen').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.cabin-nav-item').forEach(n => n.classList.remove('active'));

    // 添加active类
    const screen = document.getElementById('cabin-' + screenName + '-screen');
    if (screen) {
        screen.classList.add('active');
    }
    
    // 找到对应的导航项并激活
    const navItems = document.querySelectorAll('.cabin-nav-item');
    navItems.forEach(item => {
        const text = item.querySelector('.cabin-nav-item-text').textContent;
        if ((screenName === 'gacha' && text === '扭蛋') ||
            (screenName === 'catalog' && text === '图鉴') ||
            (screenName === 'house' && text === '房屋') ||
            (screenName === 'character' && text === '人物')) {
            item.classList.add('active');
        }
    });
}

function switchCabinMachine() {
    const furnitureGacha = document.getElementById('cabin-furniture-gacha');
    const clothesGacha = document.getElementById('cabin-clothes-gacha');
    const machineTitle = document.getElementById('cabin-machine-title');

    if (currentCabinMachine === 'furniture') {
        furnitureGacha.style.display = 'none';
        clothesGacha.style.display = 'flex';
        machineTitle.textContent = '服装扭蛋机';
        currentCabinMachine = 'clothes';
    } else {
        furnitureGacha.style.display = 'flex';
        clothesGacha.style.display = 'none';
        machineTitle.textContent = '家具扭蛋机';
        currentCabinMachine = 'furniture';
    }
}

// 稀有度权重配置
const RARITY_WEIGHTS = {
    'R': 70,    // 70%
    'SR': 25,   // 25%
    'SSR': 5    // 5%
};

// 根据权重随机抽取一个稀有度
function getRandomRarity() {
    const total = Object.values(RARITY_WEIGHTS).reduce((sum, weight) => sum + weight, 0);
    let random = Math.random() * total;
    
    for (const [rarity, weight] of Object.entries(RARITY_WEIGHTS)) {
        random -= weight;
        if (random <= 0) {
            return rarity;
        }
    }
    return 'R'; // 默认返回R
}

// 根据稀有度从物品池中随机抽取物品
function drawItem(targetRarity) {
    const state = window.cabinGachaState;
    
    // 获取当前扭蛋机类型的物品池
    const poolType = currentCabinMachine === 'furniture' ? 'furniture' : 'clothes';
    
    // 获取所有可抽取的物品
    const availableItems = Object.entries(state.customItems)
        .filter(([id, item]) => {
            // 家具扭蛋机抽取家具类
            if (poolType === 'furniture') {
                return item.inPool && ['furniture', 'decor', 'wall', 'floor'].includes(item.type);
            }
            // 服装扭蛋机抽取服装类（暂未实现）
            return false;
        })
        .filter(([id, item]) => item.rarity === targetRarity);
    
    if (availableItems.length === 0) {
        // 如果该稀有度没有物品，降级抽取
        if (targetRarity === 'SSR') return drawItem('SR');
        if (targetRarity === 'SR') return drawItem('R');
        // 如果都没有，随机返回任意物品
        const allItems = Object.entries(state.customItems).filter(([id, item]) => item.inPool);
        if (allItems.length > 0) {
            const randomIndex = Math.floor(Math.random() * allItems.length);
            return allItems[randomIndex];
        }
        return null;
    }
    
    // 随机选择一个物品
    const randomIndex = Math.floor(Math.random() * availableItems.length);
    return availableItems[randomIndex];
}

// 更新背包和图鉴
function addItemToInventory(itemId) {
    const state = window.cabinGachaState;
    
    // 更新背包
    state.inventory[itemId] = (state.inventory[itemId] || 0) + 1;
    
    // 更新图鉴
    if (!state.catalog[itemId]) {
        state.catalog[itemId] = { seen: true, owned: true };
    } else {
        state.catalog[itemId].seen = true;
        state.catalog[itemId].owned = true;
    }
    
    // 保存状态
    saveCabinGachaData();
}

// 显示抽奖结果
function showDrawResult(items) {
    if (!items || items.length === 0) return;
    
    const state = window.cabinGachaState;
    
    // 创建结果弹窗HTML
    let resultHTML = '<div class="draw-result-modal" id="draw-result-modal" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 10000; font-family: \'Press Start 2P\', cursive;">';
    resultHTML += '<div class="draw-result-content" style="background: #ffffff; border: 4px solid #FFB3C1; border-radius: 0; padding: 25px; max-width: 90%; max-height: 80%; overflow-y: auto; box-shadow: 8px 8px 0 rgba(255, 179, 193, 0.3);">';
    
    // 标题带图标
    resultHTML += '<div style="display: flex; align-items: center; justify-content: center; gap: 12px; margin-bottom: 20px;">';
    resultHTML += '<svg style="width: 24px; height: 24px; stroke: #FFB3C1;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><path d="M16 8h-8m4-4v16"></path></svg>';
    resultHTML += '<div style="font-size: 14px; color: #666666; font-weight: bold;">抽奖结果</div>';
    resultHTML += '<svg style="width: 24px; height: 24px; stroke: #FFB3C1;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><path d="M16 8h-8m4-4v16"></path></svg>';
    resultHTML += '</div>';
    
    // 显示所有抽到的物品
    resultHTML += '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 12px; margin-bottom: 20px;">';
    
    items.forEach(([itemId, item]) => {
        // 根据稀有度设置背景色
        let rarityBg = '#FAFAFA';  // R - 浅灰白
        let rarityBorder = '#E0E0E0';  // R - 灰色边框
        
        if (item.rarity === 'SR') {
            rarityBg = '#FFF5F7';  // SR - 浅粉
            rarityBorder = '#FFD4DC';  // SR - 粉色边框
        } else if (item.rarity === 'SSR') {
            rarityBg = '#FFE4E9';  // SSR - 深粉
            rarityBorder = '#FFB3C1';  // SSR - 深粉边框
        }
        
        resultHTML += `<div style="background: ${rarityBg}; border: 3px solid ${rarityBorder}; padding: 10px; text-align: center; transition: transform 0.2s;">`;
        resultHTML += `<div style="width: 70px; height: 70px; margin: 0 auto 8px; display: flex; align-items: center; justify-content: center;">${item.svg}</div>`;
        resultHTML += `<div style="color: #666666; font-size: 10px; margin-bottom: 5px; word-break: break-word;">${item.name}</div>`;
        resultHTML += `<div style="color: #999999; font-size: 8px; padding: 2px 6px; background: rgba(255,255,255,0.6); display: inline-block;">${item.rarity}</div>`;
        resultHTML += `</div>`;
    });
    
    resultHTML += '</div>';
    
    // 统计信息
    const rarityCount = { R: 0, SR: 0, SSR: 0 };
    items.forEach(([id, item]) => {
        if (rarityCount[item.rarity] !== undefined) {
            rarityCount[item.rarity]++;
        }
    });
    
    resultHTML += '<div style="color: #999999; font-size: 9px; text-align: center; margin-bottom: 15px; padding: 8px; background: #F8F8F8; border: 2px solid #F0F0F0;">';
    resultHTML += `共获得 ${items.length} 件物品 | `;
    if (rarityCount.SSR > 0) resultHTML += `SSR×${rarityCount.SSR} `;
    if (rarityCount.SR > 0) resultHTML += `SR×${rarityCount.SR} `;
    if (rarityCount.R > 0) resultHTML += `R×${rarityCount.R}`;
    resultHTML += '</div>';
    
    // 关闭按钮
    resultHTML += '<button onclick="closeDrawResult()" style="width: 100%; padding: 12px; background: #FFB3C1; color: white; border: none; cursor: pointer; font-size: 11px; font-family: \'Press Start 2P\', cursive; transition: background 0.2s;" onmouseover="this.style.background=\'#FF9EAD\'" onmouseout="this.style.background=\'#FFB3C1\'">确定</button>';
    resultHTML += '</div></div>';
    
    // 添加到页面
    document.body.insertAdjacentHTML('beforeend', resultHTML);
}

// 关闭抽奖结果弹窗
function closeDrawResult() {
    const modal = document.getElementById('draw-result-modal');
    if (modal) {
        modal.remove();
    }
}

// 单抽
function cabinDrawOnce() {
    const state = window.cabinGachaState;
    
    if (state.coins < 10) {
        alert('金币不足，需要10个金币');
        return;
    }
    
    // 扣除金币
    state.coins -= 10;
    cabinCoinCount = state.coins;
    updateCabinCoinDisplay();
    
    // 抽取物品
    const rarity = getRandomRarity();
    const drawnItem = drawItem(rarity);
    
    if (!drawnItem) {
        alert('物品池为空，请先添加物品');
        return;
    }
    
    const [itemId, item] = drawnItem;
    
    // 添加到背包和图鉴
    addItemToInventory(itemId);
    
    // 显示结果
    showDrawResult([drawnItem]);
    
    // 更新UI
    updateCabinUI();
}

// 十连抽
function cabinDrawTen() {
    const state = window.cabinGachaState;
    
    if (state.coins < 100) {
        alert('金币不足，需要100个金币');
        return;
    }
    
    // 扣除金币
    state.coins -= 100;
    cabinCoinCount = state.coins;
    updateCabinCoinDisplay();
    
    // 抽取10次
    const results = [];
    let guaranteedSR = false; // 保底机制：十连至少出一个SR
    
    for (let i = 0; i < 10; i++) {
        let rarity = getRandomRarity();
        
        // 最后一抽如果还没有SR以上，强制出SR
        if (i === 9 && !guaranteedSR) {
            rarity = Math.random() < 0.5 ? 'SR' : 'SSR';
        }
        
        const drawnItem = drawItem(rarity);
        
        if (drawnItem) {
            const [itemId, item] = drawnItem;
            
            // 检查是否抽到SR或以上
            if (item.rarity === 'SR' || item.rarity === 'SSR') {
                guaranteedSR = true;
            }
            
            // 添加到背包和图鉴
            addItemToInventory(itemId);
            
            results.push(drawnItem);
        }
    }
    
    // 显示结果
    if (results.length > 0) {
        showDrawResult(results);
    }
    
    // 更新UI
    updateCabinUI();
}

function openCabinAIModal() {
    alert('AI生成功能开发中');
}

function openCabinCharacterModal() {
    alert('角色生成功能开发中');
}

// 房间相关功能
function takeCabinScreenshot() {
    alert('拍照功能开发中');
}

// 房间颜色状态（临时存储，将来可以用localStorage）
let cabinRoomState = {
    wallColor: '#fff5f7',
    wallStyle: 'solid',
    wallPatternColor: '#fff5f7',
    floorColor: '#fefefe',
    floorStyle: 'solid',
    floorPatternColor: '#fefefe'
};

// 打开颜色选择器
function openCabinColorPicker(type) {
    window.cabinCurrentColorTarget = type;
    const modal = document.getElementById('cabin-color-picker-modal');
    const title = document.getElementById('cabin-color-modal-title');
    const colorInput = document.getElementById('cabin-color-input');
    const colorPicker = document.getElementById('cabin-color-picker');
    
    if (title) {
        const iconSvg = `<svg class="cabin-icon-inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>
        </svg>`;
        title.innerHTML = iconSvg + (type === 'wall' ? ' 修改墙面颜色' : ' 修改地板颜色');
    }
    
    const currentColor = type === 'wall' ? (cabinRoomState.wallColor || '#fff5f7') : (cabinRoomState.floorColor || '#fefefe');
    const currentPatternColor = type === 'wall' ? (cabinRoomState.wallPatternColor || currentColor) : (cabinRoomState.floorPatternColor || currentColor);
    
    if (colorInput) colorInput.value = currentColor;
    if (colorPicker) colorPicker.value = currentColor;
    
    const patternColorInput = document.getElementById('cabin-pattern-color-input');
    const patternColorPicker = document.getElementById('cabin-pattern-color-picker');
    if (patternColorInput) patternColorInput.value = currentPatternColor;
    if (patternColorPicker) patternColorPicker.value = currentPatternColor;
    
    // 同步颜色输入和拾色器
    if (colorInput && colorPicker) {
        colorInput.oninput = () => {
            if (colorInput.value.match(/^#[0-9A-Fa-f]{6}$/)) {
                colorPicker.value = colorInput.value;
            }
        };
        colorPicker.oninput = () => {
            colorInput.value = colorPicker.value;
        };
    }
    
    if (patternColorInput && patternColorPicker) {
        patternColorInput.oninput = () => {
            if (patternColorInput.value.match(/^#[0-9A-Fa-f]{6}$/)) {
                patternColorPicker.value = patternColorInput.value;
            }
        };
        patternColorPicker.oninput = () => {
            patternColorInput.value = patternColorPicker.value;
        };
    }
    
    // 样式选择变化
    const styleOptions = document.querySelectorAll('input[name="cabin-style-option"]');
    styleOptions.forEach(option => {
        option.onchange = () => {
            const patternSection = document.getElementById('cabin-pattern-color-section');
            if (patternSection) {
                patternSection.style.display = option.value === 'solid' ? 'none' : 'block';
            }
        };
    });
    
    // 恢复当前样式选择
    const currentStyle = type === 'wall' ? cabinRoomState.wallStyle : cabinRoomState.floorStyle;
    const styleOption = document.querySelector(`input[name="cabin-style-option"][value="${currentStyle}"]`);
    if (styleOption) {
        styleOption.checked = true;
        const patternSection = document.getElementById('cabin-pattern-color-section');
        if (patternSection) {
            patternSection.style.display = currentStyle === 'solid' ? 'none' : 'block';
        }
    }
    
    if (modal) modal.style.display = 'flex';
}

// 关闭颜色选择器
function closeCabinColorPicker() {
    const modal = document.getElementById('cabin-color-picker-modal');
    if (modal) modal.style.display = 'none';
    window.cabinCurrentColorTarget = null;
}

// 重置颜色
function resetCabinColor() {
    const defaultColor = window.cabinCurrentColorTarget === 'wall' ? '#fff5f7' : '#fefefe';
    const colorInput = document.getElementById('cabin-color-input');
    const colorPicker = document.getElementById('cabin-color-picker');
    const patternColorInput = document.getElementById('cabin-pattern-color-input');
    const patternColorPicker = document.getElementById('cabin-pattern-color-picker');
    
    if (colorInput) colorInput.value = defaultColor;
    if (colorPicker) colorPicker.value = defaultColor;
    if (patternColorInput) patternColorInput.value = defaultColor;
    if (patternColorPicker) patternColorPicker.value = defaultColor;
    
    const solidOption = document.querySelector('input[name="cabin-style-option"][value="solid"]');
    if (solidOption) solidOption.checked = true;
    
    const patternSection = document.getElementById('cabin-pattern-color-section');
    if (patternSection) patternSection.style.display = 'none';
}

// 应用颜色
function applyCabinColor() {
    if (!window.cabinCurrentColorTarget) return;
    
    const colorInput = document.getElementById('cabin-color-input');
    const patternColorInput = document.getElementById('cabin-pattern-color-input');
    const styleOption = document.querySelector('input[name="cabin-style-option"]:checked');
    
    if (!colorInput || !styleOption) return;
    
    const color = colorInput.value;
    if (!color.match(/^#[0-9A-Fa-f]{6}$/)) {
        alert('颜色格式不正确');
        return;
    }
    
    const style = styleOption.value;
    
    // 获取花纹颜色（如果样式不是纯色）
    let patternColor = color;
    if (style !== 'solid' && patternColorInput) {
        const patternColorValue = patternColorInput.value;
        if (patternColorValue && patternColorValue.match(/^#[0-9A-Fa-f]{6}$/)) {
            patternColor = patternColorValue;
        }
    }
    
    if (window.cabinCurrentColorTarget === 'wall') {
        cabinRoomState.wallColor = color;
        cabinRoomState.wallStyle = style;
        cabinRoomState.wallPatternColor = patternColor;
        applyCabinWallStyle();
    } else {
        cabinRoomState.floorColor = color;
        cabinRoomState.floorStyle = style;
        cabinRoomState.floorPatternColor = patternColor;
        applyCabinFloorStyle();
    }
    
    // 更新按钮颜色
    const wallBtn = document.getElementById('cabin-wall-color-btn');
    const floorBtn = document.getElementById('cabin-floor-color-btn');
    if (wallBtn) wallBtn.style.background = cabinRoomState.wallColor;
    if (floorBtn) floorBtn.style.background = cabinRoomState.floorColor;
    
    closeCabinColorPicker();
}

// 应用墙面样式
function applyCabinWallStyle() {
    const wallArea = document.getElementById('cabin-wall-area');
    if (!wallArea) return;
    
    wallArea.style.backgroundColor = cabinRoomState.wallColor || '#fff5f7';
    
    if (cabinRoomState.wallStyle === 'solid') {
        wallArea.style.backgroundImage = 'none';
    } else if (cabinRoomState.wallStyle === 'pattern1') {
        const patternColor = (cabinRoomState.wallPatternColor || cabinRoomState.wallColor) + '40';
        wallArea.style.backgroundImage = `
            linear-gradient(90deg, ${patternColor} 1px, transparent 1px),
            linear-gradient(${patternColor} 1px, transparent 1px)
        `;
        wallArea.style.backgroundSize = '32px 32px';
    } else if (cabinRoomState.wallStyle === 'pattern2') {
        const patternColor = cabinRoomState.wallPatternColor || cabinRoomState.wallColor;
        wallArea.style.backgroundImage = `
            linear-gradient(90deg, transparent 33%, ${patternColor}40 33%, ${patternColor}40 66%, transparent 66%),
            linear-gradient(transparent 33%, ${patternColor}40 33%, ${patternColor}40 66%, transparent 66%)
        `;
        wallArea.style.backgroundSize = '12px 12px';
    }
}

// 应用地板样式
function applyCabinFloorStyle() {
    const floorArea = document.getElementById('cabin-floor-area');
    if (!floorArea) return;
    
    floorArea.style.backgroundColor = cabinRoomState.floorColor || '#fefefe';
    
    if (cabinRoomState.floorStyle === 'solid') {
        floorArea.style.backgroundImage = 'none';
    } else if (cabinRoomState.floorStyle === 'pattern1') {
        const patternColor = (cabinRoomState.floorPatternColor || cabinRoomState.floorColor) + '40';
        floorArea.style.backgroundImage = `
            linear-gradient(90deg, ${patternColor} 1px, transparent 1px),
            linear-gradient(${patternColor} 1px, transparent 1px)
        `;
        floorArea.style.backgroundSize = '32px 32px';
    } else if (cabinRoomState.floorStyle === 'pattern2') {
        const patternColor = cabinRoomState.floorPatternColor || cabinRoomState.floorColor;
        floorArea.style.backgroundImage = `
            linear-gradient(90deg, transparent 33%, ${patternColor}40 33%, ${patternColor}40 66%, transparent 66%),
            linear-gradient(transparent 33%, ${patternColor}40 33%, ${patternColor}40 66%, transparent 66%)
        `;
        floorArea.style.backgroundSize = '12px 12px';
    }
}

function moveCabinUserCharacter(direction) {
    alert('角色移动功能开发中：' + direction);
}

function filterCabinInventory(category) {
    // 更新按钮激活状态
    const buttons = document.querySelectorAll('.cabin-filter-btn');
    buttons.forEach(btn => btn.classList.remove('active'));
    event.currentTarget.classList.add('active');
    
    // 这里将来会实现实际的过滤逻辑
    console.log('过滤分类：' + category);
}

// 初始化默认家具
function initDefaultItems() {
    const state = window.cabinGachaState;
    
    // 如果已经有物品，不重复添加
    if (Object.keys(state.customItems).length > 0) {
        return;
    }
    
    // 添加初始物品
    const DEFAULT_FURNITURE = {
        'bed_01': { 
            name: "草莓床", 
            svg: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
                <rect x="10" y="30" width="44" height="20" fill="#FFB3C1" stroke="#999999" stroke-width="2"/>
                <rect x="12" y="32" width="40" height="16" fill="#FFF5F7"/>
                <rect x="14" y="34" width="4" height="4" fill="#FFFFFF"/>
                <rect x="22" y="34" width="4" height="4" fill="#FFFFFF"/>
                <rect x="30" y="34" width="4" height="4" fill="#FFFFFF"/>
                <rect x="38" y="34" width="4" height="4" fill="#FFFFFF"/>
                <rect x="46" y="34" width="4" height="4" fill="#FFFFFF"/>
                <rect x="14" y="24" width="14" height="10" fill="#FFFFFF" stroke="#CCCCCC" stroke-width="2"/>
                <rect x="16" y="26" width="10" height="6" fill="#F0F0F0" rx="2"/>
                <rect x="16" y="22" width="10" height="2" fill="#FFE4E9"/>
            </svg>`,
            rarity: "R",
            inPool: true,
            type: "furniture",
            width: 3,
            height: 2
        },
        'table_01': { 
            name: "像素桌", 
            svg: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
                <rect x="12" y="32" width="40" height="10" fill="#F5F5F5" stroke="#999999" stroke-width="2"/>
                <rect x="14" y="34" width="36" height="6" fill="#FAFAFA" rx="1"/>
                <rect x="16" y="36" width="32" height="2" fill="#FFFFFF"/>
                <rect x="16" y="42" width="6" height="14" fill="#CCCCCC"/>
                <rect x="20" y="44" width="2" height="12" fill="#B0B0B0"/>
                <rect x="42" y="42" width="6" height="14" fill="#CCCCCC"/>
                <rect x="46" y="44" width="2" height="12" fill="#B0B0B0"/>
                <rect x="15" y="55" width="8" height="2" fill="#999999"/>
                <rect x="41" y="55" width="8" height="2" fill="#999999"/>
                <circle cx="32" cy="36" r="2" fill="#FFE4E9"/>
                <circle cx="38" cy="36" r="2" fill="#E8E8E8"/>
                <circle cx="26" cy="36" r="2" fill="#F0F0F0"/>
            </svg>`,
            rarity: "R",
            inPool: true,
            type: "furniture",
            width: 2,
            height: 2
        },
        'plant_01': { 
            name: "爱心草", 
            svg: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
                <rect x="24" y="40" width="16" height="16" fill="#FFE4E9" stroke="#CCCCCC" stroke-width="2" rx="2"/>
                <rect x="26" y="42" width="12" height="12" fill="#FFF5F7" rx="1"/>
                <rect x="28" y="44" width="8" height="2" fill="#FFFFFF"/>
                <rect x="28" y="48" width="8" height="2" fill="#FFFFFF"/>
                <rect x="31" y="30" width="2" height="10" fill="#B0B0B0"/>
                <polygon points="30,28 34,28 32,24" fill="#999999"/>
                <polygon points="28,32 30,32 29,30" fill="#CCCCCC"/>
                <polygon points="34,32 36,32 35,30" fill="#CCCCCC"/>
                <path d="M32,22 Q34,20 36,22 Q38,24 36,26 Q34,28 32,30 Q30,28 28,26 Q26,24 28,22 Q30,20 32,22" fill="#FFB3C1"/>
                <circle cx="32" cy="24" r="1" fill="#FFFFFF"/>
                <circle cx="34" cy="26" r="1" fill="#FFFFFF"/>
                <circle cx="30" cy="26" r="1" fill="#FFFFFF"/>
            </svg>`,
            rarity: "SR",
            inPool: true,
            type: "decor",
            width: 1,
            height: 1
        },
        'painting_01': {
            name: "像素画",
            svg: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
                <rect x="15" y="15" width="34" height="34" fill="#F5F5F5" stroke="#CCCCCC" stroke-width="3" rx="3"/>
                <rect x="18" y="18" width="28" height="28" fill="#FFFFFF" rx="2"/>
                <rect x="20" y="20" width="24" height="24" fill="#FAFAFA" rx="1"/>
                <rect x="20" y="36" width="24" height="8" fill="#E8E8E8" rx="1"/>
                <polygon points="26,36 30,32 34,36" fill="#D0D0D0"/>
                <polygon points="30,36 34,30 38,36" fill="#CCCCCC"/>
                <circle cx="44" cy="24" r="4" fill="#FFE4E9"/>
                <rect x="44" y="20" width="1" height="2" fill="#FFB3C1"/>
                <rect x="44" y="28" width="1" height="2" fill="#FFB3C1"/>
                <rect x="40" y="23" width="2" height="1" fill="#FFB3C1"/>
                <rect x="48" y="23" width="2" height="1" fill="#FFB3C1"/>
                <rect x="24" y="26" width="8" height="4" fill="#FFFFFF" rx="2"/>
                <rect x="26" y="24" width="4" height="2" fill="#FFFFFF" rx="1"/>
                <circle cx="20" cy="20" r="1" fill="#FFB3C1"/>
                <circle cx="44" cy="20" r="1" fill="#FFB3C1"/>
                <circle cx="20" cy="44" r="1" fill="#FFB3C1"/>
                <circle cx="44" cy="44" r="1" fill="#FFB3C1"/>
            </svg>`,
            rarity: "R",
            inPool: true,
            type: "wall",
            width: 1,
            height: 1
        },
        'rug_01': {
            name: "毛绒地毯",
            svg: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
                <rect x="10" y="10" width="44" height="44" fill="#F0F0F0" stroke="#CCCCCC" stroke-width="2" rx="5"/>
                <rect x="12" y="12" width="40" height="40" fill="#FAFAFA" rx="3"/>
                <circle cx="32" cy="32" r="12" fill="#FFF5F7" opacity="0.6"/>
                <circle cx="32" cy="32" r="8" fill="#FFFFFF" opacity="0.8"/>
                <path d="M32,24 Q36,28 32,32 Q28,36 32,40 Q36,36 40,32 Q36,28 32,24" fill="#FFE4E9" opacity="0.5"/>
                <rect x="14" y="14" width="4" height="4" fill="#E8E8E8" rx="1"/>
                <rect x="46" y="14" width="4" height="4" fill="#E8E8E8" rx="1"/>
                <rect x="14" y="46" width="4" height="4" fill="#E8E8E8" rx="1"/>
                <rect x="46" y="46" width="4" height="4" fill="#E8E8E8" rx="1"/>
            </svg>`,
            rarity: "SR",
            inPool: true,
            type: "floor",
            width: 3,
            height: 2
        }
    };
    
    // 添加默认物品到状态
    Object.keys(DEFAULT_FURNITURE).forEach(id => {
        state.customItems[id] = DEFAULT_FURNITURE[id];
        if (!state.catalog[id]) {
            state.catalog[id] = { seen: false, owned: false };
        }
        // 添加到背包
        state.inventory[id] = (state.inventory[id] || 0) + 1;
        // 标记为已拥有
        state.catalog[id].owned = true;
    });
    
    // 保存状态
    saveCabinGachaData();
    console.log('默认家具已初始化');
}

// 更新背包显示
function updateCabinInventoryDisplay() {
    // 如果有背包UI元素，在这里更新
    // 暂时保留此函数以备后续使用
}

// 打开图鉴
function openCatalogModal() {
    const modal = document.getElementById('catalog-modal');
    if (modal) {
        modal.style.display = 'flex';
        renderCatalogItems();
    }
}

// 关闭图鉴
function closeCatalogModal() {
    const modal = document.getElementById('catalog-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// 切换图鉴标签
let currentCatalogTab = 'all';
function switchCatalogTab(tab) {
    currentCatalogTab = tab;
    const tabs = document.querySelectorAll('.catalog-tab');
    tabs.forEach(t => {
        t.classList.remove('active');
        t.style.background = '#ffffff';
    });
    event.currentTarget.classList.add('active');
    event.currentTarget.style.background = '#fff5f7';
    renderCatalogItems();
}

// 过滤图鉴物品稀有度
let currentCatalogRarity = 'all';
function filterCatalogItems(rarity) {
    currentCatalogRarity = rarity;
    const buttons = document.querySelectorAll('.rarity-filter-btn');
    buttons.forEach(btn => btn.classList.remove('active'));
    event.currentTarget.classList.add('active');
    renderCatalogItems();
}

// 渲染图鉴物品
function renderCatalogItems() {
    const catalogGrid = document.getElementById('catalog-items');
    const catalogInfo = document.getElementById('catalog-info');
    
    if (!catalogGrid) return;
    
    const state = window.cabinGachaState;
    catalogGrid.innerHTML = '';
    
    // 获取所有物品
    const allItems = Object.keys(state.customItems).map(id => ({
        id,
        ...state.customItems[id],
        catalogData: state.catalog[id] || { seen: false, owned: false }
    }));
    
    // 按标签过滤
    let filteredItems = allItems;
    if (currentCatalogTab === 'owned') {
        filteredItems = allItems.filter(item => item.catalogData.owned);
    } else if (currentCatalogTab === 'missing') {
        filteredItems = allItems.filter(item => !item.catalogData.owned);
    }
    
    // 按稀有度过滤
    if (currentCatalogRarity !== 'all') {
        filteredItems = filteredItems.filter(item => 
            item.rarity.toUpperCase() === currentCatalogRarity.toUpperCase()
        );
    }
    
    // 渲染物品
    filteredItems.forEach(item => {
        const itemDiv = document.createElement('div');
        itemDiv.style.cssText = `
            background: ${item.catalogData.owned ? '#fff5f7' : '#f5f5f5'};
            border: 3px solid ${item.catalogData.owned ? '#ffb3c1' : '#e0e0e0'};
            border-radius: 8px;
            padding: 10px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            position: relative;
            cursor: pointer;
        `;
        
        // SVG图标
        const svgDiv = document.createElement('div');
        svgDiv.innerHTML = item.svg;
        svgDiv.style.cssText = 'width: 40px; height: 40px; margin-bottom: 5px;';
        itemDiv.appendChild(svgDiv);
        
        // 名称
        const nameDiv = document.createElement('div');
        nameDiv.textContent = item.name;
        nameDiv.style.cssText = 'font-size: 8px; color: #999999; text-align: center; margin-bottom: 3px;';
        itemDiv.appendChild(nameDiv);
        
        // 稀有度
        const rarityDiv = document.createElement('div');
        rarityDiv.textContent = item.rarity;
        rarityDiv.style.cssText = `
            font-size: 7px;
            padding: 1px 4px;
            border-radius: 3px;
            font-weight: bold;
            color: #999999;
            background: ${item.rarity === 'SSR' ? '#fff9e6' : item.rarity === 'SR' ? '#fff5f7' : '#f0f0f0'};
        `;
        itemDiv.appendChild(rarityDiv);
        
        // 拥有数量（如果已拥有）
        if (item.catalogData.owned) {
            const count = state.inventory[item.id] || 0;
            if (count > 0) {
                const countDiv = document.createElement('div');
                countDiv.textContent = `×${count}`;
                countDiv.style.cssText = `
                    position: absolute;
                    top: 5px;
                    right: 5px;
                    font-size: 8px;
                    padding: 2px 5px;
                    background: #ffb3c1;
                    color: white;
                    border-radius: 10px;
                    font-weight: bold;
                `;
                itemDiv.appendChild(countDiv);
            }
        }
        
        catalogGrid.appendChild(itemDiv);
    });
    
    // 更新统计信息
    if (catalogInfo) {
        const total = allItems.length;
        const owned = allItems.filter(item => item.catalogData.owned).length;
        const rate = total > 0 ? Math.round((owned / total) * 100) : 0;
        
        document.getElementById('catalog-total').textContent = total;
        document.getElementById('catalog-owned').textContent = owned;
        document.getElementById('catalog-rate').textContent = rate + '%';
    }
}

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', function() {
    // 小屋数据在首次打开小屋页面时初始化（见 showCabinPage 函数）
    // 这里不需要提前初始化
});