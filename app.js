/* ==================== 0. FIREBASE IMPORTS & CONFIG ==================== */
/* ==================== 0. FIREBASE IMPORTS & CONFIG ==================== */
import { 
  db, 
  auth, 
  signInAnonymously, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs,        // ← THÊM
  updateDoc, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  limit, 
  serverTimestamp 
} from './firebase-config.js';

/* ==================== 0.1. THEME SYSTEM ==================== */
let currentTheme = localStorage.getItem('vuakhoangsan_theme') || 'light';

function initTheme() {
  document.documentElement.setAttribute('data-theme', currentTheme);
  updateThemeIcon();
}

function toggleTheme() {
  currentTheme = currentTheme === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', currentTheme);
  localStorage.setItem('vuakhoangsan_theme', currentTheme);
  updateThemeIcon();
  hapticFeedback('light');
}

function updateThemeIcon() {
  const btn = document.getElementById('themeToggle');
  if (btn) btn.textContent = currentTheme === 'light' ? '🌙' : '☀️';
}

/* ==================== 0.2. HAPTIC FEEDBACK ==================== */
function hapticFeedback(type) {
  if (tg && tg.HapticFeedback) {
    try {
      if (type === 'light') tg.HapticFeedback.impactOccurred('light');
      else if (type === 'medium') tg.HapticFeedback.impactOccurred('medium');
      else if (type === 'heavy') tg.HapticFeedback.impactOccurred('heavy');
      else if (type === 'success') tg.HapticFeedback.notificationOccurred('success');
      else if (type === 'error') tg.HapticFeedback.notificationOccurred('error');
      else if (type === 'warning') tg.HapticFeedback.notificationOccurred('warning');
    } catch (e) {}
  }
}

/* ==================== 0.3. SYNC STATUS ==================== */
let isOnline = navigator.onLine;
let isSyncing = false;

function updateSyncStatus(status) {
  const el = document.getElementById('syncStatus');
  const dot = document.getElementById('syncDot');
  const text = document.getElementById('syncText');
  if (!el || !dot || !text) return;

  el.className = 'sync-status ' + status;
  if (status === 'online') {
    dot.textContent = '●';
    text.textContent = 'Online';
  } else if (status === 'offline') {
    dot.textContent = '○';
    text.textContent = 'Offline';
  } else if (status === 'syncing') {
    dot.textContent = '◐';
    text.textContent = 'Syncing...';
  }
}

window.addEventListener('online', () => { isOnline = true; updateSyncStatus('online'); });
window.addEventListener('offline', () => { isOnline = false; updateSyncStatus('offline'); });

/* ==================== 0.4. PARTICLE EFFECTS ==================== */
function spawnMiningParticles() {
  const container = document.getElementById('mineParticles');
  if (!container) return;

  for (let i = 0; i < 3; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    p.style.left = (30 + Math.random() * 40) + '%';
    p.style.bottom = '20%';
    p.style.animationDelay = (i * 0.2) + 's';
    container.appendChild(p);
    setTimeout(() => p.remove(), 2000);
  }
}

/* ==================== 0.5. LEVEL UP ANIMATION ==================== */
function triggerLevelUp() {
  const levelBadge = document.querySelector('.level-badge');
  if (levelBadge) {
    levelBadge.classList.add('level-up-flash');
    setTimeout(() => levelBadge.classList.remove('level-up-flash'), 800);
  }
  hapticFeedback('success');
}

/* ==================== 0.6. SPIN WIN ANIMATION ==================== */
function triggerSpinWin() {
  const wheel = document.getElementById('wheel');
  if (wheel) {
    wheel.classList.add('spin-win');
    setTimeout(() => wheel.classList.remove('spin-win'), 600);
  }
  hapticFeedback('success');
}

/* ==================== 1. DATABASE ENGINE (FIREBASE + FALLBACK) ==================== */
const DB = {
  prefix: 'vuakhoangsan_',

  // Firebase references
  userRef: null,
  usersRef: null,
  withdrawalsRef: null,
  configRef: null,
  logsRef: null,

  async initFirebase() {
    try {
      // Sign in anonymously
      const cred = await signInAnonymously(auth);
      console.log('[TUANX3000] Firebase auth:', cred.user.uid);

      // Set up references
      this.usersRef = collection(db, 'users');
      this.withdrawalsRef = collection(db, 'withdrawals');
      this.configRef = doc(db, 'config', 'global');
      this.logsRef = collection(db, 'logs');

      updateSyncStatus('online');
      return true;
    } catch (e) {
      console.error('[TUANX3000] Firebase init failed:', e);
      updateSyncStatus('offline');
      return false;
    }
  },

  get(key) {
    try {
      const raw = localStorage.getItem(this.prefix + key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  },

  set(key, value) {
    localStorage.setItem(this.prefix + key, JSON.stringify(value));
    this.log('DB_SET', { key, timestamp: new Date().toISOString() });

    // Sync to Firebase if online
    if (isOnline && this.userRef) {
      this.syncToFirebase(key, value);
    }
  },

  async syncToFirebase(key, value) {
    try {
      updateSyncStatus('syncing');
      if (key === 'users') {
        // Batch update users
        const users = value || [];
        for (const user of users) {
          const userDoc = doc(this.usersRef, user.uid);
          await setDoc(userDoc, { ...user, updatedAt: serverTimestamp() }, { merge: true });
        }
      } else if (key === 'withdrawals') {
        const withdrawals = value?.requests || [];
        for (const req of withdrawals) {
          const reqDoc = doc(this.withdrawalsRef, String(req.id));
          await setDoc(reqDoc, { ...req, updatedAt: serverTimestamp() }, { merge: true });
        }
      } else if (key === 'config') {
        await setDoc(this.configRef, { ...value, updatedAt: serverTimestamp() }, { merge: true });
      }
      updateSyncStatus('online');
    } catch (e) {
      console.error('[TUANX3000] Sync failed:', e);
      updateSyncStatus('offline');
    }
  },

  async loadFromFirebase() {
    if (!isOnline) return false;
    try {
      updateSyncStatus('syncing');

      // Load config
      const configSnap = await getDoc(this.configRef);
      if (configSnap.exists()) {
        const config = configSnap.data();
        this.set('config', config);
        if (config.miningRate > 0) miningRate = config.miningRate;
        if (config.EXCHANGE_RATE > 0) EXCHANGE_RATE = config.EXCHANGE_RATE;
        if (config.FEE_PERCENT >= 0) FEE_PERCENT = config.FEE_PERCENT;
        if (config.MIN_WITHDRAW > 0) MIN_WITHDRAW = config.MIN_WITHDRAW;
        if (config.MAX_WITHDRAW > 0) MAX_WITHDRAW = config.MAX_WITHDRAW;
      }

      // Load users
      const usersSnap = await getDocs(query(this.usersRef, limit(1000)));
      const users = [];
      usersSnap.forEach(d => users.push(d.data()));
      if (users.length > 0) {
        this.set('users', users);
      }

      updateSyncStatus('online');
      return true;
    } catch (e) {
      console.error('[TUANX3000] Load from Firebase failed:', e);
      updateSyncStatus('offline');
      return false;
    }
  },

  setupRealtimeListeners() {
    if (!isOnline || !this.withdrawalsRef) return;

    // Real-time withdrawals listener for admin
    onSnapshot(query(this.withdrawalsRef, orderBy('createdAt', 'desc'), limit(50)), (snap) => {
      const requests = [];
      snap.forEach(d => requests.push(d.data()));
      if (requests.length > 0) {
        withdrawRequests = requests;
        if (isAdminLoggedIn) {
          renderAdminWithdrawals();
        }
      }
    });

    // Real-time users listener
    onSnapshot(query(this.usersRef, limit(1000)), (snap) => {
      const users = [];
      snap.forEach(d => users.push(d.data()));
      if (users.length > 0) {
        this.set('users', users);
        if (isAdminLoggedIn) {
          renderAdminUsers();
        }
      }
    });
  },

  remove(key) {
    localStorage.removeItem(this.prefix + key);
  },

  getAll() {
    const data = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(this.prefix)) {
        try {
          data[key.replace(this.prefix, '')] = JSON.parse(localStorage.getItem(key));
        } catch (e) {
          data[key.replace(this.prefix, '')] = localStorage.getItem(key);
        }
      }
    }
    return data;
  },

  clear() {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(this.prefix)) keys.push(key);
    }
    keys.forEach(k => localStorage.removeItem(k));
  },

  export() {
    return JSON.stringify(this.getAll(), null, 2);
  },

  import(jsonStr) {
    try {
      const data = JSON.parse(jsonStr);
      Object.keys(data).forEach(key => {
        this.set(key, data[key]);
      });
      return true;
    } catch (e) { return false; }
  },

  backup() {
    const backup = {
      timestamp: new Date().toISOString(),
      data: this.getAll()
    };
    const backups = this.get('backups') || [];
    backups.unshift(backup);
    if (backups.length > 10) backups.pop();
    this.set('backups', backups);
    return backup.timestamp;
  },

  restore(index = 0) {
    const backups = this.get('backups') || [];
    if (backups[index]) {
      Object.keys(backups[index].data).forEach(key => {
        this.set(key, backups[index].data[key]);
      });
      return true;
    }
    return false;
  },

  log(action, details) {
    const logs = this.get('logs') || [];
    logs.unshift({
      id: Date.now(),
      action,
      details,
      timestamp: new Date().toLocaleString('vi-VN')
    });
    if (logs.length > 1000) logs.pop();
    this.set('logs', logs);

    // Also log to Firebase
    if (isOnline && this.logsRef) {
      try {
        const logDoc = doc(this.logsRef, String(Date.now()));
        setDoc(logDoc, { action, details, timestamp: serverTimestamp() }, { merge: true });
      } catch (e) {}
    }
  }
};

