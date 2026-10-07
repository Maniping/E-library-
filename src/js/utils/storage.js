export const DB_KEY = 'uv_arc_db_v13';
export const API_BASE = 'http://localhost:5000';
export const API_BASE_CANDIDATES = [API_BASE, 'http://localhost:5001'];

export const defaultDB = {
  users: [
    { id: '2023-00123', password: 'password123', name: 'Maria Santos', role: 'student', section: 'BSIT 3-A', email: 'maria.santos@uv.edu.ph', dept: 'BSIT', qrData: 'E-LIBRARY-STUDENT-2023-00123', bio: 'BSIT student.', image: null },
    { id: '2022-00456', password: 'password123', name: 'John Cruz', role: 'student', section: 'BSIT 3-A', email: 'john.cruz@uv.edu.ph', dept: 'BSIT', qrData: 'E-LIBRARY-STUDENT-2022-00456', bio: '', image: null },
    { id: '2023-00789', password: 'password123', name: 'Ana Reyes', role: 'student', section: 'BSIT 3-A', email: 'ana.reyes@uv.edu.ph', dept: 'BSIT', qrData: 'E-LIBRARY-STUDENT-2023-00789', bio: '', image: null },
    { id: 'F-1024', password: 'password123', name: 'Prof. Reyes', role: 'faculty', dept: 'College of Computer Studies', email: 'reyes@uv.edu.ph', qrData: 'E-LIBRARY-FACULTY-F-1024', bio: '', image: null },
    { id: 'A-001', password: 'password123', name: 'Admin Staff', role: 'admin', email: 'admin@uv.edu.ph', dept: 'Library', qrData: 'E-LIBRARY-ADMIN-A-001', bio: '', image: null },
  ],
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
  reservations: [
    {
      id: 'RES-2025-001', roomId: 'PC-1', roomName: 'PC 1', roomType: 'pc',
      filedBy: 'Maria Santos', filedById: '2023-00123', dept: 'BSIT',
      dateFiled: '2025-04-08', useDate: '2025-04-10', useTime: '09:00',
      participants: 1, contact: '09171234567', purpose: 'Thesis Research',
      members: [{ name: 'Maria Santos', course: 'BSIT 3-A' }],
      status: 'confirmed', remarks: '', checkedIn: false,
      qrData: 'E-LIBRARY-RES-RES-2025-001',
    },
  ],
  registry: {
    '2023-00123': { name: 'Maria Santos', section: 'BSIT 3-A', dept: 'BSIT', email: 'maria.santos@uv.edu.ph' },
    '2022-00456': { name: 'John Cruz', section: 'BSIT 3-A', dept: 'BSIT', email: 'john.cruz@uv.edu.ph' },
    '2023-00789': { name: 'Ana Reyes', section: 'BSIT 3-A', dept: 'BSIT', email: 'ana.reyes@uv.edu.ph' },
    '2023-00990': { name: 'Mark Lim', section: 'BSIT 3-A', dept: 'BSIT', email: 'mark.lim@uv.edu.ph' },
    '2023-01122': { name: 'Sofia Tan', section: 'BSIT 3-B', dept: 'BSIT', email: 'sofia.tan@uv.edu.ph' },
    'F-2025': { name: 'Prof. Dela Cruz', dept: 'College of Computer Studies', email: 'delacruz@uv.edu.ph' },
    'F-3030': { name: 'Prof. Lim', dept: 'College of Computer Studies', email: 'lim@uv.edu.ph' },
  },
  checkins: [],
  sessions: [],
  nextResId: 2,
  nextSessionId: 1,
  draft: null,
};

export let db = null;

function normalizeSnapshot(snapshot) {
  const nextState = JSON.parse(JSON.stringify(defaultDB));
  const source = snapshot && typeof snapshot === 'object' ? snapshot : {};

  return {
    ...nextState,
    ...source,
    users: Array.isArray(source.users) ? source.users : nextState.users,
    rooms: Array.isArray(source.rooms) ? source.rooms : nextState.rooms,
    reservations: Array.isArray(source.reservations) ? source.reservations : nextState.reservations,
    sessions: Array.isArray(source.sessions) ? source.sessions : nextState.sessions,
    checkins: Array.isArray(source.checkins) ? source.checkins : nextState.checkins,
    registry: source.registry && typeof source.registry === 'object' ? source.registry : nextState.registry,
    draft: source.draft ?? nextState.draft,
    nextResId: source.nextResId ?? nextState.nextResId,
    nextSessionId: source.nextSessionId ?? nextState.nextSessionId,
  };
}

function hasRequiredDemoAccounts(snapshot) {
  const demoIds = ['2023-00123', 'F-1024', 'A-001'];
  const userIds = new Set(
    (Array.isArray(snapshot?.users) ? snapshot.users : [])
      .map(u => String(u?.id ?? '').trim())
      .filter(Boolean)
      .map(id => id.replace(/[^A-Za-z0-9]/g, '').toUpperCase())
  );

  return demoIds.every(id => userIds.has(id.replace(/[^A-Za-z0-9]/g, '').toUpperCase()));
}

