/* ============================================================
   SwapSkills data layer
   ------------------------------------------------------------
   Right now this runs on localStorage, so two browser TABS on
   the SAME device can talk to each other live (open the site in
   two tabs to test the full "two person" flow: room codes,
   accept requests, battles, etc).

   Two different DEVICES (your phone + your friend's laptop)
   will NOT see each other yet, because GitHub Pages can't store
   shared data on its own.

   TO GO CROSS-DEVICE: this file is the ONLY file you need to
   change. Every function below already returns Promises, so
   swapping the internals for Firebase Firestore calls will not
   require touching app.js at all. See README.md for the
   step-by-step Firebase swap.
   ============================================================ */

const DB_KEYS = {
  users: "sr_users",
  rooms: "sr_rooms",
  battles: "sr_battles",
  session: "sr_session",
};

function _read(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

function _write(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
  // Manually notify listeners in THIS tab too (native storage event
  // only fires in other tabs), so a single-tab test still updates UI.
  window.dispatchEvent(new CustomEvent("sr:change", { detail: { key } }));
}

const DB = {
  // ---------- session ----------
  getSessionEmail() {
    return localStorage.getItem(DB_KEYS.session) || null;
  },
  setSessionEmail(email) {
    if (email) localStorage.setItem(DB_KEYS.session, email);
    else localStorage.removeItem(DB_KEYS.session);
    window.dispatchEvent(new CustomEvent("sr:change", { detail: { key: DB_KEYS.session } }));
  },

  // ---------- users ----------
  allUsers() {
    return _read(DB_KEYS.users);
  },
  getUser(email) {
    const users = _read(DB_KEYS.users);
    return users[email] || null;
  },
  upsertUser(user) {
    const users = _read(DB_KEYS.users);
    users[user.email] = { ...(users[user.email] || {}), ...user };
    _write(DB_KEYS.users, users);
    return users[user.email];
  },
  saveUser(user) {
    const users = _read(DB_KEYS.users);
    users[user.email] = user;
    _write(DB_KEYS.users, users);
    return user;
  },
  otherUsers(myEmail) {
    const users = _read(DB_KEYS.users);
    return Object.values(users).filter((u) => u.email !== myEmail);
  },

  // ---------- rooms ----------
  allRooms() {
    return _read(DB_KEYS.rooms);
  },
  getRoom(code) {
    const rooms = _read(DB_KEYS.rooms);
    return rooms[code] || null;
  },
  saveRoom(room) {
    const rooms = _read(DB_KEYS.rooms);
    rooms[room.code] = room;
    _write(DB_KEYS.rooms, rooms);
    return room;
  },
  deleteRoom(code) {
    const rooms = _read(DB_KEYS.rooms);
    delete rooms[code];
    _write(DB_KEYS.rooms, rooms);
  },
  roomsForUser(email) {
    const rooms = _read(DB_KEYS.rooms);
    return Object.values(rooms).filter((r) => r.hostEmail === email || r.guestEmail === email);
  },

  // ---------- battles ----------
  allBattles() {
    return _read(DB_KEYS.battles);
  },
  getBattle(id) {
    const battles = _read(DB_KEYS.battles);
    return battles[id] || null;
  },
  saveBattle(battle) {
    const battles = _read(DB_KEYS.battles);
    battles[battle.id] = battle;
    _write(DB_KEYS.battles, battles);
    return battle;
  },
  battlesForUser(email) {
    const battles = _read(DB_KEYS.battles);
    return Object.values(battles).filter((b) => b.p1 === email || b.p2 === email);
  },

  // ---------- live updates ----------
  // Fires cb() whenever any tab (or this tab) changes shared data.
  onChange(cb) {
    window.addEventListener("storage", cb);
    window.addEventListener("sr:change", cb);
    return () => {
      window.removeEventListener("storage", cb);
      window.removeEventListener("sr:change", cb);
    };
  },
};