/* ==================== 1.1. ANTI-CHEAT SYSTEM ==================== */
const AntiCheat = {
  secretKey: 'vuakhoangsan_v3_secret_key_2026',

  generateSignature(data) {
    const str = JSON.stringify(data) + this.secretKey + Date.now();
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  },

  verifySignature(data, signature) {
    return this.generateSignature(data) === signature;
  },

  validateMiningAction(userId, amount, rate, timestamp) {
    const now = Date.now();
    const timeDiff = now - timestamp;

    // Max mining rate check
    const maxRate = 0.001; // Max 0.001 per second
    if (rate > maxRate) return { valid: false, reason: 'RATE_EXCEEDED' };

    // Time sanity check
    if (timeDiff < 0 || timeDiff > 60000) return { valid: false, reason: 'TIME_ANOMALY' };

    // Amount sanity check
    const maxAmount = rate * (timeDiff / 1000) * 1.1; // 10% tolerance
    if (amount > maxAmount) return { valid: false, reason: 'AMOUNT_ANOMALY' };

    return { valid: true };
  },

  validateWithdraw(userId, amount, balance) {
    if (amount < MIN_WITHDRAW) return { valid: false, reason: 'MIN_NOT_MET' };
    if (amount > MAX_WITHDRAW) return { valid: false, reason: 'MAX_EXCEEDED' };
    if (amount > balance) return { valid: false, reason: 'INSUFFICIENT_BALANCE' };
    if (amount <= 0) return { valid: false, reason: 'INVALID_AMOUNT' };
    return { valid: true };
  },

  rateLimit: {},

  checkRateLimit(userId, action, limitMs = 1000) {
    const key = `${userId}_${action}`;
    const last = this.rateLimit[key] || 0;
    const now = Date.now();
    if (now - last < limitMs) {
      return { allowed: false, wait: limitMs - (now - last) };
    }
    this.rateLimit[key] = now;
    return { allowed: true };
  },

  detectAnomaly(userId, action, value) {
    const user = getCurrentUser();
    if (!user) return { anomaly: false };

    // Check for impossible balance changes
    if (action === 'balance_change') {
      const maxChange = 1000000; // Max 1M per action
      if (Math.abs(value) > maxChange) {
        return { anomaly: true, reason: 'IMPOSSIBLE_CHANGE', value };
      }
    }

    // Check for rapid actions
    const rapidCheck = this.checkRateLimit(userId, action, 500);
    if (!rapidCheck.allowed) {
      return { anomaly: true, reason: 'RAPID_ACTION', wait: rapidCheck.wait };
    }

    return { anomaly: false };
  }
};

/* ==================== 2. TELEGRAM + LOADING ==================== */
let tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
let tgUser;

if (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) {
  tgUser = tg.initDataUnsafe.user;
  try { tg.ready(); } catch (e) {}
  try { tg.expand(); } catch (e) {}
  // Set Telegram theme
  if (tg.colorScheme) {
    currentTheme = tg.colorScheme;
    document.documentElement.setAttribute('data-theme', currentTheme);
    localStorage.setItem('vuakhoangsan_theme', currentTheme);
  }
} else {
  tgUser = { id: 5838598093, first_name: 'Tuanx3000', last_name: '', username: 'Tuanx3000', photo_url: '' };
}

const uid = String(tgUser.id || '5838598093');
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

const BOT_USERNAME = 'VuaKhoangSan_Bot';
const refLinkText = `https://t.me/${BOT_USERNAME}?start=${uid}`;
document.getElementById('refLink').textContent = refLinkText;

const now = new Date();
document.getElementById('joinDate').textContent =
  `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`;

/* ==================== 2.1. INIT WITH FIREBASE ==================== */
window.addEventListener('load', async () => {
  initTheme();

  // Init Firebase
  await DB.initFirebase();
  await DB.loadFromFirebase();
  DB.setupRealtimeListeners();

  initUserSystem();
  setTimeout(() => {
    document.getElementById('loadingScreen').classList.add('hidden-load');
  }, 1100);
});

/* ==================== 3. TOAST (WITH TYPES) ==================== */
function showToast(msg, type = 'default') {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = 'toast ' + type;
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('show'), 2500);

  // Haptic based on type
  if (type === 'success') hapticFeedback('success');
  else if (type === 'error') hapticFeedback('error');
  else if (type === 'warning') hapticFeedback('warning');
  else hapticFeedback('light');
}

/* ==================== 4. USER SYSTEM - AUTO REGISTER ==================== */
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
      lastActive: new Date().toISOString(),
      miningHistory: [],
      loginHistory: [new Date().toISOString()],
      antiCheatScore: 100, // Trust score
    };
    users.push(currentUser);
    saveUsersDB(users);

    DB.log('USER_REGISTER', { uid, name: displayName });

    showNotifyBanner({
      title: 'Chào mừng thợ đào mới!',
      body: `Xin chào ${displayName}! Bạn đã được tặng 0 Quặng khởi đầu. Hãy khởi động máy đào ngay!`,
      type: 'success',
    });

    sendBotMessage(
      ADMIN_ID,
      `🆕 USER MỚI ĐĂNG KÝ\n` +
      `👤 ${displayName} (${displayHandle})\n` +
      `🆔 UID: ${uid}\n` +
      `⏰ ${currentUser.joinedAt}`
    );
  } else {
    currentUser.name = displayName;
    currentUser.handle = displayHandle;
    currentUser.photoUrl = tgPhotoUrl;
    currentUser.lastActive = new Date().toISOString();
    currentUser.loginHistory = currentUser.loginHistory || [];
    currentUser.loginHistory.unshift(new Date().toISOString());
    if (currentUser.loginHistory.length > 50) currentUser.loginHistory.pop();
    saveUsersDB(users);
  }

  loadUserState(currentUser);
  updateAllDisplays();
}

function getUsersDB() {
  return DB.get('users') || [];
}

function saveUsersDB(users) {
  DB.set('users', users);
}

function getCurrentUser() {
  const users = getUsersDB();
  return users.find(u => u.uid === uid);
}

