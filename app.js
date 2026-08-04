// ==========================================
// AI 穿搭搭配工具 - 核心逻辑 v8 (本地代理 + IDM-VTON)
// ==========================================
console.log('🟢 app.js v8 loaded - Local Proxy + IDM-VTON mode');

// ----- 配置 -----
const CONFIG = {
  // === 本地代理服务器（server.py）===
  PROXY_BASE: '',  // 同源，无需设置
  HAS_PROXY: false, // 是否检测到本地代理（在线静态部署时自动切换为直连模式）
  PROXY_CHECK_TIMEOUT: 2500, // 代理探测超时(ms)
  // === 固定模特配置 =====
  MODEL_REF_IMG: 'images/model_custom.png', // 固定模特参考照片
  ITEM_IMG_SIZE: 300,      // 单品图片尺寸
  IMAGE_WIDTH: 576,         // 成果图宽度
  IMAGE_HEIGHT: 832,        // 成果图高度
  TIMEOUT: 120000,          // Pollinations 120秒超时
  VTRYON_TIMEOUT: 300000,   // 虚拟试衣超时5分钟
  DATA_VERSION: 8,           // 数据版本（v8 = 本地代理模式）
  // ===== 试衣模式: 'tryon'（虚拟试衣，保持脸部）或 'generate'（快速生成）=====
  TRYON_MODE: localStorage.getItem('tryon_mode') || 'generate',
};

// ==========================================
// 获取单品图片URL
// 优先级: 用户上传图片 > 本地 images/{id}.jpg (Unsplash真实服装图) > emoji回退
// ==========================================
function getItemImageUrl(item) {
  // 用户上传的自定义图片优先
  if (item.image) return item.image;
  // 使用本地下载的真实服装图片（来自 Unsplash 免费商用图库）
  return `images/${item.id}.jpg`;
}

// 图片加载失败时回退到 emoji
function imgFallback(img) {
  const emoji = img.dataset.emoji || '👕';
  const parent = img.parentElement;
  const fontSize = parent.classList.contains('zone-content-img') ? '40px' : '32px';
  parent.innerHTML = `<span style="font-size:${fontSize};line-height:1">${emoji}</span>`;
}

// ----- 类别配置 -----
const CATEGORIES = {
  top:       { name: '上衣',    emoji: '👕', order: 1 },
  outerwear: { name: '外套',    emoji: '🧥', order: 2 },
  bottom:    { name: '下装',    emoji: '👖', order: 3 },
  dress:     { name: '连衣裙',  emoji: '👗', order: 4 },
  shoes:     { name: '鞋',      emoji: '👟', order: 5 },
  accessory: { name: '配饰',    emoji: '🧢', order: 6 },
  bag:       { name: '包',      emoji: '👜', order: 7 },
};

// ----- 风格预设 -----
const STYLES = {
  casual:   { name: '休闲', desc: 'casual everyday style, relaxed and comfortable' },
  formal:   { name: '正式', desc: 'formal business attire, elegant and sophisticated' },
  street:   { name: '街头', desc: 'streetwear fashion, urban and trendy' },
  elegant:  { name: '优雅', desc: 'elegant high fashion, refined and stylish' },
  minimal:  { name: '极简', desc: 'minimalist fashion, clean and simple aesthetic' },
};

