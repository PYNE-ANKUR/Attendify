// ═══════════════════════════════════════════════════════
//  AttendX — app.js
//  Firebase Firestore + Web Bluetooth attendance system
// ═══════════════════════════════════════════════════════

// ─── FIREBASE CONFIG ───────────────────────────────────
// Replace these values with your own Firebase project config.
// Get them from: Firebase Console → Project Settings → Your apps → SDK setup
const FIREBASE_CONFIG = {
  apiKey:            "YOUR_API_KEY",
  authDomain:        "YOUR_PROJECT_ID.firebaseapp.com",
  projectId:         "YOUR_PROJECT_ID",
  storageBucket:     "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId:             "YOUR_APP_ID"
};

// ─── WEB BLUETOOTH UUIDs ──────────────────────────────
const BT_SERVICE = '12345678-1234-1234-1234-123456789abc';
const BT_PIN_CHAR = '12345678-1234-1234-1234-123456789ab1';

// ─── INIT ─────────────────────────────────────────────
let db, auth, currentUser;
let sessionListener = null;   // Firestore real-time listener
let attendanceListener = null;

const S = {
  role: null,
  user: { name: '', roll: '', cls: '', uid: '' },
  session: { active: false, id: null, code: null, start: null, timerInterval: null }
};

function initFirebase() {
  try {
    firebase.initializeApp(FIREBASE_CONFIG);
    db   = firebase.firestore();
    auth = firebase.auth();
    showToast('🔥 Firebase connected', 'ok');
    document.getElementById('fb-status').innerHTML = '';
  } catch (e) {
    console.warn('Firebase init failed:', e.message);
    document.getElementById('fb-status').innerHTML = `
      <div style="background:rgba(255,179,71,.1);border:1px solid rgba(255,179,71,.3);border-radius:14px;padding:14px 18px;font-size:12px;color:#ffb347;line-height:1.8;max-width:460px;margin:0 auto">
        ⚠️ <b>Firebase not configured yet.</b> The app runs in offline demo mode.
        See <code>app.js</code> → <code>FIREBASE_CONFIG</code> to connect your database.
        <a href="#setup-guide" style="color:#ffb347;text-decoration:underline">Setup guide below ↓</a>
      </div>`;
    db = null; auth = null;
  }
}

initFirebase();

