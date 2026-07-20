/* ==================== 1. TELEGRAM + LOADING ==================== */
let tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
let tgUser;

if (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) {
  tgUser = tg.initDataUnsafe.user;
  try { tg.ready(); } catch (e) {}
  try { tg.expand(); } catch (e) {}
} else {
  tgUser = { id: 8169708922, first_name: 'PREMIUM', last_name: '', username: 'premium', photo_url: '' };
}

const uid = String(tgUser.id || '8169708922');
const tgFirstName = tgUser.first_name || '';
const tgLastName = tgUser.last_name || '';
const tgUsername = tgUser.username || '';
const tgPhotoUrl = tgUser.photo_url || '';
const tgLanguage = tgUser.language_code || 'vi';

const displayName = (tgFirstName + ' ' + tgLastName).trim() || tgUsername || ('User ' + uid);
const avatarLetter = (tgFirstName || displayName).charAt(0).toUpperCase();
const displayHandle = tgUsername ? '@' + tgUsername : '@' + uid;

function renderAvatar(imgEl, letter) {
  if (tgPhotoUrl) {
    imgEl.innerHTML = `<img src="${tgPhotoUrl}" alt="avatar" onerror="this.parentElement.textContent='${letter}'">`;
  } else {
    imgEl.textContent = letter;
  }
}

renderAvatar(document.getElementById('avatarBox'), avatarLetter);
renderAvatar(document.getElementById('avatarBoxProfile'), avatarLetter);
document.getElementById('userName').textContent = displayName;
document.getElementById('userHandle').textContent = displayHandle;
document.getElementById('userNameProfile').textContent = displayName;
document.getElementById('userHandleProfile').textContent = displayHandle;
document.getElementById('userUid').textContent = uid + ' ▦';

const BOT_USERNAME = 'VuaDaoQuang_Bot';
const refLinkText = `https://t.me/${BOT_USERNAME}?start=${uid}`;
document.getElementById('refLink').textContent = refLinkText;

const now = new Date();
document.getElementById('joinDate').textContent =
  `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`;

window.addEventListener('load', () => {
  initUserSystem();
  setTimeout(() => {
    document.getElementById('loadingScreen').classList.add('hidden-load');
  }, 1100);
});

/* ==================== 2. TOAST ==================== */
function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('show'), 2500);
}

/* ==================== 3. USER SYSTEM - AUTO REGISTER ==================== */
function initUserSystem() {
  let users = getUsersDB();
  let currentUser = users.find(u => u.uid === uid);

  if (!currentUser) {
    currentUser = {
      uid: uid,
      name: displayName,
      handle: displayHandle,
      photoUrl: tgPhotoUrl,
      balance: 0,
      points: 0,
      withdrawn: 0,
      level: 0,
      xp: 0,
      xpNeeded: 120,
      fragments: 0,
      tickets: 0,
      banned: false,
      joinedAt: new Date().toLocaleDateString('vi-VN'),
      lastCheckin: null,
      machines: [],
      inventory: [],
      referralCount: 0,
      referredBy: null,
      dailyAdWatched: 0,
      lastAdDate: null,
      vipAdsExpiry: null,
      svipAdsExpiry: null,
      insuranceExpiry: null,
      storageUpgrade: false,
      claimedDefaultGift: false,
    };
    users.push(currentUser);
    saveUsersDB(users);

    showNotifyBanner({
      title: 'Chao mung tho dao moi!',
      body: `Xin chao ${displayName}! Ban da duoc tang 0 Quang khoi dau. Hay khoi dong may dao ngay!`,
      type: 'success',
    });

    sendBotMessage(
      ADMIN_ID,
      `🆕 USER MOI DANG KY\n` +
      `👤 ${displayName} (${displayHandle})\n` +
      `🆔 UID: ${uid}\n` +
      `⏰ ${currentUser.joinedAt}`
    );
  } else {
    currentUser.name = displayName;
    currentUser.handle = displayHandle;
    currentUser.photoUrl = tgPhotoUrl;
    saveUsersDB(users);
  }

  loadUserState(currentUser);
  updateAllDisplays();
}

