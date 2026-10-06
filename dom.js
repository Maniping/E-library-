export const $ = id => document.getElementById(id);

export const esc = s => String(s || '').replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));

export function showToast(message, type = 'info') {
  const c = $('toastContainer');
  if (!c) return;
  const t = document.createElement('div');
  t.className = 'notification-toast';
  const icon = type === 'success' ? 'fa-check-circle'
    : type === 'error' ? 'fa-exclamation-circle'
    : 'fa-info-circle';
  t.innerHTML = `<i class="fas ${icon}" style="color:var(--uv-gold)"></i> <span>${esc(message)}</span>`;
  c.appendChild(t);
  setTimeout(() => {
    t.style.opacity = '0';
    t.style.transition = 'opacity .25s';
    setTimeout(() => t.remove(), 250);
  }, 2400);
}

window.showToast = showToast;
