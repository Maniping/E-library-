export const initials = n => String(n || '?')
  .split(' ').filter(x => x).map(x => x[0]).slice(0, 2).join('').toUpperCase();

export function formatDate(d) {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt)) return d;
  const m = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${m[dt.getMonth()]} ${dt.getDate()}, ${dt.getFullYear()}`;
}

export function formatTime(t) {
  if (!t) return '—';
  const [h, m] = t.split(':');
  const hr = parseInt(h);
  return `${hr % 12 || 12}:${m} ${hr >= 12 ? 'PM' : 'AM'}`;
}

export function nowTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

export function todayISO() { return new Date().toISOString().split('T')[0]; }

export function tomorrowISO() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}

export function normalizeId(s) {
  return String(s || '').replace(/[\s\-_]/g, '').toUpperCase();
}

export function extractIdFromText(raw) {
  if (!raw) return null;
  const sp = raw.match(/(\d{4})[-\s]?(\d{4,6})/);
  if (sp) return `${sp[1]}-${sp[2]}`;
  const fp = raw.match(/(F)[-\s]?(\d{3,5})/i);
  if (fp) return `${fp[1].toUpperCase()}-${fp[2]}`;
  const ap = raw.match(/(A)[-\s]?(\d{2,4})/i);
  if (ap) return `${ap[1].toUpperCase()}-${ap[2]}`;
  return raw.trim();
}

export function minutesBetween(t1, t2) {
  if (!t1 || !t2) return 0;
  const [h1,m1] = t1.split(':').map(Number);
  const [h2,m2] = t2.split(':').map(Number);
  let diff = (h2*60+m2) - (h1*60+m1);
  if (diff < 0) diff += 24*60;
  return diff;
}

export function formatDuration(min) {
  if (!min || min < 0) return '—';
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}
