// ==========================================
// CYBER OVERDRIVE (GAME 02) - ยิงถล่มจักรกล พุ่งทะลวง บอสไฟต์ และจัดอันดับ
// ==========================================

const STORAGE_KEY_USERS = 'sky_aim_jumper_users_v1';
const STORAGE_KEY_SESSION = 'sky_aim_jumper_current_user';

// --- DOM Elements ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const authModal = document.getElementById('authModal');
const startModal = document.getElementById('startModal');
const gameOverModal = document.getElementById('gameOverModal');

const authForm = document.getElementById('authForm');
const usernameInput = document.getElementById('usernameInput');
const passwordInput = document.getElementById('passwordInput');
const authError = document.getElementById('authError');

const userPanel = document.getElementById('userPanel');
const currentUsernameEl = document.getElementById('currentUsername');
const userBestScoreEl = document.getElementById('userBestScore');
const userRankEl = document.getElementById('userRank');
const logoutBtn = document.getElementById('logoutBtn');

const welcomeNameEl = document.getElementById('welcomeName');
const startGameBtn = document.getElementById('startGameBtn');
const restartGameBtn = document.getElementById('restartGameBtn');
const soundToggleBtn = document.getElementById('soundToggleBtn');
const aimModeBtn = document.getElementById('aimModeBtn');

const hpTextEl = document.getElementById('hpText');
const hpFillEl = document.getElementById('hpFill');
const ultTextEl = document.getElementById('ultText');
const ultFillEl = document.getElementById('ultFill');
const hudWaveEl = document.getElementById('hudWave');
const hudComboEl = document.getElementById('hudCombo');
const hudScoreEl = document.getElementById('hudScore');

const bossHudEl = document.getElementById('bossHud');
const bossNameEl = document.getElementById('bossName');
const bossHpFillEl = document.getElementById('bossHpFill');

const finalScoreEl = document.getElementById('finalScore');
const finalWaveEl = document.getElementById('finalWave');
const finalComboEl = document.getElementById('finalCombo');
const finalBestEl = document.getElementById('finalBest');
const newRecordBanner = document.getElementById('newRecordBanner');

const leaderboardListEl = document.getElementById('leaderboardList');
const totalPlayersBadge = document.getElementById('totalPlayersBadge');

// ==========================================
// 1. ระบบเสียงสังเคราะห์ (Web Audio API Synth SFX)
// ==========================================
let soundEnabled = true;
let audioCtx = null;

function initAudio() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

function playSfx(type) {
  if (!soundEnabled) return;
  initAudio();
  if (!audioCtx) return;

  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);

  if (type === 'shoot') {
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(140, now + 0.065);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);
    osc.start(now);
    osc.stop(now + 0.065);
  } else if (type === 'dash') {
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(680, now + 0.14);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    osc.start(now);
    osc.stop(now + 0.14);
  } else if (type === 'explode') {
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(28, now + 0.22);
    gain.gain.setValueAtTime(0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    osc.start(now);
    osc.stop(now + 0.22);
  } else if (type === 'powerup') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.setValueAtTime(640, now + 0.06);
    osc.frequency.setValueAtTime(880, now + 0.12);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    osc.start(now);
    osc.stop(now + 0.22);
  } else if (type === 'ult') {
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(620, now);
    osc.frequency.exponentialRampToValueAtTime(42, now + 0.55);
    gain.gain.setValueAtTime(0.24, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
    osc.start(now);
    osc.stop(now + 0.55);
  } else if (type === 'bossWarn') {
    osc.type = 'square';
    osc.frequency.setValueAtTime(240, now);
    osc.frequency.linearRampToValueAtTime(480, now + 0.25);
    osc.frequency.linearRampToValueAtTime(240, now + 0.5);
    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    osc.start(now);
    osc.stop(now + 0.5);
  }
}

soundToggleBtn.addEventListener('click', () => {
  soundEnabled = !soundEnabled;
  soundToggleBtn.textContent = soundEnabled ? '🔊' : '🔇';
});

// ==========================================
// 2. ระบบจัดการผู้เล่น & ตารางอันดับ (แยกคะแนนเกม 2 แต่ใช้ไอดีเดียวกันได้)
// ==========================================
let currentUser = null;

function loadUsers() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_USERS);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

function saveUsers(users) {
  localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(users));
  if (window.LanSync) {
    window.LanSync.pushToLan(users);
  }
}

function getSortedLeaderboardG2() {
  const users = loadUsers();
  return [...users].sort((a, b) => {
    const scoreA = a.bestScoreG2 || 0;
    const scoreB = b.bestScoreG2 || 0;
    if (scoreB !== scoreA) return scoreB - scoreA;
    return (a.updatedAtG2 || 0) - (b.updatedAtG2 || 0);
  });
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, (m) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[m]));
}

function renderLeaderboard() {
  const sorted = getSortedLeaderboardG2();
  totalPlayersBadge.textContent = `${sorted.length} คน`;

  if (sorted.length === 0) {
    leaderboardListEl.innerHTML = `<div class="empty-leaderboard">ยังไม่มีนักรบในตารางอันดับ<br/>มาประเดิมอันดับ 1 คนแรกเลย!</div>`;
    if (currentUser) userRankEl.textContent = '#-';
    return;
  }

  leaderboardListEl.innerHTML = '';
  sorted.forEach((u, index) => {
    const rank = index + 1;
    const bestG2 = u.bestScoreG2 || 0;
    const bestWave = u.bestWaveG2 || 1;
    const isMe = currentUser && u.username.toLowerCase() === currentUser.username.toLowerCase();

    const row = document.createElement('div');
    row.className = `rank-row rank-${rank} ${isMe ? 'current-user' : ''}`;

    let medal = rank;
    if (rank === 1) medal = '🥇';
    else if (rank === 2) medal = '🥈';
    else if (rank === 3) medal = '🥉';

    row.innerHTML = `
      <div class="rank-left">
        <div class="rank-badge">${medal}</div>
        <span class="rank-name">${escapeHtml(u.username)} ${isMe ? '(คุณ)' : ''}</span>
        <span class="rank-wave">W${bestWave}</span>
      </div>
      <span class="rank-score">${bestG2.toLocaleString()}</span>
    `;
    leaderboardListEl.appendChild(row);

    if (isMe) {
      userRankEl.textContent = `#${rank}`;
      userBestScoreEl.textContent = bestG2.toLocaleString();
    }
  });
}

