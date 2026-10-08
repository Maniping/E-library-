import { $, showToast } from '../../js/utils/dom.js';
import { db } from '../../js/utils/storage.js';
import { state } from '../../js/utils/state.js';
import { hydrateDB } from '../../js/utils/storage.js';
import { api } from '../api.js';

export function setupLoginHandlers() {
  $('loginForm')?.addEventListener('submit', handleLogin);

  $('mobileMenuBtn')?.addEventListener('click', toggleSidebar);
  $('sidebarBackdrop')?.addEventListener('click', toggleSidebar);
  $('themeToggleBtn')?.addEventListener('click', () => window.toggleTheme());
  $('userBadge')?.addEventListener('click', openUserSheet);
  $('fab')?.addEventListener('click', openQuickActions);
}

async function handleLogin(e) {
  e.preventDefault();
  const id = $('loginId').value.trim();
  const pw = $('loginPassword').value;
  const err = $('loginError');
  let user;
  try {
    user = await api.login(id, pw);
    await hydrateDB(sessionStorage.getItem('uv_arc_access_token'));
    user = db.users.find(item => item.id === user.id) || user;
  } catch (error) {
    api.logout();
    err.textContent = error.message || 'Something went wrong signing in. Please try again.';
    return;
  }
  try { localStorage.setItem('uv_arc_last_id', id); } catch (e) {}
  err.textContent = '';
  state.currentUser = user;
  state.currentRole = user.role;
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
  showToast(`Welcome back, ${user.name.split(' ')[0]}!`, 'success');
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