// ----- 默认单品数据 -----
const DEFAULT_ITEMS = [
  // 上衣
  { id: 't1', name: '白色纯棉T恤', category: 'top', emoji: '👕', color: '白色', season: '夏天', occasion: ['休闲', '通勤'], note: '百搭基础款', desc: 'a white cotton t-shirt', image: null },
  { id: 't2', name: '黑色针织衫', category: 'top', emoji: '🧶', color: '黑色', season: '冬天', occasion: ['通勤', '休闲'], note: '秋冬保暖', desc: 'a black knit sweater', image: null },
  { id: 't3', name: '蓝色条纹衬衫', category: 'top', emoji: '👔', color: '蓝色', season: '四季', occasion: ['通勤', '休闲'], note: '正式休闲皆宜', desc: 'a blue striped button-up shirt', image: null },
  { id: 't4', name: '米色高领毛衣', category: 'top', emoji: '🧶', color: '米色', season: '冬天', occasion: ['通勤', '约会'], note: '优雅保暖', desc: 'a beige turtleneck sweater', image: null },

  // 下装
  { id: 'b1', name: '深蓝色牛仔裤', category: 'bottom', emoji: '👖', color: '蓝色', season: '四季', occasion: ['休闲', '通勤'], note: '百搭牛仔裤', desc: 'dark blue denim jeans', image: null },
  { id: 'b2', name: '黑色西装裤', category: 'bottom', emoji: '👖', color: '黑色', season: '四季', occasion: ['通勤', '宴会'], note: '正式场合必备', desc: 'black tailored dress pants', image: null },
  { id: 'b3', name: '卡其色休闲裤', category: 'bottom', emoji: '👖', color: '卡其色', season: '春秋', occasion: ['通勤', '休闲'], note: '休闲通勤两相宜', desc: 'khaki chino pants', image: null },
  { id: 'b4', name: '灰色百褶裙', category: 'bottom', emoji: '👗', color: '灰色', season: '春秋', occasion: ['约会', '通勤'], note: '学院风', desc: 'a gray pleated skirt', image: null },

  // 外套
  { id: 'o1', name: '黑色西装外套', category: 'outerwear', emoji: '🧥', color: '黑色', season: '四季', occasion: ['通勤', '宴会'], note: '职场利器', desc: 'a black blazer jacket', image: null },
  { id: 'o2', name: '牛仔夹克', category: 'outerwear', emoji: '🧥', color: '蓝色', season: '春秋', occasion: ['休闲', '约会'], note: '街头风', desc: 'a blue denim jacket', image: null },
  { id: 'o3', name: '橙色棉服', category: 'outerwear', emoji: '🧥', color: '橙色', season: '冬天', occasion: ['通勤', '休闲'], note: '冬季保暖', desc: 'an orange padded winter jacket', image: null },
  { id: 'o4', name: '米色风衣', category: 'outerwear', emoji: '🧥', color: '米色', season: '春秋', occasion: ['通勤', '约会'], note: '春秋百搭', desc: 'a beige trench coat', image: null },

  // 连衣裙
  { id: 'd1', name: '碎花连衣裙', category: 'dress', emoji: '👗', color: '彩色', season: '夏天', occasion: ['约会', '宴会'], note: '浪漫碎花', desc: 'a floral print dress', image: null },
  { id: 'd2', name: '黑色连衣短裙', category: 'dress', emoji: '👗', color: '黑色', season: '四季', occasion: ['约会', '宴会'], note: '简约显气质', desc: 'a black mini dress', image: null },

  // 鞋
  { id: 's1', name: '白色运动鞋', category: 'shoes', emoji: '👟', color: '白色', season: '四季', occasion: ['休闲', '运动'], note: '舒适百搭', desc: 'white sneakers', image: null },
  { id: 's2', name: '黑色皮鞋', category: 'shoes', emoji: '👞', color: '黑色', season: '四季', occasion: ['通勤', '宴会'], note: '正式场合', desc: 'black leather shoes', image: null },
  { id: 's3', name: '棕色短靴', category: 'shoes', emoji: '🥾', color: '棕色', season: '秋冬', occasion: ['通勤', '休闲'], note: '秋冬搭配', desc: 'brown ankle boots', image: null },
  { id: 's4', name: '白色帆布鞋', category: 'shoes', emoji: '👟', color: '白色', season: '四季', occasion: ['休闲', '运动'], note: '清新学院风', desc: 'white canvas shoes', image: null },

  // 配饰
  { id: 'a1', name: '黑色棒球帽', category: 'accessory', emoji: '🧢', color: '黑色', season: '四季', occasion: ['休闲', '运动'], note: '街头风', desc: 'a black baseball cap', image: null },
  { id: 'a2', name: '太阳镜', category: 'accessory', emoji: '🕶️', color: '黑色', season: '夏天', occasion: ['休闲', '约会'], note: '夏日必备', desc: 'a pair of sunglasses', image: null },
  { id: 'a3', name: '银色手表', category: 'accessory', emoji: '⌚', color: '银色', season: '四季', occasion: ['通勤', '休闲'], note: '精致细节', desc: 'a silver wristwatch', image: null },
  { id: 'a4', name: '格纹围巾', category: 'accessory', emoji: '🧣', color: '彩色', season: '冬天', occasion: ['通勤', '休闲'], note: '冬季保暖', desc: 'a plaid scarf', image: null },

  // 包
  { id: 'g1', name: '黑色单肩包', category: 'bag', emoji: '👜', color: '黑色', season: '四季', occasion: ['通勤', '宴会'], note: '职场百搭', desc: 'a black shoulder bag', image: null },
  { id: 'g2', name: '棕色斜挎包', category: 'bag', emoji: '👝', color: '棕色', season: '四季', occasion: ['休闲', '约会'], note: '随性出街', desc: 'a brown crossbody bag', image: null },
  { id: 'g3', name: '白色手提包', category: 'bag', emoji: '👜', color: '白色', season: '四季', occasion: ['通勤', '约会'], note: '优雅提亮', desc: 'a white handbag', image: null },
];

// ----- 状态管理 -----
let state = {
  items: [],
  selectedItems: {},  // { top: item, bottom: item, ... }
  currentFilter: 'all',
  searchQuery: '',
  seasonFilter: '',
  occasionFilter: '',
  currentTab: 'wardrobe',
  currentStyle: 'casual',
  isGenerating: false,
  currentResultUrl: '',
  customItemImage: null, // modal 临时存储
  editingItemId: null,   // 编辑中的单品 id
  draggedItem: null,
};

// ----- DOM 引用 -----
const dom = {
  itemCount: document.getElementById('itemCount'),
  selectedCount: document.getElementById('selectedCount'),
  searchInput: document.getElementById('searchInput'),
  categoryFilters: document.getElementById('categoryFilters'),
  seasonFilter: document.getElementById('seasonFilter'),
  occasionFilter: document.getElementById('occasionFilter'),
  libraryControls: document.getElementById('libraryControls'),
  itemGrid: document.getElementById('itemGrid'),
  savedSets: document.getElementById('savedSets'),
  dropZonesGrid: document.getElementById('dropZonesGrid'),
  stylePresets: document.getElementById('stylePresets'),
  generateBtn: document.getElementById('generateBtn'),
  randomBtn: document.getElementById('randomBtn'),
  clearBtn: document.getElementById('clearBtn'),
  saveOutfitBtn: document.getElementById('saveOutfitBtn'),
  resultDisplay: document.getElementById('resultDisplay'),
  resultSummary: document.getElementById('resultSummary'),
  resultActions: document.getElementById('resultActions'),
  downloadBtn: document.getElementById('downloadBtn'),
  regenerateBtn: document.getElementById('regenerateBtn'),
  modelRefBtn: document.getElementById('modelRefBtn'),
  toastContainer: document.getElementById('toastContainer'),
  // Modal
  addClothingBtn: document.getElementById('addClothingBtn'),
  addClothingModal: document.getElementById('addClothingModal'),
  modalCloseBtn: document.getElementById('modalCloseBtn'),
  cancelAddBtn: document.getElementById('cancelAddBtn'),
  confirmAddBtn: document.getElementById('confirmAddBtn'),
  imageUpload: document.getElementById('imageUpload'),
  uploadPlaceholder: document.getElementById('uploadPlaceholder'),
  uploadedImagePreview: document.getElementById('uploadedImagePreview'),
  imageInput: document.getElementById('imageInput'),
  itemName: document.getElementById('itemName'),
  itemNote: document.getElementById('itemNote'),
  itemCategory: document.getElementById('itemCategory'),
  itemColor: document.getElementById('itemColor'),
  itemSeason: document.getElementById('itemSeason'),
  itemOccasion: document.getElementById('itemOccasion'),
  itemDesc: document.getElementById('itemDesc'),
  addModalTitle: document.getElementById('addModalTitle'),
  // Import/Export
  importBtn: document.getElementById('importBtn'),
  exportBtn: document.getElementById('exportBtn'),
  importInput: document.getElementById('importInput'),
  // Mode Settings Modal
  modeBtn: document.getElementById('apiKeyBtn'),
  modeModal: document.getElementById('apiKeyModal'),
  modeCloseBtn: document.getElementById('apiKeyCloseBtn'),
  modeCancelBtn: document.getElementById('apiKeyCancelBtn'),
  modeSaveBtn: document.getElementById('apiKeySaveBtn'),
  tryonModeRadio: document.getElementById('tryonModeRadio'),
  generateModeRadio: document.getElementById('generateModeRadio'),
  proxyStatus: document.getElementById('proxyStatus'),
};