function handleLoginOrRegister(username, password) {
  const cleanName = username.trim();
  const cleanPass = password.trim();

  if (!cleanName || !cleanPass) {
    showAuthError('กรุณากรอกทั้งชื่อผู้เล่นและรหัสผ่าน');
    return;
  }

  const users = loadUsers();
  const existingUser = users.find(
    (u) => u.username.toLowerCase() === cleanName.toLowerCase()
  );

  if (existingUser) {
    if (existingUser.password !== cleanPass) {
      showAuthError('❌ ชื่อนี้มีคนใช้แล้ว และรหัสผ่านไม่ถูกต้อง!');
      return;
    }
    if (typeof existingUser.bestScoreG2 !== 'number') existingUser.bestScoreG2 = 0;
    if (typeof existingUser.bestWaveG2 !== 'number') existingUser.bestWaveG2 = 1;
    currentUser = existingUser;
  } else {
    const newUser = {
      username: cleanName,
      password: cleanPass,
      bestScore: 0,
      bestScoreG2: 0,
      bestWaveG2: 1,
      updatedAt: Date.now(),
      updatedAtG2: Date.now()
    };
    users.push(newUser);
    saveUsers(users);
    currentUser = newUser;
  }

  localStorage.setItem(STORAGE_KEY_SESSION, currentUser.username);
  hideAuthError();
  onUserAuthenticated();
}

function showAuthError(msg) {
  authError.textContent = msg;
  authError.classList.remove('hidden');
}

function hideAuthError() {
  authError.textContent = '';
  authError.classList.add('hidden');
}

function onUserAuthenticated() {
  authModal.classList.add('hidden');
  userPanel.classList.remove('hidden');

  currentUsernameEl.textContent = currentUser.username;
  userBestScoreEl.textContent = (currentUser.bestScoreG2 || 0).toLocaleString();
  welcomeNameEl.textContent = currentUser.username;

  renderLeaderboard();
  showStartScreen();
}

function updateUserHighScoreG2(newScore, reachedWave) {
  if (!currentUser) return false;
  const users = loadUsers();
  const idx = users.findIndex(
    (u) => u.username.toLowerCase() === currentUser.username.toLowerCase()
  );
  if (idx === -1) return false;

  let isNewRecord = false;
  const prevBest = users[idx].bestScoreG2 || 0;
  if (newScore > prevBest) {
    users[idx].bestScoreG2 = newScore;
    users[idx].updatedAtG2 = Date.now();
    currentUser.bestScoreG2 = newScore;
    isNewRecord = true;
  }
  if (reachedWave > (users[idx].bestWaveG2 || 1)) {
    users[idx].bestWaveG2 = reachedWave;
    currentUser.bestWaveG2 = reachedWave;
  }
  saveUsers(users);
  renderLeaderboard();
  return isNewRecord;
}

authForm.addEventListener('submit', (e) => {
  e.preventDefault();
  handleLoginOrRegister(usernameInput.value, passwordInput.value);
});

logoutBtn.addEventListener('click', () => {
  gameState = 'AUTH';
  currentUser = null;
  localStorage.removeItem(STORAGE_KEY_SESSION);
  userPanel.classList.add('hidden');
  startModal.classList.add('hidden');
  gameOverModal.classList.add('hidden');
  authModal.classList.remove('hidden');
  passwordInput.value = '';
  usernameInput.focus();
  renderLeaderboard();
});

// ==========================================
// 3. ระบบเกมเพลย์หลัก (CYBER OVERDRIVE)
// ==========================================

const W = canvas.width;
const H = canvas.height;

// สถานะเกม: 'AUTH' | 'READY' | 'PLAYING' | 'GAMEOVER'
let gameState = 'AUTH';
let autoAimMode = false; // false = เล็งตามเมาส์, true = ล็อกเป้าศัตรูใกล้สุดอัตโนมัติ

const keys = {
  up: false,
  down: false,
  left: false,
  right: false
};

const mouse = {
  x: W / 2,
  y: H / 3,
  down: false,
  moved: false
};

aimModeBtn.addEventListener('click', () => {
  autoAimMode = !autoAimMode;
  updateAimModeButton();
});

function updateAimModeButton() {
  if (autoAimMode) {
    aimModeBtn.textContent = '🤖 โหมดล็อกเป้าอัตโนมัติ (กด J สลับ)';
    aimModeBtn.style.borderColor = '#4ade80';
    aimModeBtn.style.color = '#4ade80';
  } else {
    aimModeBtn.textContent = '🎯 เมาส์เล็ง + ออโต้ยิง (กด J สลับ)';
    aimModeBtn.style.borderColor = 'rgba(34, 211, 238, 0.45)';
    aimModeBtn.style.color = '#22d3ee';
  }
}

// ตัวแปรสถานะในแต่ละรอบ
let score = 0;
let wave = 1;
let waveKillCount = 0;
let waveQuota = 12;
let combo = 1;
let maxCombo = 1;
let comboTimer = 0;
let screenShake = 0;
let frameCount = 0;
let bossBannerTimer = 0;

let player = null;
let bullets = [];
let enemyBullets = [];
let enemies = [];
let gems = [];
let powerups = [];
let particles = [];
let shockwaves = [];
let floatingTexts = [];
let afterimages = [];
let activeBoss = null;

function initGameWorld() {
  score = 0;
  wave = 1;
  waveKillCount = 0;
  waveQuota = 12;
  combo = 1;
  maxCombo = 1;
  comboTimer = 0;
  screenShake = 0;
  frameCount = 0;
  bossBannerTimer = 0;

  bullets = [];
  enemyBullets = [];
  enemies = [];
  gems = [];
  powerups = [];
  particles = [];
  shockwaves = [];
  floatingTexts = [];
  afterimages = [];
  activeBoss = null;
  bossHudEl.classList.add('hidden');

  player = {
    x: W / 2,
    y: H * 0.65,
    r: 16,
    vx: 0,
    vy: 0,
    speed: 4.5,
    hp: 100,
    maxHp: 100,
    overdrive: 40, // เริ่มต้นมีเกจ 40% ให้พร้อมระเบิดความมันส์ไวๆ
    angle: -Math.PI / 2,
    shootCooldown: 0,
    dashCooldown: 0,
    dashTimer: 0,
    dashVx: 0,
    dashVy: 0,
    invulnTimer: 0,
    // ระบบอัปเกรดอาวุธ
    spreadLevel: 1,    // 1 ถึง 5 นัดพร้อมกัน
    rapidTimer: 0,     // ยิงรัวพิเศษ
    laserTimer: 0,     // กระสุนเลเซอร์เจาะเกราะ
    missileLevel: 0,   // มิสไซล์ติดตาม
    shieldOrbs: 1,     // เกราะหมุนรอบตัวเริ่มต้น 1 ลูก
    shieldAngle: 0
  };

  updateHud();
}

