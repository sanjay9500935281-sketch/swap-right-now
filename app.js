/* ============================================================
   SwapSkills — app.js
   Vanilla JS single-page app. Renders everything into #app-root
   based on `state`. Data persistence lives in db.js (DB.*).
   ============================================================ */

const CATS = {
  engineering: { label: "Engineering", icon: "🛠️" },
  arts: { label: "Arts & Science", icon: "🎨" },
  languages: { label: "Languages", icon: "🗣️" },
};

const NAV = [
  { id: "dashboard", label: "Dashboard", icon: "🏠" },
  { id: "skills", label: "Skills", icon: "📖" },
  { id: "matches", label: "Matches", icon: "👥" },
  { id: "connect", label: "Connect", icon: "🔗" },
  { id: "invite", label: "Invite", icon: "🎁" },
  { id: "dna", label: "Skill DNA", icon: "🧬" },
  { id: "battles", label: "Battles", icon: "⚔️" },
  { id: "aptitude", label: "Aptitude", icon: "🎯" },
];

const state = {
  route: "landing",
  modal: null, // 'login' | 'addSkill' | 'createBattle'
  skillsTab: "all",
  aptCategory: "engineering",
  aptTopic: "Mixed",
  aptSession: null, // { questions, index, score, category }
  connectJoinCode: "",
  loginEmail: "",
  chatDraft: "",
  battleView: null, // battle id being viewed
  toastTimer: null,
};