function isSnapshotValid(snapshot) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return false;
  const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const requiredArrays = ['users', 'rooms', 'reservations'];
  if (requiredArrays.some(key => !Array.isArray(snapshot[key]) || !snapshot[key].every(record))) return false;
  for (const key of ['sessions', 'checkins']) {
    if (snapshot[key] !== undefined && (!Array.isArray(snapshot[key]) || !snapshot[key].every(record))) return false;
  }
  if (snapshot.registry !== undefined && !record(snapshot.registry)) return false;
  if (!snapshot.users.every(user =>
    typeof user.id === 'string' && user.id.trim() &&
    typeof user.name === 'string' && user.name.trim() &&
    typeof user.password === 'string' &&
    typeof user.role === 'string'
  )) return false;
  if (!snapshot.rooms.every(room =>
    typeof room.id === 'string' &&
    typeof room.name === 'string' &&
    typeof room.status === 'string' &&
    typeof room.type === 'string' &&
    Number.isFinite(room.capacity) &&
    Number.isFinite(room.capacityMin) &&
    Number.isFinite(room.capacityMax)
  )) return false;
  if (!snapshot.reservations.every(reservation =>
    typeof reservation.id === 'string' &&
    typeof reservation.roomId === 'string' &&
    typeof reservation.filedById === 'string' &&
    typeof reservation.useDate === 'string' &&
    typeof reservation.useTime === 'string' &&
    typeof reservation.status === 'string' &&
    Array.isArray(reservation.members) &&
    reservation.members.every(member => record(member) && typeof member.name === 'string')
  )) return false;
  if (snapshot.draft !== null && snapshot.draft !== undefined && !record(snapshot.draft)) return false;
  if (snapshot.nextResId !== undefined && !Number.isInteger(snapshot.nextResId)) return false;
  if (snapshot.nextSessionId !== undefined && !Number.isInteger(snapshot.nextSessionId)) return false;
  return hasRequiredDemoAccounts(snapshot);
}

export function loadDB() {
  try {
    const raw = localStorage.getItem(DB_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    db = isSnapshotValid(parsed)
      ? normalizeSnapshot(parsed)
      : normalizeSnapshot(defaultDB);
  } catch (error) {
    db = normalizeSnapshot(defaultDB);
  }

  if (!db.draft) db.draft = null;
  if (!db.checkins) db.checkins = [];
  if (!db.sessions) db.sessions = [];
  if (!db.nextResId) db.nextResId = 2;
  if (!db.nextSessionId) db.nextSessionId = 1;
  db.reservations.forEach(r => { if (!r.qrData) r.qrData = `E-LIBRARY-RES-${r.id}`; });
  window.db = db;
  return db;
}

export async function hydrateDB() {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw && isSnapshotValid(JSON.parse(raw))) return loadDB();
  } catch (error) {
    // Ignore an unreadable local snapshot and try the backend seed.
  }

  const snapshots = await Promise.all(API_BASE_CANDIDATES.map(async candidate => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1200);
    try {
      const response = await fetch(`${candidate}/api/data`, {
        method: 'GET',
        credentials: 'include',
        signal: controller.signal,
      });
      if (!response.ok) return null;
      const remoteData = await response.json();
      return isSnapshotValid(remoteData) ? normalizeSnapshot(remoteData) : null;
    } catch (error) {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }));
  const remoteDB = snapshots.find(Boolean);
  if (remoteDB) {
    db = remoteDB;
    if (!db.draft) db.draft = null;
    if (!db.checkins) db.checkins = [];
    if (!db.sessions) db.sessions = [];
    if (!db.nextResId) db.nextResId = 2;
    if (!db.nextSessionId) db.nextSessionId = 1;
    db.reservations.forEach(r => { if (!r.qrData) r.qrData = `E-LIBRARY-RES-${r.id}`; });
    window.db = db;
    return db;
  }

  return loadDB();
}

export async function checkBackendAvailability() {
  for (const candidate of API_BASE_CANDIDATES) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1200);
    try {
      const response = await fetch(`${candidate}/health`, { method: 'GET', signal: controller.signal });
      if (response.ok) return true;
    } catch (error) {
      // Continue to the next configured backend.
    } finally {
      clearTimeout(timeout);
    }
  }
  return false;
}

export function persist() {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
    window.db = db;
  } catch (cause) {
    const error = new Error('Could not save your changes on this device. Check browser storage and try again.');
    error.cause = cause;
    throw error;
  }
}

export function resetDB() {
  try { localStorage.removeItem(DB_KEY); } catch (e) {}
  return loadDB();
}