// --- การเกิดของศัตรู & บอส ---
function spawnEnemy() {
  if (activeBoss && enemies.length >= 4) return; // ตอนสู้บอสจำกัดลูกน้องไม่ให้รกเกิน

  // สุ่มจุดเกิดรอบขอบจอทั้ง 4 ด้าน
  const side = Math.floor(Math.random() * 4);
  let x, y;
  const pad = 28;
  if (side === 0) { x = Math.random() * W; y = -pad; }
  else if (side === 1) { x = W + pad; y = Math.random() * H; }
  else if (side === 2) { x = Math.random() * W; y = H + pad; }
  else { x = -pad; y = Math.random() * H; }

  // เลือกชนิดศัตรูตามระดับความโหดของ Wave
  const roll = Math.random();
  let type = 'chaser';
  if (wave >= 2 && roll < 0.25) type = 'shooter';
  else if (wave >= 3 && roll >= 0.25 && roll < 0.42) type = 'dasher';
  else if (wave >= 4 && roll >= 0.42 && roll < 0.56) type = 'tank';

  const hpScale = 1 + (wave - 1) * 0.22;

  if (type === 'chaser') {
    enemies.push({
      type, x, y, r: 14,
      hp: 22 * hpScale, maxHp: 22 * hpScale,
      speed: 2.1 + Math.min(1.6, wave * 0.12),
      color: '#f43f5e', scoreVal: 25,
      shootTimer: 0
    });
  } else if (type === 'shooter') {
    enemies.push({
      type, x, y, r: 16,
      hp: 34 * hpScale, maxHp: 34 * hpScale,
      speed: 1.45 + Math.min(1.0, wave * 0.08),
      color: '#a855f7', scoreVal: 45,
      shootTimer: 50 + Math.floor(Math.random() * 50)
    });
  } else if (type === 'dasher') {
    enemies.push({
      type, x, y, r: 13,
      hp: 20 * hpScale, maxHp: 20 * hpScale,
      speed: 3.3 + Math.min(1.8, wave * 0.14),
      color: '#facc15', scoreVal: 40,
      shootTimer: 0
    });
  } else if (type === 'tank') {
    enemies.push({
      type, x, y, r: 23,
      hp: 85 * hpScale, maxHp: 85 * hpScale,
      speed: 1.05,
      color: '#fb923c', scoreVal: 80,
      shootTimer: 75
    });
  }
}

function spawnBoss() {
  const bossNames = [
    'OMEGA DREADNOUGHT',
    'VALKYRIE ANNIHILATOR',
    'HYPERION CORE X',
    'NEMESIS OVERLORD'
  ];
  const name = bossNames[Math.floor((wave / 3 - 1) % bossNames.length)];
  const maxHp = 950 + wave * 380;

  activeBoss = {
    type: 'boss',
    name,
    x: W / 2,
    y: -60,
    targetY: 145,
    r: 42,
    hp: maxHp,
    maxHp,
    vx: 2.2,
    phaseTimer: 0,
    attackMode: 0,
    color: '#e11d48',
    scoreVal: 1200 + wave * 300
  };

  bossNameEl.textContent = `${name} (WAVE ${wave})`;
  bossHpFillEl.style.width = '100%';
  bossHudEl.classList.remove('hidden');
  bossBannerTimer = 110;
  screenShake = 14;
  playSfx('bossWarn');
  addFloatingText('⚠️ BOSS INCOMING! ⚠️', W / 2, H * 0.35, '#f43f5e', 24);
}

// --- การโจมตี & สกิลของผู้เล่น ---
function triggerDash() {
  if (gameState !== 'PLAYING' || !player || player.dashCooldown > 0) return;

  // ทิศทางพุ่ง: ตามปุ่มเดินที่กด หรือถ้าไม่ได้กดให้พุ่งไปทางที่เล็งเป้า
  let dx = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
  let dy = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
  let len = Math.hypot(dx, dy);

  if (len === 0) {
    dx = Math.cos(player.angle);
    dy = Math.sin(player.angle);
  } else {
    dx /= len;
    dy /= len;
  }

  player.dashTimer = 11;
  player.dashCooldown = 38;
  player.invulnTimer = 18;
  player.dashVx = dx * 13.5;
  player.dashVy = dy * 13.5;

  playSfx('dash');
  spawnParticles(player.x, player.y, '#22d3ee', 14);
  shockwaves.push({ x: player.x, y: player.y, r: 8, maxR: 52, color: '#22d3ee', alpha: 0.9 });
}

function triggerOverdriveUlt() {
  if (gameState !== 'PLAYING' || !player || player.overdrive < 100) return;

  player.overdrive = 0;
  player.invulnTimer = 60;
  screenShake = 22;
  playSfx('ult');

  // ล้างกระสุนศัตรูทั้งหมดในจอเป็นคะแนนโบนัส!
  for (const eb of enemyBullets) {
    spawnParticles(eb.x, eb.y, '#c084fc', 4);
    score += 5 * combo;
  }
  enemyBullets = [];

  // คลื่นระเบิด EMP ยักษ์
  shockwaves.push({ x: player.x, y: player.y, r: 15, maxR: 520, color: '#f43f5e', alpha: 1.0, lineWidth: 10 });
  shockwaves.push({ x: player.x, y: player.y, r: 5, maxR: 380, color: '#22d3ee', alpha: 1.0, lineWidth: 6 });

  addFloatingText('⚡ EMP OVERDRIVE! ⚡', player.x, player.y - 36, '#facc15', 22);

  // ทำดาเมจมหาศาลใส่ศัตรูทั้งจอ
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    e.hp -= 180 + wave * 25;
    spawnParticles(e.x, e.y, '#f43f5e', 10);
    if (e.hp <= 0) {
      handleEnemyKilled(e);
      enemies.splice(i, 1);
    }
  }

  if (activeBoss) {
    activeBoss.hp -= 280 + wave * 30;
    spawnParticles(activeBoss.x, activeBoss.y, '#facc15', 22);
    if (activeBoss.hp <= 0) {
      handleBossKilled();
    }
  }

  updateHud();
}

