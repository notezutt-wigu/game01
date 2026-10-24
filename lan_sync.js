// ==========================================
// LAN PARTY SYNC CLIENT - ซิงค์ข้อมูลผู้เล่นและอันดับข้ามเครื่องในวง LAN
// ==========================================

window.LanSync = (function () {
  const STORAGE_KEY_USERS = 'sky_aim_jumper_users_v1';
  const STORAGE_KEY_SESSION = 'sky_aim_jumper_current_user';

  let isLanConnected = false;
  let lanServerInfo = {
    ip: window.location.hostname || '192.168.10.129',
    port: window.location.port || '8080'
  };
  let listeners = [];

  function getLocalUsers() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_USERS);
      if (!raw) return [];
      return JSON.parse(raw);
    } catch (e) {
      return [];
    }
  }

  function saveLocalUsers(users) {
    try {
      localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(users));
    } catch (e) {}
  }

  function mergeUsersList(localList, remoteList) {
    const map = new Map();

    const addOrMerge = (u) => {
      if (!u || !u.username) return;
      const key = u.username.toLowerCase();
      const existing = map.get(key);
      if (!existing) {
        map.set(key, {
          username: u.username,
          password: u.password || '',
          bestScore: Number(u.bestScore) || 0,
          bestScoreG2: Number(u.bestScoreG2) || 0,
          bestWaveG2: Number(u.bestWaveG2) || 1,
          updatedAt: Number(u.updatedAt) || Date.now(),
          updatedAtG2: Number(u.updatedAtG2) || Date.now()
        });
      } else {
        if ((Number(u.bestScore) || 0) > existing.bestScore) {
          existing.bestScore = Number(u.bestScore);
          existing.updatedAt = Number(u.updatedAt) || Date.now();
        }
        if ((Number(u.bestScoreG2) || 0) > existing.bestScoreG2) {
          existing.bestScoreG2 = Number(u.bestScoreG2);
          existing.updatedAtG2 = Number(u.updatedAtG2) || Date.now();
        }
        if ((Number(u.bestWaveG2) || 1) > existing.bestWaveG2) {
          existing.bestWaveG2 = Number(u.bestWaveG2);
        }
        if (!existing.password && u.password) {
          existing.password = u.password;
        }
      }
    };

    if (Array.isArray(remoteList)) remoteList.forEach(addOrMerge);
    if (Array.isArray(localList)) localList.forEach(addOrMerge);

    return Array.from(map.values());
  }

  async function fetchFromLan() {
    if (window.location.protocol === 'file:') {
      isLanConnected = false;
      notifyListeners();
      return getLocalUsers();
    }

    try {
      const res = await fetch('/api/users', { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      isLanConnected = true;
      if (data.lanIp) lanServerInfo.ip = data.lanIp;
      if (data.port) lanServerInfo.port = data.port;

      const localUsers = getLocalUsers();
      const merged = mergeUsersList(localUsers, data.users || []);
      saveLocalUsers(merged);
      notifyListeners();
      return merged;
    } catch (e) {
      isLanConnected = false;
      notifyListeners();
      return getLocalUsers();
    }
  }

  async function pushToLan(usersArray) {
    saveLocalUsers(usersArray);
    if (window.location.protocol === 'file:') return;

    try {
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ users: usersArray })
      });
      if (res.ok) {
        const data = await res.json();
        isLanConnected = true;
        if (data.users) {
          saveLocalUsers(mergeUsersList(usersArray, data.users));
        }
        notifyListeners();
      }
    } catch (e) {
      isLanConnected = false;
      notifyListeners();
    }
  }

  function onUpdate(cb) {
    listeners.push(cb);
  }

  function notifyListeners() {
    const users = getLocalUsers();
    listeners.forEach((cb) => {
      try {
        cb({
          isLanConnected,
          lanUrl: `http://${lanServerInfo.ip}:${lanServerInfo.port}`,
          users
        });
      } catch (e) {}
    });
  }

  // ซิงค์อัตโนมัติทุกๆ 3.5 วินาทีเพื่อให้ตารางอันดับอัปเดตสดๆ จากเครื่องอื่นในวง LAN
  setInterval(fetchFromLan, 3500);
  setTimeout(fetchFromLan, 100);

  return {
    getLocalUsers,
    saveLocalUsers,
    fetchFromLan,
    pushToLan,
    onUpdate,
    getStatus: () => ({
      isLanConnected,
      lanUrl: `http://${lanServerInfo.ip}:${lanServerInfo.port}`
    })
  };
})();