// ─── NAVIGATION ───────────────────────────────────────
function show(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function goLanding() {
  teardownListeners();
  show('landing');
}

function goAuth(role) {
  S.role = role;
  document.getElementById('auth-title').textContent = role === 'teacher' ? 'Teacher Login' : 'Student Login';
  document.getElementById('auth-sub').textContent   = role === 'teacher' ? 'Host a live session' : 'Mark your attendance';
  document.getElementById('f-class').style.display  = role === 'teacher' ? 'block' : 'none';
  document.getElementById('f-roll').style.display   = role === 'student' ? 'block' : 'none';
  ['a-name', 'a-email', 'a-pass'].forEach(id => document.getElementById(id).value = '');
  show('auth');
}

async function logout() {
  teardownListeners();
  if (S.session.active) await endSession();
  if (auth) try { await auth.signOut(); } catch (e) {}
  S.role = null;
  S.user = { name: '', roll: '', cls: '', uid: '' };
  S.session = { active: false, id: null, code: null, start: null, timerInterval: null };
  show('landing');
}

function teardownListeners() {
  if (sessionListener)    { sessionListener();    sessionListener = null; }
  if (attendanceListener) { attendanceListener(); attendanceListener = null; }
  if (S.session.timerInterval) { clearInterval(S.session.timerInterval); }
}

// ─── AUTH ─────────────────────────────────────────────
async function doLogin() {
  const name  = document.getElementById('a-name').value.trim();
  const email = document.getElementById('a-email').value.trim();
  const pass  = document.getElementById('a-pass').value.trim();
  if (!name)  { showToast('Enter your name', 'err'); return; }
  if (!email) { showToast('Enter your email', 'err'); return; }
  if (!pass)  { showToast('Enter a password (min 6 chars)', 'err'); return; }

  const btn = document.getElementById('login-btn');
  btn.disabled = true;
  btn.textContent = 'Signing in…';

  S.user.name = name;
  S.user.cls  = (document.getElementById('a-class')?.value || '').trim() || 'My Class';
  S.user.roll = (document.getElementById('a-roll')?.value  || '').trim() || 'N/A';

  if (!auth) {
    // Offline demo mode
    offlineLogin();
    btn.disabled = false; btn.textContent = 'Sign In / Register →';
    return;
  }

  try {
    let credential;
    try {
      credential = await auth.signInWithEmailAndPassword(email, pass);
    } catch (signInErr) {
      if (signInErr.code === 'auth/user-not-found' || signInErr.code === 'auth/invalid-credential') {
        credential = await auth.createUserWithEmailAndPassword(email, pass);
        showToast('Account created!', 'ok');
      } else {
        throw signInErr;
      }
    }
    currentUser = credential.user;
    S.user.uid  = currentUser.uid;

    // Save/update user profile in Firestore
    await db.collection('users').doc(currentUser.uid).set({
      name: S.user.name,
      role: S.role,
      cls: S.user.cls,
      roll: S.user.roll,
      email: email,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    onLoginSuccess();
  } catch (err) {
    showToast(friendlyError(err.code), 'err');
  }

  btn.disabled = false;
  btn.textContent = 'Sign In / Register →';
}

function offlineLogin() {
  S.user.uid = 'demo_' + Math.random().toString(36).slice(2, 9);
  showToast('Demo mode (no Firebase)', 'info');
  onLoginSuccess();
}

function onLoginSuccess() {
  if (S.role === 'teacher') {
    document.getElementById('t-name').textContent = S.user.name;
    document.getElementById('t-av').textContent   = S.user.name[0].toUpperCase();
    show('teacher-dashboard');
    checkActiveSession();
  } else {
    document.getElementById('s-name').textContent = S.user.name;
    document.getElementById('s-av').textContent   = S.user.name[0].toUpperCase();
    show('student-dashboard');
    loadStudentHistory();
  }
  showToast('Welcome, ' + S.user.name + '! 👋', 'ok');
}

function friendlyError(code) {
  const map = {
    'auth/wrong-password':   'Wrong password.',
    'auth/invalid-email':    'Invalid email address.',
    'auth/email-already-in-use': 'Email already in use.',
    'auth/weak-password':    'Password must be at least 6 characters.',
    'auth/network-request-failed': 'Network error. Check your connection.',
    'auth/too-many-requests':'Too many attempts. Try later.',
  };
  return map[code] || 'Error: ' + code;
}

// ─── TEACHER: CHECK FOR EXISTING SESSION ──────────────
async function checkActiveSession() {
  if (!db) return;
  try {
    const snap = await db.collection('sessions')
      .where('teacherUid', '==', S.user.uid)
      .where('active', '==', true)
      .limit(1)
      .get();

    if (!snap.empty) {
      const doc = snap.docs[0];
      const data = doc.data();
      S.session = { active: true, id: doc.id, code: data.code, start: data.startedAt?.toDate() || new Date(), timerInterval: null };
      showActiveSessionUI();
      startCountdown();
      listenAttendance(doc.id);
      showToast('Resumed active session: ' + data.code, 'info');
    }
  } catch (e) { console.warn('checkActiveSession:', e); }
}

// ─── TEACHER: START SESSION ───────────────────────────
async function startSession() {
  const code = String(Math.floor(1000 + Math.random() * 9000));
  const sessionData = {
    code,
    teacherUid:  S.user.uid,
    teacherName: S.user.name,
    className:   S.user.cls,
    active:      true,
    startedAt:   firebase.firestore.FieldValue.serverTimestamp(),
    expiresAt:   new Date(Date.now() + 10 * 60 * 1000),
    attendanceCount: 0
  };

  let sessionId;

  if (db) {
    try {
      const ref = await db.collection('sessions').add(sessionData);
      sessionId = ref.id;
    } catch (e) {
      showToast('Firebase error: ' + e.message, 'err'); return;
    }
  } else {
    sessionId = 'demo_' + Date.now();
    lsSet('demo_session', { ...sessionData, id: sessionId, active: true });
  }

  S.session = { active: true, id: sessionId, code, start: new Date(), timerInterval: null };
  showActiveSessionUI();
  startCountdown();
  if (db) listenAttendance(sessionId);
  showToast('Session started! PIN: ' + code, 'ok');
}

function showActiveSessionUI() {
  document.getElementById('t-create').style.display = 'none';
  document.getElementById('t-active').style.display = 'block';
  document.getElementById('bt-ring').style.display  = 'block';
  document.getElementById('t-code').textContent     = S.session.code;
  document.getElementById('t-sid').textContent      = S.session.id?.slice(-6) || '------';
  document.getElementById('s-status').textContent   = 'LIVE';
  document.getElementById('t-bt-sub').innerHTML =
    '<span class="sdot sdot-on"></span>Session active — syncing via Firebase';
}

async function endSession() {
  clearInterval(S.session.timerInterval);

  if (db && S.session.id) {
    try {
      await db.collection('sessions').doc(S.session.id).update({
        active: false,
        endedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    } catch (e) { console.warn('endSession:', e); }
  } else {
    lsSet('demo_session', { active: false });
  }

  if (attendanceListener) { attendanceListener(); attendanceListener = null; }
  const count = document.querySelectorAll('#att-list .att-item').length;

  document.getElementById('t-create').style.display = 'block';
  document.getElementById('t-active').style.display = 'none';
  document.getElementById('bt-ring').style.display  = 'none';
  document.getElementById('s-status').textContent   = 'ENDED';
  document.getElementById('t-bt-sub').innerHTML     = '<span class="sdot sdot-off"></span>No active session';
  S.session.active = false;
  showToast('Session ended. ' + count + ' students present.', 'ok');
}

// ─── TEACHER: COUNTDOWN ───────────────────────────────
function startCountdown() {
  let secs = 600;
  S.session.timerInterval = setInterval(() => {
    secs--;
    const m = String(Math.floor(secs / 60)).padStart(2, '0');
    const s = String(secs % 60).padStart(2, '0');
    document.getElementById('t-cd').textContent = m + ':' + s;
    const e = Math.floor((Date.now() - S.session.start) / 1000);
    document.getElementById('s-dur').textContent = Math.floor(e / 60) + 'm ' + (e % 60) + 's';
    if (secs <= 0) endSession();
  }, 1000);
}

// ─── TEACHER: REAL-TIME ATTENDANCE LISTENER ───────────
function listenAttendance(sessionId) {
  if (!db) return;
  attendanceListener = db
    .collection('sessions').doc(sessionId)
    .collection('attendance')
    .orderBy('markedAt', 'asc')
    .onSnapshot(snap => {
      const records = snap.docs.map(d => d.data());
      renderAttendance(records);
      document.getElementById('s-present').textContent = records.length;
      document.getElementById('live-count').textContent = '(' + records.length + ')';
    }, err => console.warn('listenAttendance:', err));
}

function renderAttendance(records) {
  const el = document.getElementById('att-list');
  if (!records.length) {
    el.innerHTML = '<div class="empty"><div class="empty-ic">📋</div><p>Waiting for students…</p></div>';
    return;
  }
  el.innerHTML = records.map(r => `
    <div class="att-item">
      <div class="avatar av-s" style="width:42px;height:42px;font-size:17px">${r.name[0].toUpperCase()}</div>
      <div class="att-info">
        <div class="att-name">${r.name}</div>
        <div class="att-meta">Roll: ${r.roll || 'N/A'} &nbsp;·&nbsp; ${r.className || 'Class'}</div>
      </div>
      <div class="time-tag">🕐 ${r.time}</div>
    </div>`).join('');
}

// ─── TEACHER: TAB SWITCHING ───────────────────────────
function switchTab(tab) {
  document.getElementById('tab-live').style.display    = tab === 'live'    ? 'block' : 'none';
  document.getElementById('tab-history').style.display = tab === 'history' ? 'block' : 'none';
  document.getElementById('tab-btn-live').className    = 'tab' + (tab === 'live'    ? ' active' : '');
  document.getElementById('tab-btn-history').className = 'tab' + (tab === 'history' ? ' active' : '');
  if (tab === 'history') loadHistory();
}

async function loadHistory() {
  const el = document.getElementById('history-content');
  el.innerHTML = '<div class="empty"><div class="empty-ic">⏳</div><p>Loading…</p></div>';
  if (!db) { el.innerHTML = '<div class="empty"><p>Firebase not connected.</p></div>'; return; }

  try {
    const snap = await db.collection('sessions')
      .where('teacherUid', '==', S.user.uid)
      .orderBy('startedAt', 'desc')
      .limit(20)
      .get();

    if (snap.empty) {
      el.innerHTML = '<div class="empty"><div class="empty-ic">🗓</div><p>No past sessions yet.</p></div>';
      return;
    }

    const blocks = await Promise.all(snap.docs.map(async doc => {
      const d = doc.data();
      const attSnap = await doc.ref.collection('attendance').get();
      const count = attSnap.size;
      const date  = d.startedAt?.toDate().toLocaleDateString() || 'Unknown date';
      const time  = d.startedAt?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) || '';
      return { id: doc.id, d, count, date, time, records: attSnap.docs.map(a => a.data()) };
    }));

    el.innerHTML = blocks.map(b => `
      <div class="session-block">
        <div class="session-block-header" onclick="toggleBlock('${b.id}')">
          <div>
            <div class="session-block-title">${b.d.className || 'Session'}</div>
            <div class="session-block-meta">${b.date} · ${b.time} · PIN: ${b.d.code} · ${b.count} students</div>
          </div>
          <div class="time-tag" id="arrow-${b.id}">▼</div>
        </div>
        <div class="session-block-body" id="body-${b.id}">
          ${b.records.length ? b.records.map(r => `
            <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--bdr)">
              <span style="font-family:'Syne',sans-serif;font-weight:600">${r.name}</span>
              <span style="font-size:11px;color:var(--mut)">${r.roll || 'N/A'} · ${r.time}</span>
            </div>`).join('') : '<p style="color:var(--mut);font-size:13px">No students in this session.</p>'}
          <button class="sm-btn" style="margin-top:14px" onclick="exportSessionCSV(${JSON.stringify(b.records).replace(/"/g,'&quot;')}, '${b.date}')">⬇ Export CSV</button>
        </div>
      </div>`).join('');
  } catch (e) {
    el.innerHTML = '<div class="empty"><p>Error loading history: ' + e.message + '</p></div>';
  }
}

function toggleBlock(id) {
  const body  = document.getElementById('body-' + id);
  const arrow = document.getElementById('arrow-' + id);
  const open  = body.classList.toggle('open');
  arrow.textContent = open ? '▲' : '▼';
}

// ─── TEACHER: CSV EXPORT ──────────────────────────────
function exportCSV() {
  const items = document.querySelectorAll('#att-list .att-item');
  if (!items.length) { showToast('No data to export', 'err'); return; }
  const rows = ['Name,Roll,Class,Time'];
  items.forEach(item => {
    const name = item.querySelector('.att-name')?.textContent || '';
    const meta = item.querySelector('.att-meta')?.textContent || '';
    const time = item.querySelector('.time-tag')?.textContent.replace('🕐 ', '') || '';
    const parts = meta.split('·').map(p => p.replace(/Roll:|Class:/gi, '').trim());
    rows.push(`"${name}","${parts[0] || ''}","${parts[1] || ''}","${time}"`);
  });
  downloadCSV(rows.join('\n'), 'attendance_live_' + new Date().toISOString().slice(0, 10));
}

function exportSessionCSV(records, date) {
  const rows = ['Name,Roll,Class,Time', ...records.map(r =>
    `"${r.name}","${r.roll || ''}","${r.className || ''}","${r.time}"`)];
  downloadCSV(rows.join('\n'), 'attendance_' + date.replace(/\//g, '-'));
}

function downloadCSV(content, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type: 'text/csv' }));
  a.download = name + '.csv';
  a.click();
  showToast('CSV downloaded!', 'ok');
}

// ─── STUDENT: BLUETOOTH SCAN ──────────────────────────
async function scanBluetooth() {
  const statusEl = document.getElementById('stu-bt-status');
  const waveEl   = document.getElementById('stu-wave');
  const devList  = document.getElementById('devices-list');

  statusEl.innerHTML = '<span class="sdot sdot-on"></span>Scanning…';
  waveEl.style.display = 'flex';
  devList.innerHTML = '';

  if (!navigator.bluetooth) {
    await delay(1500);
    waveEl.style.display = 'none';
    statusEl.innerHTML = '<span class="sdot sdot-off"></span>Bluetooth not available in this browser';
    showToast('Use Chrome on Android/Desktop for Bluetooth', 'info');
    return;
  }

  try {
    showToast('Select your teacher\'s device in Chrome…', 'info');
    const device = await navigator.bluetooth.requestDevice({
      filters: [{ services: [BT_SERVICE] }]
    });
    statusEl.innerHTML = '<span class="sdot sdot-on"></span>Connecting to ' + device.name + '…';
    const server  = await device.gatt.connect();
    const service = await server.getPrimaryService(BT_SERVICE);
    const pinChar = await service.getCharacteristic(BT_PIN_CHAR);
    const val     = await pinChar.readValue();
    const pin     = new TextDecoder().decode(val);

    waveEl.style.display = 'none';
    statusEl.innerHTML = '<span class="sdot sdot-on"></span>✅ Connected to ' + device.name;
    devList.innerHTML = `
      <div class="device-item" style="border-color:var(--teal);cursor:default">
        <div>
          <div class="device-name">✅ ${device.name}</div>
          <div class="device-meta">PIN received over BLE</div>
        </div>
        <div class="chip-ok">Connected</div>
      </div>`;
    fillPIN(pin);
    showToast('PIN auto-filled via Bluetooth!', 'ok');
  } catch (err) {
    waveEl.style.display = 'none';
    if (err.name === 'NotFoundError') {
      statusEl.innerHTML = '<span class="sdot sdot-off"></span>No device selected';
    } else {
      statusEl.innerHTML = '<span class="sdot sdot-off"></span>BT Error';
      showToast('BT Error: ' + err.message, 'err');
    }
  }
}

// ─── STUDENT: MARK ATTENDANCE ─────────────────────────
async function markAttendance() {
  const pin = ['p1','p2','p3','p4'].map(id => document.getElementById(id).value).join('');
  if (pin.length < 4) { showToast('Enter the full 4-digit PIN', 'err'); return; }

  const btn = document.getElementById('mark-btn');
  btn.disabled = true; btn.textContent = 'Verifying…';

  try {
    // Look up session by PIN in Firestore
    let sessionDoc = null;
    let sessionId  = null;
    let sessionData = null;

    if (db) {
      const snap = await db.collection('sessions')
        .where('code', '==', pin)
        .where('active', '==', true)
        .limit(1)
        .get();

      if (snap.empty) {
        showToast('Invalid PIN or session has ended.', 'err');
        btn.disabled = false; btn.textContent = '✅ Mark Attendance';
        return;
      }
      sessionDoc  = snap.docs[0];
      sessionId   = sessionDoc.id;
      sessionData = sessionDoc.data();
    } else {
      // Demo mode fallback
      const demo = lsGet('demo_session');
      if (!demo || !demo.active || demo.code !== pin) {
        showToast('Invalid PIN.', 'err');
        btn.disabled = false; btn.textContent = '✅ Mark Attendance';
        return;
      }
      sessionId   = demo.id;
      sessionData = demo;
    }

    const now    = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const dateStr = now.toLocaleDateString();

    const record = {
      name:      S.user.name,
      roll:      S.user.roll,
      className: sessionData.className || 'Class',
      time:      timeStr,
      date:      dateStr,
      uid:       S.user.uid,
      markedAt:  db ? firebase.firestore.FieldValue.serverTimestamp() : now.toISOString()
    };

    if (db) {
      // Check duplicate
      const dup = await db.collection('sessions').doc(sessionId)
        .collection('attendance').doc(S.user.uid).get();
      if (dup.exists) {
        showToast('You\'ve already marked attendance!', 'err');
        btn.disabled = false; btn.textContent = '✅ Mark Attendance';
        return;
      }

      // Write attendance (doc ID = student UID prevents duplicates)
      await db.collection('sessions').doc(sessionId)
        .collection('attendance').doc(S.user.uid).set(record);

      // Increment counter
      await db.collection('sessions').doc(sessionId).update({
        attendanceCount: firebase.firestore.FieldValue.increment(1)
      });

      // Save to student's personal history
      await db.collection('users').doc(S.user.uid)
        .collection('attendance').add({
          ...record,
          sessionId,
          subject: sessionData.className
        });
    } else {
      // Demo
      const existing = lsGet('demo_att') || [];
      if (existing.find(r => r.uid === S.user.uid)) {
        showToast('Already marked!', 'err');
        btn.disabled = false; btn.textContent = '✅ Mark Attendance';
        return;
      }
      existing.push(record);
      lsSet('demo_att', existing);
    }

    // Show success
    document.getElementById('stu-main').style.display = 'none';
    document.getElementById('success-panel').style.display = 'flex';
    document.getElementById('suc-detail').textContent =
      'Marked present for ' + (sessionData.className || 'class') + ' at ' + timeStr;

  } catch (e) {
    showToast('Error: ' + e.message, 'err');
    console.error(e);
  }

  btn.disabled = false; btn.textContent = '✅ Mark Attendance';
}

// ─── STUDENT: HISTORY ─────────────────────────────────
async function loadStudentHistory() {
  const el = document.getElementById('hist-list');
  if (!db) {
    el.innerHTML = '<div style="color:var(--mut);font-size:13px;text-align:center;padding:20px">Connect Firebase to see history.</div>';
    return;
  }
  try {
    const snap = await db.collection('users').doc(S.user.uid)
      .collection('attendance').orderBy('markedAt', 'desc').limit(20).get();

    if (snap.empty) {
      el.innerHTML = '<div style="color:var(--mut);font-size:13px;text-align:center;padding:20px">No records yet.</div>';
      return;
    }
    el.innerHTML = snap.docs.map(d => {
      const r = d.data();
      return `<div class="hist-item">
        <div>
          <div class="hist-subj">${r.subject || r.className}</div>
          <div class="hist-date">${r.date}</div>
        </div>
        <div class="chip-ok">✓ Present · ${r.time}</div>
      </div>`;
    }).join('');
  } catch (e) {
    el.innerHTML = '<div style="color:var(--mut);font-size:13px;padding:20px">Error loading history.</div>';
  }
}

function resetStu() {
  document.getElementById('success-panel').style.display = 'none';
  document.getElementById('stu-main').style.display = 'block';
  clearPIN();
  loadStudentHistory();
  document.getElementById('stu-bt-status').innerHTML = '<span class="sdot sdot-off"></span>Not scanning';
  document.getElementById('stu-wave').style.display = 'none';
  document.getElementById('devices-list').innerHTML = '';
}

// ─── HELPERS ──────────────────────────────────────────
function fillPIN(pin) {
  String(pin).split('').forEach((c, i) => {
    const el = document.getElementById('p' + (i + 1));
    if (el) el.value = c;
  });
}

function clearPIN() {
  ['p1','p2','p3','p4'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('p1').focus();
}

function pm(el, nid) {
  el.value = el.value.replace(/\D/g, '');
  if (el.value && nid) document.getElementById(nid).focus();
}

function pb(e, pid) {
  if (e.key === 'Backspace' && !e.target.value) document.getElementById(pid).focus();
}

function lsGet(k) { try { return JSON.parse(localStorage.getItem('atx_' + k)); } catch { return null; } }
function lsSet(k, v) { localStorage.setItem('atx_' + k, JSON.stringify(v)); }
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

function showToast(msg, type = 'ok') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast ' + type + ' show';
  setTimeout(() => t.classList.remove('show'), 3200);
}

// ─── INIT SCREEN ──────────────────────────────────────
show('landing');