function firePlayerWeapons() {
  const isLaser = player.laserTimer > 0;
  const count = player.spreadLevel;
  const spreadStep = 0.13; // มุมกระจาย
  const startAngle = player.angle - ((count - 1) * spreadStep) / 2;

  for (let i = 0; i < count; i++) {
    const ang = startAngle + i * spreadStep;
    const speed = isLaser ? 16 : 11.5;
    bullets.push({
      x: player.x + Math.cos(ang) * 18,
      y: player.y + Math.sin(ang) * 18,
      vx: Math.cos(ang) * speed,
      vy: Math.sin(ang) * speed,
      r: isLaser ? 5 : 4,
      dmg: isLaser ? 24 : 15,
      color: isLaser ? '#facc15' : '#22d3ee',
      pierce: isLaser ? 2 : 0,
      homing: false
    });
  }

  // มิสไซล์ติดตามเป้าหมาย
  if (player.missileLevel > 0 && frameCount % 3 === 0) {
    for (let m = 0; m < Math.min(2, player.missileLevel); m++) {
      const sideAng = player.angle + (m === 0 ? -0.6 : 0.6);
      bullets.push({
        x: player.x,
        y: player.y,
        vx: Math.cos(sideAng) * 7,
        vy: Math.sin(sideAng) * 7,
        r: 5,
        dmg: 22,
        color: '#f43f5e',
        pierce: 0,
        homing: true
      });
    }
  }

  playSfx('shoot');
}

function handleEnemyKilled(e) {
  playSfx('explode');
  screenShake = Math.max(screenShake, 4);

  // เพิ่มคอมโบ
  combo = Math.min(50, combo + 1);
  if (combo > maxCombo) maxCombo = combo;
  comboTimer = 190; // ~3.1 วินาทีก่อนคอมโบหลุด

  const gained = e.scoreVal * combo;
  score += gained;
  waveKillCount++;
  player.overdrive = Math.min(100, player.overdrive + 4.5);

  spawnParticles(e.x, e.y, e.color, 14);
  addFloatingText(`+${gained}`, e.x, e.y - 10, combo >= 10 ? '#facc15' : '#fff', 14);

  // ดรอปเพชรพลังงาน
  gems.push({
    x: e.x,
    y: e.y,
    vx: (Math.random() - 0.5) * 3,
    vy: (Math.random() - 0.5) * 3,
    r: 6,
    val: 15
  });

  // โอกาสดรอปกล่องอัปเกรดปืน / บัฟ (16%)
  if (Math.random() < 0.16) {
    spawnPowerup(e.x, e.y);
  }
}

function handleBossKilled() {
  if (!activeBoss) return;
  playSfx('ult');
  screenShake = 28;

  const gained = activeBoss.scoreVal * Math.max(2, Math.floor(combo / 2));
  score += gained;
  player.overdrive = 100;

  spawnParticles(activeBoss.x, activeBoss.y, '#facc15', 45);
  spawnParticles(activeBoss.x, activeBoss.y, '#f43f5e', 35);
  shockwaves.push({ x: activeBoss.x, y: activeBoss.y, r: 10, maxR: 320, color: '#facc15', alpha: 1, lineWidth: 8 });

  addFloatingText(`💥 BOSS DEFEATED! +${gained.toLocaleString()} 💥`, activeBoss.x, activeBoss.y, '#facc15', 22);

  // บอสดรอปกล่องอัปเกรด 2 กล่องการันตี
  spawnPowerup(activeBoss.x - 28, activeBoss.y);
  spawnPowerup(activeBoss.x + 28, activeBoss.y);

  // ล้างกระสุนบอสทั้งหมด
  enemyBullets = [];
  activeBoss = null;
  bossHudEl.classList.add('hidden');

  advanceWave();
}

function spawnPowerup(x, y) {
  const types = [
    { id: 'SPREAD', label: '🔫 SPREAD UP!', color: '#22d3ee' },
    { id: 'RAPID', label: '🔥 RAPID FIRE!', color: '#facc15' },
    { id: 'LASER', label: '⚡ RAIL LASER!', color: '#a855f7' },
    { id: 'MISSILE', label: '🚀 HOMING MISSILE!', color: '#f43f5e' },
    { id: 'SHIELD', label: '🛡️ ORBIT SHIELD!', color: '#38bdf8' },
    { id: 'HEAL', label: '❤️ +35 HP!', color: '#4ade80' }
  ];
  const pick = types[Math.floor(Math.random() * types.length)];
  powerups.push({
    x,
    y,
    r: 13,
    id: pick.id,
    label: pick.label,
    color: pick.color,
    life: 520
  });
}

function applyPowerup(p) {
  playSfx('powerup');
  score += 100 * combo;
  addFloatingText(p.label, player.x, player.y - 26, p.color, 17);

  if (p.id === 'SPREAD') {
    player.spreadLevel = Math.min(5, player.spreadLevel + 1);
  } else if (p.id === 'RAPID') {
    player.rapidTimer = 420; // 7 วินาที
  } else if (p.id === 'LASER') {
    player.laserTimer = 420;
  } else if (p.id === 'MISSILE') {
    player.missileLevel = Math.min(3, player.missileLevel + 1);
  } else if (p.id === 'SHIELD') {
    player.shieldOrbs = Math.min(3, player.shieldOrbs + 1);
  } else if (p.id === 'HEAL') {
    player.hp = Math.min(player.maxHp, player.hp + 35);
  }
}

function advanceWave() {
  wave++;
  waveKillCount = 0;
  waveQuota = 12 + wave * 5;
  addFloatingText(`🔥 WAVE ${wave} START! 🔥`, W / 2, H * 0.4, '#22d3ee', 22);

  // ทุกๆ 3 เวฟ บอสใหญ่ปรากฏตัว!
  if (wave % 3 === 0) {
    spawnBoss();
  }
}

function damagePlayer(amount) {
  if (player.invulnTimer > 0) return;

  // ถ้ามีเกราะหมุน (Orbit Shield) ให้เกราะรับดาเมจแทน 1 ครั้ง!
  if (player.shieldOrbs > 0) {
    player.shieldOrbs--;
    player.invulnTimer = 45;
    screenShake = 10;
    playSfx('explode');
    shockwaves.push({ x: player.x, y: player.y, r: 10, maxR: 90, color: '#38bdf8', alpha: 0.9, lineWidth: 5 });
    addFloatingText('🛡️ SHIELD BLOCKED!', player.x, player.y - 24, '#38bdf8', 16);
    return;
  }

  player.hp = Math.max(0, player.hp - amount);
  player.invulnTimer = 42;
  combo = Math.max(1, Math.floor(combo / 2)); // โดนชนคอมโบลดครึ่งหนึ่ง
  screenShake = 14;
  playSfx('explode');
  spawnParticles(player.x, player.y, '#f43f5e', 18);
  addFloatingText(`-${amount} HP`, player.x, player.y - 20, '#f43f5e', 16);

  if (player.hp <= 0) {
    triggerGameOver();
  }
}

