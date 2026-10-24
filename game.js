// ==========================================
// SKY AIM JUMPER - ระบบล็อกอิน จัดอันดับ และเกมเพลย์
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

const hudScoreEl = document.getElementById('hudScore');
const hudSpeedEl = document.getElementById('hudSpeed');
const hudBestEl = document.getElementById('hudBest');

const finalScoreEl = document.getElementById('finalScore');
const finalBestEl = document.getElementById('finalBest');
const newRecordBanner = document.getElementById('newRecordBanner');

const leaderboardListEl = document.getElementById('leaderboardList');
const totalPlayersBadge = document.getElementById('totalPlayersBadge');

// ==========================================
// 1. ระบบจัดการผู้ใช้และจัดอันดับ (Auth & Leaderboard)
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

function getSortedLeaderboard() {
  const users = loadUsers();
  return [...users].sort((a, b) => {
    if (b.bestScore !== a.bestScore) return b.bestScore - a.bestScore;
    return (a.updatedAt || 0) - (b.updatedAt || 0);
  });
}

function renderLeaderboard() {
  const sorted = getSortedLeaderboard();
  totalPlayersBadge.textContent = `${sorted.length} คน`;

  if (sorted.length === 0) {
    leaderboardListEl.innerHTML = `<div class="empty-leaderboard">ยังไม่มีผู้เล่นในตารางอันดับ<br/>มาเป็นอันดับ 1 คนแรกกันเลย!</div>`;
    if (currentUser) {
      userRankEl.textContent = '#-';
    }
    return;
  }

  leaderboardListEl.innerHTML = '';
  sorted.forEach((u, index) => {
    const rank = index + 1;
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
      </div>
      <span class="rank-score">${u.bestScore.toLocaleString()} คะแนน</span>
    `;
    leaderboardListEl.appendChild(row);

    if (isMe) {
      userRankEl.textContent = `#${rank}`;
      userBestScoreEl.textContent = u.bestScore.toLocaleString();
      hudBestEl.textContent = u.bestScore.toLocaleString();
    }
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
    // เช็ครหัสผ่าน
    if (existingUser.password !== cleanPass) {
      showAuthError('❌ ชื่อนี้มีคนใช้แล้ว และรหัสผ่านไม่ถูกต้อง!');
      return;
    }
    currentUser = existingUser;
  } else {
    // สมัครใหม่อัตโนมัติ
    const newUser = {
      username: cleanName,
      password: cleanPass,
      bestScore: 0,
      updatedAt: Date.now()
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
  userBestScoreEl.textContent = currentUser.bestScore.toLocaleString();
  hudBestEl.textContent = currentUser.bestScore.toLocaleString();
  welcomeNameEl.textContent = currentUser.username;

  renderLeaderboard();
  showStartScreen();
}

function updateUserHighScore(newScore) {
  if (!currentUser) return false;
  const users = loadUsers();
  const idx = users.findIndex(
    (u) => u.username.toLowerCase() === currentUser.username.toLowerCase()
  );
  if (idx === -1) return false;

  let isNewRecord = false;
  if (newScore > users[idx].bestScore) {
    users[idx].bestScore = newScore;
    users[idx].updatedAt = Date.now();
    currentUser.bestScore = newScore;
    saveUsers(users);
    isNewRecord = true;
  }
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
// 2. ระบบเกมเพลย์ (Aim Arrow + W Jump + Scrolling Platforms)
// ==========================================

const W = canvas.width;
const H = canvas.height;

// สถานะเกม: 'AUTH' | 'READY' | 'PLAYING' | 'GAMEOVER'
let gameState = 'AUTH';

// การกดปุ่ม
const keys = {
  left: false,
  right: false
};

// ค่าฟิสิกส์หลัก
const GRAVITY = 0.48;
const JUMP_SPEED = 13.6; // ความแรงกระโดดเมื่อกด W
const MAX_AIM_DEG = 65;  // มุมเล็งซ้าย-ขวาสูงสุด (องศาจากแนวดิ่ง)
const AIM_ROTATE_SPEED = 2.4; // ความเร็วในการหมุนเข็มลูกศร
const AIR_NUDGE = 0.16;  // ช่วยขยับกลางอากาศเล็กน้อยตามทิศลูกศร

let score = 0;
let highestFloor = 0;
let scrollActive = false; // จะเริ่มไหลลงมาทันทีที่กระโดดครั้งแรก (หรือหลังเริ่มเกม 1.8 วินาที)
let startGraceTimer = 0;
let baseScrollSpeed = 1.15;
let currentScrollMultiplier = 1.0;

let player = null;
let platforms = [];
let particles = [];
let floatingTexts = [];
let stars = [];

// สร้างดาวพื้นหลัง
for (let i = 0; i < 55; i++) {
  stars.push({
    x: Math.random() * W,
    y: Math.random() * H,
    r: Math.random() * 1.8 + 0.5,
    alpha: Math.random() * 0.7 + 0.2,
    speed: Math.random() * 0.3 + 0.1
  });
}

function initGameWorld() {
  score = 0;
  highestFloor = 0;
  scrollActive = false;
  startGraceTimer = 110; // ~1.8 วินาทีให้ตั้งหลักตอนเริ่ม ก่อนแท่นเริ่มไหลลงมาเอง
  currentScrollMultiplier = 1.0;
  particles = [];
  floatingTexts = [];
  platforms = [];

  // แท่นเริ่มต้นชั้นที่ 0 (กว้างพิเศษเพื่อให้ยืนตั้งหลักง่าย)
  const startPlat = {
    x: W / 2 - 75,
    y: H - 95,
    w: 150,
    h: 16,
    floor: 0,
    type: 'normal',
    vx: 0
  };
  platforms.push(startPlat);

  // สร้างแท่นล่วงหน้าขึ้นไปข้างบน
  let currentY = startPlat.y;
  for (let f = 1; f <= 10; f++) {
    currentY -= getVerticalGap(f);
    platforms.push(createPlatform(f, currentY));
  }

  // ตัวละครผู้เล่น
  player = {
    x: W / 2,
    y: startPlat.y - 20,
    r: 18,
    vx: 0,
    vy: 0,
    onGround: true,
    currentPlatform: startPlat,
    aimAngleDeg: 0, // 0 = ชี้ตรงขึ้นข้างบน, ลบ = ซ้าย, บวก = ขวา
    squash: 1.0
  };

  // หันลูกศรเล็งไปหาแท่นชั้นที่ 1 เป็นไกด์เริ่มต้นนิดหน่อย
  if (platforms[1]) {
    const targetCenter = platforms[1].x + platforms[1].w / 2;
    const dx = targetCenter - player.x;
    player.aimAngleDeg = Math.max(-35, Math.min(35, dx * 0.18));
  }

  updateHud();
}

function getVerticalGap(floor) {
  // ระยะห่างแนวตั้งที่กระโดดด้วย JUMP_SPEED ถึงได้สบายๆ
  return 88 + Math.min(22, floor * 0.35);
}

function createPlatform(floor, yPos) {
  // ยิ่งชั้นสูง แท่นจะแคบลงนิดหน่อยแต่ไม่แคบจนเกินไป
  const w = Math.max(68, 112 - Math.min(38, floor * 0.6));
  const margin = 24;

  // พยายามสุ่มตำแหน่ง X ให้ไม่ห่างจากแท่นก่อนหน้าเกินระยะกระโดดถึง
  const prevPlat = platforms[platforms.length - 1];
  let x;
  if (prevPlat) {
    const prevCenter = prevPlat.x + prevPlat.w / 2;
    const maxHorizReach = 185;
    const minX = Math.max(margin, prevCenter - maxHorizReach - w / 2);
    const maxX = Math.min(W - margin - w, prevCenter + maxHorizReach - w / 2);
    x = minX + Math.random() * Math.max(10, maxX - minX);
  } else {
    x = margin + Math.random() * (W - margin * 2 - w);
  }

  // ประเภทแท่น
  let type = 'normal';
  let vx = 0;

  if (floor >= 4 && Math.random() < 0.22) {
    type = 'moving';
    vx = (Math.random() < 0.5 ? -1 : 1) * (1.2 + Math.min(1.5, floor * 0.03));
  } else if (floor >= 3 && floor % 7 === 0) {
    type = 'bonus'; // แท่นสีทอง ได้คะแนนพิเศษ + เด้งแรงขึ้นนิดหน่อย
  }

  return {
    x,
    y: yPos,
    w,
    h: 15,
    floor,
    type,
    vx
  };
}

function triggerJump() {
  if (gameState !== 'PLAYING' || !player || !player.onGround) return;

  // เริ่มให้แท่นไหลลงมาทันทีที่กระโดดครั้งแรก
  scrollActive = true;

  const rad = (player.aimAngleDeg * Math.PI) / 180;
  // โบนัสความแรงถ้าเหยียบแท่นสีทอง
  const isBonusPlat = player.currentPlatform && player.currentPlatform.type === 'bonus';
  const power = isBonusPlat ? JUMP_SPEED * 1.15 : JUMP_SPEED;

  // คำนวณความเร็วแกน X และ Y ตามทิศลูกศรที่เล็ง
  player.vx = Math.sin(rad) * (power * 0.88);
  player.vy = -Math.cos(rad) * (power * 0.65) - (power * 0.42);
  player.onGround = false;
  player.currentPlatform = null;
  player.squash = 1.35;

  // เอฟเฟกต์ฝุ่นตอนกระโดด
  spawnParticles(player.x, player.y + player.r, '#38bdf8', 12);
}

function spawnParticles(x, y, color, count = 10) {
  for (let i = 0; i < count; i++) {
    particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 6,
      vy: (Math.random() - 0.5) * 5 - 1,
      r: Math.random() * 3.5 + 1.5,
      alpha: 1,
      color
    });
  }
}

function addFloatingText(text, x, y, color = '#fde047') {
  floatingTexts.push({
    text,
    x,
    y,
    vy: -1.5,
    alpha: 1,
    color
  });
}

function updateGame() {
  if (gameState !== 'PLAYING') return;

  // 1. หมุนเข็มลูกศรเล็งทิศทางด้วยปุ่ม ← →
  if (keys.left) {
    player.aimAngleDeg = Math.max(-MAX_AIM_DEG, player.aimAngleDeg - AIM_ROTATE_SPEED);
  }
  if (keys.right) {
    player.aimAngleDeg = Math.min(MAX_AIM_DEG, player.aimAngleDeg + AIM_ROTATE_SPEED);
  }

  // คืนรูปทรงตัวละคร (Squash & Stretch)
  player.squash += (1.0 - player.squash) * 0.18;

  // 2. นับถอยหลังช่วงเตรียมตัวตอนเริ่มเกม
  if (!scrollActive) {
    startGraceTimer--;
    if (startGraceTimer <= 0) {
      scrollActive = true;
    }
  }

  // 3. คำนวณความเร็วการไหลลงมาของแท่นเหยียบ
  currentScrollMultiplier = 1.0 + Math.min(2.2, score / 450);
  const autoScroll = scrollActive ? baseScrollSpeed * currentScrollMultiplier : 0;

  // ถ้าผู้เล่นกระโดดขึ้นไปสูงกว่า 42% บนของจอ ให้เลื่อนฉากลงเร็วขึ้นเพื่อตามตัวละคร
  let cameraCatchup = 0;
  const upperThreshold = H * 0.42;
  if (player.y < upperThreshold) {
    cameraCatchup = (upperThreshold - player.y) * 0.12;
  }

  const totalDownScroll = autoScroll + cameraCatchup;

  // 4. อัปเดตตำแหน่งแท่นเหยียบทั้งหมด
  for (const plat of platforms) {
    plat.y += totalDownScroll;

    if (plat.type === 'moving') {
      plat.x += plat.vx;
      if (plat.x < 16) {
        plat.x = 16;
        plat.vx *= -1;
      } else if (plat.x + plat.w > W - 16) {
        plat.x = W - 16 - plat.w;
        plat.vx *= -1;
      }
    }
  }

  // เลื่อนดาวพื้นหลัง
  for (const s of stars) {
    s.y += totalDownScroll * s.speed;
    if (s.y > H) {
      s.y = 0;
      s.x = Math.random() * W;
    }
  }

  // 5. อัปเดตตำแหน่งตัวละคร
  if (player.onGround && player.currentPlatform) {
    // ยืนติดอยู่บนแท่น (ไหลลงมาพร้อมแท่น และขยับตามแท่นเคลื่อนที่)
    player.y = player.currentPlatform.y - player.r;
    player.x += player.currentPlatform.vx || 0;
    player.vx = 0;
    player.vy = 0;

    // กันตกขอบซ้าย-ขวาเวลานั่งแท่นเคลื่อนที่
    player.x = Math.max(player.r + 6, Math.min(W - player.r - 6, player.x));
  } else {
    // ลอยอยู่กลางอากาศ
    // อนุญาตให้ประคองซ้าย-ขวากลางอากาศได้นิดหน่อยตามปุ่มลูกศร
    if (keys.left) player.vx -= AIR_NUDGE;
    if (keys.right) player.vx += AIR_NUDGE;

    const prevBottom = player.y + player.r;

    player.x += player.vx;
    player.y += player.vy + totalDownScroll;
    player.vy += GRAVITY;

    // ชนขอบซ้าย-ขวาแล้วเด้งกลับเข้าในฉาก
    if (player.x - player.r < 0) {
      player.x = player.r;
      player.vx = Math.abs(player.vx) * 0.75;
    } else if (player.x + player.r > W) {
      player.x = W - player.r;
      player.vx = -Math.abs(player.vx) * 0.75;
    }

    // เช็คการตกลงมาเหยียบแท่น (เฉพาะตอนกำลังตกลงมา vy > 0)
    if (player.vy > 0) {
      const currBottom = player.y + player.r;
      for (const plat of platforms) {
        const withinX = player.x + player.r * 0.65 >= plat.x && player.x - player.r * 0.65 <= plat.x + plat.w;
        const crossedTop = prevBottom <= plat.y + 12 && currBottom >= plat.y;

        if (withinX && crossedTop) {
          // ลงจอดสำเร็จ!
          player.onGround = true;
          player.currentPlatform = plat;
          player.y = plat.y - player.r;
          player.vx = 0;
          player.vy = 0;
          player.squash = 0.72;

          spawnParticles(player.x, plat.y, plat.type === 'bonus' ? '#facc15' : '#4ade80', 8);

          // คิดคะแนนเมื่อขึ้นชั้นใหม่ที่สูงกว่าเดิม
          if (plat.floor > highestFloor) {
            const diff = plat.floor - highestFloor;
            let gained = diff * 10;
            if (plat.type === 'bonus') {
              gained += 20;
              addFloatingText(`+${gained} โบนัส!`, player.x, player.y - 24, '#facc15');
            } else {
              addFloatingText(`+${gained}`, player.x, player.y - 20, '#4ade80');
            }
            highestFloor = plat.floor;
            score += gained;
          }
          break;
        }
      }
    }
  }

  // 6. สร้างแท่นใหม่ด้านบน และลบแท่นที่ไหลตกขอบล่างไปแล้ว
  platforms = platforms.filter((p) => p.y < H + 60);

  while (platforms.length > 0) {
    const topPlat = platforms[platforms.length - 1];
    if (topPlat.y > -80) {
      const nextFloor = topPlat.floor + 1;
      const nextY = topPlat.y - getVerticalGap(nextFloor);
      platforms.push(createPlatform(nextFloor, nextY));
    } else {
      break;
    }
  }

  // 7. อัปเดตพาร์ติเคิลและข้อความลอย
  for (const pt of particles) {
    pt.x += pt.vx;
    pt.y += pt.vy + totalDownScroll * 0.5;
    pt.alpha -= 0.03;
  }
  particles = particles.filter((pt) => pt.alpha > 0);

  for (const ft of floatingTexts) {
    ft.y += ft.vy;
    ft.alpha -= 0.022;
  }
  floatingTexts = floatingTexts.filter((ft) => ft.alpha > 0);

  // 8. เช็คเงื่อนไขตาย (ตกขอบล่างของจอ เพราะโดดไม่ทันแท่นที่ไหลลงมา หรือโดดพลาด)
  if (player.y - player.r > H - 14) {
    triggerGameOver();
  }

  updateHud();
}

function updateHud() {
  hudScoreEl.textContent = score.toLocaleString();
  hudSpeedEl.textContent = `${currentScrollMultiplier.toFixed(1)}x`;
  if (currentUser && score > currentUser.bestScore) {
    hudBestEl.textContent = score.toLocaleString();
  }
}

function triggerGameOver() {
  gameState = 'GAMEOVER';
  const isNewRecord = updateUserHighScore(score);

  finalScoreEl.textContent = score.toLocaleString();
  finalBestEl.textContent = currentUser ? currentUser.bestScore.toLocaleString() : score.toLocaleString();

  if (isNewRecord && score > 0) {
    newRecordBanner.classList.remove('hidden');
  } else {
    newRecordBanner.classList.add('hidden');
  }

  gameOverModal.classList.remove('hidden');
}

// ==========================================
// 3. ระบบวาดกราฟิก (Canvas Rendering)
// ==========================================

function drawGame() {
  // พื้นหลังไล่สีท้องฟ้ายามค่ำคืน
  const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
  bgGrad.addColorStop(0, '#090d16');
  bgGrad.addColorStop(0.6, '#111827');
  bgGrad.addColorStop(1, '#1e1b4b');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  // วาดดาว
  for (const s of stars) {
    ctx.fillStyle = `rgba(255, 255, 255, ${s.alpha})`;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }

  if (!player) return;

  // วาดแท่นเหยียบ
  for (const plat of platforms) {
    ctx.save();
    let grad = ctx.createLinearGradient(plat.x, plat.y, plat.x, plat.y + plat.h);
    if (plat.type === 'bonus') {
      grad.addColorStop(0, '#fde047');
      grad.addColorStop(1, '#ca8a04');
      ctx.shadowColor = 'rgba(250, 204, 21, 0.55)';
    } else if (plat.type === 'moving') {
      grad.addColorStop(0, '#c084fc');
      grad.addColorStop(1, '#7e22ce');
      ctx.shadowColor = 'rgba(192, 132, 252, 0.45)';
    } else {
      grad.addColorStop(0, '#38bdf8');
      grad.addColorStop(1, '#0284c7');
      ctx.shadowColor = 'rgba(56, 189, 248, 0.4)';
    }
    ctx.shadowBlur = 10;
    ctx.fillStyle = grad;

    roundRect(ctx, plat.x, plat.y, plat.w, plat.h, 7);
    ctx.fill();

    // เลขชั้นบนแท่นทุกๆ 5 ชั้น หรือแท่นโบนัส
    if (plat.floor > 0 && (plat.floor % 5 === 0 || plat.type === 'bonus')) {
      ctx.shadowBlur = 0;
      ctx.fillStyle = plat.type === 'bonus' ? '#0f172a' : '#e0f2fe';
      ctx.font = '700 10px Kanit';
      ctx.textAlign = 'center';
      const label = plat.type === 'bonus' ? `★ ชั้น ${plat.floor}` : `ชั้น ${plat.floor}`;
      ctx.fillText(label, plat.x + plat.w / 2, plat.y + 11);
    }
    ctx.restore();
  }

  // วาดเข็มลูกศรบอกทิศทาง และจุดประวิถีกระโดด (Aim Arrow)
  drawAimIndicator();

  // วาดตัวละครผู้เล่น
  drawPlayer();

  // วาดพาร์ติเคิล
  for (const pt of particles) {
    ctx.fillStyle = pt.color;
    ctx.globalAlpha = Math.max(0, pt.alpha);
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // วาดข้อความคะแนนลอย
  for (const ft of floatingTexts) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, ft.alpha);
    ctx.font = '800 16px Kanit';
    ctx.fillStyle = ft.color;
    ctx.textAlign = 'center';
    ctx.fillText(ft.text, ft.x, ft.y);
    ctx.restore();
  }

  // วาดเส้นเลเซอร์อันตรายด้านล่างสุดของจอ (Danger Zone)
  drawDangerZone();
}