function updateCurrentUser(updates) {
  const users = getUsersDB();
  const idx = users.findIndex(u => u.uid === uid);
  if (idx !== -1) {
    users[idx] = { ...users[idx], ...updates, lastActive: new Date().toISOString() };
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

/* ==================== 5. STATE ==================== */
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
    `${fragments}<span style="color:var(--text-muted);font-size:14px">/15</span>`;
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
  renderRankings();
}

function updateCheckinBtn() {
  const btn = document.getElementById('checkinBtn');
  if (checkedIn) {
    btn.textContent = 'ĐÃ LÀM';
    btn.disabled = true;
    btn.style.opacity = '0.5';
  } else {
    btn.textContent = 'Làm ngay';
    btn.disabled = false;
    btn.style.opacity = '1';
  }
}

/* ==================== 6. XP & LEVEL SYSTEM ==================== */
function addXP(amount) {
  userXP += amount;
  let leveledUp = false;
  while (userXP >= xpNeeded) {
    userXP -= xpNeeded;
    userLevel++;
    xpNeeded = Math.floor(xpNeeded * 1.5);
    leveledUp = true;
    miningRate += 0.00001;
  }

  if (leveledUp) {
    triggerLevelUp();
    showToast(`🎉 Lên cấp ${userLevel}! XP cần: ${xpNeeded}`, 'success');
  }

  updateCurrentUser({ xp: userXP, level: userLevel, xpNeeded: xpNeeded, miningRate: miningRate });
  updateLevelDisplay();
  updateRateDisplay();
}

/* ==================== 7. MINING (WITH ANTI-CHEAT) ==================== */
function toggleMining() {
  const btn = document.getElementById('mineBtn');
  if (!isMining) {
    // Anti-cheat: rate limit
    const rateCheck = AntiCheat.checkRateLimit(uid, 'mining_toggle', 500);
    if (!rateCheck.allowed) {
      showToast('Quá nhanh! Hãy đợi một chút.', 'warning');
      return;
    }

    isMining = true;
    btn.textContent = '⛏ THU HOẠCH NGAY';
    btn.classList.add('mining-active');
    hapticFeedback('medium');

    miningTimer = setInterval(() => {
      pendingOre += miningRate / 10;
      updatePendingDisplay();

      // Spawn particles occasionally
      if (Math.random() < 0.3) spawnMiningParticles();
    }, 100);
  } else {
    isMining = false;
    clearInterval(miningTimer);
    btn.classList.remove('mining-active');
    hapticFeedback('heavy');

    if (pendingOre > 0) {
      const harvested = pendingOre;

      // Anti-cheat validation
      const validation = AntiCheat.validateMiningAction(uid, harvested, miningRate, Date.now() - (harvested / miningRate * 1000));
      if (!validation.valid) {
        console.warn('[TUANX3000] Mining validation failed:', validation.reason);
        // Still allow but log
        DB.log('ANTICHEAT_MINING_WARNING', { uid, reason: validation.reason, harvested, miningRate });
      }

      balance += harvested;
      showToast(`Thu hoạch +${harvested.toFixed(4)} Quặng`, 'success');
      pendingOre = 0;
      addXP(Math.floor(harvested * 100));

      // Log mining
      const user = getCurrentUser();
      user.miningHistory = user.miningHistory || [];
      user.miningHistory.unshift({
        amount: harvested,
        timestamp: new Date().toISOString()
      });
      if (user.miningHistory.length > 100) user.miningHistory.pop();
      updateCurrentUser({ miningHistory: user.miningHistory });
    }
    updatePendingDisplay();
    updateBalanceDisplay();
    btn.textContent = '▶ KHỞI ĐỘNG MÁY ĐÀO';
    updateCurrentUser({ balance: balance });
  }
}

/* ==================== 8. DAILY MISSIONS ==================== */
function doCheckin() {
  if (checkedIn) {
    showToast('Bạn đã điểm danh hôm nay rồi!', 'warning');
    return;
  }

  // Anti-cheat: rate limit
  const rateCheck = AntiCheat.checkRateLimit(uid, 'checkin', 2000);
  if (!rateCheck.allowed) {
    showToast('Quá nhanh! Hãy đợi một chút.', 'warning');
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
  showToast('Điểm danh thành công! +10 Quặng +1 Điểm', 'success');
  hapticFeedback('success');
}

function watchAd() {
  const user = getCurrentUser();
  const today = new Date().toLocaleDateString('vi-VN');

  if (user.lastAdDate !== today) {
    user.dailyAdWatched = 0;
    user.lastAdDate = today;
  }

  if (user.dailyAdWatched >= 10) {
    showToast('Bạn đã xem hết quảng cáo hôm nay! (10/10)', 'warning');
    return;
  }

  // Anti-cheat: rate limit
  const rateCheck = AntiCheat.checkRateLimit(uid, 'watch_ad', 3000);
  if (!rateCheck.allowed) {
    showToast('Quá nhanh! Hãy đợi một chút.', 'warning');
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
  showToast(`Xem quảng cáo thành công! +${oreReward} Quặng & +${pointReward} Điểm (${user.dailyAdWatched}/10)`, 'success');
  hapticFeedback('success');
}

/* ==================== 9. MACHINES ==================== */
const machineTemplates = [
  {
    id: 1, name: 'Máy Sơ Cấp', icon: '🌱',
    iconBg: 'linear-gradient(135deg,#dcfce7,#bbf7d0)',
    rateText: '1.98/p', cycle: '3h',
    price: 100000, rateAdd: 0.000033,
    btn: 'linear-gradient(135deg,#16a34a,#15803d)', priceColor: '#16a34a',
  },
  {
    id: 2, name: 'Máy Trung Cấp', icon: '▶',
    iconBg: 'linear-gradient(135deg,#dbeafe,#bfdbfe)',
    rateText: '4.63/p', cycle: '4h',
    price: 200000, rateAdd: 0.000077,
    btn: 'linear-gradient(135deg,#2563eb,#1d4ed8)', priceColor: '#2563eb',
  },
  {
    id: 3, name: 'Máy Cao Cấp', icon: '🏅',
    iconBg: 'linear-gradient(135deg,#f3e8ff,#e9d5ff)',
    rateText: '13.89/p', cycle: '5h',
    price: 500000, rateAdd: 0.000231,
    btn: 'linear-gradient(135deg,#9333ea,#7c3aed)', priceColor: '#9333ea',
  },
  {
    id: 4, name: 'Máy Tối Cao', icon: '👑',
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
        <div class="machine-desc">Tốc độ: ${m.rateText} · Chu kỳ: ${m.cycle}<br>Bảo trì: Mỗi 10 ngày</div>
      </div>
      <div class="machine-side">
        <div class="machine-price" style="color:${m.priceColor}">
          ${formatInt(m.price)} <span class="coin">●</span>
        </div>
        <button class="buy-btn" style="background:${m.btn}" onclick="buyMachine(${m.id})">MUA MÁY</button>
      </div>
    </div>
  `;
  }).join('');
}

function buyMachine(id) {
  // Anti-cheat: rate limit
  const rateCheck = AntiCheat.checkRateLimit(uid, 'buy_machine', 1000);
  if (!rateCheck.allowed) {
    showToast('Quá nhanh! Hãy đợi một chút.', 'warning');
    return;
  }

  const m = machineTemplates.find((x) => x.id === id);
  if (!m) return;
  if (balance < m.price) {
    showToast('Số dư không đủ để mua máy này!', 'error');
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
  showToast(`Mua thành công ${m.name}! Tốc độ tăng.`, 'success');
  hapticFeedback('success');
}

/* ==================== 10. SPIN ==================== */
const prizes = [
  { label: 'JACKPOT', value: 'jackpot' },
  { label: 'Trượt rồi', value: 0 },
  { label: '100', value: 100 },
  { label: '200', value: 200 },
  { label: '500', value: 500 },
  { label: '1000', value: 1000 },
  { label: '2000', value: 2000 },
];

function exchangeTicket() {
  // Anti-cheat: rate limit
  const rateCheck = AntiCheat.checkRateLimit(uid, 'exchange_ticket', 1000);
  if (!rateCheck.allowed) {
    showToast('Quá nhanh! Hãy đợi một chút.', 'warning');
    return;
  }

  if (fragments < 15) {
    showToast('Cần đủ 15 mảnh VQMM để đổi 1 vé!', 'warning');
    return;
  }
  fragments -= 15;
  tickets += 1;
  updateCurrentUser({ fragments: fragments, tickets: tickets });
  updateMeta();
  showToast('Đổi thành công 1 Vé Quay Số!', 'success');
  hapticFeedback('success');
}

function spinWheel() {
  if (spinning) return;

  // Anti-cheat: rate limit
  const rateCheck = AntiCheat.checkRateLimit(uid, 'spin_wheel', 5000);
  if (!rateCheck.allowed) {
    showToast('Quá nhanh! Hãy đợi một chút.', 'warning');
    return;
  }

  if (tickets <= 0) {
    showToast('Bạn không có vé quay số! Hãy đổi mảnh VQMM.', 'warning');
    return;
  }

  spinning = true;
  tickets -= 1;
  updateCurrentUser({ tickets: tickets });
  updateMeta();
  hapticFeedback('medium');

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
      triggerSpinWin();
      showToast(`🎉 JACKPOT! Bạn nhận ${formatInt(jack)} Quặng!`, 'success');
    } else if (prize.value === 0) {
      showToast('Trượt rồi! Chúc bạn may mắn lần sau.', 'default');
      hapticFeedback('error');
    } else {
      balance += prize.value;
      updateCurrentUser({ balance: balance });
      updateBalanceDisplay();
      addXP(Math.floor(prize.value / 50));
      triggerSpinWin();
      showToast(`Chúc mừng! Bạn nhận ${formatInt(prize.value)} Quặng.`, 'success');
    }
    spinning = false;
  }, 4600);
}

/* ==================== 11. INVITE ==================== */
const milestones = [
  { need: 3, reward: '1 Hộp Bí Ẩn' },
  { need: 10, reward: '3 Hộp Bí Ẩn' },
  { need: 20, reward: '8 Hộp Bí Ẩn' },
  { need: 50, reward: '20 Hộp Bí Ẩn' },
  { need: 100, reward: '30 Hộp Bí Ẩn' },
  { need: 200, reward: '70 Hộp Bí Ẩn' },
];

function renderMilestones() {
  const user = getCurrentUser();
  const refCount = user ? (user.referralCount || 0) : 0;

  document.getElementById('milestones').innerHTML = milestones.map((m) => {
    const achieved = refCount >= m.need;
    return `
    <div class="milestone-row" style="${achieved ? 'background:var(--bg-secondary);border-radius:8px;padding:8px 6px;' : ''}">
      <span class="milestone-left">${achieved ? '✅ ' : ''}Mời ${m.need} Bạn bè</span>
      <span class="milestone-right" style="${achieved ? 'color:var(--accent-green);' : ''}">${m.reward}</span>
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

function renderRankings() {
  const list = document.getElementById('rankList');
  if (!list) return;

  let users = getUsersDB();
  users.sort((a, b) => (b.referralCount || 0) - (a.referralCount || 0));
  const topUsers = users.slice(0, 20);

  if (topUsers.length === 0) {
    list.innerHTML = '<div class="rank-empty">Chưa có dữ liệu xếp hạng.</div>';
    return;
  }

  list.innerHTML = topUsers.map((u, i) => {
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `<span style="color:var(--text-muted)">#${i+1}</span>`;
    return `
      <div class="milestone-row" style="padding:12px 6px;">
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="font-size:18px;">${medal}</span>
          <div>
            <div style="font-weight:800;font-size:13px;color:var(--text-primary);">${u.name || 'Unknown'}</div>
            <div style="font-size:11px;color:var(--text-muted);">${u.handle || ''}</div>
          </div>
        </div>
        <span style="color:var(--accent-blue);font-weight:800;">${u.referralCount || 0} ref</span>
      </div>
    `;
  }).join('');
}

function copyRefLink() {
  hapticFeedback('light');
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(refLinkText).then(() => {
      showToast('Đã sao chép link mời bạn!', 'success');
    }).catch(() => {
      showToast('Không thể sao chép link.', 'error');
    });
  } else {
    showToast('Link: ' + refLinkText, 'default');
  }
}

/* ==================== 12. SHOP ==================== */
const shopItems = [
  {
    id: 1, name: 'Bảo Hiểm Băng', icon: '🛡',
    desc: 'Bảo vệ nick không bị trừ điểm khi Off 72h.',
    price: 2000, type: 'insurance',
  },
  {
    id: 2, name: 'Thùng Cải Tiến', icon: '📦',
    desc: 'Kéo dài kho chứa từ 3h lên 8h tự động đầy.',
    price: 3000, type: 'storage',
  },
  {
    id: 3, name: 'Vé VIP Ads', icon: '▶',
    desc: 'Nhân đôi Quặng & Điểm khi xem Ads (30 ngày).',
    price: 5000, type: 'vip_ads', duration: 30,
  },
  {
    id: 4, name: 'Vé S-VIP Ads', icon: '👑',
    desc: 'Nhân NĂM (x5) Quặng & Điểm xem Ads (30 ngày).',
    price: 25000, featured: true, hot: true, type: 'svip_ads', duration: 30,
  },
  {
    id: 5, name: 'Gói 10 Vé Quay Số', icon: '🎟',
    desc: 'Nhận ngay 10 Vé Vòng Quay thẳng vào Túi đồ.',
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
  // Anti-cheat: rate limit
  const rateCheck = AntiCheat.checkRateLimit(uid, 'buy_item', 1000);
  if (!rateCheck.allowed) {
    showToast('Quá nhanh! Hãy đợi một chút.', 'warning');
    return;
  }

  const it = shopItems.find((x) => x.id === id);
  if (!it) return;
  if (balance < it.price) {
    showToast('Số dư không đủ để mua vật phẩm này!', 'error');
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
  showToast(`Mua thành công: ${it.name}! Đã vào Túi đồ.`, 'success');
  hapticFeedback('success');
}

/* ==================== 13. PROFILE / WITHDRAW (WITH ANTI-CHEAT) ==================== */
let MIN_WITHDRAW = 240000;
let MAX_WITHDRAW = 15000000;
let FEE_PERCENT = 10;
let EXCHANGE_RATE = 1 / 30;

function claimGift() {
  // Anti-cheat: rate limit
  const rateCheck = AntiCheat.checkRateLimit(uid, 'claim_gift', 2000);
  if (!rateCheck.allowed) {
    showToast('Quá nhanh! Hãy đợi một chút.', 'warning');
    return;
  }

  const code = document.getElementById('giftCode').value.trim();
  if (!code) {
    showToast('Vui lòng nhập Giftcode!', 'warning');
    return;
  }

  const users = getUsersDB();
  const user = users.find(u => u.uid === uid);

  const gift = adminGiftcodes.find(g => g.code.toUpperCase() === code.toUpperCase());
  if (gift) {
    if (gift.used >= gift.limit) {
      showToast('Giftcode đã hết lượt dùng!', 'warning');
      return;
    }
    if (gift.claimedBy.includes(uid)) {
      showToast('Bạn đã dùng Giftcode này rồi!', 'warning');
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
    showToast(`Nhận quà thành công! +${formatInt(gift.reward)} Quặng`, 'success');
    hapticFeedback('success');
    return;
  }

  if (code.toUpperCase() === 'VUA2026') {
    if (user && user.claimedDefaultGift) {
      showToast('Bạn đã dùng Giftcode mặc định rồi!', 'warning');
      return;
    }
    balance += 100;
    updateCurrentUser({ balance: balance, claimedDefaultGift: true });
    updateBalanceDisplay();
    document.getElementById('giftCode').value = '';
    addXP(2);
    showToast('Nhận quà thành công! +100 Quặng', 'success');
    hapticFeedback('success');
  } else {
    showToast('Giftcode không hợp lệ hoặc đã hết hạn.', 'error');
    hapticFeedback('error');
  }
}

let withdrawRequests = [];
let withdrawIdCounter = 1;

function loadWithdrawRequests() {
  try {
    const raw = DB.get('withdrawals');
    if (raw) {
      withdrawRequests = raw.requests || [];
      withdrawIdCounter = raw.counter || 1;
    }
  } catch (e) {
    withdrawRequests = [];
    withdrawIdCounter = 1;
  }
}

function saveWithdrawRequests() {
  DB.set('withdrawals', {
    requests: withdrawRequests,
    counter: withdrawIdCounter,
  });
}

loadWithdrawRequests();

function submitWithdraw() {
  // Anti-cheat: rate limit
  const rateCheck = AntiCheat.checkRateLimit(uid, 'submit_withdraw', 5000);
  if (!rateCheck.allowed) {
    showToast('Quá nhanh! Hãy đợi một chút.', 'warning');
    return;
  }

  const bankName = document.getElementById('bankName').value.trim();
  const bankOwner = document.getElementById('bankOwner').value.trim();
  const bankNumber = document.getElementById('bankNumber').value.trim();
  const amountRaw = document.getElementById('bankAmount').value.trim();

  if (!bankName || !bankOwner || !bankNumber || !amountRaw) {
    showToast('Vui lòng điền đầy đủ thông tin!', 'warning');
    return;
  }

  const amount = Number(amountRaw);
  if (isNaN(amount) || amount <= 0) {
    showToast('Số quặng muốn rút không hợp lệ!', 'error');
    return;
  }

  // Anti-cheat validation
  const validation = AntiCheat.validateWithdraw(uid, amount, balance);
  if (!validation.valid) {
    showToast(`Rút tiền không hợp lệ: ${validation.reason}`, 'error');
    DB.log('ANTICHEAT_WITHDRAW_BLOCKED', { uid, amount, reason: validation.reason });
    return;
  }

  if (amount < MIN_WITHDRAW) {
    showToast(`Tối thiểu ${formatInt(MIN_WITHDRAW)} Quặng!`, 'warning');
    return;
  }
  if (amount > MAX_WITHDRAW) {
    showToast(`Tối đa ${formatInt(MAX_WITHDRAW)} Quặng!`, 'warning');
    return;
  }
  if (amount > balance) {
    showToast('Số dư không đủ để thực hiện lệnh rút!', 'error');
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

  showToast(`Đã tạo lệnh rút #${req.id}! Chờ Admin duyệt.`, 'success');
  hapticFeedback('success');

  sendBotMessage(
    ADMIN_ID,
    `🔔 LỆNH RÚT TIỀN MỚI #${req.id}\n` +
    `👤 ${displayName} (${displayHandle})\n` +
    `🆔 UID: ${uid}\n` +
    `🏦 ${bankName} - ${bankOwner}\n` +
    `💳 STK: ${bankNumber}\n` +
    `💰 Số quặng: ${formatInt(amount)}\n` +
    `📉 Phí (${FEE_PERCENT}%): ${formatInt(fee)}\n` +
    `💵 Nhận: ${formatInt(vnd)} VND (30 Quặng = 1đ)\n` +
    `⏰ ${req.createdAt}`
  );

  document.getElementById('bankName').value = '';
  document.getElementById('bankOwner').value = '';
  document.getElementById('bankNumber').value = '';
  document.getElementById('bankAmount').value = '';
}

/* ==================== 14. NAV (WITH TRANSITIONS) ==================== */
const mainTabs = ['home', 'invite', 'camp', 'shop', 'profile'];

function showTab(tabId) {
  hapticFeedback('light');

  mainTabs.forEach((id) => {
    const tab = document.getElementById('tab-' + id);
    const navBtn = document.getElementById('nav-' + id);

    if (id === tabId) {
      tab.classList.remove('hidden');
      navBtn.classList.add('nav-active');
      navBtn.classList.remove('nav-inactive');
    } else {
      tab.classList.add('hidden');
      navBtn.classList.remove('nav-active');
      navBtn.classList.add('nav-inactive');
    }
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

const subTabGroups = {
  camp: ['farm', 'spin'],
  invite: ['ref', 'rank'],
  profile: ['overview', 'bank'],
};

function showSubTab(group, subId) {
  hapticFeedback('light');
  subTabGroups[group].forEach((id) => {
    document.getElementById(`sub${group}-${id}`).classList.toggle('hidden', id !== subId);
    const btn = document.getElementById(`sub${group}-btn-${id}`);
    btn.classList.toggle('subtab-active', id === subId);
    btn.classList.toggle('subtab-inactive', id !== subId);
  });
}

function openInventory() {
  hapticFeedback('medium');
  const user = getCurrentUser();
  const inv = user && user.inventory ? user.inventory : [];
  const invText = inv.length > 0
    ? inv.map(i => `${i.icon} ${i.name}`).join(' · ')
    : 'Túi đồ trống';
  showToast(`🎒 ${invText}\n🎟 ${tickets} vé quay · ${fragments}/15 mảnh VQMM`, 'default');
}

/* ==================== 15. TELEGRAM BOT API ==================== */
const BOT_TOKEN = '8781327103:AAE63nHgMacJN4gXBVJ7-LEyshLQcgSj9zI';
const ADMIN_ID = '5838598093';
const GROUP_CHAT_ID = ' -1003882234479';
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

/* ==================== 16. ADMIN PANEL ==================== */
let adminTapCount = 0;
let adminTapTimer = null;
let isAdminLoggedIn = false;
let currentEditUserId = null;

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
  hapticFeedback('medium');
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
  closeUserEditModal();
}

function tryAdminLogin() {
  const pass = document.getElementById('adminPass').value.trim();
  const msgEl = document.getElementById('adminLoginMsg');
  const correctPass = '5838598093';

  if (pass === correctPass) {
    isAdminLoggedIn = true;
    msgEl.textContent = 'Đăng nhập thành công!';
    msgEl.className = 'admin-msg success';
    hapticFeedback('success');
    setTimeout(() => {
      document.getElementById('adminLogin').classList.add('hidden');
      document.getElementById('adminDash').classList.remove('hidden');
      refreshAdminAll();
    }, 500);
  } else {
    msgEl.textContent = 'Sai mật khẩu Admin!';
    msgEl.className = 'admin-msg error';
    hapticFeedback('error');
  }
}

const admSubTabs = ['users', 'withdraw', 'notify', 'gift', 'config', 'db', 'logs'];

function admSub(tabId) {
  hapticFeedback('light');
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
  updateDBStats();
  renderLogs();
}

/* ==================== 17. ADMIN: USERS (100% EDITABLE) ==================== */
function getAdminUsers() {
  return getUsersDB();
}

function renderAdminUsers() {
  const search = (document.getElementById('admSearchUser')?.value || '').toLowerCase().trim();
  const list = document.getElementById('admUserList');
  let users = getAdminUsers();

  // Update stats
  document.getElementById('admTotalUsers').textContent = users.length;
  const onlineCount = users.filter(u => {
    if (!u.lastActive) return false;
    const last = new Date(u.lastActive);
    return (Date.now() - last.getTime()) < 5 * 60 * 1000;
  }).length;
  document.getElementById('admOnlineUsers').textContent = onlineCount;
  document.getElementById('admBannedUsers').textContent = users.filter(u => u.banned).length;

  if (search) {
    users = users.filter(u =>
      u.uid.includes(search) || 
      (u.name || '').toLowerCase().includes(search) ||
      (u.handle || '').toLowerCase().includes(search)
    );
  }

  if (users.length === 0) {
    list.innerHTML = '<div class="adm-item-sub" style="text-align:center;padding:20px">Không tìm thấy người dùng.</div>';
    return;
  }

  list.innerHTML = users.map(u => `
    <div class="adm-item">
      <div class="adm-item-head">
        <div style="display:flex;align-items:center;gap:8px">
          ${u.photoUrl
            ? `<img src="${u.photoUrl}" style="width:28px;height:28px;border-radius:8px;object-fit:cover" onerror="this.style.display='none'">`
            : `<div style="width:28px;height:28px;border-radius:8px;background:var(--accent-blue);color:#fff;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800">${(u.name||'?').charAt(0).toUpperCase()}</div>`
          }
          <span class="adm-item-name">${u.name || 'Unknown'}</span>
        </div>
        <span class="adm-badge ${u.banned ? 'locked' : 'active'}">${u.banned ? 'BAN' : 'OK'}</span>
      </div>
      <div class="adm-item-sub">
        🆔 UID: ${u.uid}${u.handle ? ' · ' + u.handle : ''}<br>
        Cấp: ${u.level || 0} · Số dư: ${formatInt(u.balance || 0)} Quặng · Điểm: ${u.points || 0}<br>
        Đã rút: ${formatInt(u.withdrawn || 0)} · Máy: ${(u.machines || []).length} · Tham gia: ${u.joinedAt || '?'}
      </div>
      <div class="adm-item-actions">
        <button class="admin-btn-sm blue" onclick="adminEditBalance('${u.uid}')">± Số dư</button>
        <button class="admin-btn-sm amber" onclick="adminEditPoints('${u.uid}')">± Điểm</button>
        <button class="admin-btn-sm blue" onclick="adminEditLevel('${u.uid}')">± Cấp</button>
        <button class="admin-btn-sm green" onclick="adminEditXP('${u.uid}')">± XP</button>
        <button class="admin-btn-sm amber" onclick="adminEditMachines('${u.uid}')">⚙ Máy</button>
        <button class="admin-btn-sm blue" onclick="adminEditInventory('${u.uid}')">🎒 Túi</button>
        <button class="admin-btn-sm ${u.banned ? 'green' : 'red'}" onclick="adminToggleBan('${u.uid}')">${u.banned ? 'Unban' : 'Ban'}</button>
        <button class="admin-btn-sm gray" onclick="adminNotifyUser('${u.uid}')">💬 Nhắn</button>
        <button class="admin-btn-sm blue" onclick="openUserEditModal('${u.uid}')">✏️ Sửa</button>
        <button class="admin-btn-sm red" onclick="adminDeleteUser('${u.uid}')">🗑 Xóa</button>
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
  const input = prompt(`Số dư hiện tại: ${formatInt(u.balance || 0)}\nNhập số Quặng thêm (+) hoặc bớt (-):`);
  if (input === null) return;
  const delta = Number(input);
  if (isNaN(delta)) {
    showToast('Giá trị không hợp lệ!', 'error');
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
  DB.log('ADMIN_EDIT_BALANCE', { targetUid: userId, delta, newBalance: u.balance, adminUid: uid });
  showToast(`Đã ${delta >= 0 ? 'cộng' : 'trừ'} ${formatInt(Math.abs(delta))} Quặng cho ${u.name}`, 'success');
  sendBotMessage(u.uid, `💰 Admin đã ${delta >= 0 ? 'cộng' : 'trừ'} ${formatInt(Math.abs(delta))} Quặng vào tài khoản của bạn.`);
}

function adminEditPoints(userId) {
  const u = adminFindUser(userId);
  if (!u) return;
  const input = prompt(`Điểm hiện tại: ${u.points || 0}\nNhập số Điểm thêm (+) hoặc bớt (-):`);
  if (input === null) return;
  const delta = Number(input);
  if (isNaN(delta)) {
    showToast('Giá trị không hợp lệ!', 'error');
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
  DB.log('ADMIN_EDIT_POINTS', { targetUid: userId, delta, newPoints: u.points, adminUid: uid });
  showToast(`Đã ${delta >= 0 ? 'cộng' : 'trừ'} ${Math.abs(delta)} Điểm cho ${u.name}`, 'success');
}

function adminEditLevel(userId) {
  const u = adminFindUser(userId);
  if (!u) return;
  const input = prompt(`Cấp hiện tại: ${u.level || 0}\nNhập cấp mới:`);
  if (input === null) return;
  const newLevel = Number(input);
  if (isNaN(newLevel) || newLevel < 0) {
    showToast('Giá trị không hợp lệ!', 'error');
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
  DB.log('ADMIN_EDIT_LEVEL', { targetUid: userId, newLevel, adminUid: uid });
  showToast(`Đã đặt cấp ${newLevel} cho ${u.name}`, 'success');
}

function adminEditXP(userId) {
  const u = adminFindUser(userId);
  if (!u) return;
  const input = prompt(`XP hiện tại: ${u.xp || 0}/${u.xpNeeded || 120}\nNhập XP mới:`);
  if (input === null) return;
  const newXP = Number(input);
  if (isNaN(newXP) || newXP < 0) {
    showToast('Giá trị không hợp lệ!', 'error');
    return;
  }
  u.xp = newXP;
  const users = getUsersDB();
  const idx = users.findIndex(x => x.uid === userId);
  if (idx !== -1) users[idx] = u;
  saveUsersDB(users);

  if (u.uid === uid) {
    userXP = u.xp;
    updateLevelDisplay();
  }
  renderAdminUsers();
  DB.log('ADMIN_EDIT_XP', { targetUid: userId, newXP, adminUid: uid });
  showToast(`Đã đặt XP ${newXP} cho ${u.name}`, 'success');
}

function adminEditMachines(userId) {
  const u = adminFindUser(userId);
  if (!u) return;
  const currentMachines = (u.machines || []).map((m, i) => 
    `${i}: ${m.name} (ID:${m.templateId})`
  ).join('\n');

  const action = prompt(
    `Máy của ${u.name}:\n${currentMachines || 'Không có máy'}\n\n` +
    `Nhập:\n+ID để THÊM máy (VD: +1)\n-ID để XÓA máy theo index (VD: -0)\nhoặc CLEAR để xóa hết:`
  );
  if (action === null) return;

  const users = getUsersDB();
  const idx = users.findIndex(x => x.uid === userId);
  if (idx === -1) return;

  if (action.toUpperCase() === 'CLEAR') {
    users[idx].machines = [];
    saveUsersDB(users);
    renderAdminUsers();
    DB.log('ADMIN_CLEAR_MACHINES', { targetUid: userId, adminUid: uid });
    showToast(`Đã xóa hết máy của ${u.name}`, 'success');
    return;
  }

  if (action.startsWith('+')) {
    const templateId = Number(action.slice(1));
    const template = machineTemplates.find(t => t.id === templateId);
    if (!template) {
      showToast('ID máy không hợp lệ!', 'error');
      return;
    }
    users[idx].machines = users[idx].machines || [];
    users[idx].machines.push({
      templateId: template.id,
      name: template.name,
      purchasedAt: new Date().toISOString(),
      lastHarvest: new Date().toISOString(),
      maintenanceDue: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
    });
    saveUsersDB(users);
    renderAdminUsers();
    DB.log('ADMIN_ADD_MACHINE', { targetUid: userId, templateId, adminUid: uid });
    showToast(`Đã thêm ${template.name} cho ${u.name}`, 'success');
  } else if (action.startsWith('-')) {
    const machineIdx = Number(action.slice(1));
    if (isNaN(machineIdx) || !users[idx].machines || !users[idx].machines[machineIdx]) {
      showToast('Index máy không hợp lệ!', 'error');
      return;
    }
    const removed = users[idx].machines.splice(machineIdx, 1)[0];
    saveUsersDB(users);
    renderAdminUsers();
    DB.log('ADMIN_REMOVE_MACHINE', { targetUid: userId, machineName: removed.name, adminUid: uid });
    showToast(`Đã xóa ${removed.name} của ${u.name}`, 'success');
  }
}

function adminEditInventory(userId) {
  const u = adminFindUser(userId);
  if (!u) return;
  const currentInv = (u.inventory || []).map((item, i) => 
    `${i}: ${item.icon} ${item.name}`
  ).join('\n');

  const action = prompt(
    `Túi đồ của ${u.name}:\n${currentInv || 'Túi đồ trống'}\n\n` +
    `Nhập:\n+ITEM_ID để THÊM (VD: +1)\n-INDEX để XÓA (VD: -0)\nhoặc CLEAR để xóa hết:`
  );
  if (action === null) return;

  const users = getUsersDB();
  const idx = users.findIndex(x => x.uid === userId);
  if (idx === -1) return;

  if (action.toUpperCase() === 'CLEAR') {
    users[idx].inventory = [];
    saveUsersDB(users);
    renderAdminUsers();
    DB.log('ADMIN_CLEAR_INVENTORY', { targetUid: userId, adminUid: uid });
    showToast(`Đã xóa hết túi đồ của ${u.name}`, 'success');
    return;
  }

  if (action.startsWith('+')) {
    const itemId = Number(action.slice(1));
    const item = shopItems.find(it => it.id === itemId);
    if (!item) {
      showToast('ID vật phẩm không hợp lệ!', 'error');
      return;
    }
    users[idx].inventory = users[idx].inventory || [];
    users[idx].inventory.push({
      itemId: item.id,
      name: item.name,
      icon: item.icon,
      purchasedAt: new Date().toISOString(),
    });
    saveUsersDB(users);
    renderAdminUsers();
    DB.log('ADMIN_ADD_ITEM', { targetUid: userId, itemName: item.name, adminUid: uid });
    showToast(`Đã thêm ${item.name} vào túi ${u.name}`, 'success');
  } else if (action.startsWith('-')) {
    const itemIdx = Number(action.slice(1));
    if (isNaN(itemIdx) || !users[idx].inventory || !users[idx].inventory[itemIdx]) {
      showToast('Index vật phẩm không hợp lệ!', 'error');
      return;
    }
    const removed = users[idx].inventory.splice(itemIdx, 1)[0];
    saveUsersDB(users);
    renderAdminUsers();
    DB.log('ADMIN_REMOVE_ITEM', { targetUid: userId, itemName: removed.name, adminUid: uid });
    showToast(`Đã xóa ${removed.name} khỏi túi ${u.name}`, 'success');
  }
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
  DB.log('ADMIN_TOGGLE_BAN', { targetUid: userId, banned: u.banned, adminUid: uid });
  showToast(`${u.name} đã ${u.banned ? 'bị BAN' : 'được Unban'}`, u.banned ? 'warning' : 'success');
  sendBotMessage(u.uid, `${u.banned ? '🚫 Tài khoản của bạn đã bị khóa!' : '✅ Tài khoản của bạn đã được mở khóa!'}`);
}

function adminNotifyUser(userId) {
  const u = adminFindUser(userId);
  if (!u) return;
  const msg = prompt(`Gửi thông báo đến ${u.name} (UID: ${u.uid}):`);
  if (!msg || !msg.trim()) return;
  sendBotMessage(u.uid, `📢 Thông báo từ Admin:\n${msg}`);
  DB.log('ADMIN_NOTIFY_USER', { targetUid: userId, message: msg, adminUid: uid });
  showToast(`Đã gửi thông báo đến ${u.name}`, 'success');
}

function adminDeleteUser(userId) {
  const u = adminFindUser(userId);
  if (!u) return;
  if (!confirm(`⚠️ XÓA TÀI KHOẢN ${u.name} (UID: ${userId})?\nHành động này không thể hoàn tác!`)) return;

  let users = getUsersDB();
  users = users.filter(x => x.uid !== userId);
  saveUsersDB(users);

  DB.log('ADMIN_DELETE_USER', { targetUid: userId, userName: u.name, adminUid: uid });
  renderAdminUsers();
  showToast(`Đã xóa tài khoản ${u.name}`, 'success');
}

/* ==================== USER EDIT MODAL (FULL JSON EDITOR) ==================== */
function openUserEditModal(userId) {
  const u = adminFindUser(userId);
  if (!u) return;
  currentEditUserId = userId;

  const modal = document.getElementById('userEditModal');
  const content = document.getElementById('userEditContent');

  content.innerHTML = `
    <div style="margin-bottom:12px;">
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:4px;">UID: ${u.uid}</div>
      <div style="font-size:14px;font-weight:800;color:var(--text-primary);">${u.name || 'Unknown'}</div>
    </div>

    <div class="adm-field">
      <label class="admin-label">Tên hiển thị</label>
      <input id="edit-name" class="admin-input" value="${escapeHtml(u.name || '')}">
    </div>
    <div class="adm-field">
      <label class="admin-label">Username</label>
      <input id="edit-handle" class="admin-input" value="${escapeHtml(u.handle || '')}">
    </div>
    <div class="adm-field">
      <label class="admin-label">Số dư Quặng</label>
      <input id="edit-balance" class="admin-input" type="number" value="${u.balance || 0}">
    </div>
    <div class="adm-field">
      <label class="admin-label">Điểm</label>
      <input id="edit-points" class="admin-input" type="number" value="${u.points || 0}">
    </div>
    <div class="adm-field">
      <label class="admin-label">Cấp độ</label>
      <input id="edit-level" class="admin-input" type="number" value="${u.level || 0}">
    </div>
    <div class="adm-field">
      <label class="admin-label">XP</label>
      <input id="edit-xp" class="admin-input" type="number" value="${u.xp || 0}">
    </div>
    <div class="adm-field">
      <label class="admin-label">XP Cần</label>
      <input id="edit-xpNeeded" class="admin-input" type="number" value="${u.xpNeeded || 120}">
    </div>
    <div class="adm-field">
      <label class="admin-label">Mảnh VQMM</label>
      <input id="edit-fragments" class="admin-input" type="number" value="${u.fragments || 0}">
    </div>
    <div class="adm-field">
      <label class="admin-label">Vé quay</label>
      <input id="edit-tickets" class="admin-input" type="number" value="${u.tickets || 0}">
    </div>
    <div class="adm-field">
      <label class="admin-label">Đã rút</label>
      <input id="edit-withdrawn" class="admin-input" type="number" value="${u.withdrawn || 0}">
    </div>
    <div class="adm-field">
      <label class="admin-label">Số ref</label>
      <input id="edit-referralCount" class="admin-input" type="number" value="${u.referralCount || 0}">
    </div>
    <div class="adm-field">
      <label class="admin-label">Banned</label>
      <select id="edit-banned" class="admin-select">
        <option value="false" ${!u.banned ? 'selected' : ''}>Không</option>
        <option value="true" ${u.banned ? 'selected' : ''}>Có</option>
      </select>
    </div>
    <div class="adm-field">
      <label class="admin-label">Raw JSON (nâng cao)</label>
      <textarea id="edit-raw" class="admin-textarea" rows="4">${escapeHtml(JSON.stringify(u, null, 2))}</textarea>
    </div>
    <div style="display:flex;gap:8px;margin-top:12px;">
      <button class="admin-btn" onclick="saveUserEditModal()" style="flex:1;">💾 LƯU THAY ĐỔI</button>
      <button class="admin-btn admin-btn-danger" onclick="closeUserEditModal()" style="flex:1;">❌ HỦY</button>
    </div>
  `;

  modal.classList.remove('hidden');
}

function closeUserEditModal() {
  document.getElementById('userEditModal').classList.add('hidden');
  currentEditUserId = null;
}

function saveUserEditModal() {
  if (!currentEditUserId) return;

  const users = getUsersDB();
  const idx = users.findIndex(x => x.uid === currentEditUserId);
  if (idx === -1) return;

  const rawJson = document.getElementById('edit-raw').value.trim();
  try {
    const parsed = JSON.parse(rawJson);
    users[idx] = { ...users[idx], ...parsed, uid: currentEditUserId };
  } catch (e) {
    users[idx].name = document.getElementById('edit-name').value;
    users[idx].handle = document.getElementById('edit-handle').value;
    users[idx].balance = Number(document.getElementById('edit-balance').value) || 0;
    users[idx].points = Number(document.getElementById('edit-points').value) || 0;
    users[idx].level = Number(document.getElementById('edit-level').value) || 0;
    users[idx].xp = Number(document.getElementById('edit-xp').value) || 0;
    users[idx].xpNeeded = Number(document.getElementById('edit-xpNeeded').value) || 120;
    users[idx].fragments = Number(document.getElementById('edit-fragments').value) || 0;
    users[idx].tickets = Number(document.getElementById('edit-tickets').value) || 0;
    users[idx].withdrawn = Number(document.getElementById('edit-withdrawn').value) || 0;
    users[idx].referralCount = Number(document.getElementById('edit-referralCount').value) || 0;
    users[idx].banned = document.getElementById('edit-banned').value === 'true';
  }

  saveUsersDB(users);

  if (currentEditUserId === uid) {
    loadUserState(users[idx]);
    updateAllDisplays();
  }

  DB.log('ADMIN_EDIT_USER_MODAL', { targetUid: currentEditUserId, adminUid: uid });
  showToast('Đã lưu thay đổi!', 'success');
  closeUserEditModal();
  renderAdminUsers();
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/* ==================== 18. ADMIN: WITHDRAW APPROVAL ==================== */
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
    list.innerHTML = '<div class="adm-item-sub" style="text-align:center;padding:20px">Chưa có lệnh rút nào.</div>';
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
        <span class="adm-item-name">Lệnh #${r.id} · ${r.userName}</span>
        <span class="adm-badge ${r.status}">${r.status === 'pending' ? 'CHỜ DUYỆT' : r.status === 'approved' ? 'ĐÃ DUYỆT' : 'TỪ CHỐI'}</span>
      </div>
      <div class="adm-item-sub">
        UID: ${r.uid}<br>
        🏦 ${r.bankName} · ${r.bankOwner}<br>
        💳 STK: ${r.bankNumber}<br>
        💰 Quặng: ${formatInt(r.amount)} · Phí: ${formatInt(r.fee)}<br>
        💵 Nhận: ${formatInt(r.vnd)} VND<br>
        ⏰ ${r.createdAt}${r.rejectedAt ? '<br>❌ Từ chối: ' + r.rejectedAt : ''}${r.rejectReason ? ' (' + r.rejectReason + ')' : ''}${r.approvedAt ? '<br>✅ Duyệt: ' + r.approvedAt : ''}
      </div>
      ${r.status === 'pending' ? `
        <div class="adm-item-actions">
          <button class="admin-btn-sm green" onclick="approveWithdraw(${r.id})">✅ DUYỆT</button>
          <button class="admin-btn-sm red" onclick="rejectWithdraw(${r.id})">❌ TỪ CHỐI</button>
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
    `✅ LỆNH RÚT ĐÃ DUYỆT #${req.id}\n` +
    `👤 ${req.userName}${req.userHandle ? ' (' + req.userHandle + ')' : ''}\n` +
    `🆔 UID: ${req.uid}\n` +
    `🏦 ${req.bankName} - ${req.bankOwner}\n` +
    `💳 STK: ${req.bankNumber}\n` +
    `💰 Số quặng: ${formatInt(req.amount)}\n` +
    `📉 Phí (${FEE_PERCENT}%): ${formatInt(req.fee)}\n` +
    `💵 Số tiền nhận: ${formatInt(req.vnd)} VND (30 Quặng = 1đ)\n` +
    `⏰ Duyệt lúc: ${req.approvedAt}\n` +
    `━━━━━━━━━━━━━━━\n` +
    `👉 Tham gia nhóm: ${GROUP_LINK}`;

  sendBotMessage(GROUP_CHAT_ID, groupMsg);

  sendBotMessage(
    req.uid,
    `✅ Lệnh rút #${req.id} đã được DUYỆT!\n` +
    `💵 Số tiền nhận: ${formatInt(req.vnd)} VND (30 Quặng = 1đ)\n` +
    `⏰ Lúc: ${req.approvedAt}\n` +
    `👉 Tham gia nhóm để nhận tin tức: ${GROUP_LINK}`
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

  DB.log('ADMIN_APPROVE_WITHDRAW', { reqId, uid: req.uid, amount: req.amount, adminUid: uid });
  renderAdminWithdrawals();
  renderAdminUsers();
  showToast(`Đã duyệt lệnh #${req.id} và gửi lên nhóm!`, 'success');
  hapticFeedback('success');
}

function rejectWithdraw(reqId) {
  const req = withdrawRequests.find(r => r.id === reqId);
  if (!req || req.status !== 'pending') return;
  const reason = prompt('Lý do từ chối (để trống nếu không có):');
  if (reason === null) return;

  req.status = 'rejected';
  req.rejectedAt = new Date().toLocaleString('vi-VN');
  req.rejectReason = reason || 'Không có lý do';
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
    `❌ Lệnh rút #${req.id} bị TỪ CHỐI!\n` +
    `Lý do: ${req.rejectReason}\n` +
    `💰 Đã hoàn trả ${formatInt(req.amount)} Quặng vào tài khoản.\n` +
    `⏰ Lúc: ${req.rejectedAt}`
  );

  DB.log('ADMIN_REJECT_WITHDRAW', { reqId, uid: req.uid, reason: req.rejectReason, adminUid: uid });
  renderAdminWithdrawals();
  renderAdminUsers();
  showToast(`Đã từ chối lệnh #${req.id} và hoàn tiền!`, 'success');
  hapticFeedback('success');
}

/* ==================== 19. ADMIN: NOTIFICATIONS ==================== */
let adminNotifications = [];

function loadAdminNotifications() {
  adminNotifications = DB.get('notifications') || [];
}

function saveAdminNotifications() {
  DB.set('notifications', adminNotifications);
}

loadAdminNotifications();

function sendNotify() {
  const title = document.getElementById('admNotifyTitle').value.trim();
  const body = document.getElementById('admNotifyBody').value.trim();
  const type = document.getElementById('admNotifyType').value;

  if (!title || !body) {
    showToast('Vui lòng nhập tiêu đề và nội dung!', 'warning');
    return;
  }

  const notif = {
    id: adminNotifications.length + 1,
    title: title,
    body: body,
    type: type,
    createdAt: new Date().toLocaleString('vi-VN'),
    sentBy: uid,
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

  DB.log('ADMIN_SEND_NOTIFY', { title, type, recipients: users.length, adminUid: uid });
  renderAdminNotifications();
  showToast('Đã gửi thông báo đến tất cả người dùng!', 'success');
  hapticFeedback('success');
}

function renderAdminNotifications() {
  const list = document.getElementById('admNotifyList');
  if (adminNotifications.length === 0) {
    list.innerHTML = '<div class="adm-item-sub" style="text-align:center;padding:20px">Chưa có thông báo nào.</div>';
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
        ⏰ ${n.createdAt}${n.sentBy ? ' · Gửi bởi: ' + n.sentBy : ''}
      </div>
    </div>
  `).join('');
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

/* ==================== 20. ADMIN: GIFTCODE ==================== */
let adminGiftcodes = [];

function loadAdminGiftcodes() {
  adminGiftcodes = DB.get('giftcodes') || [];
}

function saveAdminGiftcodes() {
  DB.set('giftcodes', adminGiftcodes);
}

loadAdminGiftcodes();

function createGiftcode() {
  const code = document.getElementById('admGiftCode').value.trim().toUpperCase();
  const reward = Number(document.getElementById('admGiftReward').value);
  const limit = Number(document.getElementById('admGiftLimit').value);

  if (!code || !reward || !limit) {
    showToast('Vui lòng nhập đầy đủ thông tin!', 'warning');
    return;
  }
  if (reward <= 0 || limit <= 0) {
    showToast('Phần thưởng và số lượt phải > 0!', 'warning');
    return;
  }
  if (adminGiftcodes.find(g => g.code === code)) {
    showToast('Giftcode đã tồn tại!', 'warning');
    return;
  }

  const gift = {
    code: code,
    reward: reward,
    limit: limit,
    used: 0,
    claimedBy: [],
    createdAt: new Date().toLocaleString('vi-VN'),
    createdBy: uid,
  };
  adminGiftcodes.unshift(gift);
  saveAdminGiftcodes();

  document.getElementById('admGiftCode').value = '';
  document.getElementById('admGiftReward').value = '';
  document.getElementById('admGiftLimit').value = '';

  DB.log('ADMIN_CREATE_GIFTCODE', { code, reward, limit, adminUid: uid });
  renderAdminGiftcodes();
  showToast(`Đã tạo Giftcode: ${code}`, 'success');
  hapticFeedback('success');
}

function renderAdminGiftcodes() {
  const list = document.getElementById('admGiftList');
  if (adminGiftcodes.length === 0) {
    list.innerHTML = '<div class="adm-item-sub" style="text-align:center;padding:20px">Chưa có Giftcode nào.</div>';
    return;
  }
  list.innerHTML = adminGiftcodes.map(g => {
    const exhausted = g.used >= g.limit;
    return `
      <div class="adm-item">
        <div class="adm-item-head">
          <span class="adm-item-name">${g.code}</span>
          <span class="adm-badge ${exhausted ? 'used' : 'active'}">${exhausted ? 'HẾT' : 'HOẠT ĐỘNG'}</span>
        </div>
        <div class="adm-item-sub">
          Phần thưởng: ${formatInt(g.reward)} Quặng<br>
          Đã dùng: ${g.used}/${g.limit}<br>
          ⏰ ${g.createdAt}${g.createdBy ? ' · Tạo bởi: ' + g.createdBy : ''}
        </div>
        <div class="adm-item-actions">
          <button class="admin-btn-sm blue" onclick="copyGiftcode('${g.code}')">Copy mã</button>
          <button class="admin-btn-sm gray" onclick="broadcastGiftcode('${g.code}')">Gửi tất cả</button>
          <button class="admin-btn-sm red" onclick="deleteGiftcode('${g.code}')">Xóa</button>
        </div>
      </div>
    `;
  }).join('');
}

function copyGiftcode(code) {
  hapticFeedback('light');
  if (navigator.clipboard) {
    navigator.clipboard.writeText(code).then(() => showToast(`Đã copy: ${code}`, 'success'));
  } else {
    showToast(`Mã: ${code}`, 'default');
  }
}

function broadcastGiftcode(code) {
  const gift = adminGiftcodes.find(g => g.code === code);
  if (!gift) return;
  const users = getUsersDB();
  users.forEach(u => {
    if (u.uid !== uid) {
      sendBotMessage(u.uid, `🎁 Giftcode mới: ${code}\nPhần thưởng: ${formatInt(gift.reward)} Quặng\nSố lượt: ${gift.limit - gift.used} còn lại\nVào ứng dụng > Hồ Sơ > Nhập Giftcode!`);
    }
  });
  DB.log('ADMIN_BROADCAST_GIFTCODE', { code, recipients: users.length, adminUid: uid });
  showToast(`Đã gửi Giftcode ${code} đến tất cả!`, 'success');
  hapticFeedback('success');
}

function deleteGiftcode(code) {
  if (!confirm(`Xóa Giftcode ${code}?`)) return;
  adminGiftcodes = adminGiftcodes.filter(g => g.code !== code);
  saveAdminGiftcodes();
  DB.log('ADMIN_DELETE_GIFTCODE', { code, adminUid: uid });
  renderAdminGiftcodes();
  showToast(`Đã xóa ${code}`, 'success');
}

/* ==================== 21. ADMIN: CONFIG ==================== */
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

  DB.set('config', { miningRate, EXCHANGE_RATE, FEE_PERCENT, MIN_WITHDRAW, MAX_WITHDRAW });
  DB.log('ADMIN_SAVE_CONFIG', { miningRate, EXCHANGE_RATE, FEE_PERCENT, MIN_WITHDRAW, MAX_WITHDRAW, adminUid: uid });
  updateRateDisplay();
  showToast('Đã lưu cấu hình hệ thống!', 'success');
  hapticFeedback('success');
}

function adjustJackpot() {
  const delta = Number(document.getElementById('admCfgJackpot').value);
  if (isNaN(delta) || delta === 0) {
    showToast('Nhập số Quặng hợp lệ (âm để trừ)!', 'warning');
    return;
  }
  const jackEl = document.getElementById('jackpotValue');
  const current = Number(String(jackEl.textContent).replace(/,/g, '')) || 1331716;
  const newVal = Math.max(0, current + delta);
  jackEl.textContent = formatInt(newVal);
  document.getElementById('admCfgJackpot').value = '';
  DB.log('ADMIN_ADJUST_JACKPOT', { delta, oldValue: current, newValue: newVal, adminUid: uid });
  showToast(`Jackpot ${delta >= 0 ? '+' : ''}${formatInt(delta)} → ${formatInt(newVal)}`, 'success');
  hapticFeedback('success');
}

/* ==================== 22. ADMIN: DATABASE MANAGEMENT ==================== */
function updateDBStats() {
  const users = getUsersDB();
  const txs = withdrawRequests.length;
  document.getElementById('dbTotalUsers').textContent = users.length;
  document.getElementById('dbTotalTx').textContent = txs;

  const rawData = DB.getAll();
  document.getElementById('dbRawViewer').innerHTML = `
    <div style="background:var(--bg-secondary);border-radius:8px;padding:10px;overflow:auto;">
      <pre style="margin:0;white-space:pre-wrap;word-break:break-all;color:var(--text-primary);">${escapeHtml(JSON.stringify(rawData, null, 2))}</pre>
    </div>
  `;
}

function dbExportJSON() {
  const data = DB.export();
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `vuakhoangsan_backup_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  DB.log('DB_EXPORT', { adminUid: uid });
  showToast('Đã export database!', 'success');
  hapticFeedback('success');
}

function dbImportJSON() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const success = DB.import(event.target.result);
        if (success) {
          DB.log('DB_IMPORT', { adminUid: uid });
          showToast('Import database thành công!', 'success');
          refreshAdminAll();
          updateAllDisplays();
          hapticFeedback('success');
        } else {
          showToast('Import thất bại! JSON không hợp lệ.', 'error');
          hapticFeedback('error');
        }
      } catch (err) {
        showToast('Lỗi đọc file: ' + err.message, 'error');
        hapticFeedback('error');
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

function dbBackup() {
  const timestamp = DB.backup();
  DB.log('DB_BACKUP', { timestamp, adminUid: uid });
  showToast(`Đã backup database! (${timestamp})`, 'success');
  hapticFeedback('success');
}

function dbRestore() {
  const backups = DB.get('backups') || [];
  if (backups.length === 0) {
    showToast('Không có backup nào!', 'warning');
    return;
  }

  const list = backups.map((b, i) => `${i}: ${b.timestamp}`).join('\n');
  const idx = prompt(`Chọn backup để restore:\n${list}\n\nNhập số:`);
  if (idx === null) return;

  const index = Number(idx);
  if (isNaN(index) || index < 0 || index >= backups.length) {
    showToast('Index không hợp lệ!', 'error');
    return;
  }

  if (!confirm(`⚠️ RESTORE sẽ ghi đè toàn bộ database hiện tại!\nBackup: ${backups[index].timestamp}\n\nTiếp tục?`)) return;

  const success = DB.restore(index);
  if (success) {
    DB.log('DB_RESTORE', { index, timestamp: backups[index].timestamp, adminUid: uid });
    showToast('Restore database thành công!', 'success');
    refreshAdminAll();
    updateAllDisplays();
    hapticFeedback('success');
  } else {
    showToast('Restore thất bại!', 'error');
    hapticFeedback('error');
  }
}

function dbReset() {
  if (!confirm('⚠️⚠️⚠️ BẠN CÓ CHẮC CHẮN?\n\nHành động này sẽ XÓA TOÀN BỘ DATABASE!\nTất cả user, giao dịch, cấu hình sẽ biến mất!\n\nNhập "DELETE" để xác nhận:')) return;

  const confirmText = prompt('Nhập "DELETE" để xác nhận xóa toàn bộ database:');
  if (confirmText !== 'DELETE') {
    showToast('Hủy thao tác!', 'default');
    return;
  }

  DB.log('DB_RESET', { adminUid: uid });
  DB.clear();
  localStorage.removeItem('vuakhoangsan_users');
  localStorage.removeItem('vuakhoangsan_withdrawals');
  localStorage.removeItem('vuakhoangsan_notifications');
  localStorage.removeItem('vuakhoangsan_giftcodes');
  localStorage.removeItem('vuakhoangsan_config');
  localStorage.removeItem('vuakhoangsan_logs');
  localStorage.removeItem('vuakhoangsan_backups');

  withdrawRequests = [];
  withdrawIdCounter = 1;
  adminNotifications = [];
  adminGiftcodes = [];

  showToast('🗑 Đã RESET toàn bộ database!', 'success');
  refreshAdminAll();
  updateAllDisplays();
  hapticFeedback('success');
}

function dbLoadUserJSON() {
  const uidInput = prompt('Nhập UID user cần load:');
  if (!uidInput) return;

  const u = adminFindUser(uidInput.trim());
  if (!u) {
    document.getElementById('dbUserEditMsg').textContent = 'Không tìm thấy user!';
    document.getElementById('dbUserEditMsg').className = 'admin-msg error';
    return;
  }

  document.getElementById('dbUserEdit').value = JSON.stringify(u, null, 2);
  document.getElementById('dbUserEditMsg').textContent = `Loaded: ${u.name} (${u.uid})`;
  document.getElementById('dbUserEditMsg').className = 'admin-msg success';
}

function dbSaveUserJSON() {
  const raw = document.getElementById('dbUserEdit').value.trim();
  if (!raw) {
    document.getElementById('dbUserEditMsg').textContent = 'Không có dữ liệu!';
    document.getElementById('dbUserEditMsg').className = 'admin-msg error';
    return;
  }

  try {
    const parsed = JSON.parse(raw);
    if (!parsed.uid) {
      document.getElementById('dbUserEditMsg').textContent = 'Thiếu trường uid!';
      document.getElementById('dbUserEditMsg').className = 'admin-msg error';
      return;
    }

    const users = getUsersDB();
    const idx = users.findIndex(u => u.uid === parsed.uid);
    if (idx === -1) {
      users.push(parsed);
    } else {
      users[idx] = parsed;
    }
    saveUsersDB(users);

    DB.log('DB_SAVE_USER_JSON', { uid: parsed.uid, adminUid: uid });
    document.getElementById('dbUserEditMsg').textContent = `Đã lưu user ${parsed.uid}!`;
    document.getElementById('dbUserEditMsg').className = 'admin-msg success';
    renderAdminUsers();

    if (parsed.uid === uid) {
      loadUserState(parsed);
      updateAllDisplays();
    }
  } catch (e) {
    document.getElementById('dbUserEditMsg').textContent = 'JSON không hợp lệ: ' + e.message;
    document.getElementById('dbUserEditMsg').className = 'admin-msg error';
  }
}

function dbDeleteUserJSON() {
  const raw = document.getElementById('dbUserEdit').value.trim();
  if (!raw) return;

  try {
    const parsed = JSON.parse(raw);
    if (!parsed.uid) return;

    if (!confirm(`Xóa user ${parsed.name || parsed.uid}?`)) return;

    let users = getUsersDB();
    users = users.filter(u => u.uid !== parsed.uid);
    saveUsersDB(users);

    DB.log('DB_DELETE_USER_JSON', { uid: parsed.uid, adminUid: uid });
    document.getElementById('dbUserEdit').value = '';
    document.getElementById('dbUserEditMsg').textContent = `Đã xóa ${parsed.uid}`;
    document.getElementById('dbUserEditMsg').className = 'admin-msg success';
    renderAdminUsers();
  } catch (e) {
    document.getElementById('dbUserEditMsg').textContent = 'Lỗi: ' + e.message;
    document.getElementById('dbUserEditMsg').className = 'admin-msg error';
  }
}

function dbBulkAddOre() {
  const amount = Number(document.getElementById('dbBulkAmount').value);
  if (isNaN(amount) || amount === 0) {
    showToast('Nhập số Quặng hợp lệ!', 'warning');
    return;
  }

  const users = getUsersDB();
  users.forEach(u => {
    u.balance = (u.balance || 0) + amount;
  });
  saveUsersDB(users);

  DB.log('DB_BULK_ADD_ORE', { amount, affectedUsers: users.length, adminUid: uid });
  showToast(`Đã ${amount >= 0 ? 'cộng' : 'trừ'} ${formatInt(Math.abs(amount))} Quặng cho ${users.length} user!`, 'success');
  renderAdminUsers();

  if (amount !== 0) {
    const current = getCurrentUser();
    if (current) {
      balance = current.balance + amount;
      updateBalanceDisplay();
    }
  }
  hapticFeedback('success');
}

function dbBulkAddPoints() {
  const amount = Number(document.getElementById('dbBulkPoints').value);
  if (isNaN(amount) || amount === 0) {
    showToast('Nhập số Điểm hợp lệ!', 'warning');
    return;
  }

  const users = getUsersDB();
  users.forEach(u => {
    u.points = (u.points || 0) + amount;
  });
  saveUsersDB(users);

  DB.log('DB_BULK_ADD_POINTS', { amount, affectedUsers: users.length, adminUid: uid });
  showToast(`Đã ${amount >= 0 ? 'cộng' : 'trừ'} ${Math.abs(amount)} Điểm cho ${users.length} user!`, 'success');
  renderAdminUsers();
  hapticFeedback('success');
}

function dbBulkBan() {
  const cond = document.getElementById('dbBulkBanCond').value;
  let users = getUsersDB();
  let affected = 0;

  users.forEach(u => {
    let shouldBan = false;
    if (cond === 'all') shouldBan = true;
    else if (cond === 'negative') shouldBan = (u.balance || 0) < 0;
    else if (cond === 'inactive') {
      const lastActive = u.lastActive ? new Date(u.lastActive) : null;
      if (lastActive) {
        const daysInactive = (Date.now() - lastActive.getTime()) / (1000 * 60 * 60 * 24);
        shouldBan = daysInactive > 7;
      }
    }

    if (shouldBan) {
      u.banned = true;
      affected++;
    }
  });

  saveUsersDB(users);
  DB.log('DB_BULK_BAN', { condition: cond, affectedUsers: affected, adminUid: uid });
  showToast(`Đã BAN ${affected} user!`, 'success');
  renderAdminUsers();
  hapticFeedback('success');
}

function dbBulkUnban() {
  const cond = document.getElementById('dbBulkBanCond').value;
  let users = getUsersDB();
  let affected = 0;

  users.forEach(u => {
    let shouldUnban = false;
    if (cond === 'all') shouldUnban = true;
    else if (cond === 'negative') shouldUnban = (u.balance || 0) < 0;
    else if (cond === 'inactive') {
      const lastActive = u.lastActive ? new Date(u.lastActive) : null;
      if (lastActive) {
        const daysInactive = (Date.now() - lastActive.getTime()) / (1000 * 60 * 60 * 24);
        shouldUnban = daysInactive > 7;
      }
    }

    if (shouldUnban) {
      u.banned = false;
      affected++;
    }
  });

  saveUsersDB(users);
  DB.log('DB_BULK_UNBAN', { condition: cond, affectedUsers: affected, adminUid: uid });
  showToast(`Đã UNBAN ${affected} user!`, 'success');
  renderAdminUsers();
  hapticFeedback('success');
}

/* ==================== 23. ADMIN: LOGS ==================== */
function renderLogs() {
  const list = document.getElementById('admLogsList');
  const logs = DB.get('logs') || [];

  if (logs.length === 0) {
    list.innerHTML = '<div class="adm-item-sub" style="text-align:center;padding:20px">Chưa có log nào.</div>';
    return;
  }

  list.innerHTML = logs.slice(0, 100).map(log => `
    <div class="adm-item" style="padding:8px 12px;">
      <div style="font-size:10px;color:var(--text-muted);">${log.timestamp} · ID: ${log.id}</div>
      <div style="font-size:12px;font-weight:700;color:var(--text-primary);margin-top:2px;">${escapeHtml(log.action)}</div>
      <div style="font-size:11px;color:var(--text-secondary);white-space:pre-wrap;">${escapeHtml(JSON.stringify(log.details, null, 2))}</div>
    </div>
  `).join('');
}

function logsClear() {
  if (!confirm('Xóa tất cả logs?')) return;
  DB.set('logs', []);
  renderLogs();
  showToast('Đã xóa logs!', 'success');
  hapticFeedback('success');
}

function logsExport() {
  const logs = DB.get('logs') || [];
  const data = JSON.stringify(logs, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `vuakhoangsan_logs_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Đã export logs!', 'success');
  hapticFeedback('success');
}

/* ==================== 24. START BOT LINK ==================== */
function checkStartParam() {
  const urlParams = new URLSearchParams(window.location.search);
  const startParam = urlParams.get('start') || urlParams.get('startapp');
  if (startParam) {
    setTimeout(() => {
      showNotifyBanner({
        title: 'Chào mừng bạn!',
        body: `Bạn đã được mời tham gia Vua Đào Quặng. Tham gia nhóm để nhận tin tức và hỗ trợ: ${GROUP_LINK}`,
        type: 'info',
      });
    }, 2000);
  }
}
checkStartParam();

/* ==================== 25. LOAD SAVED CONFIG ==================== */
(function loadSavedConfig() {
  const saved = DB.get('config');
  if (saved) {
    if (saved.miningRate > 0) miningRate = saved.miningRate;
    if (saved.EXCHANGE_RATE > 0) EXCHANGE_RATE = saved.EXCHANGE_RATE;
    if (saved.FEE_PERCENT >= 0) FEE_PERCENT = saved.FEE_PERCENT;
    if (saved.MIN_WITHDRAW > 0) MIN_WITHDRAW = saved.MIN_WITHDRAW;
    if (saved.MAX_WITHDRAW > 0) MAX_WITHDRAW = saved.MAX_WITHDRAW;
  }
})();

/* ==================== 26. AUTO-SAVE MINING STATE ==================== */
window.addEventListener('beforeunload', () => {
  if (isMining) {
    toggleMining();
  }
  const user = getCurrentUser();
  if (user) {
    user.lastActive = new Date().toISOString();
    const users = getUsersDB();
    const idx = users.findIndex(u => u.uid === uid);
    if (idx !== -1) {
      users[idx] = user;
      saveUsersDB(users);
    }
  }
});

/* ==================== 27. PERIODIC SYNC ==================== */
setInterval(() => {
  const user = getCurrentUser();
  if (user) {
    user.lastActive = new Date().toISOString();
    const users = getUsersDB();
    const idx = users.findIndex(u => u.uid === uid);
    if (idx !== -1) {
      users[idx] = user;
      saveUsersDB(users);
    }
  }

  // Sync to Firebase if online
  if (isOnline && DB.userRef) {
    DB.syncToFirebase('users', getUsersDB());
  }
}, 30000);

/* ==================== 28. CONSOLE SIGNATURE ==================== */
console.log('%c[TUANX3000] Vua Đào Quặng v3.0 — UPGRADED', 'color:#0ea6e9;font-size:14px;font-weight:800;');
console.log('%c🔥 Firebase Real-time: ACTIVE | 🛡️ Anti-Cheat: ENABLED | 🌙 Dark Mode: READY | 📳 Haptics: ENABLED', 'color:#16a34a;font-size:11px;');
console.log('%c⚠️ WARNING: This is a fictional movie prop. Not for real-world use.', 'color:#ef4444;font-size:10px;font-style:italic;');

/* ==================== 29. EXPORT GLOBALS FOR INLINE HANDLERS ==================== */
window.toggleTheme = toggleTheme;
window.toggleMining = toggleMining;
window.doCheckin = doCheckin;
window.watchAd = watchAd;
window.buyMachine = buyMachine;
window.exchangeTicket = exchangeTicket;
window.spinWheel = spinWheel;
window.copyRefLink = copyRefLink;
window.buyItem = buyItem;
window.claimGift = claimGift;
window.submitWithdraw = submitWithdraw;
window.showTab = showTab;
window.showSubTab = showSubTab;
window.openInventory = openInventory;
window.adminTap = adminTap;
window.openAdmin = openAdmin;
window.closeAdmin = closeAdmin;
window.tryAdminLogin = tryAdminLogin;
window.admSub = admSub;
window.adminEditBalance = adminEditBalance;
window.adminEditPoints = adminEditPoints;
window.adminEditLevel = adminEditLevel;
window.adminEditXP = adminEditXP;
window.adminEditMachines = adminEditMachines;
window.adminEditInventory = adminEditInventory;
window.adminToggleBan = adminToggleBan;
window.adminNotifyUser = adminNotifyUser;
window.adminDeleteUser = adminDeleteUser;
window.openUserEditModal = openUserEditModal;
window.closeUserEditModal = closeUserEditModal;
window.saveUserEditModal = saveUserEditModal;
window.approveWithdraw = approveWithdraw;
window.rejectWithdraw = rejectWithdraw;
window.sendNotify = sendNotify;
window.createGiftcode = createGiftcode;
window.copyGiftcode = copyGiftcode;
window.broadcastGiftcode = broadcastGiftcode;
window.deleteGiftcode = deleteGiftcode;
window.saveConfig = saveConfig;
window.adjustJackpot = adjustJackpot;
window.dbExportJSON = dbExportJSON;
window.dbImportJSON = dbImportJSON;
window.dbBackup = dbBackup;
window.dbRestore = dbRestore;
window.dbReset = dbReset;
window.dbLoadUserJSON = dbLoadUserJSON;
window.dbSaveUserJSON = dbSaveUserJSON;
window.dbDeleteUserJSON = dbDeleteUserJSON;
window.dbBulkAddOre = dbBulkAddOre;
window.dbBulkAddPoints = dbBulkAddPoints;
window.dbBulkBan = dbBulkBan;
window.dbBulkUnban = dbBulkUnban;
window.logsClear = logsClear;
window.logsExport = logsExport;
window.closeNotifyBanner = closeNotifyBanner;