// ==========================================
// 4. ลูปอัปเดตสถานะเกม (Update Loop)
// ==========================================

function updateGame() {
  if (gameState !== 'PLAYING') return;
  frameCount++;

  if (screenShake > 0) screenShake *= 0.88;
  if (screenShake < 0.4) screenShake = 0;
  if (bossBannerTimer > 0) bossBannerTimer--;

  // นับเวลาคอมโบ
  if (combo > 1) {
    comboTimer--;
    if (comboTimer <= 0) {
      combo = 1;
    }
  }

  // อัปเดตคูลดาวน์และบัฟผู้เล่น
  if (player.dashCooldown > 0) player.dashCooldown--;
  if (player.invulnTimer > 0) player.invulnTimer--;
  if (player.rapidTimer > 0) player.rapidTimer--;
  if (player.laserTimer > 0) player.laserTimer--;
  player.shieldAngle += 0.07;

  // 1. การเคลื่อนที่ของผู้เล่น
  if (player.dashTimer > 0) {
    player.dashTimer--;
    player.x += player.dashVx;
    player.y += player.dashVy;

    // ทิ้งภาพติดตา (Afterimage)
    afterimages.push({
      x: player.x,
      y: player.y,
      r: player.r,
      alpha: 0.65
    });

    // พุ่งชนศัตรูระเบิดระหว่าง Dash!
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      if (Math.hypot(player.x - e.x, player.y - e.y) < player.r + e.r + 8) {
        e.hp -= 45;
        spawnParticles(e.x, e.y, '#22d3ee', 8);
        if (e.hp <= 0) {
          handleEnemyKilled(e);
          enemies.splice(i, 1);
        }
      }
    }
  } else {
    let mx = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    let my = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
    const len = Math.hypot(mx, my);
    if (len > 0) {
      mx /= len;
      my /= len;
    }
    player.x += mx * player.speed;
    player.y += my * player.speed;
  }

  // จำกัดขอบเขตผู้เล่นในสนาม
  const margin = player.r + 8;
  player.x = Math.max(margin, Math.min(W - margin, player.x));
  player.y = Math.max(85, Math.min(H - margin, player.y));

  // 2. คำนวณมุมเล็งปืน (เมาส์ หรือ ล็อกเป้าอัตโนมัติ)
  let target = null;
  if (autoAimMode || !mouse.moved) {
    target = findNearestTarget(player.x, player.y);
  }
  if (target) {
    player.angle = Math.atan2(target.y - player.y, target.x - player.x);
  } else {
    player.angle = Math.atan2(mouse.y - player.y, mouse.x - player.x);
  }

  // 3. ยิงกระสุนอัตโนมัติ
  if (player.shootCooldown > 0) {
    player.shootCooldown--;
  } else {
    firePlayerWeapons();
    player.shootCooldown = player.rapidTimer > 0 ? 5 : 9;
  }

  // 4. สร้างศัตรูตามจังหวะ Wave
  const spawnInterval = Math.max(24, 68 - wave * 5);
  if (frameCount % spawnInterval === 0) {
    spawnEnemy();
  }

  // เช็คผ่าน Wave (กรณีไม่ใช่เวฟบอส)
  if (!activeBoss && waveKillCount >= waveQuota) {
    advanceWave();
  }

  // 5. อัปเดตกระสุนผู้เล่น
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];

    // มิสไซล์ติดตามเป้าหมาย
    if (b.homing) {
      const t = findNearestTarget(b.x, b.y);
      if (t) {
        const desired = Math.atan2(t.y - b.y, t.x - b.x);
        b.vx = b.vx * 0.88 + Math.cos(desired) * 1.4;
        b.vy = b.vy * 0.88 + Math.sin(desired) * 1.4;
      }
    }

    b.x += b.vx;
    b.y += b.vy;

    if (b.x < -20 || b.x > W + 20 || b.y < -20 || b.y > H + 20) {
      bullets.splice(i, 1);
      continue;
    }

    let removed = false;

    // เช็คยิงโดนบอส
    if (activeBoss && Math.hypot(b.x - activeBoss.x, b.y - activeBoss.y) < b.r + activeBoss.r) {
      activeBoss.hp -= b.dmg;
      player.overdrive = Math.min(100, player.overdrive + 0.45);
      spawnParticles(b.x, b.y, b.color, 3);
      if (activeBoss.hp <= 0) {
        handleBossKilled();
      }
      bullets.splice(i, 1);
      continue;
    }

    // เช็คยิงโดนศัตรูทั่วไป
    for (let j = enemies.length - 1; j >= 0; j--) {
      const e = enemies[j];
      if (Math.hypot(b.x - e.x, b.y - e.y) < b.r + e.r) {
        e.hp -= b.dmg;
        spawnParticles(b.x, b.y, b.color, 4);

        if (e.hp <= 0) {
          handleEnemyKilled(e);
          enemies.splice(j, 1);
        }

        if (b.pierce > 0) {
          b.pierce--;
        } else {
          bullets.splice(i, 1);
          removed = true;
        }
        break;
      }
    }
    if (removed) continue;
  }

  // 6. อัปเดตบอสใหญ่
  if (activeBoss) {
    if (activeBoss.y < activeBoss.targetY) {
      activeBoss.y += 2.2;
    } else {
      activeBoss.x += activeBoss.vx;
      if (activeBoss.x < 80 || activeBoss.x > W - 80) {
        activeBoss.vx *= -1;
      }
    }

    activeBoss.phaseTimer++;
    // รูปแบบการยิงของบอส
    if (activeBoss.phaseTimer % 46 === 0) {
      // ยิงกระสุนกระจายวงกลม
      const count = 10 + Math.min(8, wave);
      for (let k = 0; k < count; k++) {
        const ang = (k / count) * Math.PI * 2 + activeBoss.phaseTimer * 0.03;
        enemyBullets.push({
          x: activeBoss.x,
          y: activeBoss.y,
          vx: Math.cos(ang) * 3.8,
          vy: Math.sin(ang) * 3.8,
          r: 6,
          color: '#f43f5e'
        });
      }
    }
    if (activeBoss.phaseTimer % 75 === 0) {
      // ยิงเล็งตรงหาผู้เล่น 3 นัดซ้อน
      const aim = Math.atan2(player.y - activeBoss.y, player.x - activeBoss.x);
      for (let s = -1; s <= 1; s++) {
        enemyBullets.push({
          x: activeBoss.x,
          y: activeBoss.y,
          vx: Math.cos(aim + s * 0.16) * 5.6,
          vy: Math.sin(aim + s * 0.16) * 5.6,
          r: 7,
          color: '#facc15'
        });
      }
    }

    // เช็คชนตัวบอส
    if (Math.hypot(player.x - activeBoss.x, player.y - activeBoss.y) < player.r + activeBoss.r - 4) {
      damagePlayer(25);
    }

    const hpPct = Math.max(0, (activeBoss.hp / activeBoss.maxHp) * 100);
    bossHpFillEl.style.width = `${hpPct}%`;
  }

  // 7. อัปเดตศัตรูทั่วไป
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    const ang = Math.atan2(player.y - e.y, player.x - e.x);

    e.x += Math.cos(ang) * e.speed;
    e.y += Math.sin(ang) * e.speed;

    // ศัตรูยิงกระสุน
    if (e.type === 'shooter' || e.type === 'tank') {
      e.shootTimer--;
      if (e.shootTimer <= 0) {
        if (e.type === 'shooter') {
          enemyBullets.push({
            x: e.x,
            y: e.y,
            vx: Math.cos(ang) * 4.5,
            vy: Math.sin(ang) * 4.5,
            r: 5,
            color: '#c084fc'
          });
          e.shootTimer = 95;
        } else {
          // Tank ยิง 6 ทิศ
          for (let k = 0; k < 6; k++) {
            const a = ang + (k * Math.PI) / 3;
            enemyBullets.push({
              x: e.x,
              y: e.y,
              vx: Math.cos(a) * 3.6,
              vy: Math.sin(a) * 3.6,
              r: 6,
              color: '#fb923c'
            });
          }
          e.shootTimer = 125;
        }
      }
    }

    // เช็คศัตรูชนผู้เล่น
    if (Math.hypot(player.x - e.x, player.y - e.y) < player.r + e.r - 2) {
      if (player.dashTimer <= 0) {
        damagePlayer(18);
        enemies.splice(i, 1);
      }
    }
  }

  // 8. อัปเดตกระสุนศัตรู
  for (let i = enemyBullets.length - 1; i >= 0; i--) {
    const eb = enemyBullets[i];
    eb.x += eb.vx;
    eb.y += eb.vy;

    if (eb.x < -30 || eb.x > W + 30 || eb.y < -30 || eb.y > H + 30) {
      enemyBullets.splice(i, 1);
      continue;
    }

    if (Math.hypot(player.x - eb.x, player.y - eb.y) < player.r + eb.r - 2) {
      enemyBullets.splice(i, 1);
      damagePlayer(15);
    }
  }

  // 9. อัปเดตเพชรพลังงาน (ดูดเข้าหาตัวอัตโนมัติเมื่ออยู่ใกล้)
  for (let i = gems.length - 1; i >= 0; i--) {
    const g = gems[i];
    const dist = Math.hypot(player.x - g.x, player.y - g.y);
    if (dist < 135) {
      const ang = Math.atan2(player.y - g.y, player.x - g.x);
      g.x += Math.cos(ang) * 7.5;
      g.y += Math.sin(ang) * 7.5;
    } else {
      g.x += g.vx;
      g.y += g.vy;
      g.vx *= 0.92;
      g.vy *= 0.92;
    }

    if (dist < player.r + g.r + 6) {
      score += g.val * combo;
      player.overdrive = Math.min(100, player.overdrive + 1.5);
      gems.splice(i, 1);
    }
  }

  // 10. อัปเดตกล่องอัปเกรดปืน
  for (let i = powerups.length - 1; i >= 0; i--) {
    const p = powerups[i];
    p.life--;
    const dist = Math.hypot(player.x - p.x, player.y - p.y);
    if (dist < 95) {
      const ang = Math.atan2(player.y - p.y, player.x - p.x);
      p.x += Math.cos(ang) * 4.5;
      p.y += Math.sin(ang) * 4.5;
    }
    if (dist < player.r + p.r + 6) {
      applyPowerup(p);
      powerups.splice(i, 1);
      continue;
    }
    if (p.life <= 0) {
      powerups.splice(i, 1);
    }
  }

  // 11. อัปเดตเอฟเฟกต์กราฟิก
  for (const pt of particles) {
    pt.x += pt.vx;
    pt.y += pt.vy;
    pt.vx *= 0.95;
    pt.vy *= 0.95;
    pt.alpha -= 0.032;
  }
  particles = particles.filter((pt) => pt.alpha > 0);

  for (const sw of shockwaves) {
    sw.r += (sw.maxR - sw.r) * 0.16;
    sw.alpha -= 0.04;
  }
  shockwaves = shockwaves.filter((sw) => sw.alpha > 0);

  for (const ai of afterimages) {
    ai.alpha -= 0.07;
  }
  afterimages = afterimages.filter((ai) => ai.alpha > 0);

  for (const ft of floatingTexts) {
    ft.y += ft.vy;
    ft.alpha -= 0.022;
  }
  floatingTexts = floatingTexts.filter((ft) => ft.alpha > 0);

  updateHud();
}