// ==========================================
// 初始化
// ==========================================
function init() {
  loadFromStorage();
  // 检查数据版本，v2 需要重新加载（使用真实衣服图片）
  const savedVersion = parseInt(localStorage.getItem('outfitStyler_version') || '1');
  if (savedVersion < CONFIG.DATA_VERSION) {
    state.items = [...DEFAULT_ITEMS];
    state.selectedItems = {};
    localStorage.setItem('outfitStyler_version', String(CONFIG.DATA_VERSION));
  } else if (state.items.length === 0) {
    state.items = [...DEFAULT_ITEMS];
  }

  renderCategoryFilters();
  renderStylePresets();
  renderDropZones();
  renderItems();
  updateItemCount();
  updateSelectedCount();
  bindEvents();
  detectProxy();
}

// ==========================================
// 事件绑定
// ==========================================
function bindEvents() {
  // 搜索
  dom.searchInput.addEventListener('input', (e) => {
    state.searchQuery = e.target.value.toLowerCase();
    renderItems();
  });

  // 季节筛选
  dom.seasonFilter.addEventListener('change', (e) => {
    state.seasonFilter = e.target.value;
    renderItems();
  });

  // 场合筛选
  dom.occasionFilter.addEventListener('change', (e) => {
    state.occasionFilter = e.target.value;
    renderItems();
  });

  // 衣橱 / 套装 切换
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchLibraryTab(btn.dataset.tab));
  });

  // 生成穿搭
  dom.generateBtn.addEventListener('click', generateOutfit);

  // 随机搭配
  dom.randomBtn.addEventListener('click', randomOutfit);

  // 清空
  dom.clearBtn.addEventListener('click', clearAll);

  // 保存套装
  dom.saveOutfitBtn.addEventListener('click', saveOutfit);

  // 下载
  dom.downloadBtn.addEventListener('click', downloadResult);

  // 重新生成
  dom.regenerateBtn.addEventListener('click', generateOutfit);

  // 查看模特参考照
  dom.modelRefBtn.addEventListener('click', showModelRef);

  // Mode Settings Modal
  dom.modeBtn.addEventListener('click', showModeModal);
  dom.modeCloseBtn.addEventListener('click', () => dom.modeModal.style.display = 'none');
  dom.modeCancelBtn.addEventListener('click', () => dom.modeModal.style.display = 'none');
  dom.modeSaveBtn.addEventListener('click', saveModeSetting);

  // 添加衣服 Modal
  dom.addClothingBtn.addEventListener('click', openAddModal);
  dom.modalCloseBtn.addEventListener('click', closeAddModal);
  dom.cancelAddBtn.addEventListener('click', closeAddModal);
  dom.confirmAddBtn.addEventListener('click', addCustomItem);
  dom.imageUpload.addEventListener('click', () => dom.imageInput.click());
  dom.imageInput.addEventListener('change', handleImageUpload);

  // 导入/导出
  dom.exportBtn.addEventListener('click', exportData);
  dom.importBtn.addEventListener('click', () => dom.importInput.click());
  dom.importInput.addEventListener('change', (e) => {
    if (e.target.files[0]) importData(e.target.files[0]);
  });
}

// ==========================================
// 渲染：类别筛选
// ==========================================
function renderCategoryFilters() {
  const cats = [{ key: 'all', name: '全部' }];
  Object.entries(CATEGORIES).forEach(([key, val]) => {
    cats.push({ key, name: val.name });
  });

  dom.categoryFilters.innerHTML = cats.map(c =>
    `<button class="cat-pill ${state.currentFilter === c.key ? 'active' : ''}" data-cat="${c.key}">${c.name}</button>`
  ).join('');

  dom.categoryFilters.querySelectorAll('.cat-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      state.currentFilter = btn.dataset.cat;
      renderCategoryFilters();
      renderItems();
    });
  });
}

// ==========================================
// 渲染：风格预设
// ==========================================
function renderStylePresets() {
  dom.stylePresets.innerHTML = Object.entries(STYLES).map(([key, val]) =>
    `<button class="style-btn ${state.currentStyle === key ? 'active' : ''}" data-style="${key}">${val.name}</button>`
  ).join('');

  dom.stylePresets.querySelectorAll('.style-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.currentStyle = btn.dataset.style;
      renderStylePresets();
    });
  });
}