// ---------------- utils ----------------
function uid() { return Math.random().toString(36).slice(2, 10); }
function genRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}
function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
function escapeHtml(s) {
  return String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function initials(name) {
  return (name || "?").split(" ").filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
}
function toast(msg) {
  const stack = document.getElementById("toast-stack");
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = msg;
  stack.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}
function currentUser() {
  const email = DB.getSessionEmail();
  return email ? DB.getUser(email) : null;
}

// ---------------- seed demo data (only if store is empty) ----------------
function seedIfEmpty() {
  const users = DB.allUsers();
  if (Object.keys(users).length > 0) return;
  const demo = [
    { email: "rohan.verma@gmail.com", name: "Rohan Verma", skills: [
        { id: uid(), name: "Python", category: "engineering", mode: "teach" },
        { id: uid(), name: "Guitar", category: "arts", mode: "learn" } ] },
    { email: "meera.patel@gmail.com", name: "Meera Patel", skills: [
        { id: uid(), name: "Canva", category: "arts", mode: "learn" },
        { id: uid(), name: "French", category: "languages", mode: "teach" } ] },
    { email: "arjun.sharma@gmail.com", name: "Arjun Sharma", skills: [
        { id: uid(), name: "Excel", category: "engineering", mode: "teach" },
        { id: uid(), name: "Public Speaking", category: "arts", mode: "learn" } ] },
  ];
  demo.forEach((d) => {
    DB.saveUser({
      email: d.email, name: d.name, skills: d.skills,
      connections: [], referredBy: null, joinedAt: Date.now() - Math.floor(Math.random() * 5e8),
      sessionsTaught: Math.floor(Math.random() * 4), battlesPlayed: Math.floor(Math.random() * 5),
      battlesWon: Math.floor(Math.random() * 3), seenQuestions: {}, lastSeen: Date.now(),
    });
  });
}

// ---------------- matching ----------------
function matchScore(me, other) {
  const myTeach = me.skills.filter((s) => s.mode === "teach").map((s) => s.name.toLowerCase().trim());
  const myLearn = me.skills.filter((s) => s.mode === "learn").map((s) => s.name.toLowerCase().trim());
  const otherTeach = other.skills.filter((s) => s.mode === "teach").map((s) => s.name.toLowerCase().trim());
  const otherLearn = other.skills.filter((s) => s.mode === "learn").map((s) => s.name.toLowerCase().trim());
  const iCanLearnFromThem = myLearn.filter((s) => otherTeach.includes(s));
  const theyCanLearnFromMe = otherLearn.filter((s) => myTeach.includes(s));
  const reciprocal = iCanLearnFromThem.length + theyCanLearnFromMe.length;
  let score;
  if (reciprocal > 0) score = clamp(45 + reciprocal * 20, 45, 98);
  else {
    // small deterministic baseline so the list isn't all identical
    let hash = 0;
    for (const c of me.email + other.email) hash = (hash * 31 + c.charCodeAt(0)) % 97;
    score = clamp(20 + (hash % 25), 18, 44);
  }
  return { score, iLearn: iCanLearnFromThem, theyLearn: theyCanLearnFromMe, myTeachTop: me.skills.find(s=>s.mode==='teach'), otherTeachTop: other.skills.find(s=>s.mode==='teach') };
}
function rankedMatches(me) {
  return DB.otherUsers(me.email)
    .map((u) => ({ user: u, ...matchScore(me, u) }))
    .sort((a, b) => b.score - a.score);
}

// ---------------- skill DNA ----------------
function computeDNA(user) {
  const teachCount = user.skills.filter((s) => s.mode === "teach").length;
  const learnCount = user.skills.filter((s) => s.mode === "learn").length;
  const conns = (user.connections || []).length;
  const taught = user.sessionsTaught || 0;
  const played = user.battlesPlayed || 0;
  const won = user.battlesWon || 0;
  const knowledge = clamp(30 + teachCount * 6 + learnCount * 4 + won * 3, 20, 99);
  const teaching = clamp(25 + teachCount * 10 + taught * 8, 20, 99);
  const consistency = clamp(28 + conns * 10 + taught * 4, 20, 99);
  const confidence = clamp(30 + played * 6 + won * 4, 20, 99);
  const overall = Math.round((knowledge + teaching + consistency + confidence) / 4);
  const bars = { Knowledge: knowledge, Teaching: teaching, Consistency: consistency, Confidence: confidence };
  const weakest = Object.entries(bars).sort((a, b) => a[1] - b[1])[0][0];
  const tips = {
    Knowledge: "Add a couple more skills you can teach or learn to widen your matches.",
    Teaching: "Finish a teaching session and mark it done to grow this faster.",
    Consistency: "Reconnect with a past partner — steady swaps build this up.",
    Confidence: "Jump into a battle. Even a close loss sharpens this score.",
  };
  return { overall, bars, weakest, tip: tips[weakest] };
}

// ---------------- render root ----------------
function render() {
  const root = document.getElementById("app-root");
  const user = currentUser();
  if (!user) {
    root.innerHTML = renderLanding();
  } else {
    root.innerHTML = renderShell(user);
  }
  if (state.modal) {
    root.insertAdjacentHTML("beforeend", renderModal(user));
  }
  bindPostRender();
}
function safeRender() {
  const ae = document.activeElement;
  if (ae && ae.dataset && ae.dataset.preserve === "1") return;
  render();
}

function bindPostRender() {
  // nothing needed globally right now; per-element handlers are inline via Actions.*
}

// ================================================================
// LANDING
// ================================================================
function renderLanding() {
  return `
  <div class="landing">
    <div class="landing-nav">
      <div class="brand"><span class="mark">S</span> SwapSkills</div>
      <button class="btn secondary sm" onclick="Actions.openLogin()">Sign in</button>
    </div>
    <div class="landing-hero">
      <div>
        <div class="kicker">✨ Peer-to-peer learning</div>
        <h1>Learn what you need. Teach what you know.</h1>
        <p class="lede">SwapSkills connects students through reciprocal skill exchange — learn from a peer while helping someone else grow. Match, connect, teach, learn, clear doubts, and battle to test what stuck.</p>
        <div class="hero-actions">
          <button class="btn" onclick="Actions.tryDemo()">Try demo →</button>
          <button class="btn secondary" onclick="Actions.openLogin()">Sign in</button>
        </div>
      </div>
      <div class="hero-art">
        <div class="swap-card teach"><span class="label">🎓 YOU TEACH</span><span class="val">Canva</span></div>
        <div class="swap-mid">⇅ SMART MATCH</div>
        <div class="swap-card learn"><span class="label">🧠 YOU LEARN</span><span class="val">Python</span></div>
      </div>
    </div>
  </div>`;
}

// ================================================================
// SHELL (logged-in)
// ================================================================
function renderShell(user) {
  return `
  <div class="shell">
    <div class="topbar">
      <div class="brand"><span class="mark">S</span> SwapSkills</div>
      <button onclick="Actions.go('${state.route === 'dashboard' ? 'skills' : 'dashboard'}')">☰ Menu</button>
    </div>
    <div class="sidebar">
      <div class="brand"><span class="mark">S</span> SwapSkills</div>
      ${NAV.map((n) => `<button class="nav-item ${state.route === n.id ? "active" : ""}" onclick="Actions.go('${n.id}')"><span class="ic">${n.icon}</span> ${n.label}</button>`).join("")}
      <div class="sidebar-spacer"></div>
      <div class="sidebar-user">
        <div class="avatar">${initials(user.name)}</div>
        <div class="who"><div class="name">${escapeHtml(user.name)}</div><div class="em">${escapeHtml(user.email)}</div></div>
        <button title="Sign out" onclick="Actions.logout()">⎋</button>
      </div>
    </div>
    <div class="main">
      ${renderRoute(user)}
    </div>
  </div>`;
}

function renderRoute(user) {
  switch (state.route) {
    case "skills": return renderSkills(user);
    case "matches": return renderMatches(user);
    case "connect": return renderConnect(user);
    case "invite": return renderInvite(user);
    case "dna": return renderDNA(user);
    case "battles": return renderBattles(user);
    case "aptitude": return renderAptitude(user);
    default: return renderDashboard(user);
  }
}

// ================================================================
// DASHBOARD
// ================================================================
function renderDashboard(user) {
  const dna = computeDNA(user);
  const matches = rankedMatches(user).slice(0, 3);
  const myRoom = myActiveRoom(user);
  const incoming = pendingIncomingRoom(user);
  const teachSkill = user.skills.find((s) => s.mode === "teach");
  const learnSkill = user.skills.find((s) => s.mode === "learn");

  return `
  <div class="page-head">
    <h2>Welcome back, ${escapeHtml(user.name.split(" ")[0])} 👋</h2>
    <p>${teachSkill ? `You teach <strong>${escapeHtml(teachSkill.name)}</strong>` : "Add a skill you can teach"}${learnSkill ? ` · You're learning <strong>${escapeHtml(learnSkill.name)}</strong>` : ""}.</p>
  </div>

  ${incoming ? `
  <div class="card tint-gold" style="margin-bottom:16px;">
    <div class="row-between">
      <div><strong>${escapeHtml(otherPartyName(incoming, user))}</strong> wants to connect with you.</div>
      <div class="gap-8" style="display:flex;">
        <button class="btn sm" onclick="Actions.acceptRoom('${incoming.code}')">Accept</button>
        <button class="btn sm secondary" onclick="Actions.declineRoom('${incoming.code}')">Decline</button>
      </div>
    </div>
  </div>` : ""}

  <div class="grid cols-3">
    <div class="card tint-teal">
      <div class="stat-row"><span class="stat-num">${matches.length ? matches[0].score : 0}%</span></div>
      <div class="stat-label">Top match: ${matches.length ? escapeHtml(matches[0].user.name) : "add skills to get matched"}</div>
      <div style="margin-top:12px;"><button class="btn sm" onclick="Actions.go('matches')">👥 See matches</button></div>
    </div>
    <div class="card tint-gold">
      <div class="stat-row"><span class="stat-num">${dna.overall}</span></div>
      <div class="stat-label">Skill DNA score</div>
      <div style="margin-top:12px;"><button class="btn sm gold" onclick="Actions.go('dna')">🧬 View breakdown</button></div>
    </div>
    <div class="card ${myRoom ? "tint-coral" : ""}">
      <div class="stat-row"><span class="stat-num">${myRoom ? "1" : "0"}</span></div>
      <div class="stat-label">${myRoom ? "Active room — " + roomStatusLabel(myRoom, user) : "No open room yet"}</div>
      <div style="margin-top:12px;"><button class="btn sm secondary" onclick="Actions.go('connect')">🔗 Connect</button></div>
    </div>
  </div>

  <div class="section-title">Quick actions</div>
  <div class="grid cols-3">
    <div class="card">
      <div style="font-weight:600;margin-bottom:6px;">➕ Add a skill</div>
      <p class="muted small" style="margin:0 0 12px;">Tell people what you can teach or want to learn.</p>
      <button class="btn secondary sm block" onclick="Actions.openAddSkill()">Add skill</button>
    </div>
    <div class="card">
      <div style="font-weight:600;margin-bottom:6px;">🎁 Invite a friend</div>
      <p class="muted small" style="margin:0 0 12px;">Share your link — they join and connect to you.</p>
      <button class="btn secondary sm block" onclick="Actions.go('invite')">Get my link</button>
    </div>
    <div class="card">
      <div style="font-weight:600;margin-bottom:6px;">🎯 Practice aptitude</div>
      <p class="muted small" style="margin:0 0 12px;">Engineering, Arts &amp; Science, or Languages.</p>
      <button class="btn secondary sm block" onclick="Actions.go('aptitude')">Start practice</button>
    </div>
  </div>`;
}

// ================================================================
// SKILLS
// ================================================================
function renderSkills(user) {
  const tabs = ["all", ...Object.keys(CATS)];
  const list = user.skills.filter((s) => state.skillsTab === "all" || s.category === state.skillsTab);
  return `
  <div class="page-head row-between">
    <div><h2>Skills</h2><p>Browse by category — Engineering, Arts &amp; Science, and Languages.</p></div>
    <button class="btn" onclick="Actions.openAddSkill()">＋ Add skill</button>
  </div>
  <div class="tabs">
    ${tabs.map((t) => `<button class="tab ${state.skillsTab === t ? "active" : ""}" onclick="Actions.setSkillsTab('${t}')">${t === "all" ? "All" : CATS[t].icon + " " + CATS[t].label}</button>`).join("")}
  </div>
  <div class="card">
    ${list.length === 0 ? `<div class="empty">No skills here yet. Add one to start matching with people.</div>` :
      list.map((s) => `
      <div class="list-row">
        <div class="meta">
          <div class="n">${CATS[s.category].icon} ${escapeHtml(s.name)}</div>
          <div class="s">${CATS[s.category].label}</div>
        </div>
        <span class="chip ${s.mode}">${s.mode === "teach" ? "🎓 Teaching" : "🧠 Learning"}</span>
        <button class="btn sm secondary" onclick="Actions.removeSkill('${s.id}')">Remove</button>
      </div>`).join("")}
  </div>`;
}

// ================================================================
// MATCHES
// ================================================================
function renderMatches(user) {
  const list = rankedMatches(user);
  return `
  <div class="page-head row-between">
    <div><h2>Matches</h2><p>Ranked by reciprocal skill fit — both people teach and learn from each other.</p></div>
    <button class="btn secondary sm" onclick="toast('Matches recalculated'); render();">↺ Recalculate</button>
  </div>
  ${list.length === 0 ? `<div class="empty">No one else has joined yet. Invite a friend to get matched.</div>` :
  `<div class="card">
    ${list.map((m) => `
    <div class="list-row">
      <div class="avatar">${initials(m.user.name)}</div>
      <div class="meta">
        <div class="n">${escapeHtml(m.user.name)} <span class="chip" style="margin-left:6px;">${m.score}% match</span></div>
        <div class="s">${m.myTeachTop ? "You teach " + escapeHtml(m.myTeachTop.name) : "Add a skill to teach"} ${m.otherTeachTop ? " · They teach " + escapeHtml(m.otherTeachTop.name) : ""}</div>
      </div>
      <button class="btn sm secondary" onclick="Actions.inviteUser('${m.user.email}')">🔗 Connect</button>
      <button class="btn sm" onclick="Actions.quickBattle('${m.user.email}')">⚔️ Battle</button>
    </div>`).join("")}
  </div>`}`;
}

// ================================================================
// CONNECT
// ================================================================
function otherPartyName(room, user) {
  const otherEmail = room.hostEmail === user.email ? room.guestEmail : room.hostEmail;
  const u = DB.getUser(otherEmail);
  return u ? u.name : otherEmail;
}
function approverEmail(room) {
  return room.initiator === room.hostEmail ? room.guestEmail : room.hostEmail;
}
function myActiveRoom(user) {
  return DB.roomsForUser(user.email).find((r) => ["waiting", "pending", "connected", "active"].includes(r.status));
}
function pendingIncomingRoom(user) {
  return DB.roomsForUser(user.email).find((r) => r.status === "pending" && approverEmail(r) === user.email);
}
function roomStatusLabel(room, user) {
  if (room.status === "waiting") return "waiting for partner";
  if (room.status === "pending") return approverEmail(room) === user.email ? "request to accept" : "request sent";
  if (room.status === "connected") return "pick a skill";
  if (room.status === "active") return "session live";
  return room.status;
}

function renderConnect(user) {
  const myRoom = myActiveRoom(user);
  if (myRoom) return renderRoomDetail(myRoom, user);

  const inRoomEmails = new Set();
  Object.values(DB.allRooms()).forEach((r) => {
    if (["waiting", "pending", "connected", "active"].includes(r.status)) {
      inRoomEmails.add(r.hostEmail); inRoomEmails.add(r.guestEmail);
    }
  });
  const suggested = DB.otherUsers(user.email).filter((u) => !inRoomEmails.has(u.email));
  const pastPartners = (user.connections || []).map((e) => DB.getUser(e)).filter(Boolean).filter((u) => !inRoomEmails.has(u.email));

  return `
  <div class="page-head">
    <h2>Connect with a partner</h2>
    <p>Create a room and share the code, or connect directly with someone below — both people pick a skill and take turns teaching &amp; learning.</p>
  </div>

  <div class="card" style="margin-bottom:18px;">
    <div class="row-between" style="margin-bottom:12px;">
      <strong>Create or join a room</strong>
    </div>
    <div class="grid cols-2">
      <button class="btn block" onclick="Actions.createRoom()">＋ Create new room</button>
      <div style="display:flex;gap:8px;">
        <input type="text" placeholder="Enter room code" maxlength="6" data-preserve="1" value="${escapeHtml(state.connectJoinCode)}" oninput="state.connectJoinCode=this.value.toUpperCase()" style="flex:1;padding:11px 13px;border-radius:6px;border:1px solid var(--line);text-transform:uppercase;">
        <button class="btn secondary" onclick="Actions.joinRoomByCode()">Join</button>
      </div>
    </div>
  </div>

  <div class="section-title">🟢 Suggested — people online now</div>
  <p class="muted small mt-0">Anyone who's signed in recently. Tap Connect to send them a room invite.</p>
  <div class="card" style="margin-bottom:22px;">
    ${suggested.length === 0 ? `<div class="empty">No one else is around yet — invite a friend from the Invite tab.</div>` :
      suggested.map((u) => `
      <div class="list-row">
        <div class="avatar">${initials(u.name)}</div>
        <div class="meta"><div class="n">${escapeHtml(u.name)}</div><div class="s">${escapeHtml(u.email)}</div></div>
        <button class="btn sm" onclick="Actions.inviteUser('${u.email}')">🔗 Connect</button>
      </div>`).join("")}
  </div>

  <div class="section-title">🔁 Reconnect with a past partner</div>
  <p class="muted small mt-0">People you've already swapped skills with.</p>
  <div class="card">
    ${pastPartners.length === 0 ? `<div class="empty">No past partners yet. Your first swap will show up here.</div>` :
      pastPartners.map((u) => `
      <div class="list-row">
        <div class="avatar">${initials(u.name)}</div>
        <div class="meta"><div class="n">${escapeHtml(u.name)}</div><div class="s">${escapeHtml(u.email)}</div></div>
        <button class="btn sm secondary" onclick="Actions.inviteUser('${u.email}')">🔁 Reconnect</button>
      </div>`).join("")}
  </div>`;
}

function renderRoomDetail(room, user) {
  const isHost = room.hostEmail === user.email;
  const otherEmail = isHost ? room.guestEmail : room.hostEmail;
  const otherUser = otherEmail ? DB.getUser(otherEmail) : null;

  let body = "";
  if (room.status === "waiting") {
    body = `
      <div class="code-display">${room.code}</div>
      <div class="code-actions" style="margin-bottom:16px;">
        <button class="btn sm secondary" onclick="Actions.copyText('${room.code}')">📋 Copy code</button>
        <button class="btn sm secondary" onclick="Actions.copyJoinLink('${room.code}')">🔗 Copy join link</button>
        <button class="btn sm ghost" onclick="Actions.refreshRoom('${room.code}')">⟳ Refresh</button>
      </div>
      <div class="empty">⏳ Waiting for your partner to join…</div>
      <div style="margin-top:14px;"><button class="btn sm secondary" onclick="Actions.leaveRoom('${room.code}')">Cancel room</button></div>`;
  } else if (room.status === "pending") {
    if (approverEmail(room) === user.email) {
      body = `
        <div class="card tint-gold" style="margin-bottom:14px;">
          <strong>${escapeHtml(otherUser ? otherUser.name : otherEmail)}</strong> wants to connect with you.
        </div>
        <div class="gap-8" style="display:flex;">
          <button class="btn" onclick="Actions.acceptRoom('${room.code}')">Accept</button>
          <button class="btn secondary" onclick="Actions.declineRoom('${room.code}')">Decline</button>
        </div>`;
    } else {
      body = `<div class="empty">⏳ Request sent to <strong>${escapeHtml(otherUser ? otherUser.name : otherEmail)}</strong> — waiting for them to accept.</div>
        <div style="margin-top:14px;"><button class="btn sm secondary" onclick="Actions.leaveRoom('${room.code}')">Cancel request</button></div>`;
    }
  } else if (room.status === "connected") {
    const myTeachSkills = user.skills.filter((s) => s.mode === "teach");
    const already = room.teach && room.teach[user.email];
    body = `
      <div class="flow-steps"><div class="flow-step done"></div><div class="flow-step done"></div><div class="flow-step"></div></div>
      <h3 style="margin-top:0;">Step 2 — Pick what you'll teach</h3>
      <p class="muted">You're connected with <strong>${escapeHtml(otherUser ? otherUser.name : otherEmail)}</strong>. Choose the skill you'll teach them this session.</p>
      ${already ? `<div class="card tint-teal">You picked <strong>${escapeHtml(already)}</strong>. Waiting for ${escapeHtml(otherUser ? otherUser.name : "your partner")} to pick theirs…</div>` : `
      <div class="field">
        <label>Skill to teach</label>
        <select id="teachPick" ${myTeachSkills.length === 0 ? "disabled" : ""}>
          ${myTeachSkills.length === 0 ? `<option>Add a teaching skill first</option>` : myTeachSkills.map((s) => `<option value="${escapeHtml(s.name)}">${escapeHtml(s.name)}</option>`).join("")}
        </select>
      </div>
      <button class="btn block" ${myTeachSkills.length === 0 ? "disabled" : ""} onclick="Actions.confirmTeachSkill('${room.code}')">Confirm skill</button>`}
    `;
  } else if (room.status === "active") {
    body = renderTeachLearn(room, user, otherUser);
  }

  return `
  <div class="page-head">
    <button class="btn secondary sm" onclick="Actions.go('connect')" style="margin-bottom:14px;">‹ Back</button>
    <h2>${room.status === "active" ? "Teach & Learn" : "Room " + room.code}</h2>
  </div>
  <div class="card">${body}</div>`;
}

function renderTeachLearn(room, user, otherUser) {
  const myTeach = room.teach ? room.teach[user.email] : null;
  const theirTeach = room.teach && otherUser ? room.teach[otherUser.email] : null;
  const iTaught = room.taught && room.taught[user.email];
  const theyTaught = room.taught && otherUser && room.taught[otherUser.email];
  const messages = room.messages || [];

  return `
  <div class="partner-status"><span class="dot on"></span> Connected with ${escapeHtml(otherUser ? otherUser.name : "partner")}</div>
  <div class="tl-grid">
    <div class="card tint-teal">
      <div class="chip teach" style="margin-bottom:10px;">🎓 You teach</div>
      <div style="font-weight:700;font-size:18px;margin-bottom:12px;">${escapeHtml(myTeach || "—")}</div>
      <p class="small muted">Walk your partner through it live, then mark it done.</p>
      <button class="btn sm ${iTaught ? "secondary" : ""}" onclick="Actions.markTaught('${room.code}')" ${iTaught ? "disabled" : ""}>${iTaught ? "✅ Marked taught" : "✅ I've taught this"}</button>
    </div>
    <div class="card tint-gold">
      <div class="chip learn" style="margin-bottom:10px;">🧠 You learn</div>
      <div style="font-weight:700;font-size:18px;margin-bottom:12px;">${escapeHtml(theirTeach || "—")}</div>
      <p class="small muted">${theyTaught ? "✅ Your partner confirmed they've taught this." : "Waiting for your partner to finish teaching."}</p>
    </div>
  </div>

  <div class="section-title">💬 Ask a doubt</div>
  <div class="chat-box" id="chatBox">
    ${messages.length === 0 ? `<div class="muted small">No messages yet — ask your partner (or the AI helper) anything about the topic.</div>` :
      messages.map((m) => `<div class="msg ${m.from === user.email ? "me" : (m.from === "ai" ? "ai" : "them")}">${m.from === "ai" ? "🤖 " : ""}${escapeHtml(m.text)}</div>`).join("")}
  </div>
  <div class="chat-input-row" style="margin-bottom:10px;">
    <input type="text" data-preserve="1" placeholder="Type your doubt…" value="${escapeHtml(state.chatDraft)}" oninput="state.chatDraft=this.value" onkeydown="if(event.key==='Enter'){Actions.sendChat('${room.code}');}">
    <button class="btn sm secondary" onclick="Actions.sendChat('${room.code}')">Ask</button>
    <button class="btn sm gold" onclick="Actions.askAI('${room.code}')">🤖 Ask AI</button>
  </div>

  <hr class="rule">
  <div class="row-between">
    <button class="btn coral sm" onclick="Actions.startRoomBattle('${room.code}')">⚔️ Battle your partner</button>
    <button class="btn secondary sm" onclick="Actions.leaveRoom('${room.code}')">Leave room</button>
  </div>`;
}

// ================================================================
// INVITE
// ================================================================
function renderInvite(user) {
  const link = `${location.origin}${location.pathname}?ref=${encodeURIComponent(user.email)}`;
  const friends = DB.otherUsers(user.email).filter((u) => u.referredBy === user.email);
  const waText = encodeURIComponent(`Join me on SwapSkills — teach what you know, learn what you need: ${link}`);
  return `
  <div class="page-head">
    <h2>Invite friends</h2>
    <p>Share your personal link — anyone who signs up through it gets connected to you, and it's the fastest way to find a swap partner.</p>
  </div>
  <div class="card" style="margin-bottom:20px;">
    <label class="muted small" style="font-weight:600;">Your referral link</label>
    <div class="row-between" style="margin-top:8px;">
      <input type="text" readonly value="${escapeHtml(link)}" style="flex:1;padding:11px 13px;border-radius:6px;border:1px solid var(--line);background:var(--paper-2);">
    </div>
    <div class="gap-8" style="display:flex;margin-top:12px;">
      <button class="btn sm" onclick="Actions.copyText('${link.replace(/'/g, "\\'")}')">Copy link</button>
      <a class="btn sm secondary" href="https://wa.me/?text=${waText}" target="_blank" rel="noopener">💬 Share on WhatsApp</a>
    </div>
  </div>
  <div class="section-title">Friends invited</div>
  <p class="muted small mt-0">People who signed in through your link.</p>
  <div class="card">
    <div class="stat-row"><span class="stat-num">${friends.length}</span><span class="stat-label">joined via your link</span></div>
    ${friends.length > 0 ? `<hr class="rule">` + friends.map((f) => `
      <div class="list-row">
        <div class="avatar">${initials(f.name)}</div>
        <div class="meta"><div class="n">${escapeHtml(f.name)}</div><div class="s">${escapeHtml(f.email)}</div></div>
        <span class="chip on">Gmail ✓</span>
      </div>`).join("") : ""}
  </div>`;
}

// ================================================================
// SKILL DNA
// ================================================================
function renderDNA(user) {
  const dna = computeDNA(user);
  const matches = rankedMatches(user).slice(0, 4);
  return `
  <div class="page-head row-between">
    <div><h2>Skill DNA</h2><p>Based on current activity — not a permanent measure of ability.</p></div>
    <button class="btn secondary sm" onclick="Actions.recalcDNA()">↺ Recalculate</button>
  </div>
  <div class="card" style="margin-bottom:20px;">
    <div class="dna-ring-wrap">
      <div><div class="dna-num">${dna.overall}</div><div class="muted small">Overall Skill DNA</div></div>
      <div class="dna-bars">
        ${Object.entries(dna.bars).map(([k, v]) => `
          <div class="dna-bar-row">
            <div class="lbl"><span>${k}</span><span>${v}</span></div>
            <div class="dna-bar-track"><div class="dna-bar-fill" style="width:${v}%;"></div></div>
          </div>`).join("")}
      </div>
    </div>
  </div>
  <div class="card tint-teal" style="margin-bottom:20px;">
    <strong>Recommendation</strong>
    <p style="margin:8px 0 0;">${dna.tip}</p>
  </div>
  <div class="section-title">How much you match with others right now</div>
  <div class="card">
    ${matches.length === 0 ? `<div class="empty">No one to compare with yet.</div>` :
      matches.map((m) => `
      <div class="list-row">
        <div class="avatar">${initials(m.user.name)}</div>
        <div class="meta"><div class="n">${escapeHtml(m.user.name)}</div><div class="s">reciprocal skill fit</div></div>
        <span class="chip">${m.score}%</span>
      </div>`).join("")}
  </div>`;
}

// ================================================================
// BATTLES
// ================================================================
function renderBattles(user) {
  if (state.battleView) {
    const b = DB.getBattle(state.battleView);
    if (b) return renderBattleDetail(b, user);
    state.battleView = null;
  }
  const myBattles = DB.battlesForUser(user.email).sort((a, b) => b.createdAt - a.createdAt);
  const topMatches = rankedMatches(user).slice(0, 3);
  return `
  <div class="page-head">
    <h2>Battles</h2>
    <p>Quick 1v1 skill battles, five questions each. The topic you miss most gets AI-recommended for relearning.</p>
  </div>
  <div class="section-title">Start a new battle</div>
  <div class="card" style="margin-bottom:20px;">
    ${topMatches.length === 0 ? `<div class="empty">Get a match first, then battle them here.</div>` :
      topMatches.map((m) => `
      <div class="list-row">
        <div class="avatar">${initials(m.user.name)}</div>
        <div class="meta"><div class="n">vs ${escapeHtml(m.user.name)}</div><div class="s">${m.score}% match</div></div>
        <button class="btn sm" onclick="Actions.quickBattle('${m.user.email}')">⚔️ Create battle</button>
      </div>`).join("")}
  </div>
  <div class="section-title">Your battles</div>
  <div class="card">
    ${myBattles.length === 0 ? `<div class="empty">No battles yet.</div>` :
      myBattles.map((b) => {
        const oppEmail = b.p1 === user.email ? b.p2 : b.p1;
        const opp = DB.getUser(oppEmail);
        const meDone = b.finished && b.finished[user.email];
        const oppDone = b.finished && b.finished[oppEmail];
        const statusText = b.status === "done" ? "Finished" : meDone ? "Waiting on opponent" : "Open";
        return `
        <div class="list-row">
          <div class="avatar">${initials(opp ? opp.name : "?")}</div>
          <div class="meta"><div class="n">vs ${escapeHtml(opp ? opp.name : oppEmail)} · ${escapeHtml(b.topic)}</div><div class="s">${statusText}</div></div>
          <button class="btn sm secondary" onclick="Actions.openBattle('${b.id}')">${b.status === "done" ? "View result" : "Open"}</button>
        </div>`;
      }).join("")}
  </div>`;
}

function renderBattleDetail(b, user) {
  const oppEmail = b.p1 === user.email ? b.p2 : b.p1;
  const opp = DB.getUser(oppEmail);
  const myAnswers = (b.answers && b.answers[user.email]) || [];
  const meDone = b.finished && b.finished[user.email];
  const oppDone = b.finished && b.finished[oppEmail];

  let body;
  if (b.status === "done" || (meDone && oppDone)) {
    const myScore = (b.scores && b.scores[user.email]) || 0;
    const oppScore = (b.scores && b.scores[oppEmail]) || 0;
    const iWon = myScore > oppScore;
    const tie = myScore === oppScore;
    const weak = myScore < 3;
    body = `
      <div class="center" style="font-size:20px;font-weight:700;margin-bottom:8px;">${tie ? "It's a tie! 🤝" : iWon ? "You won! 🎉" : "Good effort! 💪"}</div>
      <div class="vs-row">
        <div class="vs-side"><div class="avatar" style="margin:0 auto 6px;">${initials(user.name)}</div><div class="vs-score">${myScore}</div><div class="vs-mid">You</div></div>
        <div class="vs-mid">VS</div>
        <div class="vs-side"><div class="avatar" style="margin:0 auto 6px;">${initials(opp ? opp.name : "?")}</div><div class="vs-score">${oppScore}</div><div class="vs-mid">${escapeHtml(opp ? opp.name.split(" ")[0] : "Opponent")}</div></div>
      </div>
      ${weak ? `
      <div class="card tint-gold">
        <strong>✨ AI recommendation</strong>
        <p style="margin:8px 0 0;"><strong>${escapeHtml(b.topic)}</strong> was your weak spot this battle — missed ${5 - myScore} of 5. Queued a fresh relearn round so it doesn't repeat silently.</p>
        <button class="btn sm" style="margin-top:10px;" onclick="Actions.relearnTopic('${b.category}','${escapeHtml(b.topic)}')">🔁 Relearn this topic now</button>
      </div>` : `<div class="card tint-teal">Solid round on <strong>${escapeHtml(b.topic)}</strong> — nothing urgent to relearn.</div>`}
      <div style="margin-top:16px;"><button class="btn secondary sm" onclick="Actions.closeBattle()">‹ Back to battles</button></div>`;
  } else if (myAnswers.length >= b.questions.length) {
    body = `<div class="empty">⏳ Waiting for ${escapeHtml(opp ? opp.name : "your opponent")} to finish this round…</div>
      <div style="margin-top:14px;"><button class="btn secondary sm" onclick="Actions.closeBattle()">‹ Back to battles</button></div>`;
  } else {
    const idx = myAnswers.length;
    const q = b.questions[idx];
    body = `
      <div class="vs-row" style="margin:0 0 14px;">
        <div class="vs-side"><div class="vs-score">${b.scores && b.scores[user.email] || 0}</div><div class="vs-mid">You</div></div>
        <div class="vs-mid">Q${idx + 1}/${b.questions.length}</div>
        <div class="vs-side"><div class="vs-score">${b.scores && b.scores[oppEmail] || 0}</div><div class="vs-mid">${escapeHtml(opp ? opp.name.split(" ")[0] : "Opp")}</div></div>
      </div>
      <div class="q-box">
        <div class="q-text">${escapeHtml(q.q)}</div>
        ${q.options.map((o, i) => `<button class="opt-btn" onclick="Actions.answerBattle('${b.id}',${i})">${escapeHtml(o)}</button>`).join("")}
      </div>`;
  }

  return `
  <div class="page-head">
    <button class="btn secondary sm" onclick="Actions.closeBattle()" style="margin-bottom:14px;">‹ Back</button>
    <h2>${escapeHtml(b.topic)}</h2>
    <p>${CATS[b.category].icon} ${CATS[b.category].label} · 5 questions, most correct wins</p>
  </div>
  <div class="card">${body}</div>`;
}

// ================================================================
// APTITUDE
// ================================================================
function renderAptitude(user) {
  if (state.aptSession) return renderAptSession(user);
  const cat = state.aptCategory;
  const topics = Object.keys(QUESTIONS[cat]);
  return `
  <div class="page-head">
    <h2>Aptitude coach</h2>
    <p>Fresh questions every time — nothing repeats until you've seen the whole set.</p>
  </div>
  <div class="tabs">
    ${Object.keys(CATS).map((c) => `<button class="tab ${cat === c ? "active" : ""}" onclick="Actions.setAptCategory('${c}')">${CATS[c].icon} ${CATS[c].label}</button>`).join("")}
  </div>
  <div class="tabs">
    <button class="tab ${state.aptTopic === "Mixed" ? "active" : ""}" onclick="Actions.setAptTopic('Mixed')">Mixed</button>
    ${topics.map((t) => `<button class="tab ${state.aptTopic === t ? "active" : ""}" onclick="Actions.setAptTopic('${t.replace(/'/g, "\\'")}')">${t}</button>`).join("")}
  </div>
  <div class="card center">
    <p class="muted">${state.aptTopic === "Mixed" ? "A mix of every topic in " + CATS[cat].label : state.aptTopic} · 8 questions</p>
    <button class="btn" onclick="Actions.startAptitude()">Start practice →</button>
  </div>`;
}

function renderAptSession(user) {
  const s = state.aptSession;
  if (s.index >= s.questions.length) {
    return `
    <div class="page-head"><h2>Practice result</h2></div>
    <div class="card center">
      <div class="dna-num" style="margin-bottom:6px;">${s.score}/${s.questions.length}</div>
      <p class="muted">${CATS[s.category].label} · ${s.topic}</p>
      <div class="gap-8" style="display:flex;justify-content:center;margin-top:14px;">
        <button class="btn secondary sm" onclick="Actions.exitAptitude()">Back to Aptitude</button>
        <button class="btn sm" onclick="Actions.startAptitude()">Practice again</button>
      </div>
    </div>`;
  }
  const q = s.questions[s.index];
  return `
  <div class="page-head">
    <button class="btn secondary sm" onclick="Actions.exitAptitude()" style="margin-bottom:14px;">‹ Back to Aptitude</button>
    <h2>Practice</h2>
    <p>${CATS[s.category].label} · ${s.topic} · Question ${s.index + 1} of ${s.questions.length}</p>
  </div>
  <div class="card">
    <div class="q-box">
      <div class="q-text">${escapeHtml(q.q)}</div>
      ${q.options.map((o, i) => `<button class="opt-btn" onclick="Actions.answerAptitude(${i})">${escapeHtml(o)}</button>`).join("")}
    </div>
  </div>`;
}

// ================================================================
// MODALS
// ================================================================
function renderModal(user) {
  if (state.modal === "login") return renderLoginModal();
  if (state.modal === "addSkill" && user) return renderAddSkillModal();
  return "";
}

function renderLoginModal() {
  return `
  <div class="modal-backdrop" onclick="if(event.target===this) Actions.closeModal()">
    <div class="modal">
      <div class="modal-head"><h3>G Continue with Google</h3><button class="modal-close" onclick="Actions.closeModal()">✕</button></div>
      <p class="muted small">Demo Google sign-in — this shows the flow but doesn't hit real Google servers. Enter any Gmail address to continue as that person.</p>
      <div class="field">
        <label>Gmail address</label>
        <input type="email" id="loginEmailInput" data-preserve="1" placeholder="you@gmail.com" value="${escapeHtml(state.loginEmail)}" oninput="state.loginEmail=this.value" onkeydown="if(event.key==='Enter')Actions.doLogin();">
      </div>
      <button class="btn block" onclick="Actions.doLogin()">Continue →</button>
      <p class="muted small" style="margin-top:14px;">New students are provisioned instantly for this demo. No real credentials are stored.</p>
    </div>
  </div>`;
}

function renderAddSkillModal() {
  return `
  <div class="modal-backdrop" onclick="if(event.target===this) Actions.closeModal()">
    <div class="modal">
      <div class="modal-head"><h3>Add a skill</h3><button class="modal-close" onclick="Actions.closeModal()">✕</button></div>
      <p class="muted small">Anyone can add any skill they can teach or want to learn — no approval needed for this demo.</p>
      <div class="field">
        <label>Skill name</label>
        <input type="text" id="skillNameInput" data-preserve="1" placeholder="e.g. Python, Guitar, Spanish">
      </div>
      <div class="field">
        <label>Category</label>
        <select id="skillCatInput">
          ${Object.entries(CATS).map(([k, v]) => `<option value="${k}">${v.icon} ${v.label}</option>`).join("")}
        </select>
      </div>
      <div class="field">
        <label>I want to…</label>
        <div class="seg">
          <button type="button" class="active" id="modeTeachBtn" onclick="Actions.setAddSkillMode('teach')">Teach this</button>
          <button type="button" id="modeLearnBtn" onclick="Actions.setAddSkillMode('learn')">Learn this</button>
        </div>
      </div>
      <button class="btn block" onclick="Actions.submitAddSkill()">＋ Add skill</button>
    </div>
  </div>`;
}

// ================================================================
// ACTIONS
// ================================================================
const Actions = {
  // ---- auth ----
  openLogin() { state.modal = "login"; state.loginEmail = ""; render(); },
  closeModal() { state.modal = null; render(); },
  tryDemo() {
    const n = Math.floor(1000 + Math.random() * 8999);
    const email = `guest.${n}@gmail.com`;
    loginOrCreate(email, `Guest ${n}`);
    render();
  },
  doLogin() {
    const email = (state.loginEmail || "").trim().toLowerCase();
    if (!email || !email.includes("@") || !email.includes(".")) { toast("Enter a valid email to continue"); return; }
    const namePart = email.split("@")[0].replace(/[._]/g, " ");
    const name = namePart.replace(/\b\w/g, (c) => c.toUpperCase());
    loginOrCreate(email, name);
    state.modal = null;
    render();
    if (state.pendingRoom) {
      state.connectJoinCode = state.pendingRoom.toUpperCase();
      state.pendingRoom = null;
      Actions.joinRoomByCode();
    }
  },
  logout() { DB.setSessionEmail(null); state.route = "landing"; render(); },

  // ---- nav ----
  go(route) { state.route = route; state.battleView = null; state.aptSession = null; render(); },

  // ---- skills ----
  setSkillsTab(t) { state.skillsTab = t; render(); },
  openAddSkill() { state.modal = "addSkill"; state.addSkillMode = "teach"; render(); },
  setAddSkillMode(mode) {
    state.addSkillMode = mode;
    const t = document.getElementById("modeTeachBtn"), l = document.getElementById("modeLearnBtn");
    if (t && l) { t.classList.toggle("active", mode === "teach"); l.classList.toggle("active", mode === "learn"); }
  },
  submitAddSkill() {
    const nameInput = document.getElementById("skillNameInput");
    const catInput = document.getElementById("skillCatInput");
    const name = (nameInput.value || "").trim();
    if (!name) { toast("Give the skill a name"); return; }
    const user = currentUser();
    user.skills.push({ id: uid(), name, category: catInput.value, mode: state.addSkillMode || "teach" });
    DB.saveUser(user);
    state.modal = null;
    toast(`Added ${name}`);
    render();
  },
  removeSkill(id) {
    const user = currentUser();
    user.skills = user.skills.filter((s) => s.id !== id);
    DB.saveUser(user);
    render();
  },

  // ---- connect / rooms ----
  createRoom() {
    const user = currentUser();
    if (myActiveRoom(user)) { toast("Leave your current room first"); return; }
    const code = genRoomCode();
    DB.saveRoom({ code, hostEmail: user.email, guestEmail: null, initiator: user.email, status: "waiting", teach: {}, ready: {}, taught: {}, messages: [], createdAt: Date.now() });
    render();
  },
  refreshRoom(oldCode) {
    const user = currentUser();
    DB.deleteRoom(oldCode);
    const code = genRoomCode();
    DB.saveRoom({ code, hostEmail: user.email, guestEmail: null, initiator: user.email, status: "waiting", teach: {}, ready: {}, taught: {}, messages: [], createdAt: Date.now() });
    toast("New code generated");
    render();
  },
  joinRoomByCode() {
    const user = currentUser();
    const code = (state.connectJoinCode || "").trim().toUpperCase();
    if (!code) { toast("Enter a room code"); return; }
    if (myActiveRoom(user)) { toast("Leave your current room first"); return; }
    const room = DB.getRoom(code);
    if (!room) { toast("Room not found"); return; }
    if (room.hostEmail === user.email) { toast("That's your own room code"); return; }
    if (room.guestEmail && room.guestEmail !== user.email) { toast("That room is full"); return; }
    room.guestEmail = user.email;
    room.initiator = user.email;
    room.status = "pending";
    DB.saveRoom(room);
    state.connectJoinCode = "";
    toast("Request sent — waiting for them to accept");
    render();
  },
  inviteUser(targetEmail) {
    const user = currentUser();
    if (myActiveRoom(user)) { toast("Leave your current room first"); return; }
    const code = genRoomCode();
    DB.saveRoom({ code, hostEmail: user.email, guestEmail: targetEmail, initiator: user.email, status: "pending", teach: {}, ready: {}, taught: {}, messages: [], createdAt: Date.now() });
    toast("Request sent");
    render();
  },
  acceptRoom(code) {
    const room = DB.getRoom(code);
    if (!room) return;
    room.status = "connected";
    DB.saveRoom(room);
    render();
  },
  declineRoom(code) { DB.deleteRoom(code); render(); },
  leaveRoom(code) { DB.deleteRoom(code); toast("Left room"); render(); },
  confirmTeachSkill(code) {
    const room = DB.getRoom(code);
    const user = currentUser();
    const sel = document.getElementById("teachPick");
    if (!sel || !sel.value) { toast("Add a teaching skill first"); return; }
    room.teach = room.teach || {};
    room.ready = room.ready || {};
    room.teach[user.email] = sel.value;
    room.ready[user.email] = true;
    if (room.ready[room.hostEmail] && room.ready[room.guestEmail]) {
      room.status = "active";
      linkConnection(room.hostEmail, room.guestEmail);
    }
    DB.saveRoom(room);
    render();
  },
  markTaught(code) {
    const room = DB.getRoom(code);
    const user = currentUser();
    room.taught = room.taught || {};
    room.taught[user.email] = true;
    DB.saveRoom(room);
    const u = DB.getUser(user.email);
    u.sessionsTaught = (u.sessionsTaught || 0) + 1;
    DB.saveUser(u);
    toast("Marked as taught");
    render();
  },
  sendChat(code) {
    const text = (state.chatDraft || "").trim();
    if (!text) return;
    const room = DB.getRoom(code);
    const user = currentUser();
    room.messages = room.messages || [];
    room.messages.push({ from: user.email, text, ts: Date.now() });
    DB.saveRoom(room);
    state.chatDraft = "";
    render();
    const box = document.getElementById("chatBox");
    if (box) box.scrollTop = box.scrollHeight;
  },
  askAI(code) {
    const room = DB.getRoom(code);
    const user = currentUser();
    const isHost = room.hostEmail === user.email;
    const learningTopic = room.teach ? room.teach[isHost ? room.guestEmail : room.hostEmail] : null;
    const tip = aiTip(learningTopic || "this topic");
    room.messages = room.messages || [];
    room.messages.push({ from: "ai", text: tip, ts: Date.now() });
    DB.saveRoom(room);
    render();
    const box = document.getElementById("chatBox");
    if (box) box.scrollTop = box.scrollHeight;
  },

  // ---- battles ----
  startRoomBattle(code) {
    const room = DB.getRoom(code);
    const hostUser = DB.getUser(room.hostEmail);
    const teachSkill = hostUser.skills.find((s) => s.name === room.teach[room.hostEmail]) || hostUser.skills.find((s) => s.mode === "teach");
    const category = (teachSkill && teachSkill.category) || "engineering";
    const battle = createBattle(room.hostEmail, room.guestEmail, category, room.teach[room.hostEmail] || "Mixed");
    state.battleView = battle.id;
    state.route = "battles";
    render();
  },
  quickBattle(oppEmail) {
    const user = currentUser();
    const teachSkill = user.skills.find((s) => s.mode === "teach") || user.skills[0];
    const category = (teachSkill && teachSkill.category) || "engineering";
    const battle = createBattle(user.email, oppEmail, category, (teachSkill && teachSkill.name) || "Mixed");
    state.battleView = battle.id;
    state.route = "battles";
    render();
  },
  openBattle(id) { state.battleView = id; state.route = "battles"; render(); },
  closeBattle() { state.battleView = null; render(); },
  answerBattle(id, idx) {
    const b = DB.getBattle(id);
    const user = currentUser();
    b.answers = b.answers || {}; b.scores = b.scores || {}; b.finished = b.finished || {};
    const arr = b.answers[user.email] || [];
    const q = b.questions[arr.length];
    const correct = idx === q.answer;
    arr.push(idx);
    b.answers[user.email] = arr;
    b.scores[user.email] = (b.scores[user.email] || 0) + (correct ? 1 : 0);
    toast(correct ? "Correct! ✅" : "Not quite ❌");
    if (arr.length >= b.questions.length) {
      b.finished[user.email] = true;
      const otherEmail = b.p1 === user.email ? b.p2 : b.p1;
      if (b.finished[otherEmail]) {
        b.status = "done";
        const myScore = b.scores[user.email] || 0;
        const otherScore = b.scores[otherEmail] || 0;
        if (myScore !== otherScore) {
          const winnerEmail = myScore > otherScore ? user.email : otherEmail;
          const w = DB.getUser(winnerEmail);
          if (w) { w.battlesWon = (w.battlesWon || 0) + 1; DB.saveUser(w); }
        }
      }
    }
    DB.saveBattle(b);
    render();
  },
  relearnTopic(category, topic) {
    state.battleView = null;
    state.aptCategory = category;
    state.aptTopic = QUESTIONS[category][topic] ? topic : "Mixed";
    state.route = "aptitude";
    Actions.startAptitude();
  },

  // ---- invite / dna ----
  recalcDNA() {
    const user = currentUser();
    user.dnaRecalculatedAt = Date.now();
    DB.saveUser(user);
    toast("Skill DNA recalculated");
    render();
  },

  // ---- aptitude ----
  setAptCategory(c) { state.aptCategory = c; state.aptTopic = "Mixed"; render(); },
  setAptTopic(t) { state.aptTopic = t; render(); },
  startAptitude() {
    const user = currentUser();
    const cat = state.aptCategory;
    const topic = state.aptTopic;
    let pool = [];
    if (topic === "Mixed") {
      Object.entries(QUESTIONS[cat]).forEach(([tname, qs]) => qs.forEach((q, i) => pool.push({ key: `${tname}|${i}`, q })));
    } else {
      (QUESTIONS[cat][topic] || []).forEach((q, i) => pool.push({ key: `${topic}|${i}`, q }));
    }
    user.seenQuestions = user.seenQuestions || {};
    const seenKey = cat + "::" + topic;
    const seen = new Set(user.seenQuestions[seenKey] || []);
    let unseen = pool.filter((p) => !seen.has(p.key));
    if (unseen.length < 5) { seen.clear(); unseen = pool; toast("Fresh round — you've seen every question, starting over"); }
    shuffle(unseen);
    const picked = unseen.slice(0, Math.min(8, unseen.length));
    picked.forEach((p) => seen.add(p.key));
    user.seenQuestions[seenKey] = Array.from(seen);
    DB.saveUser(user);
    state.aptSession = { questions: picked.map((p) => p.q), index: 0, score: 0, category: cat, topic: topic === "Mixed" ? "Mixed" : topic };
    render();
  },
  answerAptitude(idx) {
    const s = state.aptSession;
    const q = s.questions[s.index];
    const correct = idx === q.answer;
    if (correct) s.score++;
    toast(correct ? "Correct! ✅" : "Not quite ❌");
    s.index++;
    render();
  },
  exitAptitude() { state.aptSession = null; render(); },

  // ---- misc ----
  copyText(text) {
    navigator.clipboard.writeText(text).then(() => toast("Copied!")).catch(() => toast("Copy failed — select and copy manually"));
  },
  copyJoinLink(code) {
    const link = `${location.origin}${location.pathname}?room=${code}`;
    Actions.copyText(link);
  },
};

// ---------------- helpers used by Actions ----------------
function loginOrCreate(email, name) {
  let user = DB.getUser(email);
  if (!user) {
    user = {
      email, name, skills: [], connections: [],
      referredBy: state.pendingRef || null,
      joinedAt: Date.now(), sessionsTaught: 0, battlesPlayed: 0, battlesWon: 0,
      seenQuestions: {}, lastSeen: Date.now(),
    };
    DB.saveUser(user);
    if (state.pendingRef) toast("Connected to your inviter!");
  } else {
    user.lastSeen = Date.now();
    DB.saveUser(user);
  }
  DB.setSessionEmail(email);
  state.route = "dashboard";
  state.pendingRef = null;
}

function linkConnection(emailA, emailB) {
  const a = DB.getUser(emailA), b = DB.getUser(emailB);
  if (a) { a.connections = a.connections || []; if (!a.connections.includes(emailB)) a.connections.push(emailB); DB.saveUser(a); }
  if (b) { b.connections = b.connections || []; if (!b.connections.includes(emailA)) b.connections.push(emailA); DB.saveUser(b); }
}

function createBattle(p1, p2, category, topic) {
  const topics = Object.keys(QUESTIONS[category]);
  let pool = [];
  if (QUESTIONS[category][topic]) pool = QUESTIONS[category][topic].slice();
  else topics.forEach((t) => pool.push(...QUESTIONS[category][t]));
  shuffle(pool);
  const questions = pool.slice(0, 5);
  const battle = {
    id: uid(), p1, p2, category, topic: topic || "Mixed",
    questions, answers: {}, scores: {}, finished: {}, status: "active", createdAt: Date.now(),
  };
  DB.saveBattle(battle);
  [p1, p2].forEach((e) => {
    const u = DB.getUser(e);
    if (u) { u.battlesPlayed = (u.battlesPlayed || 0) + 1; DB.saveUser(u); }
  });
  return battle;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function aiTip(topic) {
  const tips = [
    `Good question about ${topic} — try breaking it into smaller steps and testing each one before moving on.`,
    `For ${topic}, it helps to explain it back in your own words first — that's usually where the gap shows up.`,
    `A common sticking point with ${topic} is skipping the basics under pressure — go back one step and rebuild from there.`,
    `Try working through one concrete example of ${topic} by hand before trusting the shortcut version.`,
  ];
  return tips[Math.floor(Math.random() * tips.length)];
}

// ---------------- boot ----------------
function init() {
  seedIfEmpty();
  const params = new URLSearchParams(location.search);
  state.pendingRef = params.get("ref");
  state.pendingRoom = params.get("room");
  if (params.toString()) history.replaceState({}, "", location.pathname);
  DB.onChange(() => safeRender());
  setInterval(() => safeRender(), 3000);
  render();
  const user = currentUser();
  if (user && state.pendingRoom) {
    state.connectJoinCode = state.pendingRoom.toUpperCase();
    state.pendingRoom = null;
    Actions.joinRoomByCode();
  }
}
window.addEventListener("DOMContentLoaded", init);