function findNearestTarget(fromX, fromY) {
  let best = null;
  let minDist = Infinity;

  if (activeBoss) {
    minDist = Math.hypot(activeBoss.x - fromX, activeBoss.y - fromY);
    best = activeBoss;
  }

  for (const e of enemies) {
    const d = Math.hypot(e.x - fromX, e.y - fromY);
    if (d < minDist) {
      minDist = d;
      best = e;
    }
  }
  return best;
}

function spawnParticles(x, y, color, count = 10) {
  for (let i = 0; i < count; i++) {
    const ang = Math.random() * Math.PI * 2;
    const spd = Math.random() * 5.5 + 1;
    particles.push({
      x,
      y,
      vx: Math.cos(ang) * spd,
      vy: Math.sin(ang) * spd,
      r: Math.random() * 3.5 + 1.5,
      alpha: 1,
      color
    });
  }
}

function addFloatingText(text, x, y, color = '#facc15', size = 16) {
  floatingTexts.push({
    text,
    x,
    y,
    vy: -1.4,
    alpha: 1,
    color,
    size
  });
}

function updateHud() {
  if (!player) return;
  const hpPct = Math.max(0, (player.hp / player.maxHp) * 100);
  hpTextEl.textContent = `${Math.ceil(player.hp)} / ${player.maxHp}`;
  hpFillEl.style.width = `${hpPct}%`;

  const ultPct = Math.floor(player.overdrive);
  ultTextEl.textContent = ultPct >= 100 ? 'READY! (กด E)' : `${ultPct}%`;
  ultFillEl.style.width = `${ultPct}%`;

  hudWaveEl.textContent = wave;
  hudComboEl.textContent = `x${combo}`;
  hudScoreEl.textContent = score.toLocaleString();
}

