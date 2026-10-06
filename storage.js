export const DB_KEY = 'uv_arc_db_v13';

export const defaultDB = {
  users: [
    { id: '2023-00123', password: 'password123', name: 'Maria Santos', role: 'student', section: 'BSIT 3-A', email: 'maria.santos@uv.edu.ph', dept: 'BSIT', qrData: 'UV-ARC-STUDENT-2023-00123', bio: 'BSIT student.', image: null },
    { id: '2022-00456', password: 'password123', name: 'John Cruz', role: 'student', section: 'BSIT 3-A', email: 'john.cruz@uv.edu.ph', dept: 'BSIT', qrData: 'UV-ARC-STUDENT-2022-00456', bio: '', image: null },
    { id: '2023-00789', password: 'password123', name: 'Ana Reyes', role: 'student', section: 'BSIT 3-A', email: 'ana.reyes@uv.edu.ph', dept: 'BSIT', qrData: 'UV-ARC-STUDENT-2023-00789', bio: '', image: null },
    { id: 'F-1024', password: 'password123', name: 'Prof. Reyes', role: 'faculty', dept: 'College of Computer Studies', email: 'reyes@uv.edu.ph', qrData: 'UV-ARC-FACULTY-F-1024', bio: '', image: null },
    { id: 'A-001', password: 'password123', name: 'Admin Staff', role: 'admin', email: 'admin@uv.edu.ph', dept: 'ARC', qrData: 'UV-ARC-ADMIN-A-001', bio: '', image: null },
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
      qrData: 'UV-ARC-RES-RES-2025-001',
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

export function loadDB() {
  try {
    const raw = localStorage.getItem(DB_KEY);
    db = raw ? JSON.parse(raw) : JSON.parse(JSON.stringify(defaultDB));
  } catch (e) {
    db = JSON.parse(JSON.stringify(defaultDB));
  }
  if (!db.draft) db.draft = null;
  if (!db.checkins) db.checkins = [];
  if (!db.sessions) db.sessions = [];
  if (!db.nextResId) db.nextResId = 2;
  if (!db.nextSessionId) db.nextSessionId = 1;
  db.reservations.forEach(r => { if (!r.qrData) r.qrData = `UV-ARC-RES-${r.id}`; });
  window.db = db;
  return db;
}

export function persist() {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
    window.db = db;
  } catch (e) {}
}

export function resetDB() {
  try { localStorage.removeItem(DB_KEY); } catch (e) {}
  return loadDB();
}