function drawAimIndicator() {
  const rad = (player.aimAngleDeg * Math.PI) / 180;

  // ถ้าอยู่บนพื้น จะแสดงทั้งเส้นประจำลองวิถีโค้ง + ลูกศรใหญ่ชัดเจน
  if (player.onGround) {
    const isBonusPlat = player.currentPlatform && player.currentPlatform.type === 'bonus';
    const power = isBonusPlat ? JUMP_SPEED * 1.15 : JUMP_SPEED;
    let simVx = Math.sin(rad) * (power * 0.88);
    let simVy = -Math.cos(rad) * (power * 0.65) - (power * 0.42);
    let simX = player.x;
    let simY = player.y;

    ctx.save();
    for (let step = 1; step <= 16; step++) {
      simX += simVx * 1.6;
      simY += simVy * 1.6;
      simVy += GRAVITY * 1.6;

      // สะท้อนขอบจอในเส้นเล็งด้วย
      if (simX < player.r) {
        simX = player.r;
        simVx = Math.abs(simVx) * 0.75;
      } else if (simX > W - player.r) {
        simX = W - player.r;
        simVx = -Math.abs(simVx) * 0.75;
      }

      if (step % 2 === 0) {
        const dotAlpha = Math.max(0.15, 0.85 - step * 0.045);
        ctx.fillStyle = `rgba(250, 204, 21, ${dotAlpha})`;
        ctx.beginPath();
        ctx.arc(simX, simY, 3.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  // วาดเข็มลูกศรชี้ทิศทางบนหัวตัวละครเสมอ
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(rad);

  const arrowDist = player.r + 12;
  const arrowLen = 26;

  // ก้านลูกศร
  ctx.strokeStyle = '#fde047';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.shadowColor = 'rgba(250, 204, 21, 0.8)';
  ctx.shadowBlur = 8;

  ctx.beginPath();
  ctx.moveTo(0, -arrowDist);
  ctx.lineTo(0, -(arrowDist + arrowLen));
  ctx.stroke();

  // หัวลูกศรสามเหลี่ยม
  ctx.fillStyle = '#fde047';
  ctx.beginPath();
  ctx.moveTo(0, -(arrowDist + arrowLen + 10));
  ctx.lineTo(-9, -(arrowDist + arrowLen - 2));
  ctx.lineTo(9, -(arrowDist + arrowLen - 2));
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function drawPlayer() {
  ctx.save();
  ctx.translate(player.x, player.y);

  const scaleY = player.squash;
  const scaleX = 2.0 - player.squash;
  ctx.scale(scaleX, scaleY);

  // ตัวกลมเรืองแสง
  const grad = ctx.createRadialGradient(-5, -6, 3, 0, 0, player.r);
  grad.addColorStop(0, '#67e8f9');
  grad.addColorStop(0.6, '#0ea5e9');
  grad.addColorStop(1, '#1d4ed8');

  ctx.shadowColor = 'rgba(56, 189, 248, 0.7)';
  ctx.shadowBlur = 14;
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, player.r, 0, Math.PI * 2);
  ctx.fill();

  // ตาของตัวละคร (มองตามทิศที่เล็งลูกศร)
  ctx.shadowBlur = 0;
  const lookOffset = (player.aimAngleDeg / MAX_AIM_DEG) * 5;

  // ตาขาว
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(-6 + lookOffset, -3, 4.5, 0, Math.PI * 2);
  ctx.arc(6 + lookOffset, -3, 4.5, 0, Math.PI * 2);
  ctx.fill();

  // ตาดำ
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.arc(-6 + lookOffset * 1.3, -4, 2.3, 0, Math.PI * 2);
  ctx.arc(6 + lookOffset * 1.3, -4, 2.3, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawDangerZone() {
  const zoneH = 18;
  const grad = ctx.createLinearGradient(0, H - zoneH, 0, H);
  grad.addColorStop(0, 'rgba(239, 68, 68, 0)');
  grad.addColorStop(1, 'rgba(239, 68, 68, 0.75)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, H - zoneH, W, zoneH);

  // เส้นหยักเตือนภัยด้านล่าง
  ctx.strokeStyle = 'rgba(248, 113, 113, 0.85)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, H - 3);
  ctx.lineTo(W, H - 3);
  ctx.stroke();
}

function roundRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
}

// ==========================================
// 4. การควบคุมด้วยคีย์บอร์ด & ลูปหลักของเกม
// ==========================================

function showStartScreen() {
  gameState = 'READY';
  initGameWorld();
  startModal.classList.remove('hidden');
  gameOverModal.classList.add('hidden');
}

function startPlaying() {
  if (!currentUser) return;
  initGameWorld();
  gameState = 'PLAYING';
  startModal.classList.add('hidden');
  gameOverModal.classList.add('hidden');
}

startGameBtn.addEventListener('click', startPlaying);
restartGameBtn.addEventListener('click', startPlaying);

window.addEventListener('keydown', (e) => {
  // ถ้ากำลังพิมพ์ชื่อ/รหัสในช่อง Input ไม่ต้องดักปุ่มเกม
  if (document.activeElement === usernameInput || document.activeElement === passwordInput) {
    return;
  }

  if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
    keys.left = true;
    e.preventDefault();
  }
  if (e.code === 'ArrowRight' || e.code === 'KeyD') {
    keys.right = true;
    e.preventDefault();
  }

  // ปุ่ม W เพื่อกระโดด (รองรับทั้งแป้นไทย 'ไ' และอังกฤษ 'W' ด้วย e.code === 'KeyW')
  if (e.code === 'KeyW' || e.code === 'ArrowUp') {
    e.preventDefault();
    if (gameState === 'READY') {
      startPlaying();
    } else if (gameState === 'PLAYING') {
      triggerJump();
    }
  }

  // ปุ่ม Space หรือ Enter เพื่อเริ่มเกมใหม่ตอน Game Over
  if ((e.code === 'Space' || e.code === 'Enter') && (gameState === 'GAMEOVER' || gameState === 'READY')) {
    e.preventDefault();
    startPlaying();
  }
});

window.addEventListener('keyup', (e) => {
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
    keys.left = false;
  }
  if (e.code === 'ArrowRight' || e.code === 'KeyD') {
    keys.right = false;
  }
});

// ปุ่มกดบนหน้าจอสำหรับมือถือ / แท็บเล็ตในวง LAN
const touchLeftBtn = document.getElementById('touchLeftBtn');
const touchRightBtn = document.getElementById('touchRightBtn');
const touchJumpBtn = document.getElementById('touchJumpBtn');

if (touchLeftBtn && touchRightBtn && touchJumpBtn) {
  const bindHold = (btn, keyName) => {
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      keys[keyName] = true;
    });
    const release = () => { keys[keyName] = false; };
    btn.addEventListener('pointerup', release);
    btn.addEventListener('pointerleave', release);
    btn.addEventListener('pointercancel', release);
  };
  bindHold(touchLeftBtn, 'left');
  bindHold(touchRightBtn, 'right');

  touchJumpBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (gameState === 'READY') startPlaying();
    else if (gameState === 'PLAYING') triggerJump();
  });
}