function getUsersDB() {
  try {
    const raw = localStorage.getItem('vuadaoquang_users');
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveUsersDB(users) {
  localStorage.setItem('vuadaoquang_users', JSON.stringify(users));
}

function getCurrentUser() {
  const users = getUsersDB();
  return users.find(u => u.uid === uid);
}

function updateCurrentUser(updates) {
  const users = getUsersDB();
  const idx = users.findIndex(u => u.uid === uid);
  if (idx !== -1) {
    users[idx] = { ...users[idx], ...updates };
    saveUsersDB(users);
    loadUserState(users[idx]);
  }
}

function loadUserState(user) {
  balance = user.balance || 0;
  points = user.points || 0;
  withdrawn = user.withdrawn || 0;
  fragments = user.fragments || 0;
  tickets = user.tickets || 0;
  userLevel = user.level || 0;
  userXP = user.xp || 0;
  xpNeeded = user.xpNeeded || 120;
  checkedIn = user.lastCheckin === new Date().toLocaleDateString('vi-VN');
  userMachines = user.machines || [];
  userInventory = user.inventory || [];
}

/* ==================== 4. STATE ==================== */
let balance = 0;
let miningRate = 0.000139;
let pendingOre = 0;
let isMining = false;
let miningTimer = null;
let checkedIn = false;
let points = 0;
let withdrawn = 0;
let fragments = 0;
let tickets = 0;
let wheelRotation = 0;
let spinning = false;
let userLevel = 0;
let userXP = 0;
let xpNeeded = 120;
let userMachines = [];
let userInventory = [];

function formatInt(n) {
  return Math.floor(n).toLocaleString('en-US');
}

function formatBalance(n) {
  if (n >= 1000) return formatInt(n);
  return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function updateBalanceDisplay() {
  document.getElementById('topBalance').textContent = formatBalance(balance);
  document.getElementById('profileBalance').textContent = formatBalance(balance);
}

function updatePendingDisplay() {
  document.getElementById('pendingDisplay').textContent = pendingOre.toFixed(6);
}

function updateRateDisplay() {
  document.getElementById('rateDisplay').textContent = miningRate.toFixed(6);
}

function updateLevelDisplay() {
  document.getElementById('userLevel').textContent = userLevel;
  document.getElementById('xpCurrent').textContent = userXP;
  document.getElementById('xpNeeded').textContent = xpNeeded;
  document.getElementById('xpBar').style.width = Math.min(100, (userXP / xpNeeded) * 100) + '%';
  document.getElementById('profileLevel').textContent = userLevel;
}

function updateMeta() {
  document.getElementById('pointsValue').textContent = String(points);
  document.getElementById('withdrawnValue').textContent = withdrawn >= 1000
    ? (withdrawn / 1000) + 'k'
    : String(withdrawn) + 'k';
  document.getElementById('fragmentCount').innerHTML =
    `${fragments}<span style="color:#94a3b8;font-size:14px">/15</span>`;
  document.getElementById('ticketCount').textContent = String(tickets);
}

function updateAllDisplays() {
  updateBalanceDisplay();
  updatePendingDisplay();
  updateRateDisplay();
  updateLevelDisplay();
  updateMeta();
  renderMachines();
  renderShop();
  renderMilestones();
  updateRefStats();
  updateCheckinBtn();
}

function updateCheckinBtn() {
  const btn = document.getElementById('checkinBtn');
  if (checkedIn) {
    btn.textContent = 'DA LAM';
    btn.disabled = true;
    btn.style.opacity = '0.5';
  } else {
    btn.textContent = 'Lam ngay';
    btn.disabled = false;
    btn.style.opacity = '1';
  }
}

/* ==================== 5. XP & LEVEL SYSTEM ==================== */
function addXP(amount) {
  userXP += amount;
  while (userXP >= xpNeeded) {
    userXP -= xpNeeded;
    userLevel++;
    xpNeeded = Math.floor(xpNeeded * 1.5);
    showToast(`🎉 Len cap ${userLevel}! XP can: ${xpNeeded}`);
    miningRate += 0.00001;
  }
  updateCurrentUser({ xp: userXP, level: userLevel, xpNeeded: xpNeeded, miningRate: miningRate });
  updateLevelDisplay();
  updateRateDisplay();
}

/* ==================== 6. MINING ==================== */
function toggleMining() {
  const btn = document.getElementById('mineBtn');
  if (!isMining) {
    isMining = true;
    btn.textContent = '⛏ THU HOACH NGAY';
    btn.classList.add('mining-active');
    miningTimer = setInterval(() => {
      pendingOre += miningRate / 10;
      updatePendingDisplay();
    }, 100);
  } else {
    isMining = false;
    clearInterval(miningTimer);
    btn.classList.remove('mining-active');
    if (pendingOre > 0) {
      const harvested = pendingOre;
      balance += harvested;
      showToast(`Thu hoach +${harvested.toFixed(4)} Quang`);
      pendingOre = 0;
      addXP(Math.floor(harvested * 100));
    }
    updatePendingDisplay();
    updateBalanceDisplay();
    btn.textContent = '▶ KHOI DONG MAY DAO';
    updateCurrentUser({ balance: balance });
  }
}

/* ==================== 7. DAILY MISSIONS ==================== */
function doCheckin() {
  if (checkedIn) {
    showToast('Ban da diem danh hom nay roi!');
    return;
  }
  checkedIn = true;
  points += 1;
  balance += 10;
  addXP(5);
  const today = new Date().toLocaleDateString('vi-VN');
  updateCurrentUser({
    points: points,
    balance: balance,
    lastCheckin: today,
  });
  updateCheckinBtn();
  updateBalanceDisplay();
  updateMeta();
  showToast('Diem danh thanh cong! +10 Quang +1 Diem');
}

function watchAd() {
  const user = getCurrentUser();
  const today = new Date().toLocaleDateString('vi-VN');

  if (user.lastAdDate !== today) {
    user.dailyAdWatched = 0;
    user.lastAdDate = today;
  }

  if (user.dailyAdWatched >= 10) {
    showToast('Ban da xem het quang cao hom nay! (10/10)');
    return;
  }

  user.dailyAdWatched++;

  let multiplier = 1;
  const now = new Date();
  if (user.svipAdsExpiry && new Date(user.svipAdsExpiry) > now) multiplier = 5;
  else if (user.vipAdsExpiry && new Date(user.vipAdsExpiry) > now) multiplier = 2;

  const oreReward = 50 * multiplier;
  const pointReward = 1 * multiplier;

  balance += oreReward;
  points += pointReward;
  addXP(3 * multiplier);

  updateCurrentUser({
    balance: balance,
    points: points,
    dailyAdWatched: user.dailyAdWatched,
    lastAdDate: today,
  });

  updateBalanceDisplay();
  updateMeta();
  showToast(`Xem quang cao thanh cong! +${oreReward} Quang & +${pointReward} Diem (${user.dailyAdWatched}/10)`);
}

/* ==================== 8. MACHINES ==================== */
const machineTemplates = [
  {
    id: 1, name: 'May So Cap', icon: '🌱',
    iconBg: 'linear-gradient(135deg,#dcfce7,#bbf7d0)',
    rateText: '1.98/p', cycle: '3h',
    price: 100000, rateAdd: 0.000033,
    btn: 'linear-gradient(135deg,#16a34a,#15803d)', priceColor: '#16a34a',
  },
  {
    id: 2, name: 'May Trung Cap', icon: '▶',
    iconBg: 'linear-gradient(135deg,#dbeafe,#bfdbfe)',
    rateText: '4.63/p', cycle: '4h',
    price: 200000, rateAdd: 0.000077,
    btn: 'linear-gradient(135deg,#2563eb,#1d4ed8)', priceColor: '#2563eb',
  },
  {
    id: 3, name: 'May Cao Cap', icon: '🏅',
    iconBg: 'linear-gradient(135deg,#f3e8ff,#e9d5ff)',
    rateText: '13.89/p', cycle: '5h',
    price: 500000, rateAdd: 0.000231,
    btn: 'linear-gradient(135deg,#9333ea,#7c3aed)', priceColor: '#9333ea',
  },
  {
    id: 4, name: 'May Toi Cao', icon: '👑',
    iconBg: 'linear-gradient(135deg,#fef3c7,#fde68a)',
    rateText: '34.72/p', cycle: '6h',
    price: 1000000, rateAdd: 0.000579,
    btn: 'linear-gradient(135deg,#f59e0b,#d97706)', priceColor: '#f59e0b',
  },
];

function renderMachines() {
  const container = document.getElementById('machineList');
  const user = getCurrentUser();
  const ownedIds = user ? (user.machines || []).map(m => m.templateId) : [];

  container.innerHTML = machineTemplates.map((m) => {
    const ownedCount = ownedIds.filter(id => id === m.id).length;
    return `
    <div class="card machine-item">
      <div class="machine-icon" style="background:${m.iconBg}">${m.icon}</div>
      <div class="machine-meta">
        <div class="machine-name">${m.name} ${ownedCount > 0 ? `<span style="color:#16a34a;font-size:11px">(x${ownedCount})</span>` : ''}</div>
        <div class="machine-desc">Toc do: ${m.rateText} · Chu ky: ${m.cycle}<br>Bao tri: Moi 10 ngay</div>
      </div>
      <div class="machine-side">
        <div class="machine-price" style="color:${m.priceColor}">
          ${formatInt(m.price)} <span class="coin">●</span>
        </div>
        <button class="buy-btn" style="background:${m.btn}" onclick="buyMachine(${m.id})">MUA MAY</button>
      </div>
    </div>
  `;
  }).join('');
}

function buyMachine(id) {
  const m = machineTemplates.find((x) => x.id === id);
  if (!m) return;
  if (balance < m.price) {
    showToast('So du khong du de mua may nay!');
    return;
  }

  balance -= m.price;
  miningRate += m.rateAdd;

  const user = getCurrentUser();
  const newMachine = {
    templateId: m.id,
    name: m.name,
    purchasedAt: new Date().toISOString(),
    lastHarvest: new Date().toISOString(),
    maintenanceDue: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
  };
  user.machines = user.machines || [];
  user.machines.push(newMachine);

  updateCurrentUser({
    balance: balance,
    miningRate: miningRate,
    machines: user.machines,
  });

  updateBalanceDisplay();
  updateRateDisplay();
  renderMachines();
  addXP(20);
  showToast(`Mua thanh cong ${m.name}! Toc do tang.`);
}

/* ==================== 9. SPIN ==================== */
const prizes = [
  { label: 'JACKPOT', value: 'jackpot' },
  { label: 'Truot roi', value: 0 },
  { label: '100', value: 100 },
  { label: '200', value: 200 },
  { label: '500', value: 500 },
  { label: '1000', value: 1000 },
  { label: '2000', value: 2000 },
];

function exchangeTicket() {
  if (fragments < 15) {
    showToast('Can du 15 manh VQMM de doi 1 ve!');
    return;
  }
  fragments -= 15;
  tickets += 1;
  updateCurrentUser({ fragments: fragments, tickets: tickets });
  updateMeta();
  showToast('Doi thanh cong 1 Ve Quay So!');
}

function spinWheel() {
  if (spinning) return;
  if (tickets <= 0) {
    showToast('Ban khong co ve quay so! Hay doi manh VQMM.');
    return;
  }
  spinning = true;
  tickets -= 1;
  updateCurrentUser({ tickets: tickets });
  updateMeta();

  const idx = Math.floor(Math.random() * prizes.length);
  const extra = 360 * 5 + (360 - (idx * (360 / prizes.length)) - 360 / prizes.length / 2);
  wheelRotation += extra;
  const wheel = document.getElementById('wheel');
  wheel.style.transform = `rotate(${wheelRotation}deg)`;

  setTimeout(() => {
    const prize = prizes[idx];
    if (prize.value === 'jackpot') {
      const jack = 5000 + Math.floor(Math.random() * 5000);
      balance += jack;
      updateCurrentUser({ balance: balance });
      updateBalanceDisplay();
      addXP(50);
      showToast(`🎉 JACKPOT! Ban nhan ${formatInt(jack)} Quang!`);
    } else if (prize.value === 0) {
      showToast('Truot roi! Chuc ban may man lan sau.');
    } else {
      balance += prize.value;
      updateCurrentUser({ balance: balance });
      updateBalanceDisplay();
      addXP(Math.floor(prize.value / 50));
      showToast(`Chuc mung! Ban nhan ${formatInt(prize.value)} Quang.`);
    }
    spinning = false;
  }, 4600);
}

/* ==================== 10. INVITE ==================== */
const milestones = [
  { need: 3, reward: '1 Hop Bi An' },
  { need: 10, reward: '3 Hop Bi An' },
  { need: 20, reward: '8 Hop Bi An' },
  { need: 50, reward: '20 Hop Bi An' },
  { need: 100, reward: '30 Hop Bi An' },
  { need: 200, reward: '70 Hop Bi An' },
];

function renderMilestones() {
  const user = getCurrentUser();
  const refCount = user ? (user.referralCount || 0) : 0;

  document.getElementById('milestones').innerHTML = milestones.map((m) => {
    const achieved = refCount >= m.need;
    return `
    <div class="milestone-row" style="${achieved ? 'background:#f0fdf4;border-radius:8px;padding:8px 6px;' : ''}">
      <span class="milestone-left">${achieved ? '✅ ' : ''}Moi ${m.need} Ban be</span>
      <span class="milestone-right" style="${achieved ? 'color:#16a34a;' : ''}">${m.reward}</span>
    </div>
  `;
  }).join('');
}

function updateRefStats() {
  const user = getCurrentUser();
  const refCount = user ? (user.referralCount || 0) : 0;
  document.getElementById('totalFriends').textContent = refCount;
  document.getElementById('todayRefs').textContent = '+' + refCount;
}

function copyRefLink() {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(refLinkText).then(() => {
      showToast('Da sao chep link moi ban!');
    }).catch(() => {
      showToast('Khong the sao chep link.');
    });
  } else {
    showToast('Link: ' + refLinkText);
  }
}

/* ==================== 11. SHOP ==================== */
const shopItems = [
  {
    id: 1, name: 'Bao Hiem Bang', icon: '🛡',
    desc: 'Bao ve nick khong bi tru diem khi Off 72h.',
    price: 2000, type: 'insurance',
  },
  {
    id: 2, name: 'Thung Cai Tien', icon: '📦',
    desc: 'Keo dai kho chua tu 3h len 8h tu dong day.',
    price: 3000, type: 'storage',
  },
  {
    id: 3, name: 'Ve VIP Ads', icon: '▶',
    desc: 'Nhan doi Quang & Diem khi xem Ads (30 ngay).',
    price: 5000, type: 'vip_ads', duration: 30,
  },
  {
    id: 4, name: 'Ve S-VIP Ads', icon: '👑',
    desc: 'Nhan NAM (x5) Quang & Diem xem Ads (30 ngay).',
    price: 25000, featured: true, hot: true, type: 'svip_ads', duration: 30,
  },
  {
    id: 5, name: 'Goi 10 Ve Quay So', icon: '🎟',
    desc: 'Nhan ngay 10 Ve Vong Quay thang vao Tui do.',
    price: 10000, wide: true, type: 'tickets', amount: 10,
  },
];

function renderShop() {
  const grid = document.getElementById('shopGrid');
  grid.innerHTML = shopItems.map((it) => `
    <div class="card shop-item ${it.wide ? 'wide' : ''} ${it.featured ? 'featured' : ''}">
      <div class="shop-icon">${it.icon}</div>
      <div>
        <div class="shop-name ${it.hot ? 'hot' : ''}">${it.name}</div>
        <div class="shop-desc">${it.desc}</div>
        <div class="shop-price">${formatInt(it.price)} <span class="coin">●</span></div>
        <button class="btn-buy ${it.hot ? 'hot' : ''}" onclick="buyItem(${it.id})">Mua ngay</button>
      </div>
    </div>
  `).join('');
}

function buyItem(id) {
  const it = shopItems.find((x) => x.id === id);
  if (!it) return;
  if (balance < it.price) {
    showToast('So du khong du de mua vat pham nay!');
    return;
  }

  balance -= it.price;
  const user = getCurrentUser();
  const now = new Date();

  switch (it.type) {
    case 'tickets':
      tickets += it.amount;
      updateCurrentUser({ balance: balance, tickets: tickets });
      break;
    case 'insurance':
      const insExpiry = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
      updateCurrentUser({ balance: balance, insuranceExpiry: insExpiry });
      break;
    case 'storage':
      updateCurrentUser({ balance: balance, storageUpgrade: true });
      break;
    case 'vip_ads':
      const vipExpiry = new Date(now.getTime() + it.duration * 24 * 60 * 60 * 1000).toISOString();
      updateCurrentUser({ balance: balance, vipAdsExpiry: vipExpiry });
      break;
    case 'svip_ads':
      const svipExpiry = new Date(now.getTime() + it.duration * 24 * 60 * 60 * 1000).toISOString();
      updateCurrentUser({ balance: balance, svipAdsExpiry: svipExpiry });
      break;
  }

  user.inventory = user.inventory || [];
  user.inventory.push({
    itemId: it.id,
    name: it.name,
    icon: it.icon,
    purchasedAt: now.toISOString(),
  });
  updateCurrentUser({ inventory: user.inventory });

  updateBalanceDisplay();
  updateMeta();
  addXP(10);
  showToast(`Mua thanh cong: ${it.name}! Da vao Tui do.`);
}

/* ==================== 12. PROFILE / WITHDRAW ==================== */
let MIN_WITHDRAW = 240000;
let MAX_WITHDRAW = 15000000;
let FEE_PERCENT = 10;
let EXCHANGE_RATE = 1 / 30;

function claimGift() {
  const code = document.getElementById('giftCode').value.trim();
  if (!code) {
    showToast('Vui long nhap Giftcode!');
    return;
  }

  const users = getUsersDB();
  const user = users.find(u => u.uid === uid);

  const gift = adminGiftcodes.find(g => g.code.toUpperCase() === code.toUpperCase());
  if (gift) {
    if (gift.used >= gift.limit) {
      showToast('Giftcode da het luot dung!');
      return;
    }
    if (gift.claimedBy.includes(uid)) {
      showToast('Ban da dung Giftcode nay roi!');
      return;
    }
    gift.used++;
    gift.claimedBy.push(uid);
    saveAdminGiftcodes();
    balance += gift.reward;
    updateCurrentUser({ balance: balance });
    updateBalanceDisplay();
    document.getElementById('giftCode').value = '';
    addXP(5);
    showToast(`Nhan qua thanh cong! +${formatInt(gift.reward)} Quang`);
    return;
  }

  if (code.toUpperCase() === 'VUA2026') {
    if (user && user.claimedDefaultGift) {
      showToast('Ban da dung Giftcode mac dinh roi!');
      return;
    }
    balance += 100;
    updateCurrentUser({ balance: balance, claimedDefaultGift: true });
    updateBalanceDisplay();
    document.getElementById('giftCode').value = '';
    addXP(2);
    showToast('Nhan qua thanh cong! +100 Quang');
  } else {
    showToast('Giftcode khong hop le hoac da het han.');
  }
}

let withdrawRequests = [];
let withdrawIdCounter = 1;

function loadWithdrawRequests() {
  try {
    const raw = localStorage.getItem('vuadaoquang_withdrawals');
    if (raw) {
      const parsed = JSON.parse(raw);
      withdrawRequests = parsed.requests || [];
      withdrawIdCounter = parsed.counter || 1;
    }
  } catch (e) {
    withdrawRequests = [];
    withdrawIdCounter = 1;
  }
}

function saveWithdrawRequests() {
  localStorage.setItem('vuadaoquang_withdrawals', JSON.stringify({
    requests: withdrawRequests,
    counter: withdrawIdCounter,
  }));
}

loadWithdrawRequests();

function submitWithdraw() {
  const bankName = document.getElementById('bankName').value.trim();
  const bankOwner = document.getElementById('bankOwner').value.trim();
  const bankNumber = document.getElementById('bankNumber').value.trim();
  const amountRaw = document.getElementById('bankAmount').value.trim();

  if (!bankName || !bankOwner || !bankNumber || !amountRaw) {
    showToast('Vui long dien day du thong tin!');
    return;
  }

  const amount = Number(amountRaw);
  if (isNaN(amount) || amount <= 0) {
    showToast('So quang muon rut khong hop le!');
    return;
  }
  if (amount < MIN_WITHDRAW) {
    showToast(`Toi thieu ${formatInt(MIN_WITHDRAW)} Quang!`);
    return;
  }
  if (amount > MAX_WITHDRAW) {
    showToast(`Toi da ${formatInt(MAX_WITHDRAW)} Quang!`);
    return;
  }
  if (amount > balance) {
    showToast('So du khong du de thuc hien lenh rut!');
    return;
  }

  const fee = amount * FEE_PERCENT / 100;
  const vnd = Math.floor((amount - fee) / 30);

  const req = {
    id: withdrawIdCounter++,
    uid: uid,
    userName: displayName,
    userHandle: displayHandle,
    photoUrl: tgPhotoUrl,
    bankName: bankName,
    bankOwner: bankOwner,
    bankNumber: bankNumber,
    amount: amount,
    fee: fee,
    vnd: vnd,
    status: 'pending',
    createdAt: new Date().toLocaleString('vi-VN'),
    approvedAt: null,
    rejectedAt: null,
    rejectReason: null,
  };
  withdrawRequests.push(req);
  saveWithdrawRequests();

  balance -= amount;
  withdrawn += amount;
  updateCurrentUser({ balance: balance, withdrawn: withdrawn });
  updateBalanceDisplay();
  updateMeta();

  showToast(`Da tao lenh rut #${req.id}! Cho Admin duyet.`);

  sendBotMessage(
    ADMIN_ID,
    `🔔 LENH RUT TIEN MOI #${req.id}\n` +
    `👤 ${displayName} (${displayHandle})\n` +
    `🆔 UID: ${uid}\n` +
    `🏦 ${bankName} - ${bankOwner}\n` +
    `💳 STK: ${bankNumber}\n` +
    `💰 So quang: ${formatInt(amount)}\n` +
    `📉 Phi (${FEE_PERCENT}%): ${formatInt(fee)}\n` +
    `💵 Nhan: ${formatInt(vnd)} VND (30 Quang = 1d)\n` +
    `⏰ ${req.createdAt}`
  );

  document.getElementById('bankName').value = '';
  document.getElementById('bankOwner').value = '';
  document.getElementById('bankNumber').value = '';
  document.getElementById('bankAmount').value = '';
}

/* ==================== 13. NAV ==================== */
const mainTabs = ['home', 'invite', 'camp', 'shop', 'profile'];

function showTab(tabId) {
  mainTabs.forEach((id) => {
    document.getElementById('tab-' + id).classList.toggle('hidden', id !== tabId);
    const navBtn = document.getElementById('nav-' + id);
    navBtn.classList.toggle('nav-active', id === tabId);
    navBtn.classList.toggle('nav-inactive', id !== tabId);
  });
  window.scrollTo(0, 0);
}

const subTabGroups = {
  camp: ['farm', 'spin'],
  invite: ['ref', 'rank'],
  profile: ['overview', 'bank'],
};

function showSubTab(group, subId) {
  subTabGroups[group].forEach((id) => {
    document.getElementById(`sub${group}-${id}`).classList.toggle('hidden', id !== subId);
    const btn = document.getElementById(`sub${group}-btn-${id}`);
    btn.classList.toggle('subtab-active', id === subId);
    btn.classList.toggle('subtab-inactive', id !== subId);
  });
}

function openInventory() {
  const user = getCurrentUser();
  const inv = user && user.inventory ? user.inventory : [];
  const invText = inv.length > 0
    ? inv.map(i => `${i.icon} ${i.name}`).join(' · ')
    : 'Tui do trong';
  showToast(`🎒 ${invText}\n🎟 ${tickets} ve quay · ${fragments}/15 manh VQMM`);
}

/* ==================== 14. TELEGRAM BOT API ==================== */
const BOT_TOKEN = '8781327103:AAE63nHgMacJN4gXBVJ7-LEyshLQcgSj9zI';
const ADMIN_ID = '5838598093';
const GROUP_CHAT_ID = '-5434654672';
const GROUP_LINK = 'https://t.me/groupchatvuakhoangsan';
const BOT_API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;

async function sendBotMessage(chatId, text) {
  try {
    const resp = await fetch(`${BOT_API_BASE}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });
    const data = await resp.json();
    return data.ok === true;
  } catch (e) {
    console.error('Bot API error:', e);
    return false;
  }
}

/* ==================== 15. ADMIN PANEL ==================== */
let adminTapCount = 0;
let adminTapTimer = null;
let isAdminLoggedIn = false;

function adminTap() {
  adminTapCount++;
  clearTimeout(adminTapTimer);
  adminTapTimer = setTimeout(() => { adminTapCount = 0; }, 2000);
  if (adminTapCount >= 5) {
    adminTapCount = 0;
    openAdmin();
  }
}

function openAdmin() {
  document.getElementById('adminOverlay').classList.remove('hidden');
  if (isAdminLoggedIn) {
    document.getElementById('adminLogin').classList.add('hidden');
    document.getElementById('adminDash').classList.remove('hidden');
    refreshAdminAll();
  } else {
    document.getElementById('adminLogin').classList.remove('hidden');
    document.getElementById('adminDash').classList.add('hidden');
    document.getElementById('adminPass').value = '';
    document.getElementById('adminLoginMsg').textContent = '';
  }
}

function closeAdmin() {
  document.getElementById('adminOverlay').classList.add('hidden');
}

function tryAdminLogin() {
  const pass = document.getElementById('adminPass').value.trim();
  const msgEl = document.getElementById('adminLoginMsg');
  const correctPass = '5838598093';

  if (pass === correctPass) {
    isAdminLoggedIn = true;
    msgEl.textContent = 'Dang nhap thanh cong!';
    msgEl.className = 'admin-msg success';
    setTimeout(() => {
      document.getElementById('adminLogin').classList.add('hidden');
      document.getElementById('adminDash').classList.remove('hidden');
      refreshAdminAll();
    }, 500);
  } else {
    msgEl.textContent = 'Sai mat khau Admin!';
    msgEl.className = 'admin-msg error';
  }
}

const admSubTabs = ['users', 'withdraw', 'notify', 'gift', 'config'];

function admSub(tabId) {
  admSubTabs.forEach((id) => {
    document.getElementById('admTab-' + id).classList.toggle('hidden', id !== tabId);
    const btn = document.getElementById('admSub-btn-' + id);
    btn.classList.toggle('adm-sub-active', id === tabId);
    btn.classList.toggle('adm-sub-inactive', id !== tabId);
  });
}

function refreshAdminAll() {
  renderAdminUsers();
  renderAdminWithdrawals();
  renderAdminNotifications();
  renderAdminGiftcodes();
  loadConfigForm();
}

/* ==================== 16. ADMIN: USERS ==================== */
function getAdminUsers() {
  return getUsersDB();
}

function renderAdminUsers() {
  const search = (document.getElementById('admSearchUser')?.value || '').toLowerCase().trim();
  const list = document.getElementById('admUserList');
  let users = getAdminUsers();

  if (search) {
    users = users.filter(u =>
      u.uid.includes(search) || (u.name || '').toLowerCase().includes(search)
    );
  }

  if (users.length === 0) {
    list.innerHTML = '<div class="adm-item-sub" style="text-align:center;padding:20px">Khong tim thay nguoi dung.</div>';
    return;
  }

  list.innerHTML = users.map(u => `
    <div class="adm-item">
      <div class="adm-item-head">
        <div style="display:flex;align-items:center;gap:8px">
          ${u.photoUrl
            ? `<img src="${u.photoUrl}" style="width:28px;height:28px;border-radius:8px;object-fit:cover" onerror="this.style.display='none'">`
            : `<div style="width:28px;height:28px;border-radius:8px;background:#0ea6e9;color:#fff;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800">${(u.name||'?').charAt(0).toUpperCase()}</div>`
          }
          <span class="adm-item-name">${u.name || 'Unknown'}</span>
        </div>
        <span class="adm-badge ${u.banned ? 'locked' : 'active'}">${u.banned ? 'BAN' : 'OK'}</span>
      </div>
      <div class="adm-item-sub">
        🆔 UID: ${u.uid}${u.handle ? ' · ' + u.handle : ''}<br>
        Cap: ${u.level || 0} · So du: ${formatInt(u.balance || 0)} Quang · Diem: ${u.points || 0}<br>
        Da rut: ${formatInt(u.withdrawn || 0)} · May: ${(u.machines || []).length} · Tham gia: ${u.joinedAt || '?'}
      </div>
      <div class="adm-item-actions">
        <button class="admin-btn-sm blue" onclick="adminEditBalance('${u.uid}')">± So du</button>
        <button class="admin-btn-sm amber" onclick="adminEditPoints('${u.uid}')">± Diem</button>
        <button class="admin-btn-sm blue" onclick="adminEditLevel('${u.uid}')">± Cap</button>
        <button class="admin-btn-sm ${u.banned ? 'green' : 'red'}" onclick="adminToggleBan('${u.uid}')">${u.banned ? 'Unban' : 'Ban'}</button>
        <button class="admin-btn-sm gray" onclick="adminNotifyUser('${u.uid}')">Nhan tin</button>
        <button class="admin-btn-sm red" onclick="adminDeleteUser('${u.uid}')">Xoa TK</button>
      </div>
    </div>
  `).join('');
}

function adminFindUser(userId) {
  const users = getUsersDB();
  return users.find(u => u.uid === userId);
}

function adminEditBalance(userId) {
  const u = adminFindUser(userId);
  if (!u) return;
  const input = prompt(`So du hien tai: ${formatInt(u.balance || 0)}\nNhap so Quang them (+) hoac bot (-):`);
  if (input === null) return;
  const delta = Number(input);
  if (isNaN(delta)) {
    showToast('Gia tri khong hop le!');
    return;
  }
  u.balance = (u.balance || 0) + delta;
  const users = getUsersDB();
  const idx = users.findIndex(x => x.uid === userId);
  if (idx !== -1) users[idx] = u;
  saveUsersDB(users);

  if (u.uid === uid) {
    balance = u.balance;
    updateBalanceDisplay();
  }
  renderAdminUsers();
  showToast(`Da ${delta >= 0 ? 'cong' : 'tru'} ${formatInt(Math.abs(delta))} Quang cho ${u.name}`);
  sendBotMessage(u.uid, `💰 Admin da ${delta >= 0 ? 'cong' : 'tru'} ${formatInt(Math.abs(delta))} Quang vao tai khoan cua ban.`);
}

function adminEditPoints(userId) {
  const u = adminFindUser(userId);
  if (!u) return;
  const input = prompt(`Diem hien tai: ${u.points || 0}\nNhap so Diem them (+) hoac bot (-):`);
  if (input === null) return;
  const delta = Number(input);
  if (isNaN(delta)) {
    showToast('Gia tri khong hop le!');
    return;
  }
  u.points = (u.points || 0) + delta;
  const users = getUsersDB();
  const idx = users.findIndex(x => x.uid === userId);
  if (idx !== -1) users[idx] = u;
  saveUsersDB(users);

  if (u.uid === uid) {
    points = u.points;
    updateMeta();
  }
  renderAdminUsers();
  showToast(`Da ${delta >= 0 ? 'cong' : 'tru'} ${Math.abs(delta)} Diem cho ${u.name}`);
}

function adminEditLevel(userId) {
  const u = adminFindUser(userId);
  if (!u) return;
  const input = prompt(`Cap hien tai: ${u.level || 0}\nNhap cap moi:`);
  if (input === null) return;
  const newLevel = Number(input);
  if (isNaN(newLevel) || newLevel < 0) {
    showToast('Gia tri khong hop le!');
    return;
  }
  u.level = newLevel;
  const users = getUsersDB();
  const idx = users.findIndex(x => x.uid === userId);
  if (idx !== -1) users[idx] = u;
  saveUsersDB(users);

  if (u.uid === uid) {
    userLevel = u.level;
    updateLevelDisplay();
  }
  renderAdminUsers();
  showToast(`Da dat cap ${newLevel} cho ${u.name}`);
}

function adminToggleBan(userId) {
  const u = adminFindUser(userId);
  if (!u) return;
  u.banned = !u.banned;
  const users = getUsersDB();
  const idx = users.findIndex(x => x.uid === userId);
  if (idx !== -1) users[idx] = u;
  saveUsersDB(users);

  renderAdminUsers();
  showToast(`${u.name} da ${u.banned ? 'bi BAN' : 'duoc Unban'}`);
  sendBotMessage(u.uid, `${u.banned ? '🚫 Tai khoan cua ban da bi khoa!' : '✅ Tai khoan cua ban da duoc mo khoa!'}`);
}

function adminNotifyUser(userId) {
  const u = adminFindUser(userId);
  if (!u) return;
  const msg = prompt(`Gui thong bao den ${u.name} (UID: ${u.uid}):`);
  if (!msg || !msg.trim()) return;
  sendBotMessage(u.uid, `📢 Thong bao tu Admin:\n${msg}`);
  showToast(`Da gui thong bao den ${u.name}`);
}

function adminDeleteUser(userId) {
  const u = adminFindUser(userId);
  if (!u) return;
  if (!confirm(`⚠️ XOA TAI KHOAN ${u.name} (UID: ${userId})?\nHanh dong nay khong the hoan tac!`)) return;

  let users = getUsersDB();
  users = users.filter(x => x.uid !== userId);
  saveUsersDB(users);

  renderAdminUsers();
  showToast(`Da xoa tai khoan ${u.name}`);
}

/* ==================== 17. ADMIN: WITHDRAW APPROVAL ==================== */
function renderAdminWithdrawals() {
  const list = document.getElementById('admWithdrawList');
  loadWithdrawRequests();

  const pending = withdrawRequests.filter(r => r.status === 'pending');
  const approved = withdrawRequests.filter(r => r.status === 'approved');
  const rejected = withdrawRequests.filter(r => r.status === 'rejected');

  document.getElementById('wdPending').textContent = pending.length;
  document.getElementById('wdApproved').textContent = approved.length;
  document.getElementById('wdRejected').textContent = rejected.length;

  if (withdrawRequests.length === 0) {
    list.innerHTML = '<div class="adm-item-sub" style="text-align:center;padding:20px">Chua co lenh rut nao.</div>';
    return;
  }

  const sorted = [...withdrawRequests].sort((a, b) => {
    if (a.status === 'pending' && b.status !== 'pending') return -1;
    if (a.status !== 'pending' && b.status === 'pending') return 1;
    return b.id - a.id;
  });

  list.innerHTML = sorted.map(r => `
    <div class="adm-item">
      <div class="adm-item-head">
        <span class="adm-item-name">Lenh #${r.id} · ${r.userName}</span>
        <span class="adm-badge ${r.status}">${r.status === 'pending' ? 'CHO DUYET' : r.status === 'approved' ? 'DA DUYET' : 'TU CHOI'}</span>
      </div>
      <div class="adm-item-sub">
        UID: ${r.uid}<br>
        🏦 ${r.bankName} · ${r.bankOwner}<br>
        💳 STK: ${r.bankNumber}<br>
        💰 Quang: ${formatInt(r.amount)} · Phi: ${formatInt(r.fee)}<br>
        💵 Nhan: ${formatInt(r.vnd)} VND<br>
        ⏰ ${r.createdAt}${r.rejectedAt ? '<br>❌ Tu choi: ' + r.rejectedAt : ''}${r.rejectReason ? ' (' + r.rejectReason + ')' : ''}${r.approvedAt ? '<br>✅ Duyet: ' + r.approvedAt : ''}
      </div>
      ${r.status === 'pending' ? `
        <div class="adm-item-actions">
          <button class="admin-btn-sm green" onclick="approveWithdraw(${r.id})">✅ DUYET</button>
          <button class="admin-btn-sm red" onclick="rejectWithdraw(${r.id})">❌ TU CHOI</button>
        </div>
      ` : ''}
    </div>
  `).join('');
}

function approveWithdraw(reqId) {
  const req = withdrawRequests.find(r => r.id === reqId);
  if (!req || req.status !== 'pending') return;
  req.status = 'approved';
  req.approvedAt = new Date().toLocaleString('vi-VN');
  saveWithdrawRequests();

  const groupMsg =
    `✅ LENH RUT DA DUYET #${req.id}\n` +
    `👤 ${req.userName}${req.userHandle ? ' (' + req.userHandle + ')' : ''}\n` +
    `🆔 UID: ${req.uid}\n` +
    `🏦 ${req.bankName} - ${req.bankOwner}\n` +
    `💳 STK: ${req.bankNumber}\n` +
    `💰 So quang: ${formatInt(req.amount)}\n` +
    `📉 Phi (${FEE_PERCENT}%): ${formatInt(req.fee)}\n` +
    `💵 So tien nhan: ${formatInt(req.vnd)} VND (30 Quang = 1d)\n` +
    `⏰ Duyet luc: ${req.approvedAt}\n` +
    `━━━━━━━━━━━━━━━\n` +
    `👉 Tham gia nhom: ${GROUP_LINK}`;

  sendBotMessage(GROUP_CHAT_ID, groupMsg);

  sendBotMessage(
    req.uid,
    `✅ Lenh rut #${req.id} da duoc DUYET!\n` +
    `💵 So tien nhan: ${formatInt(req.vnd)} VND (30 Quang = 1d)\n` +
    `⏰ Luc: ${req.approvedAt}\n` +
    `👉 Tham gia nhom de nhan tin tuc: ${GROUP_LINK}`
  );

  const u = adminFindUser(req.uid);
  if (u) {
    u.withdrawn = (u.withdrawn || 0) + req.amount;
    const users = getUsersDB();
    const idx = users.findIndex(x => x.uid === req.uid);
    if (idx !== -1) users[idx] = u;
    saveUsersDB(users);
  }
  if (req.uid === uid) {
    withdrawn += req.amount;
    updateMeta();
  }

  const jackEl = document.getElementById('jackpotValue');
  const current = Number(String(jackEl.textContent).replace(/,/g, '')) || 1331716;
  jackEl.textContent = formatInt(current + req.fee);

  renderAdminWithdrawals();
  renderAdminUsers();
  showToast(`Da duyet lenh #${req.id} va gui len nhom!`);
}

function rejectWithdraw(reqId) {
  const req = withdrawRequests.find(r => r.id === reqId);
  if (!req || req.status !== 'pending') return;
  const reason = prompt('Ly do tu choi (de trong neu khong co):');
  if (reason === null) return;

  req.status = 'rejected';
  req.rejectedAt = new Date().toLocaleString('vi-VN');
  req.rejectReason = reason || 'Khong co ly do';
  saveWithdrawRequests();

  const u = adminFindUser(req.uid);
  if (u) {
    u.balance = (u.balance || 0) + req.amount;
    const users = getUsersDB();
    const idx = users.findIndex(x => x.uid === req.uid);
    if (idx !== -1) users[idx] = u;
    saveUsersDB(users);
  }
  if (req.uid === uid) {
    balance += req.amount;
    updateBalanceDisplay();
  }

  sendBotMessage(
    req.uid,
    `❌ Lenh rut #${req.id} bi TU CHOI!\n` +
    `Ly do: ${req.rejectReason}\n` +
    `💰 Da hoan tra ${formatInt(req.amount)} Quang vao tai khoan.\n` +
    `⏰ Luc: ${req.rejectedAt}`
  );

  renderAdminWithdrawals();
  renderAdminUsers();
  showToast(`Da tu choi lenh #${req.id} va hoan tien!`);
}

/* ==================== 18. ADMIN: NOTIFICATIONS ==================== */
let adminNotifications = [];

function loadAdminNotifications() {
  try {
    const raw = localStorage.getItem('vuadaoquang_notifications');
    if (raw) adminNotifications = JSON.parse(raw);
  } catch (e) {
    adminNotifications = [];
  }
}

function saveAdminNotifications() {
  localStorage.setItem('vuadaoquang_notifications', JSON.stringify(adminNotifications));
}

loadAdminNotifications();

function sendNotify() {
  const title = document.getElementById('admNotifyTitle').value.trim();
  const body = document.getElementById('admNotifyBody').value.trim();
  const type = document.getElementById('admNotifyType').value;

  if (!title || !body) {
    showToast('Vui long nhap tieu de va noi dung!');
    return;
  }

  const notif = {
    id: adminNotifications.length + 1,
    title: title,
    body: body,
    type: type,
    createdAt: new Date().toLocaleString('vi-VN'),
  };
  adminNotifications.unshift(notif);
  saveAdminNotifications();

  showNotifyBanner(notif);

  const users = getUsersDB();
  const icons = { info: 'ℹ', success: '✅', warning: '⚠', danger: '🚨' };
  users.forEach(u => {
    if (u.uid !== uid) {
      sendBotMessage(
        u.uid,
        `${icons[type] || '📢'} ${title}\n\n${body}`
      );
    }
  });

  document.getElementById('admNotifyTitle').value = '';
  document.getElementById('admNotifyBody').value = '';

  renderAdminNotifications();
  showToast('Da gui thong bao den tat ca nguoi dung!');
}

function renderAdminNotifications() {
  const list = document.getElementById('admNotifyList');
  if (adminNotifications.length === 0) {
    list.innerHTML = '<div class="adm-item-sub" style="text-align:center;padding:20px">Chua co thong bao nao.</div>';
    return;
  }
  const icons = { info: 'ℹ', success: '✅', warning: '⚠', danger: '🚨' };
  list.innerHTML = adminNotifications.map(n => `
    <div class="adm-item">
      <div class="adm-item-head">
        <span class="adm-item-name">${icons[n.type] || '📢'} ${escapeHtml(n.title)}</span>
      </div>
      <div class="adm-item-sub">
        ${escapeHtml(n.body)}<br>
        ⏰ ${n.createdAt}
      </div>
    </div>
  `).join('');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showNotifyBanner(notif) {
  const banner = document.getElementById('notifyBanner');
  const icons = { info: 'ℹ', success: '✅', warning: '⚠', danger: '🚨' };
  banner.className = `notify-banner ${notif.type}`;
  banner.innerHTML = `
    <span class="notify-banner-icon">${icons[notif.type] || '📢'}</span>
    <div class="notify-banner-body">
      <div class="notify-banner-title">${escapeHtml(notif.title)}</div>
      <div class="notify-banner-text">${escapeHtml(notif.body)}</div>
    </div>
    <button class="notify-banner-close" onclick="closeNotifyBanner()">✕</button>
  `;
  banner.classList.remove('hidden');
  clearTimeout(banner._timer);
  banner._timer = setTimeout(() => closeNotifyBanner(), 8000);
}

function closeNotifyBanner() {
  document.getElementById('notifyBanner').classList.add('hidden');
}

/* ==================== 19. ADMIN: GIFTCODE ==================== */
let adminGiftcodes = [];

function loadAdminGiftcodes() {
  try {
    const raw = localStorage.getItem('vuadaoquang_giftcodes');
    if (raw) adminGiftcodes = JSON.parse(raw);
  } catch (e) {
    adminGiftcodes = [];
  }
}

function saveAdminGiftcodes() {
  localStorage.setItem('vuadaoquang_giftcodes', JSON.stringify(adminGiftcodes));
}

loadAdminGiftcodes();

function createGiftcode() {
  const code = document.getElementById('admGiftCode').value.trim().toUpperCase();
  const reward = Number(document.getElementById('admGiftReward').value);
  const limit = Number(document.getElementById('admGiftLimit').value);

  if (!code || !reward || !limit) {
    showToast('Vui long nhap day du thong tin!');
    return;
  }
  if (reward <= 0 || limit <= 0) {
    showToast('Phan thuong va so luot phai > 0!');
    return;
  }
  if (adminGiftcodes.find(g => g.code === code)) {
    showToast('Giftcode da ton tai!');
    return;
  }

  const gift = {
    code: code,
    reward: reward,
    limit: limit,
    used: 0,
    claimedBy: [],
    createdAt: new Date().toLocaleString('vi-VN'),
  };
  adminGiftcodes.unshift(gift);
  saveAdminGiftcodes();

  document.getElementById('admGiftCode').value = '';
  document.getElementById('admGiftReward').value = '';
  document.getElementById('admGiftLimit').value = '';

  renderAdminGiftcodes();
  showToast(`Da tao Giftcode: ${code}`);
}

function renderAdminGiftcodes() {
  const list = document.getElementById('admGiftList');
  if (adminGiftcodes.length === 0) {
    list.innerHTML = '<div class="adm-item-sub" style="text-align:center;padding:20px">Chua co Giftcode nao.</div>';
    return;
  }
  list.innerHTML = adminGiftcodes.map(g => {
    const exhausted = g.used >= g.limit;
    return `
      <div class="adm-item">
        <div class="adm-item-head">
          <span class="adm-item-name">${g.code}</span>
          <span class="adm-badge ${exhausted ? 'used' : 'active'}">${exhausted ? 'HET' : 'HOAT DONG'}</span>
        </div>
        <div class="adm-item-sub">
          Phan thuong: ${formatInt(g.reward)} Quang<br>
          Da dung: ${g.used}/${g.limit}<br>
          ⏰ ${g.createdAt}
        </div>
        <div class="adm-item-actions">
          <button class="admin-btn-sm blue" onclick="copyGiftcode('${g.code}')">Copy ma</button>
          <button class="admin-btn-sm gray" onclick="broadcastGiftcode('${g.code}')">Gui tat ca</button>
          <button class="admin-btn-sm red" onclick="deleteGiftcode('${g.code}')">Xoa</button>
        </div>
      </div>
    `;
  }).join('');
}

function copyGiftcode(code) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(code).then(() => showToast(`Da copy: ${code}`));
  } else {
    showToast(`Ma: ${code}`);
  }
}

function broadcastGiftcode(code) {
  const gift = adminGiftcodes.find(g => g.code === code);
  if (!gift) return;
  const users = getUsersDB();
  users.forEach(u => {
    if (u.uid !== uid) {
      sendBotMessage(u.uid, `🎁 Giftcode moi: ${code}\nPhan thuong: ${formatInt(gift.reward)} Quang\nSo luot: ${gift.limit - gift.used} con lai\nVao ung dung > Ho So > Nhap Giftcode!`);
    }
  });
  showToast(`Da gui Giftcode ${code} den tat ca!`);
}

function deleteGiftcode(code) {
  if (!confirm(`Xoa Giftcode ${code}?`)) return;
  adminGiftcodes = adminGiftcodes.filter(g => g.code !== code);
  saveAdminGiftcodes();
  renderAdminGiftcodes();
  showToast(`Da xoa ${code}`);
}

/* ==================== 20. ADMIN: CONFIG ==================== */
function loadConfigForm() {
  document.getElementById('admCfgRate').value = miningRate;
  document.getElementById('admCfgRate2').value = EXCHANGE_RATE;
  document.getElementById('admCfgFee').value = FEE_PERCENT;
  document.getElementById('admCfgMin').value = MIN_WITHDRAW;
  document.getElementById('admCfgMax').value = MAX_WITHDRAW;
}

function saveConfig() {
  const rate = Number(document.getElementById('admCfgRate').value);
  const exRate = Number(document.getElementById('admCfgRate2').value);
  const fee = Number(document.getElementById('admCfgFee').value);
  const minW = Number(document.getElementById('admCfgMin').value);
  const maxW = Number(document.getElementById('admCfgMax').value);

  if (rate > 0) miningRate = rate;
  if (exRate > 0) EXCHANGE_RATE = exRate;
  if (fee >= 0 && fee <= 100) FEE_PERCENT = fee;
  if (minW > 0) MIN_WITHDRAW = minW;
  if (maxW > 0) MAX_WITHDRAW = maxW;

  updateRateDisplay();
  showToast('Da luu cau hinh he thong!');
}

function adjustJackpot() {
  const delta = Number(document.getElementById('admCfgJackpot').value);
  if (isNaN(delta) || delta === 0) {
    showToast('Nhap so Quang hop le (am de tru)!');
    return;
  }
  const jackEl = document.getElementById('jackpotValue');
  const current = Number(String(jackEl.textContent).replace(/,/g, '')) || 1331716;
  const newVal = Math.max(0, current + delta);
  jackEl.textContent = formatInt(newVal);
  document.getElementById('admCfgJackpot').value = '';
  showToast(`Jackpot ${delta >= 0 ? '+' : ''}${formatInt(delta)} → ${formatInt(newVal)}`);
}

/* ==================== 21. START BOT LINK ==================== */
function checkStartParam() {
  const urlParams = new URLSearchParams(window.location.search);
  const startParam = urlParams.get('start') || urlParams.get('startapp');
  if (startParam) {
    setTimeout(() => {
      showNotifyBanner({
        title: 'Chao mung ban!',
        body: `Ban da duoc moi tham gia Vua Dao Quang. Tham gia nhom de nhan tin tuc va ho tro: ${GROUP_LINK}`,
        type: 'info',
      });
    }, 2000);
  }
}
checkStartParam();