function triggerGameOver() {
  gameState = 'GAMEOVER';
  const isNewRecord = updateUserHighScoreG2(score, wave);

  finalScoreEl.textContent = score.toLocaleString();
  finalWaveEl.textContent = wave;
  finalComboEl.textContent = `x${maxCombo}`;
  finalBestEl.textContent = currentUser
    ? (currentUser.bestScoreG2 || score).toLocaleString()
    : score.toLocaleString();

  if (isNewRecord && score > 0) {
    newRecordBanner.classList.remove('hidden');
  } else {
    newRecordBanner.classList.add('hidden');
  }

  gameOverModal.classList.remove('hidden');
}

// ==========================================
// 5. ระบบวาดกราฟิกไซเบอร์พังก์ (Canvas Rendering)
// ==========================================

function drawGame() {
  ctx.save();

  // เอฟเฟกต์จอสั่นสะเทือน (Screen Shake)
  if (screenShake > 0) {
    const dx = (Math.random() - 0.5) * screenShake * 1.6;
    const dy = (Math.random() - 0.5) * screenShake * 1.6;
    ctx.translate(dx, dy);
  }

  // พื้นหลังไซเบอร์
  ctx.fillStyle = '#07060e';
  ctx.fillRect(0, 0, W, H);

  // เส้นตาราง Synthwave Grid เคลื่อนไหว
  ctx.strokeStyle = 'rgba(168, 85, 247, 0.12)';
  ctx.lineWidth = 1;
  const gridSize = 48;
  const offset = (frameCount * 0.8) % gridSize;

  for (let x = 0; x <= W; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  for (let y = offset; y <= H; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }

  if (!player) {
    ctx.restore();
    return;
  }

  // วาดคลื่น Shockwave
  for (const sw of shockwaves) {
    ctx.save();
    ctx.strokeStyle = sw.color;
    ctx.globalAlpha = Math.max(0, sw.alpha);
    ctx.lineWidth = sw.lineWidth || 3;
    ctx.beginPath();
    ctx.arc(sw.x, sw.y, sw.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // วาดเพชรพลังงาน
  for (const g of gems) {
    ctx.save();
    ctx.fillStyle = '#4ade80';
    ctx.shadowColor = '#4ade80';
    ctx.shadowBlur = 8;
    ctx.translate(g.x, g.y);
    ctx.rotate(frameCount * 0.08);
    ctx.fillRect(-g.r / 2, -g.r / 2, g.r, g.r);
    ctx.restore();
  }

  // วาดกล่องอัปเกรดอาวุธ
  for (const p of powerups) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.strokeStyle = p.color;
    ctx.fillStyle = 'rgba(15, 12, 32, 0.9)';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 12;

    ctx.beginPath();
    ctx.arc(0, 0, p.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.fillStyle = p.color;
    ctx.font = '800 10px Kanit';
    ctx.textAlign = 'center';
    ctx.fillText(p.id, 0, 3.5);
    ctx.restore();
  }

  // วาดภาพติดตาตอน Dash
  for (const ai of afterimages) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, ai.alpha);
    ctx.fillStyle = '#22d3ee';
    ctx.beginPath();
    ctx.arc(ai.x, ai.y, ai.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // วาดกระสุนผู้เล่น
  for (const b of bullets) {
    ctx.save();
    ctx.fillStyle = b.color;
    ctx.shadowColor = b.color;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // วาดกระสุนศัตรู
  for (const eb of enemyBullets) {
    ctx.save();
    ctx.fillStyle = eb.color;
    ctx.shadowColor = eb.color;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(eb.x, eb.y, eb.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // วาดศัตรูทั่วไป
  for (const e of enemies) {
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.fillStyle = e.color;
    ctx.shadowColor = e.color;
    ctx.shadowBlur = 12;

    ctx.beginPath();
    if (e.type === 'dasher') {
      // รูปทรงเพชรแหลมคม
      ctx.moveTo(0, -e.r);
      ctx.lineTo(e.r, 0);
      ctx.lineTo(0, e.r);
      ctx.lineTo(-e.r, 0);
      ctx.closePath();
    } else if (e.type === 'tank') {
      // หกเหลี่ยมหุ้มเกราะ
      for (let s = 0; s < 6; s++) {
        const a = (s * Math.PI) / 3;
        if (s === 0) ctx.moveTo(Math.cos(a) * e.r, Math.sin(a) * e.r);
        else ctx.lineTo(Math.cos(a) * e.r, Math.sin(a) * e.r);
      }
      ctx.closePath();
    } else {
      ctx.arc(0, 0, e.r, 0, Math.PI * 2);
    }
    ctx.fill();

    // แกนกลางสีขาว
    ctx.fillStyle = '#07060e';
    ctx.beginPath();
    ctx.arc(0, 0, e.r * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // วาดบอสใหญ่
  if (activeBoss) {
    ctx.save();
    ctx.translate(activeBoss.x, activeBoss.y);
    ctx.rotate(frameCount * 0.02);

    ctx.fillStyle = '#e11d48';
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#f43f5e';
    ctx.shadowBlur = 22;

    // ตัวบอสทรงแปดเหลี่ยมจักรกล
    ctx.beginPath();
    for (let s = 0; s < 8; s++) {
      const a = (s * Math.PI) / 4;
      const rad = s % 2 === 0 ? activeBoss.r : activeBoss.r * 0.78;
      if (s === 0) ctx.moveTo(Math.cos(a) * rad, Math.sin(a) * rad);
      else ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // แกนพลังงานบอส
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // วาดตัวละครผู้เล่น
  drawCyberPlayer();

  // วาดพาร์ติเคิล
  for (const pt of particles) {
    ctx.fillStyle = pt.color;
    ctx.globalAlpha = Math.max(0, pt.alpha);
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // วาดข้อความลอย
  for (const ft of floatingTexts) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, ft.alpha);
    ctx.font = `800 ${ft.size || 16}px Kanit`;
    ctx.fillStyle = ft.color;
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = 4;
    ctx.fillText(ft.text, ft.x, ft.y);
    ctx.restore();
  }

  // วาดเป้าเล็งเมาส์ (Crosshair)
  if (!autoAimMode && gameState === 'PLAYING') {
    ctx.save();
    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(mouse.x, mouse.y, 10, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();
}

function drawCyberPlayer() {
  ctx.save();
  ctx.translate(player.x, player.y);

  // เกราะหมุนรอบตัว (Orbit Shields)
  for (let i = 0; i < player.shieldOrbs; i++) {
    const orbAng = player.shieldAngle + (i * Math.PI * 2) / player.shieldOrbs;
    const ox = Math.cos(orbAng) * (player.r + 14);
    const oy = Math.sin(orbAng) * (player.r + 14);
    ctx.fillStyle = '#38bdf8';
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(ox, oy, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  // กระพริบตอนเป็นอมตะ
  if (player.invulnTimer > 0 && Math.floor(frameCount / 2) % 2 === 0) {
    ctx.globalAlpha = 0.55;
  }

  ctx.rotate(player.angle);

  // กระบอกปืนคู่ด้านหน้า
  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(6, -9, 16, 5);
  ctx.fillRect(6, 4, 16, 5);

  // ตัวหุ่นรบไซเบอร์
  ctx.fillStyle = '#0ea5e9';
  ctx.strokeStyle = '#22d3ee';
  ctx.lineWidth = 2.5;
  ctx.shadowColor = '#22d3ee';
  ctx.shadowBlur = 16;

  ctx.beginPath();
  ctx.arc(0, 0, player.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // เลนส์ตาเรืองแสงด้านหน้า
  ctx.fillStyle = '#facc15';
  ctx.beginPath();
  ctx.arc(6, 0, 5, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// ==========================================
// 6. การควบคุมคีย์บอร์ด & เมาส์
// ==========================================

function showStartScreen() {
  gameState = 'READY';
  initGameWorld();
  startModal.classList.remove('hidden');
  gameOverModal.classList.add('hidden');
}

function startPlaying() {
  if (!currentUser) return;
  initAudio();
  initGameWorld();
  gameState = 'PLAYING';
  startModal.classList.add('hidden');
  gameOverModal.classList.add('hidden');
}

startGameBtn.addEventListener('click', startPlaying);
restartGameBtn.addEventListener('click', startPlaying);

canvas.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  const scaleX = W / rect.width;
  const scaleY = H / rect.height;
  mouse.x = (e.clientX - rect.left) * scaleX;
  mouse.y = (e.clientY - rect.top) * scaleY;
  mouse.moved = true;
});

canvas.addEventListener('mousedown', (e) => {
  if (e.button === 2) {
    e.preventDefault();
    triggerDash();
  } else {
    mouse.down = true;
  }
});

canvas.addEventListener('mouseup', () => {
  mouse.down = false;
});

canvas.addEventListener('contextmenu', (e) => e.preventDefault());

window.addEventListener('keydown', (e) => {
  if (document.activeElement === usernameInput || document.activeElement === passwordInput) {
    return;
  }

  if (e.code === 'KeyW' || e.code === 'ArrowUp') { keys.up = true; e.preventDefault(); }
  if (e.code === 'KeyS' || e.code === 'ArrowDown') { keys.down = true; e.preventDefault(); }
  if (e.code === 'KeyA' || e.code === 'ArrowLeft') { keys.left = true; e.preventDefault(); }
  if (e.code === 'KeyD' || e.code === 'ArrowRight') { keys.right = true; e.preventDefault(); }

  // ปุ่ม J สลับโหมดเล็งเมาส์ / ล็อกเป้าอัตโนมัติ
  if (e.code === 'KeyJ') {
    autoAimMode = !autoAimMode;
    updateAimModeButton();
  }

  // ปุ่ม Space หรือ Shift เพื่อพุ่งหลบ (Cyber Dash) หรือเริ่มเกม
  if (e.code === 'Space' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
    e.preventDefault();
    if (gameState === 'READY' || gameState === 'GAMEOVER') {
      startPlaying();
    } else if (gameState === 'PLAYING') {
      triggerDash();
    }
  }

  // ปุ่ม E หรือ Q ปล่อยท่าไม้ตาย EMP OVERDRIVE
  if ((e.code === 'KeyE' || e.code === 'KeyQ') && gameState === 'PLAYING') {
    e.preventDefault();
    triggerOverdriveUlt();
  }

  if (e.code === 'Enter' && (gameState === 'READY' || gameState === 'GAMEOVER')) {
    e.preventDefault();
    startPlaying();
  }
});

window.addEventListener('keyup', (e) => {
  if (e.code === 'KeyW' || e.code === 'ArrowUp') keys.up = false;
  if (e.code === 'KeyS' || e.code === 'ArrowDown') keys.down = false;
  if (e.code === 'KeyA' || e.code === 'ArrowLeft') keys.left = false;
  if (e.code === 'KeyD' || e.code === 'ArrowRight') keys.right = false;
});

function gameLoop() {
  updateGame();
  drawGame();
  requestAnimationFrame(gameLoop);
}

function boot() {
  initGameWorld();
  renderLeaderboard();

  if (window.LanSync) {
    window.LanSync.onUpdate(() => {
      if (currentUser) {
        const users = loadUsers();
        const found = users.find((u) => u.username.toLowerCase() === currentUser.username.toLowerCase());
        if (found && (found.bestScoreG2 || 0) > (currentUser.bestScoreG2 || 0)) {
          currentUser.bestScoreG2 = found.bestScoreG2;
        }
      }
      renderLeaderboard();
    });
  }

  // เช็ค session ล็อกอินที่ใช้ร่วมกับเกม 1 ได้เลย
  const savedName = localStorage.getItem(STORAGE_KEY_SESSION);
  if (savedName) {
    const users = loadUsers();
    const found = users.find((u) => u.username.toLowerCase() === savedName.toLowerCase());
    if (found) {
      if (typeof found.bestScoreG2 !== 'number') found.bestScoreG2 = 0;
      if (typeof found.bestWaveG2 !== 'number') found.bestWaveG2 = 1;
      currentUser = found;
      onUserAuthenticated();
    }
  }

  requestAnimationFrame(gameLoop);
}

boot();