if (window.LanSync) {
  window.LanSync.onUpdate(({ isLanConnected }) => {
    const badge = document.getElementById('lanBadge');
    if (badge) {
      badge.textContent = isLanConnected ? '🟢 LAN Online' : '⚪ Offline';
    }
    if (currentUser) {
      const users = loadUsers();
      const found = users.find((u) => u.username.toLowerCase() === currentUser.username.toLowerCase());
      if (found && found.bestScore > currentUser.bestScore) {
        currentUser.bestScore = found.bestScore;
      }
    }
    renderLeaderboard();
  });
}

// ลูปหลักของเกม 60 FPS
function gameLoop() {
  updateGame();
  drawGame();
  requestAnimationFrame(gameLoop);
}

// เริ่มต้นระบบเมื่อโหลดหน้าเว็บ
function boot() {
  initGameWorld();
  renderLeaderboard();

  // เช็คว่ามี session ผู้เล่นที่ล็อกอินค้างไว้ไหม
  const savedName = localStorage.getItem(STORAGE_KEY_SESSION);
  if (savedName) {
    const users = loadUsers();
    const found = users.find((u) => u.username.toLowerCase() === savedName.toLowerCase());
    if (found) {
      currentUser = found;
      onUserAuthenticated();
    }
  }

  requestAnimationFrame(gameLoop);
}

boot();
