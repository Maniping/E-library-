export const DB_KEY = 'uv_arc_db_v14';
export const API_BASE = typeof window !== 'undefined' && window.UV_API_BASE
  ? window.UV_API_BASE.replace(/\/+$/, '')
  : (typeof location !== 'undefined' && ['localhost', '127.0.0.1'].includes(location.hostname)
      ? 'http://localhost:5000'
      : '');
export const API_BASE_CANDIDATES = [API_BASE];

export const defaultDB = {
  users: [],
  rooms: Array.from({ length: 20 }, (_, i) => ({
    id: `PC-${i + 1}`,
    name: `PC ${i + 1}`,
    type: 'pc',
    capacity: 1,
    capacityMin: 1,
    capacityMax: 1,
    status: 'available',
    location: i < 10 ? 'ARC 2F' : 'ARC 3F',
  })),
  reservations: [],
  registry: {},
  checkins: [],
  sessions: [],
  nextResId: 1,
  nextSessionId: 1,
  draft: null,
};

export let db = null;
let pendingRemoteSave = Promise.resolve();

function sanitizeUserRecord(user) {
  if (!user || typeof user !== 'object') return null;
  const safeUser = { ...user };
  for (const key of ['password', 'passwordHash', 'secret', 'token']) {
    delete safeUser[key];
  }
  return safeUser;
}

function sanitizeSnapshotForStorage(snapshot) {
  const source = snapshot && typeof snapshot === 'object' ? snapshot : {};
  return {
    ...source,
    users: Array.isArray(source.users) ? source.users.map(sanitizeUserRecord).filter(Boolean) : [],
    rooms: Array.isArray(source.rooms) ? source.rooms.map(room => (room && typeof room === 'object' ? { ...room } : room)).filter(Boolean) : [],
    reservations: Array.isArray(source.reservations) ? source.reservations.map(reservation => (reservation && typeof reservation === 'object' ? { ...reservation } : reservation)).filter(Boolean) : [],
    sessions: Array.isArray(source.sessions) ? source.sessions.map(session => (session && typeof session === 'object' ? { ...session } : session)).filter(Boolean) : [],
    checkins: Array.isArray(source.checkins) ? source.checkins.map(checkin => (checkin && typeof checkin === 'object' ? { ...checkin } : checkin)).filter(Boolean) : [],
    registry: source.registry && typeof source.registry === 'object' ? { ...source.registry } : {},
    draft: source.draft == null ? null : JSON.parse(JSON.stringify(source.draft)),
  };
}

function normalizeSnapshot(snapshot) {
  const source = snapshot && typeof snapshot === 'object' ? snapshot : {};
  const fallback = JSON.parse(JSON.stringify(defaultDB));
  const sanitized = sanitizeSnapshotForStorage(source);
  return {
    ...fallback,
    ...sanitized,
    users: Array.isArray(sanitized.users) ? sanitized.users.map(sanitizeUserRecord).filter(Boolean) : fallback.users,
    rooms: Array.isArray(sanitized.rooms) ? sanitized.rooms : fallback.rooms,
    reservations: Array.isArray(sanitized.reservations) ? sanitized.reservations : fallback.reservations,
    sessions: Array.isArray(sanitized.sessions) ? sanitized.sessions : fallback.sessions,
    checkins: Array.isArray(sanitized.checkins) ? sanitized.checkins : fallback.checkins,
    registry: sanitized.registry && typeof sanitized.registry === 'object' ? sanitized.registry : fallback.registry,
    draft: sanitized.draft == null ? null : sanitized.draft,
    nextResId: sanitized.nextResId ?? fallback.nextResId,
    nextSessionId: sanitized.nextSessionId ?? fallback.nextSessionId,
  };
}

function isSnapshotValid(snapshot) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return false;
  const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  if (!Array.isArray(snapshot.users) || !snapshot.users.every(record)) return false;
  if (!snapshot.users.every(user =>
    typeof user.id === 'string' && user.id.trim() &&
    typeof user.name === 'string' && user.name.trim() &&
    typeof user.role === 'string'
  )) return false;
  if (!Array.isArray(snapshot.rooms) || !snapshot.rooms.every(room =>
    record(room) && typeof room.id === 'string' && typeof room.name === 'string' &&
    typeof room.status === 'string' && typeof room.type === 'string' &&
    Number.isFinite(room.capacity) && Number.isFinite(room.capacityMin) &&
    Number.isFinite(room.capacityMax)
  )) return false;
  if (!Array.isArray(snapshot.reservations) || !snapshot.reservations.every(reservation =>
    record(reservation) && typeof reservation.id === 'string' &&
    typeof reservation.roomId === 'string' && typeof reservation.status === 'string'
  )) return false;
  for (const key of ['sessions', 'checkins']) {
    if (snapshot[key] !== undefined && (!Array.isArray(snapshot[key]) || !snapshot[key].every(record))) return false;
  }
  if (snapshot.registry !== undefined && !record(snapshot.registry)) return false;
  return true;
}

function setCurrentDB(snapshot) {
  db = normalizeSnapshot(snapshot);
  db.reservations.forEach(reservation => {
    if (!reservation.qrData) reservation.qrData = `E-LIBRARY-RES-${reservation.id}`;
  });
  if (typeof window !== 'undefined') window.db = db;
  return db;
}

export function loadDB() {
  try {
    const raw = localStorage.getItem(DB_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return setCurrentDB(isSnapshotValid(parsed) ? parsed : defaultDB);
  } catch {
    return setCurrentDB(defaultDB);
  }
}

export async function hydrateDB(accessToken = null) {
  if (!accessToken) return setCurrentDB(defaultDB);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`${API_BASE}/api/data`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: controller.signal,
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || 'Could not load your library data.');
    }
    const snapshot = await response.json();
    if (!isSnapshotValid(snapshot)) throw new Error('The backend returned invalid library data.');
    return setCurrentDB(snapshot);
  } finally {
    clearTimeout(timeout);
  }
}

export async function checkBackendAvailability() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  try {
    const response = await fetch(`${API_BASE}/health`, { signal: controller.signal });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

export async function persist({ sync = true } = {}) {
  if (!db) {
    setCurrentDB(defaultDB);
  }

  const safeDb = sanitizeSnapshotForStorage(db ?? defaultDB);
  db = safeDb;

  try {
    localStorage.setItem(DB_KEY, JSON.stringify(safeDb));
    if (typeof window !== 'undefined') window.db = safeDb;
  } catch (cause) {
    const error = new Error('Could not save your changes on this device. Check browser storage and try again.');
    error.cause = cause;
    throw error;
  }

  const token = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('uv_arc_access_token') : null;
  const currentUserId = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('uv_arc_user_id') : null;
  const currentUser = safeDb?.users.find(user => String(user.id) === currentUserId);
  if (sync && token && currentUser?.role === 'admin') {
    const snapshot = JSON.stringify(safeDb);
    pendingRemoteSave = pendingRemoteSave
      .catch(() => {})
      .then(async () => {
        const response = await fetch(`${API_BASE}/api/data`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + token,
          },
          body: snapshot,
        });
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body.error || 'Could not sync library changes with the server.');
        }
      });
    await pendingRemoteSave;
  }
}

export function resetDB() {
  try { localStorage.removeItem(DB_KEY); } catch {}
  return setCurrentDB(defaultDB);
}