// ==========================================
// 渲染：单品库
// ==========================================
function renderItems() {
  let filtered = state.items;

  // 类别筛选
  if (state.currentFilter !== 'all') {
    filtered = filtered.filter(item => item.category === state.currentFilter);
  }

  // 季节筛选
  if (state.seasonFilter) {
    filtered = filtered.filter(item =>
      item.season === state.seasonFilter || item.season === '四季' || item.season === '秋冬'
    );
  }

  // 场合筛选
  if (state.occasionFilter) {
    filtered = filtered.filter(item =>
      Array.isArray(item.occasion)
        ? item.occasion.includes(state.occasionFilter)
        : item.occasion === state.occasionFilter
    );
  }

  // 搜索
  if (state.searchQuery) {
    filtered = filtered.filter(item =>
      item.name.toLowerCase().includes(state.searchQuery) ||
      (item.color && item.color.toLowerCase().includes(state.searchQuery)) ||
      (item.note && item.note.toLowerCase().includes(state.searchQuery))
    );
  }

  if (filtered.length === 0) {
    dom.itemGrid.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:#94a3b8;padding:20px;font-size:12px;">暂无匹配单品</div>';
    return;
  }

  dom.itemGrid.innerHTML = filtered.map(item => {
    const isSelected = Object.values(state.selectedItems).some(s => s && s.id === item.id);
    const imgUrl = getItemImageUrl(item);
    return `
      <div class="item-card ${isSelected ? 'selected' : ''}" draggable="true" data-id="${item.id}">
        <div class="item-card-img">
          <img src="${imgUrl}" alt="${item.name}" loading="lazy" data-emoji="${item.emoji}" onerror="imgFallback(this)">
        </div>
        <div class="item-card-name">${item.name}</div>
        <div class="item-card-tags">
          <span class="item-tag">${item.color}</span>
          <span class="item-tag">${CATEGORIES[item.category].name}</span>
        </div>
        <button class="item-add-btn" data-id="${item.id}">+</button>
        <button class="item-edit-btn" data-id="${item.id}" title="编辑">✎</button>
      </div>
    `;
  }).join('');

  // 绑定拖拽事件
  dom.itemGrid.querySelectorAll('.item-card').forEach(card => {
    card.addEventListener('dragstart', handleDragStart);
    card.addEventListener('dragend', handleDragEnd);
  });

  // 绑定点击添加
  dom.itemGrid.querySelectorAll('.item-add-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const item = state.items.find(i => i.id === btn.dataset.id);
      if (item) addToZone(item);
    });
  });

  // 绑定点击编辑
  dom.itemGrid.querySelectorAll('.item-edit-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openAddModal(btn.dataset.id);
    });
  });

  // 绑定点击卡片添加
  dom.itemGrid.querySelectorAll('.item-card').forEach(card => {
    card.addEventListener('click', () => {
      const item = state.items.find(i => i.id === card.dataset.id);
      if (item) addToZone(item);
    });
  });
}

// ==========================================
// 渲染：拖拽搭配区
// ==========================================
function renderDropZones() {
  const sortedCats = Object.entries(CATEGORIES).sort((a, b) => a[1].order - b[1].order);

  dom.dropZonesGrid.innerHTML = sortedCats.map(([key, cat]) => {
    const selected = state.selectedItems[key];
    if (selected) {
      const imgUrl = getItemImageUrl(selected);
      return `
        <div class="drop-zone filled" data-cat="${key}">
          <button class="zone-remove" data-cat="${key}">×</button>
          <div class="zone-content">
            <div class="zone-content-img">
              <img src="${imgUrl}" alt="${selected.name}" loading="lazy" data-emoji="${selected.emoji}" onerror="imgFallback(this)">
            </div>
            <div class="zone-content-info">
              <div class="zone-content-name">${selected.name}</div>
              <div class="zone-content-cat">${cat.name} · ${selected.color}</div>
            </div>
          </div>
        </div>
      `;
    }
    return `
      <div class="drop-zone" data-cat="${key}">
        <div class="zone-placeholder">${cat.emoji}</div>
        <div class="zone-label">${cat.name}</div>
      </div>
    `;
  }).join('');

  // 绑定拖放事件
  dom.dropZonesGrid.querySelectorAll('.drop-zone').forEach(zone => {
    zone.addEventListener('dragover', handleDragOver);
    zone.addEventListener('dragleave', handleDragLeave);
    zone.addEventListener('drop', handleDrop);
  });

  // 绑定移除按钮
  dom.dropZonesGrid.querySelectorAll('.zone-remove').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      removeFromZone(btn.dataset.cat);
    });
  });

  updateGenerateButton();
}

// ==========================================
// 拖拽事件
// ==========================================
function handleDragStart(e) {
  const id = e.currentTarget.dataset.id;
  state.draggedItem = state.items.find(i => i.id === id);
  e.currentTarget.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'copy';
  e.dataTransfer.setData('text/plain', id);
}

function handleDragEnd(e) {
  e.currentTarget.classList.remove('dragging');
  state.draggedItem = null;
  // 清除所有 drag-over 样式
  dom.dropZonesGrid.querySelectorAll('.drop-zone').forEach(z => z.classList.remove('drag-over'));
}

function handleDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'copy';
  e.currentTarget.classList.add('drag-over');
}

function handleDragLeave(e) {
  e.currentTarget.classList.remove('drag-over');
}

function handleDrop(e) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  if (state.draggedItem) {
    addToZone(state.draggedItem);
  }
}

// ==========================================
// 添加/移除单品到搭配区
// ==========================================
function addToZone(item) {
  state.selectedItems[item.category] = item;
  renderDropZones();
  renderItems();
  saveToStorage();
  showToast(`已添加：${item.name}`, 'success');
}

function removeFromZone(category) {
  const item = state.selectedItems[category];
  if (item) {
    delete state.selectedItems[category];
    renderDropZones();
    renderItems();
    saveToStorage();
    showToast(`已移除：${item.name}`, 'info');
  }
}

function updateGenerateButton() {
  const count = Object.keys(state.selectedItems).length;
  dom.generateBtn.disabled = count === 0 || state.isGenerating;
  updateSelectedCount();
}

function updateItemCount() {
  dom.itemCount.textContent = `${state.items.length}件单品`;
}

function updateSelectedCount() {
  const count = Object.keys(state.selectedItems).length;
  dom.selectedCount.textContent = `${count}件`;
}

// ==========================================
// 衣橱 / 套装 切换与套装管理
// ==========================================
function switchLibraryTab(tab) {
  state.currentTab = tab;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  const showWardrobe = tab === 'wardrobe';
  dom.libraryControls.style.display = showWardrobe ? '' : 'none';
  dom.itemGrid.style.display = showWardrobe ? '' : 'none';
  dom.savedSets.style.display = showWardrobe ? 'none' : '';
  if (!showWardrobe) renderSavedSets();
}

