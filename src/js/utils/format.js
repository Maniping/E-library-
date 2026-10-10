export const initials = n => String(n || '?')
  .split(/\s+/).filter(Boolean).map(x => x[0]).slice(0, 2).join('').toUpperCase() || '?';

export function formatDate(d) {
  if (!d) return '—';
  const value = String(d);
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(Number(value.slice(0, 4)), Number(value.slice(5, 7)) - 1, Number(value.slice(8, 10)))
    : new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  const m = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${m[parsed.getMonth()]} ${parsed.getDate()}, ${parsed.getFullYear()}`;
}

export function formatTime(t) {
  if (!t) return '—';
  const raw = String(t).trim();
  const [hoursRaw, minutesRaw = '0'] = raw.split(':');
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return '—';
  const normalizedHour = hours % 12 || 12;
  return `${normalizedHour}:${String(minutes).padStart(2, '0')} ${hours >= 12 ? 'PM' : 'AM'}`;
}

export function nowTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function todayISO() {
  const d = new Date();
  const padded = new Date(d.getTime() - (d.getTimezoneOffset() * 60000));
  return padded.toISOString().slice(0, 10);
}

export function tomorrowISO() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const padded = new Date(d.getTime() - (d.getTimezoneOffset() * 60000));
  return padded.toISOString().slice(0, 10);
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
  const other = raw.match(/([A-Za-z]+)[-\s]?(\d{2,6})/);
  if (other) return `${other[1].toUpperCase()}-${other[2]}`;
  return raw.trim();
}

export function minutesBetween(t1, t2) {
  if (!t1 || !t2) return 0;
  const [h1, m1] = String(t1).split(':').map(Number);
  const [h2, m2] = String(t2).split(':').map(Number);
  if (!Number.isFinite(h1) || !Number.isFinite(m1) || !Number.isFinite(h2) || !Number.isFinite(m2)) return 0;
  let diff = (h2 * 60 + m2) - (h1 * 60 + m1);
  if (diff < 0) diff += 24 * 60;
  return diff;
}

export function formatDuration(min) {
  const value = Number(min);
  if (!Number.isFinite(value) || value < 0) return '—';
  if (value === 0) return '—';
  const h = Math.floor(value / 60);
  const m = value % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
