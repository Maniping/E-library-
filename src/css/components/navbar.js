import { $, showToast } from '../utils/dom.js';
import { db, persist } from '../utils/storage.js';
import { state } from '../utils/state.js';
import { normalizeId } from '../utils/format.js';

export function setupLoginHandlers() {
  $('loginForm')?.addEventListener('submit', handleLogin);

  document.querySelectorAll('[data-quick-login]').forEach(btn => {
    btn.addEventListener('click', () => quickLogin(btn.dataset.quickLogin));
  });

  $('mobileMenuBtn')?.addEventListener('click', toggleSidebar);
  $('sidebarBackdrop')?.addEventListener('click', toggleSidebar);
  $('themeToggleBtn')?.addEventListener('click', () => window.toggleTheme());
  $('userBadge')?.addEventListener('click', openUserSheet);
  $('fab')?.addEventListener('click', openQuickActions);
}

function handleLogin(e) {
  e.preventDefault();
  const id = $('loginId').value.trim();
  const pw = $('loginPassword').value;
  const err = $('loginError');
  const u = db.users.find(x => normalizeId(x.id) === normalizeId(id) && x.password === pw);
  if (!u) {
    err.textContent = 'Invalid ID number or password.';
    return;
  }
  try { localStorage.setItem('uv_arc_last_id', id); } catch (e) {}
  err.textContent = '';
  state.currentUser = u;
  state.currentRole = u.role;
  $('loginScreen').classList.add('hidden');
  $('appContainer').classList.remove('hidden');
  if (window.innerWidth < 1024) {
    $('bottomNav').classList.remove('hidden');
    $('fab').classList.remove('hidden');
  }
  updateHeader();
  state.currentPage = 'dashboard';
  renderSidebar();
  renderContent();
  showToast(`Welcome back, ${u.name.split(' ')[0]}!`, 'success');
}

function quickLogin(id) {
  $('loginId').value = id;
  $('loginPassword').value = 'password123';
  $('loginForm').dispatchEvent(new Event('submit', { cancelable: true }));
}

function updateHeader() {
  const u = state.currentUser;
  if (!u) return;
  $('headerUserName').textContent = u.name;
  $('headerRoleTag').textContent = u.role.charAt(0).toUpperCase() + u.role.slice(1);
  const av = $('headerAvatar');
  if (u.image) {
    av.innerHTML = `<img src="${u.image}" alt="${u.name}">`;
    av.style.background = 'transparent';
  } else {
    av.textContent = window.initials(u.name);
    av.style.background = u.role === 'admin' ? '#053d23' : u.role === 'faculty' ? '#0f7a48' : '#0a5c36';
    av.style.color = 'white';
  }
}

function toggleSidebar() {
  state.sidebarOpen = !state.sidebarOpen;
  $('sidebarNav').classList.toggle('open', state.sidebarOpen);
  $('sidebarBackdrop').classList.toggle('show', state.sidebarOpen);
}

function closeSidebar() {
  state.sidebarOpen = false;
  $('sidebarNav').classList.remove('open');
  $('sidebarBackdrop').classList.remove('show');
}

function openUserSheet() {
  // ... (full bottom sheet implementation)
}

function openQuickActions() {
  // ...
}

// Expose globally
window.toggleSidebar = toggleSidebar;
window.closeSidebar = closeSidebar;
window.openUserSheet = openUserSheet;
window.openQuickActions = openQuickActions;
window.navigateTo = navigateTo;
window.renderSidebar = renderSidebar;
window.renderContent = renderContent;