function renderSavedSets() {
  const saved = JSON.parse(localStorage.getItem('savedOutfits') || '[]');
  if (saved.length === 0) {
    dom.savedSets.innerHTML = `
      <div class="sets-empty">
        <div>👔</div>
        暂无保存的套装
        <span>在搭配区点击"保存套装"即可收藏</span>
      </div>
    `;
    return;
  }

  dom.savedSets.innerHTML = saved.map(set => {
    const items = Object.entries(set.items || {}).map(([cat, item]) =>
      `<span class="summary-tag">${CATEGORIES[cat] ? CATEGORIES[cat].name : cat}: ${item.name}</span>`
    ).join('');
    const styleName = set.style && STYLES[set.style] ? STYLES[set.style].name : '休闲';
    return `
      <div class="set-card">
        <div class="set-info">
          <div class="set-name">${set.name || '未命名套装'}</div>
          <div class="set-meta">${Object.keys(set.items || {}).length}件单品 · ${styleName}风格</div>
          <div class="set-tags">${items}</div>
        </div>
        <div class="set-actions">
          <button class="btn btn-secondary btn-sm" data-load="${set.id}">使用</button>
          <button class="btn btn-ghost btn-sm set-del" data-del="${set.id}">删除</button>
        </div>
      </div>
    `;
  }).join('');

  dom.savedSets.querySelectorAll('[data-load]').forEach(btn => {
    btn.addEventListener('click', () => loadSet(btn.dataset.load));
  });
  dom.savedSets.querySelectorAll('[data-del]').forEach(btn => {
    btn.addEventListener('click', () => deleteSet(btn.dataset.del));
  });
}

function loadSet(id) {
  const saved = JSON.parse(localStorage.getItem('savedOutfits') || '[]');
  const set = saved.find(s => s.id === id);
  if (!set) return;
  state.selectedItems = { ...(set.items || {}) };
  if (set.style) state.currentStyle = set.style;
  renderDropZones();
  renderItems();
  renderStylePresets();
  saveToStorage();
  showToast(`已载入套装：${set.name || '未命名套装'}`, 'success');
}

function deleteSet(id) {
  let saved = JSON.parse(localStorage.getItem('savedOutfits') || '[]');
  saved = saved.filter(s => s.id !== id);
  localStorage.setItem('savedOutfits', JSON.stringify(saved));
  renderSavedSets();
  showToast('套装已删除', 'info');
}

// ==========================================
// AI 虚拟试衣生成
// 方案1: IDM-VTON（免费，Hugging Face，保持脸部不变）- 约1-2分钟
// 方案2: Pollinations 文生图（免费备选，会重新生成模特）- 约10-20秒
// ==========================================

// 获取当前选中服装的图片URL（取第一件选中的服装）
function getSelectedClothingImage() {
  const order = ['top', 'dress', 'outerwear', 'bottom', 'shoes', 'accessory', 'bag'];
  for (const cat of order) {
    const item = state.selectedItems[cat];
    if (item) {
      return getItemImageUrl(item);
    }
  }
  return null;
}

// ==========================================
// AI 虚拟试衣生成
// 方案1: IDM-VTON（免费，Hugging Face，保持脸部不变）- 约1-2分钟
// 方案2: Pollinations 文生图（免费备选，会重新生成模特）- 约10-20秒
// ==========================================

// 获取选中服装的文字描述
function getGarmentDescription() {
  const order = ['dress', 'top', 'outerwear', 'bottom', 'shoes', 'accessory', 'bag'];
  const parts = [];
  order.forEach(cat => {
    const item = state.selectedItems[cat];
    if (item) {
      parts.push(item.desc || item.name);
    }
  });
  return parts.join(', ') || 'clothing';
}

// IDM-VTON 虚拟试衣（通过本地代理服务器，保持脸部不变）
async function generateWithIDMVTON() {
  // 获取服装图片
  const clothingImgUrl = getSelectedClothingImage();
  if (!clothingImgUrl) {
    throw new Error('未找到服装图片');
  }

  const garmentDes = getGarmentDescription();

  updateLoadingText('正在连接AI服务器...');

  // 通过本地代理调用 IDM-VTON API
  const resp = await fetch('/api/tryon', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      modelImage: CONFIG.MODEL_REF_IMG,
      garmentImage: clothingImgUrl,
      garmentDes: garmentDes,
    }),
  });

  if (!resp.ok) {
    const errData = await resp.json().catch(() => ({ error: `服务器错误 (${resp.status})` }));
    throw new Error(errData.error || `虚拟试衣失败 (${resp.status})`);
  }

  const data = await resp.json();
  if (!data.success) {
    throw new Error(data.error || '虚拟试衣失败');
  }

  return data.resultUrl;
}

function updateLoadingText(text) {
  const el = dom.resultDisplay.querySelector('.loading-text');
  if (el) el.textContent = text;
}

