import { initializeApp }         from 'firebase/app';
import { getDatabase, ref, set, update, remove, onValue, get, onDisconnect } from 'firebase/database';

// ── Firebase config ────────────────────────────────────────────────────────
// Replace these values with your own Firebase project config.
// Guide: https://console.firebase.google.com → New project → Web app → copy config
// Also enable Realtime Database and set rules to allow read/write (see README).
const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyCwJjCpbtPfIKf7W4bo_UI38EvtS3Gh5WE",
  authDomain:        "multiplayer-game-94bdd.firebaseapp.com",
  databaseURL:       "https://multiplayer-game-94bdd-default-rtdb.firebaseio.com",
  projectId:         "multiplayer-game-94bdd",
  storageBucket:     "multiplayer-game-94bdd.firebasestorage.app",
  messagingSenderId: "739850398965",
  appId:             "1:739850398965:web:fd37e2aa6f66957c8ee9bc",
};

let db = null;
let _unsubFns = [];

export function initNetwork(config = FIREBASE_CONFIG) {
  try {
    const app = initializeApp(config);
    db = getDatabase(app);
    return true;
  } catch (e) {
    console.error('[Network] Firebase init failed:', e);
    return false;
  }
}

export function isReady() { return db !== null; }

// ── Helpers ────────────────────────────────────────────────────────────────
function genCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let c = '';
  for (let i = 0; i < 6; i++) c += chars[Math.floor(Math.random() * chars.length)];
  return c;
}

// ── Room API ───────────────────────────────────────────────────────────────
export async function createRoom(username) {
  if (!db) throw new Error('Network not ready');
  const code = genCode();
  const roomRef = ref(db, `rooms/${code}`);
  await set(roomRef, {
    host:      username,
    status:    'waiting',
    createdAt: Date.now(),
    players:   { [username]: true },
  });
  // Auto-delete when host disconnects
  onDisconnect(roomRef).remove();
  return code;
}

export async function joinRoom(code, username) {
  if (!db) throw new Error('Network not ready');
  const snap = await get(ref(db, `rooms/${code}`));
  if (!snap.exists()) throw new Error('Room not found');
  const data = snap.val();
  if (data.status !== 'waiting') throw new Error('Room already started');
  const players = Object.keys(data.players || {});
  if (players.length >= 2) throw new Error('Room is full');
  await update(ref(db, `rooms/${code}/players`), { [username]: true });
  onDisconnect(ref(db, `rooms/${code}/players/${username}`)).remove();
  return data;
}

export function listenRooms(callback) {
  if (!db) return () => {};
  const unsub = onValue(ref(db, 'rooms'), snap => {
    if (!snap.exists()) return callback([]);
    const list = [];
    snap.forEach(child => {
      const d = child.val();
      if (d.status === 'waiting') {
        list.push({
          code:        child.key,
          host:        d.host,
          playerCount: Object.keys(d.players || {}).length,
        });
      }
    });
    callback(list);
  });
  _unsubFns.push(unsub);
  return unsub;
}

export function listenRoom(code, callback) {
  if (!db) return () => {};
  const unsub = onValue(ref(db, `rooms/${code}`), snap => {
    callback(snap.exists() ? snap.val() : null);
  });
  _unsubFns.push(unsub);
  return unsub;
}

export async function startGame(code) {
  if (!db) throw new Error('Network not ready');
  await update(ref(db, `rooms/${code}`), { status: 'playing' });
}

export async function leaveRoom(code, username) {
  if (!db) return;
  await remove(ref(db, `rooms/${code}/players/${username}`));
}

// ── Position sync (call ~20× per second) ──────────────────────────────────
export function syncPosition(code, username, x, z, yaw) {
  if (!db) return;
  update(ref(db, `positions/${code}/${username}`), { x, z, yaw });
}

export function listenPositions(code, callback) {
  if (!db) return () => {};
  const unsub = onValue(ref(db, `positions/${code}`), snap => {
    if (snap.exists()) callback(snap.val());
  });
  _unsubFns.push(unsub);
  return unsub;
}

// ── Ball sync (broadcast on kick / collision) ──────────────────────────────
export function syncBall(code, state) {
  if (!db) return;
  set(ref(db, `ball/${code}`), state);
}

export function listenBall(code, callback) {
  if (!db) return () => {};
  const unsub = onValue(ref(db, `ball/${code}`), snap => {
    if (snap.exists()) callback(snap.val());
  });
  _unsubFns.push(unsub);
  return unsub;
}

// ── Cleanup all listeners ──────────────────────────────────────────────────
export function unsubAll() {
  _unsubFns.forEach(fn => { try { fn(); } catch (_) {} });
  _unsubFns = [];
}
