export function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const btn = document.getElementById('themeToggleBtn');
  if (btn) btn.innerHTML = theme === 'dark' ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
  try { localStorage.setItem('uv_arc_theme', theme); } catch (e) {}
}

export function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  applyTheme(current === 'dark' ? 'light' : 'dark');
}

export function initTheme() {
  let saved = 'light';
  try { saved = localStorage.getItem('uv_arc_theme') || 'light'; } catch (e) {}
  applyTheme(saved);
}

window.toggleTheme = toggleTheme;