// Pollinations 文生图（通过本地代理，免费备选）
async function generateWithPollinations() {
  const order = ['outerwear', 'top', 'dress', 'bottom', 'shoes', 'accessory', 'bag'];
  const parts = [];
  order.forEach(cat => {
    const item = state.selectedItems[cat];
    if (item) {
      if (cat === 'accessory') parts.push(`wearing ${item.desc}`);
      else if (cat === 'bag') parts.push(`carrying ${item.desc}`);
      else parts.push(item.desc);
    }
  });

  const styleDesc = STYLES[state.currentStyle]?.desc || '';
  const itemsStr = parts.join(', ');
  const prompt = `Fashion portrait of a young Asian woman, slim body type, long dark hair, wearing ${itemsStr}. ${styleDesc}. Beautiful detailed face, photorealistic, studio lighting, white background, 8K.`;

  const seed = 42;

  if (CONFIG.HAS_PROXY) {
    // 本地代理：避免浏览器 CORS 限制
    const resp = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        width: CONFIG.IMAGE_WIDTH,
        height: CONFIG.IMAGE_HEIGHT,
        seed,
      }),
    });

    if (!resp.ok) {
      throw new Error(`图片生成失败 (${resp.status})`);
    }

    const blob = await resp.blob();
    return URL.createObjectURL(blob);
  }

  // 在线直连模式（无需后端，适合 GitHub Pages 等静态托管）
  const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${CONFIG.IMAGE_WIDTH}&height=${CONFIG.IMAGE_HEIGHT}&model=flux&nologo=true&seed=${seed}`;
  await loadImageWithTimeout(imageUrl, CONFIG.TIMEOUT);
  return imageUrl;
}

async function generateOutfit() {
  const selectedCount = Object.keys(state.selectedItems).length;
  if (selectedCount === 0) {
    showToast('请先选择至少一件单品', 'warning');
    return;
  }

  const useTryon = CONFIG.TRYON_MODE === 'tryon';

  if (useTryon) {
    // 虚拟试衣每次只换1件服装
    const clothingCount = ['top', 'dress', 'outerwear', 'bottom', 'shoes'].filter(c => state.selectedItems[c]).length;
    if (clothingCount > 1) {
      showToast('虚拟试衣每次换1件服装，将使用第一件', 'warning');
    }
  }

  state.isGenerating = true;
  updateGenerateButton();

  // 显示加载状态
  dom.resultDisplay.classList.add('loading');
  dom.resultDisplay.innerHTML = `
    <div class="spinner-wrap">
      <div class="spinner"></div>
      <p class="loading-text">${useTryon ? 'AI 正在为模特换装...' : 'AI 正在生成穿搭...'}</p>
      <p class="loading-sub">${useTryon ? '虚拟试衣中，保持脸部不变，预计1-2分钟' : '文生图模式，预计 10-20 秒'}</p>
    </div>
  `;
  dom.resultActions.style.display = 'none';
  dom.resultSummary.innerHTML = '';

  // 显示搭配摘要
  renderResultSummary();

  // 加载进度计时器（虚拟试衣模式）
  let loadingTimer = null;
  if (useTryon) {
    const startTime = Date.now();
    loadingTimer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      if (elapsed < 10) {
        updateLoadingText('正在连接AI服务器...');
      } else if (elapsed < 30) {
        updateLoadingText('正在上传图片...');
      } else if (elapsed < 60) {
        updateLoadingText(`AI正在换装中... 已等待${elapsed}秒`);
      } else if (elapsed < 120) {
        updateLoadingText(`AI正在换装中... 已等待${elapsed}秒，请耐心等待`);
      } else {
        updateLoadingText(`仍在处理中... 已等待${elapsed}秒`);
      }
    }, 3000);
  }

  try {
    let resultUrl;

    if (useTryon) {
      try {
        resultUrl = await generateWithIDMVTON();
      } catch (tryonErr) {
        // 虚拟试衣失败 - 不再静默回退，而是询问用户
        console.warn('虚拟试衣失败:', tryonErr);
        if (loadingTimer) clearInterval(loadingTimer);
        state.isGenerating = false;
        updateGenerateButton();
        dom.resultDisplay.classList.remove('loading');

        const tryonErrorMsg = tryonErr.message || '未知错误';
        dom.resultDisplay.innerHTML = `
          <div class="result-error">
            <div class="result-error-icon">⚠️</div>
            <p style="font-size:14px;font-weight:600;">虚拟试衣失败</p>
            <p style="font-size:11px;color:#94a3b8;margin-top:6px;line-height:1.5;">
              AI 服务器可能暂时不可用<br>
              （Hugging Face IDM-VTON Space 近期可能维护中）
            </p>
            <div style="margin-top:12px;display:flex;flex-direction:column;gap:8px;">
              <button class="btn btn-primary btn-sm" onclick="retryTryon()">🔄 重新试衣</button>
              <button class="btn btn-secondary btn-sm" onclick="switchToGenerate()">⚡ 切换到快速生成</button>
            </div>
          </div>
        `;
        showToast('虚拟试衣失败，可重试或切换模式', 'warning');
        return;
      }
    } else {
      resultUrl = await generateWithPollinations();
    }

    state.currentResultUrl = resultUrl;
    state.isGenerating = false;

    // 清除加载计时器
    if (loadingTimer) clearInterval(loadingTimer);

    dom.resultDisplay.classList.remove('loading');
    dom.resultDisplay.innerHTML = `<img src="${resultUrl}" alt="AI 换装效果" onerror="this.parentElement.innerHTML='<div class=\\'result-error\\'><div class=\\'result-error-icon\\'>🖼️</div><p>图片加载失败</p><p style=\\'font-size:11px;color:#94a3b8;\\'>${resultUrl}</p></div>';">`;
    dom.resultActions.style.display = 'flex';
    updateGenerateButton();
    showToast(useTryon ? '换装成功！脸部已保持不变' : '穿搭生成成功！', 'success');
    saveToStorage();
  } catch (err) {
    state.isGenerating = false;
    updateGenerateButton();

    // 清除加载计时器
    if (loadingTimer) clearInterval(loadingTimer);
    dom.resultDisplay.classList.remove('loading');

    const errorMsg = err.message || '未知错误';

    dom.resultDisplay.innerHTML = `
      <div class="result-error">
        <div class="result-error-icon">⚠️</div>
        <p>生成失败</p>
        <p style="font-size:11px;color:#94a3b8;margin-top:4px;">${errorMsg}</p>
        <p style="font-size:11px;color:#f59e0b;margin-top:4px;">请检查网络连接后重试</p>
        <button class="btn btn-secondary btn-sm" style="margin-top:8px;" onclick="switchToGenerate()">切换到快速生成模式</button>
      </div>
    `;
    showToast('生成失败，请重试', 'error');
  }
}

function loadImageWithTimeout(url, timeout) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const timer = setTimeout(() => {
      img.src = '';
      reject(new Error('请求超时'));
    }, timeout);

    img.onload = () => {
      clearTimeout(timer);
      resolve(url);
    };
    img.onerror = () => {
      clearTimeout(timer);
      reject(new Error('图片加载失败'));
    };
    img.src = url;
  });
}

function renderResultSummary() {
  const selected = Object.entries(state.selectedItems);
  if (selected.length === 0) {
    dom.resultSummary.innerHTML = '';
    return;
  }
  dom.resultSummary.innerHTML = `
    <div class="result-summary-title">本次搭配（${STYLES[state.currentStyle].name}风格）</div>
    <div class="result-summary-items">
      ${selected.map(([cat, item]) =>
        `<span class="summary-tag">${CATEGORIES[cat].name}: ${item.name}</span>`
      ).join('')}
    </div>
  `;
}

// ==========================================
// 随机搭配
// ==========================================
function randomOutfit() {
  state.selectedItems = {};
  const cats = Object.keys(CATEGORIES);

  cats.forEach(cat => {
    const items = state.items.filter(i => i.category === cat);
    if (items.length > 0 && Math.random() > 0.3) {
      const randomItem = items[Math.floor(Math.random() * items.length)];
      state.selectedItems[cat] = randomItem;
    }
  });

  // 确保至少有上装和下装（或连衣裙）
  if (!state.selectedItems.top && !state.selectedItems.dress) {
    const tops = state.items.filter(i => i.category === 'top');
    if (tops.length > 0) state.selectedItems.top = tops[0];
  }
  if (!state.selectedItems.bottom && !state.selectedItems.dress) {
    const bottoms = state.items.filter(i => i.category === 'bottom');
    if (bottoms.length > 0) state.selectedItems.bottom = bottoms[0];
  }

  renderDropZones();
  renderItems();
  saveToStorage();
  showToast('已随机搭配', 'info');
}

// ==========================================
// 清空
// ==========================================
function clearAll() {
  state.selectedItems = {};
  renderDropZones();
  renderItems();
  saveToStorage();
  showToast('已清空搭配', 'info');
}

// ==========================================
// 保存套装
// ==========================================
function saveOutfit() {
  const count = Object.keys(state.selectedItems).length;
  if (count === 0) {
    showToast('当前没有搭配可保存', 'warning');
    return;
  }

  const saved = JSON.parse(localStorage.getItem('savedOutfits') || '[]');
  saved.push({
    id: Date.now().toString(),
    name: `套装 ${saved.length + 1}`,
    items: state.selectedItems,
    style: state.currentStyle,
    createdAt: new Date().toISOString(),
  });
  localStorage.setItem('savedOutfits', JSON.stringify(saved));
  renderSavedSets();
  showToast(`套装已保存！（共 ${saved.length} 套）`, 'success');
}

// ==========================================
// 下载结果
// ==========================================
function downloadResult() {
  if (!state.currentResultUrl) return;

  fetch(state.currentResultUrl)
    .then(res => res.blob())
    .then(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `outfit_${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('图片下载成功', 'success');
    })
    .catch(() => {
      // 如果 fetch 失败，直接打开链接
      window.open(state.currentResultUrl, '_blank');
      showToast('已在新窗口打开图片', 'info');
    });
}

// ==========================================
// 查看模特参考照
// ==========================================
function showModelRef() {
  // 创建临时模态层展示模特参考照
  let modal = document.getElementById('modelRefModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modelRefModal';
    modal.className = 'modal-overlay';
    modal.style.display = 'flex';
    modal.innerHTML = `
      <div class="modal" style="max-width: 360px;">
        <div class="modal-header">
          <h3>固定模特参考照</h3>
          <button class="modal-close" onclick="document.getElementById('modelRefModal').style.display='none'">×</button>
        </div>
        <div class="modal-body" style="text-align: center;">
          <img src="${CONFIG.MODEL_REF_IMG}" alt="固定模特" style="max-width: 100%; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
          <p style="display:none; color: #94a3b8; padding: 40px;">模特照片加载失败</p>
          <p style="font-size: 12px; color: #64748b; margin-top: 12px; line-height: 1.6;">
            AI 将基于此模特的固定面部特征和体型生成穿搭效果。<br>
            每次换装仅改变服装，模特本人保持一致。
          </p>
        </div>
      </div>
    `;
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.style.display = 'none';
    });
    document.body.appendChild(modal);
  } else {
    modal.style.display = 'flex';
  }
}

// ==========================================
// 试衣模式设置
// ==========================================
function showModeModal() {
  dom.modeModal.style.display = 'flex';
  const currentMode = localStorage.getItem('tryon_mode') || 'tryon';
  dom.tryonModeRadio.checked = currentMode === 'tryon';
  dom.generateModeRadio.checked = currentMode !== 'tryon';
  dom.tryonModeRadio.disabled = !CONFIG.HAS_PROXY;
  dom.proxyStatus.textContent = CONFIG.HAS_PROXY
    ? '本地代理：已连接（支持虚拟试衣模式）'
    : '本地代理：未连接（在线版自动使用快速生成）';
}

function saveModeSetting() {
  if (dom.tryonModeRadio.checked && !CONFIG.HAS_PROXY) {
    showToast('当前环境未连接本地代理，无法使用虚拟试衣', 'warning');
    return;
  }
  const mode = dom.tryonModeRadio.checked ? 'tryon' : 'generate';
  localStorage.setItem('tryon_mode', mode);
  CONFIG.TRYON_MODE = mode;
  dom.modeModal.style.display = 'none';
  showToast(mode === 'tryon' ? '已切换到虚拟试衣模式（保持脸部，约1-2分钟）' : '已切换到快速生成模式（10-20秒）', 'success');
}

function switchToGenerate() {
  localStorage.setItem('tryon_mode', 'generate');
  CONFIG.TRYON_MODE = 'generate';
  showToast('已切换到快速生成模式', 'info');
  generateOutfit();
}

function retryTryon() {
  generateOutfit();
}

// ==========================================
// 添加衣服 Modal
// ==========================================
function openAddModal(itemId) {
  dom.addClothingModal.style.display = 'flex';
  state.editingItemId = itemId || null;
  const editing = itemId ? state.items.find(i => i.id === itemId) : null;

  dom.addModalTitle.textContent = editing ? '编辑衣服' : '添加衣服';
  dom.confirmAddBtn.textContent = editing ? '保存修改' : '确认添加';

  // 重置表单
  dom.itemName.value = editing ? editing.name : '';
  dom.itemNote.value = editing && editing.note ? editing.note : '';
  dom.itemColor.value = editing ? (editing.color || '') : '';
  dom.itemDesc.value = editing ? (editing.desc || '') : '';
  dom.itemCategory.value = editing ? editing.category : 'top';
  dom.itemSeason.value = editing ? (editing.season || '四季') : '四季';
  dom.itemOccasion.value = editing
    ? (Array.isArray(editing.occasion) ? editing.occasion[0] : editing.occasion || '休闲')
    : '休闲';

  state.customItemImage = null;
  if (editing && editing.image) {
    dom.uploadedImagePreview.src = editing.image;
    dom.uploadedImagePreview.style.display = 'block';
    dom.uploadPlaceholder.style.display = 'none';
  } else {
    dom.uploadedImagePreview.style.display = 'none';
    dom.uploadPlaceholder.style.display = 'block';
    dom.uploadPlaceholder.querySelector('p').textContent = editing
      ? '未上传过图片（点击上传新图，留空保留原图）'
      : '点击上传图片';
  }
}

function closeAddModal() {
  dom.addClothingModal.style.display = 'none';
}

function handleImageUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    state.customItemImage = e.target.result;
    dom.uploadedImagePreview.src = e.target.result;
    dom.uploadedImagePreview.style.display = 'block';
    dom.uploadPlaceholder.style.display = 'none';
  };
  reader.readAsDataURL(file);
}

function addCustomItem() {
  const name = dom.itemName.value.trim();
  if (!name) {
    showToast('请输入名称', 'warning');
    return;
  }

  const category = dom.itemCategory.value;
  const color = dom.itemColor.value.trim() || '未知';
  const season = dom.itemSeason.value;
  const occasion = dom.itemOccasion.value || '休闲';
  const note = dom.itemNote.value.trim() || '';
  const desc = dom.itemDesc.value.trim() || `a ${color} ${CATEGORIES[category].name}`;
  const emoji = CATEGORIES[category].emoji;

  // 编辑模式：更新已有单品
  if (state.editingItemId) {
    const item = state.items.find(i => i.id === state.editingItemId);
    if (item) {
      Object.assign(item, {
        name,
        category,
        color,
        season,
        occasion: [occasion],
        note,
        desc,
      });
      if (state.customItemImage) item.image = state.customItemImage;
      renderItems();
      renderDropZones();
      updateItemCount();
      saveToStorage();
      closeAddModal();
      showToast(`已更新：${name}`, 'success');
      return;
    }
  }

  const newItem = {
    id: 'custom_' + Date.now(),
    name,
    category,
    emoji,
    color,
    season,
    occasion: [occasion],
    note,
    desc,
    image: state.customItemImage,
  };

  state.items.push(newItem);
  renderItems();
  updateItemCount();
  saveToStorage();
  closeAddModal();
  showToast(`已添加：${name}`, 'success');
}

// ==========================================
// 导入/导出
// ==========================================
function exportData() {
  const data = {
    items: state.items,
    selectedItems: state.selectedItems,
    currentStyle: state.currentStyle,
    exportedAt: new Date().toISOString(),
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `outfit_backup_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('备份已导出', 'success');
}

function importData(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (data.items && Array.isArray(data.items)) {
        state.items = data.items;
        if (data.selectedItems) state.selectedItems = data.selectedItems;
        if (data.currentStyle) state.currentStyle = data.currentStyle;

        renderCategoryFilters();
        renderStylePresets();
        renderDropZones();
        renderItems();
        updateItemCount();
        saveToStorage();
        showToast(`已导入 ${data.items.length} 件单品`, 'success');
      } else {
        showToast('文件格式不正确', 'error');
      }
    } catch (err) {
      showToast('导入失败：文件格式错误', 'error');
    }
  };
  reader.readAsText(file);
  dom.importInput.value = ''; // 重置 input
}

// ==========================================
// LocalStorage 持久化
// ==========================================
function saveToStorage() {
  try {
    localStorage.setItem('outfitStyler_items', JSON.stringify(state.items));
    localStorage.setItem('outfitStyler_selected', JSON.stringify(state.selectedItems));
    localStorage.setItem('outfitStyler_style', state.currentStyle);
    localStorage.setItem('outfitStyler_version', String(CONFIG.DATA_VERSION));
  } catch (e) {
    console.warn('保存失败', e);
  }
}

function loadFromStorage() {
  try {
    const items = localStorage.getItem('outfitStyler_items');
    const selected = localStorage.getItem('outfitStyler_selected');
    const style = localStorage.getItem('outfitStyler_style');

    if (items) state.items = JSON.parse(items);
    if (selected) state.selectedItems = JSON.parse(selected);
    if (style) state.currentStyle = style;
  } catch (e) {
    console.warn('加载失败', e);
  }
}

// ==========================================
// 本地代理探测：有代理用虚拟试衣/本地生图，无代理自动切直连模式
// ==========================================
async function detectProxy() {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), CONFIG.PROXY_CHECK_TIMEOUT);
    const resp = await fetch('/api/health', { signal: ctrl.signal });
    clearTimeout(timer);
    if (resp.ok) {
      CONFIG.HAS_PROXY = true;
      if (dom.proxyStatus) dom.proxyStatus.textContent = '本地代理：已连接（支持虚拟试衣模式）';
      return;
    }
  } catch (e) {
    // 网络错误视为无代理
  }

  CONFIG.HAS_PROXY = false;
  if (dom.proxyStatus) dom.proxyStatus.textContent = '本地代理：未连接（在线版自动使用快速生成）';
  if (CONFIG.TRYON_MODE === 'tryon') {
    CONFIG.TRYON_MODE = 'generate';
    localStorage.setItem('tryon_mode', 'generate');
    showToast('在线环境已自动切换到快速生成模式', 'info');
  }
}

// ==========================================
// Toast 通知
// ==========================================
function showToast(message, type = 'info') {
  const icons = { success: '✓', error: '✕', info: 'ℹ', warning: '⚠' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${icons[type]}</span><span>${message}</span>`;
  dom.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(120%)';
    toast.style.transition = '0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

// ==========================================
// 启动
// ==========================================
init();
