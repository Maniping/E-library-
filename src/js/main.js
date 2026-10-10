import { hydrateDB, checkBackendAvailability, db, persist } from './utils/storage.js';
import { api } from '../css/api.js';
import { state } from './utils/state.js';
import { $, esc, showToast } from './utils/dom.js';
import { applyTheme, toggleTheme, initTheme } from './utils/theme.js';
import {
  initials, formatDate, formatTime, nowTime, todayISO, tomorrowISO,
  normalizeId, extractIdFromText, minutesBetween, formatDuration,
} from './utils/format.js';
import { generateQrData, generateResQrData, renderQrCode } from './utils/qr.js';
import {
  startScanner, stopScanner, switchCamera, closeIdCapture,
  backToScan, proceedChoice, resetScannerUI, selectChoice,
  openCheckinScanner, openCreateAccountScanner, handleDetected,
} from './utils/scanner.js';

/* ============================================================
   GLOBAL EXPOSURE (for inline onclick handlers)
   ============================================================ */
Object.assign(window, {
  // Helpers
  esc, showToast, initials, formatDate, formatTime, nowTime, todayISO,
  tomorrowISO, normalizeId, extractIdFromText, minutesBetween, formatDuration,
  generateQrData, generateResQrData,
  // Theme
  toggleTheme,
  // Navigation & rendering
  navigateTo, renderSidebar, renderContent, renderDashboard,
  renderMyQr, renderMySessions, renderSessions, renderRooms, renderGuidelines,
  renderMyProfile, renderNewReservation, renderMyReservations, renderCheckin,
  renderApprovals, renderAllReservations, renderAccounts, renderCreateAccount,
  renderManageRooms, renderReports,
  // Actions
  handleLogin, handleLogout, updateHeader,
  toggleSidebar, closeSidebar, openUserSheet, openQuickActions,
  closeBottomSheet, openBottomSheet,
  quickCheckout, quickReserveRoom, saveDraft, clearDraft, updateRoomInfo,
  submitReservation, closeSuccess,
  viewReservation, closeReservationModal, approveReservation, rejectReservation,
  printReservationSlip, openReservationQr, printReservationQr,
  openQrModal, closeQrModal, printQrCode, openAccountDetails, closeAccountDetails,
  openEditProfile, closeEditProfile, previewImage, saveProfile,
  openChangePassword, closeChangePassword, checkPasswordStrength,
  checkPasswordMatch, submitChangePassword,
  createAccount, toggleRoleFields, changeRoomStatus, exportReport,
  checkCameraPermission,
  togglePw, closePopup,
  // Scanner
  startScanner, stopScanner, switchCamera, closeIdCapture, backToScan,
  proceedChoice, selectChoice, openCheckinScanner, openCreateAccountScanner,
  // DOM
  $,
});

async function persistWithFeedback() {
  try {
    await persist();
    return true;
  } catch (error) {
    showToast(error.message || 'Could not save your changes. Please try again.', 'error');
    return false;
  }
}

function setFormSubmitting(button, submitting, label = 'Saving...') {
  if (!button) return;
  button.disabled = submitting;
  if (submitting) {
    button.dataset.originalLabel = button.innerHTML;
    button.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${label}`;
  } else if (button.dataset.originalLabel) {
    button.innerHTML = button.dataset.originalLabel;
    delete button.dataset.originalLabel;
  }
}

/* ============================================================
   THEME TOGGLE WIRING
   ============================================================ */
function togglePw(id, btn) {
  const input = $(id);
  if (!input) return;
  if (input.type === 'password') {
    input.type = 'text';
    btn.innerHTML = '<i class="fas fa-eye-slash"></i>';
  } else {
    input.type = 'password';
    btn.innerHTML = '<i class="fas fa-eye"></i>';
  }
}
window.togglePw = togglePw;

const DEMO_ACCOUNTS = {
  student: { id: '2023-00123', password: 'password123' },
  faculty: { id: 'F-1024', password: 'password123' },
};

function revealDemoAccounts() {
  const panel = $('demoAccounts');
  if (!panel) return;
  panel.classList.remove('hidden');
  panel.setAttribute('aria-hidden', 'false');
}

function hideDemoAccounts() {
  const panel = $('demoAccounts');
  if (!panel) return;
  panel.classList.add('hidden');
  panel.setAttribute('aria-hidden', 'true');
}

function fillDemoAccount(role) {
  const account = DEMO_ACCOUNTS[role];
  if (!account) return;
  $('loginId').value = account.id;
  $('loginPassword').value = account.password;
  $('loginError').textContent = '';
}

/* ============================================================
   SIDEBAR
   ============================================================ */
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

function renderSidebar() {
  const u = state.currentUser;
  if (!u) return;
  const role = u.role;
  const pending = db.reservations.filter(r => r.status === 'pending').length;
  const badge = n => n ? `<span class="nav-badge">${n}</span>` : '';

  let html = `
    <div class="sidebar-section">
      <h4>Main</h4>
      <div class="nav-item ${state.currentPage==='dashboard'?'active':''}" data-page="dashboard"><i class="fas fa-th-large"></i> Dashboard</div>
      <div class="nav-item ${state.currentPage==='myqr'?'active':''}" data-page="myqr"><i class="fas fa-qrcode"></i> My QR Code</div>
      <div class="nav-item ${state.currentPage==='rooms'?'active':''}" data-page="rooms"><i class="fas fa-desktop"></i> PCs</div>
      <div class="nav-item ${state.currentPage==='guidelines'?'active':''}" data-page="guidelines"><i class="fas fa-scroll"></i> Guidelines</div>
      <div class="nav-item ${state.currentPage==='myprofile'?'active':''}" data-page="myprofile"><i class="fas fa-id-badge"></i> My Profile</div>
      <div class="nav-item ${state.currentPage==='mysessions'?'active':''}" data-page="mysessions"><i class="fas fa-clock"></i> My Library Sessions</div>
  `;
  if (role === 'student' || role === 'faculty') {
    html += `
      <div class="nav-item ${state.currentPage==='newreservation'?'active':''}" data-page="newreservation"><i class="fas fa-plus-circle"></i> New Reservation</div>
      <div class="nav-item ${state.currentPage==='myreservations'?'active':''}" data-page="myreservations"><i class="fas fa-history"></i> My Reservations</div>
    `;
  }
  html += `</div>`;
  if (role === 'admin') {
    html += `
      <div class="sidebar-section">
        <h4>Administration</h4>
        <div class="nav-item ${state.currentPage==='checkin'?'active':''}" data-page="checkin"><i class="fas fa-camera"></i> Check-In / Out Scanner</div>
        <div class="nav-item ${state.currentPage==='sessions'?'active':''}" data-page="sessions"><i class="fas fa-clock"></i> Library Sessions</div>
        <div class="nav-item ${state.currentPage==='approvals'?'active':''}" data-page="approvals"><i class="fas fa-check-double"></i> Approvals ${badge(pending)}</div>
        <div class="nav-item ${state.currentPage==='allreservations'?'active':''}" data-page="allreservations"><i class="fas fa-list-alt"></i> All Reservations</div>
        <div class="nav-item ${state.currentPage==='accounts'?'active':''}" data-page="accounts"><i class="fas fa-users-cog"></i> Accounts</div>
        <div class="nav-item ${state.currentPage==='createaccount'?'active':''}" data-page="createaccount"><i class="fas fa-user-plus"></i> Create Account</div>
        <div class="nav-item ${state.currentPage==='managerooms'?'active':''}" data-page="managerooms"><i class="fas fa-cog"></i> Manage PCs</div>
        <div class="nav-item ${state.currentPage==='reports'?'active':''}" data-page="reports"><i class="fas fa-chart-bar"></i> Reports</div>
      </div>
    `;
  }
  const sb = $('sidebarNav');
  sb.innerHTML = html;
  sb.querySelectorAll('.nav-item').forEach(el => {
    el.addEventListener('click', () => { navigateTo(el.dataset.page); closeSidebar(); });
  });
}

function navigateTo(page) {
  if (state.scannerActive) stopScanner();
  state.currentPage = page;
  renderSidebar();
  renderContent();
  document.querySelectorAll('.bottom-nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page);
  });
}

/* ============================================================
   RENDER ROUTER
   ============================================================ */
function renderContent() {
  const area = $('contentArea');
  let html = '';
  switch (state.currentPage) {
    case 'dashboard':       html = renderDashboard(); break;
    case 'myqr':            html = renderMyQr(); break;
    case 'rooms':           html = renderRooms(); break;
    case 'guidelines':      html = renderGuidelines(); break;
    case 'myprofile':       html = renderMyProfile(); break;
    case 'newreservation':  html = renderNewReservation(); break;
    case 'myreservations':  html = renderMyReservations(); break;
    case 'mysessions':      html = renderMySessions(); break;
    case 'checkin':         html = renderCheckin(); break;
    case 'sessions':        html = renderSessions(); break;
    case 'approvals':       html = renderApprovals(); break;
    case 'allreservations': html = renderAllReservations(); break;
    case 'accounts':        html = renderAccounts(); break;
    case 'createaccount':   html = renderCreateAccount(); break;
    case 'managerooms':     html = renderManageRooms(); break;
    case 'reports':         html = renderReports(); break;
    case 'notfound':        html = renderNotFound(); break;
    default:                html = renderNotFound();
  }
  area.innerHTML = html;
  area.classList.remove('page-enter');
  void area.offsetWidth;
  area.classList.add('page-enter');
  area.scrollTop = 0;

  if (state.currentPage === 'myqr' && state.currentUser) {
    setTimeout(() => {
      const c = $('fullQrContainer');
      if (c) renderQrCode(c, state.currentUser.qrData, 200);
    }, 20);
  }
  if (state.currentPage === 'dashboard') {
    setTimeout(() => {
      const box = $('dashboardQrBox');
      if (box && state.currentUser) renderQrCode(box, state.currentUser.qrData, 100);
    }, 30);
  }
}

function renderNotFound() {
  return `
    <div class="page-title"><i class="fas fa-circle-question"></i> Page not found</div>
    <div class="page-sub">The page or item you requested could not be found.</div>
    <button class="btn btn-primary" onclick="navigateTo('dashboard')"><i class="fas fa-home"></i> Back to dashboard</button>
  `;
}

/* ============================================================
   DASHBOARD
   ============================================================ */
function activeSessionFor(userId) {
  return db.sessions.find(s => s.userId === userId && !s.checkOut);
}
function sessionsFor(userId) {
  return db.sessions.filter(s => s.userId === userId).sort((a,b) => (b.checkIn || '').localeCompare(a.checkIn || ''));
}
function userById(id) { return db.users.find(u => u.id === id); }

function renderDashboard() {
  const u = state.currentUser;
  const totalRooms = db.rooms.length;
  const avail = db.rooms.filter(r => r.status === 'available').length;
  const occ = db.rooms.filter(r => r.status === 'occupied').length;
  const myRes = db.reservations.filter(r => r.filedById === u.id);
  const pending = db.reservations.filter(r => r.status === 'pending').length;
  const myUpcoming = myRes.filter(r => r.status === 'confirmed');
  const active = activeSessionFor(u.id);
  const mySessions = sessionsFor(u.id).slice(0, 5);

  let suggestion = '';
  if (active) {
    suggestion = `<div class="smart-suggestion" style="background:linear-gradient(135deg,#dcfce7 0%,#bbf7d0 100%);border-color:#86efac;color:#166534"><i class="fas fa-sign-in-alt" style="color:#16a34a"></i><div><strong>You're checked in at ${esc(active.room)}</strong> since ${esc(active.checkIn)}. Don't forget to check out when you leave.</div></div>`;
  } else if ((state.currentRole === 'student' || state.currentRole === 'faculty') && myUpcoming.length === 0 && avail > 0) {
    suggestion = `<div class="smart-suggestion"><i class="fas fa-lightbulb"></i><div><strong>${avail} PC${avail > 1 ? 's' : ''} available.</strong> Reserve a PC in under 30 seconds. <span style="cursor:pointer;text-decoration:underline;font-weight:600" onclick="navigateTo('newreservation')">Reserve now →</span></div></div>`;
  } else if (myUpcoming.length > 0) {
    const next = myUpcoming[0];
    suggestion = `<div class="smart-suggestion" style="background:linear-gradient(135deg,#dcfce7 0%,#bbf7d0 100%);border-color:#86efac;color:#166534"><i class="fas fa-calendar-check" style="color:#16a34a"></i><div><strong>Your next reservation:</strong> ${esc(next.roomName)} on ${formatDate(next.useDate)} at ${formatTime(next.useTime)}. <span style="cursor:pointer;text-decoration:underline;font-weight:600" onclick="viewReservation('${esc(next.id)}')">View →</span></div></div>`;
  }

  let quickActions = '';
  if (state.currentRole === 'student' || state.currentRole === 'faculty') {
    quickActions = `<div class="quick-actions">
      <div class="quick-action" onclick="navigateTo('newreservation')"><div class="qa-icon"><i class="fas fa-plus-circle"></i></div><div class="qa-label">Reserve PC</div><div class="qa-desc">Book in seconds</div></div>
      <div class="quick-action" onclick="navigateTo('myqr')"><div class="qa-icon"><i class="fas fa-qrcode"></i></div><div class="qa-label">My QR Code</div><div class="qa-desc">For check-in/out</div></div>
      <div class="quick-action" onclick="navigateTo('myreservations')"><div class="qa-icon"><i class="fas fa-calendar-check"></i></div><div class="qa-label">My Reservations</div><div class="qa-desc">${myRes.length} total</div></div>
      <div class="quick-action" onclick="navigateTo('mysessions')"><div class="qa-icon"><i class="fas fa-clock"></i></div><div class="qa-label">My Library Sessions</div><div class="qa-desc">${sessionsFor(u.id).length} logs</div></div>
    </div>`;
  } else {
    quickActions = `<div class="quick-actions">
      <div class="quick-action" onclick="navigateTo('checkin')"><div class="qa-icon"><i class="fas fa-camera"></i></div><div class="qa-label">Scanner</div><div class="qa-desc">In / Out</div></div>
      <div class="quick-action" onclick="navigateTo('sessions')"><div class="qa-icon"><i class="fas fa-clock"></i></div><div class="qa-label">Library Sessions</div><div class="qa-desc">${db.sessions.length} logs</div></div>
      <div class="quick-action" onclick="navigateTo('approvals')"><div class="qa-icon"><i class="fas fa-check-double"></i></div><div class="qa-label">Approvals</div><div class="qa-desc">${pending} pending</div></div>
      <div class="quick-action" onclick="navigateTo('reports')"><div class="qa-icon"><i class="fas fa-chart-bar"></i></div><div class="qa-label">Reports</div><div class="qa-desc">Analytics</div></div>
    </div>`;
  }

  let sessionPanel = '';
  if (state.currentRole === 'student' || state.currentRole === 'faculty') {
    sessionPanel = `<div class="session-card">
      <h3><i class="fas fa-clock"></i> Library Session</h3>
      ${active ? `
        <div class="session-active">
          <div class="sess-icon"><i class="fas fa-sign-in-alt"></i></div>
          <div class="sess-info">
            <h4>Currently checked in</h4>
            <p>${esc(active.room)}${active.reservationId ? ' · ' + esc(active.reservationId) : ''}</p>
            <div class="sess-time"><i class="fas fa-clock"></i> Since ${esc(active.checkIn)}</div>
          </div>
          <button class="btn-checkout" onclick="quickCheckout('${esc(active.id)}')"><i class="fas fa-sign-out-alt"></i> Check-Out</button>
        </div>
      ` : `
        <div class="session-empty">
          <i class="fas fa-sign-in-alt"></i>
          <p>Not currently checked in.</p>
          <p style="font-size:.78rem;color:var(--text-faint);margin-top:4px">Scan your reservation QR at the library desk to log in.</p>
        </div>
      `}
      ${mySessions.length > 0 ? `
        <div class="session-history">
          <h4>Recent logs</h4>
          ${mySessions.map(s => `
            <div class="session-log">
              <div class="log-icon ${s.checkOut ? 'out' : 'in'}"><i class="fas fa-${s.checkOut ? 'sign-out-alt' : 'sign-in-alt'}"></i></div>
              <div class="log-info">
                <strong>${s.checkOut ? 'Checked out' : 'Checked in'}</strong>
                <span>${esc(s.room)}${s.reservationId ? ' · ' + esc(s.reservationId) : ''}</span>
              </div>
              <div class="log-time">${s.checkOut ? esc(s.checkOut) : esc(s.checkIn)}</div>
            </div>
          `).join('')}
        </div>
      ` : ''}
    </div>`;
  }

  return `
    <div class="page-title"><i class="fas fa-th-large"></i> Hi, ${esc(u.name.split(' ')[0])}!</div>
    <div class="page-sub">${state.currentRole.charAt(0).toUpperCase()+state.currentRole.slice(1)} dashboard · ${formatDate(todayISO())}</div>
    ${suggestion}
    ${quickActions}
    ${sessionPanel}
    <div class="qr-section">
      <div class="qr-box" id="dashboardQrBox"></div>
      <div class="qr-info">
        <h4><i class="fas fa-qrcode"></i> Your Account QR</h4>
        <p>Show this when entering the library.</p>
        <code>${esc(u.qrData)}</code>
        <div style="margin-top:8px"><button class="btn btn-sm btn-primary" onclick="navigateTo('myqr')"><i class="fas fa-expand"></i> View Full QR</button></div>
      </div>
    </div>
    <div class="card-grid">
      <div class="stat-card"><div class="stat-icon"><i class="fas fa-desktop"></i></div><div class="stat-info"><h3>${totalRooms}</h3><p>Total PCs</p></div></div>
      <div class="stat-card"><div class="stat-icon"><i class="fas fa-check-circle" style="color:#166534"></i></div><div class="stat-info"><h3>${avail}</h3><p>Available</p></div></div>
      <div class="stat-card"><div class="stat-icon"><i class="fas fa-users" style="color:#b91c1c"></i></div><div class="stat-info"><h3>${occ}</h3><p>Occupied</p></div></div>
      ${state.currentRole === 'admin' ? `<div class="stat-card"><div class="stat-icon"><i class="fas fa-clock"></i></div><div class="stat-info"><h3>${pending}</h3><p>Pending</p></div></div>` : `<div class="stat-card"><div class="stat-icon"><i class="fas fa-calendar-check"></i></div><div class="stat-info"><h3>${myUpcoming.length}</h3><p>Upcoming</p></div></div>`}
    </div>
    ${myRes.length > 0 ? `
      <h3 style="margin:18px 0 10px;color:var(--text-primary);font-size:1.05rem">🕐 Recent Reservations</h3>
      ${myRes.slice(-3).reverse().map(r => `
        <div class="recent-item" onclick="viewReservation('${esc(r.id)}')">
          <div class="recent-icon"><i class="fas fa-desktop"></i></div>
          <div class="recent-info">
            <h5>${esc(r.roomName)}</h5>
            <p>${formatDate(r.useDate)} · ${formatTime(r.useTime)} · ${r.status}</p>
          </div>
          <i class="fas fa-chevron-right" style="color:var(--text-faint)"></i>
        </div>
      `).join('')}
    ` : ''}
  `;
}

async function quickCheckout(sessionId) {
  const s = db.sessions.find(x => x.id === sessionId);
  if (!s) return;
  const previous = { checkOut: s.checkOut, durationMin: s.durationMin };
  const t = nowTime();
  s.checkOut = t;
  s.durationMin = minutesBetween(s.checkIn, t);
  if (!await persistWithFeedback()) {
    Object.assign(s, previous);
    return;
  }
  showToast(`✅ Checked out of ${s.room}`, 'success');
  renderContent();
}

/* ============================================================
   OTHER PAGES
   ============================================================ */
function renderMyQr() {
  const u = state.currentUser;
  return `
    <div class="page-title"><i class="fas fa-qrcode"></i> My QR Code</div>
    <div class="page-sub">Present this at the library desk</div>
    <div style="display:flex;justify-content:center">
      <div style="background:var(--bg-card);padding:24px;border-radius:24px;border:1px solid var(--border);display:flex;flex-direction:column;align-items:center;max-width:480px;width:100%">
        <div id="fullQrContainer" style="background:white;padding:16px;border-radius:16px;border:1px solid var(--border)"></div>
        <h3 style="margin-top:16px;color:var(--text-primary);font-size:1.15rem">${esc(u.name)}</h3>
        <p style="color:var(--text-muted);margin:6px 0 2px;font-size:.9rem">${esc(u.id)}</p>
        <p style="color:var(--text-muted);text-transform:capitalize;margin-bottom:14px;font-size:.9rem">${esc(u.role)}</p>
        <code style="background:var(--bg-subtle);padding:6px 14px;border-radius:8px;font-size:.72rem;color:var(--uv-green);word-break:break-all;text-align:center">${esc(u.qrData)}</code>
        <div style="display:flex;gap:10px;margin-top:20px;flex-wrap:wrap;justify-content:center">
          <button class="btn btn-primary" onclick="openQrModal('${esc(u.id)}')"><i class="fas fa-expand"></i> Enlarge</button>
          <button class="btn btn-outline" onclick="printQrCode()"><i class="fas fa-print"></i> Print</button>
        </div>
      </div>
    </div>
  `;
}

function renderMySessions() {
  const u = state.currentUser;
  const all = sessionsFor(u.id);
  const active = activeSessionFor(u.id);
  let html = `<div class="page-title"><i class="fas fa-clock"></i> My Library Sessions</div>
    <div class="page-sub">${all.length} session${all.length !== 1 ? 's' : ''} logged</div>`;
  if (active) {
    html += `
      <div class="session-active" style="margin-bottom:18px">
        <div class="sess-icon"><i class="fas fa-sign-in-alt"></i></div>
        <div class="sess-info">
          <h4>Currently checked in</h4>
          <p>${esc(active.room)}${active.reservationId ? ' · ' + esc(active.reservationId) : ''}</p>
          <div class="sess-time"><i class="fas fa-clock"></i> Since ${esc(active.checkIn)}</div>
        </div>
        <button class="btn-checkout" onclick="quickCheckout('${esc(active.id)}')"><i class="fas fa-sign-out-alt"></i> Check-Out</button>
      </div>
    `;
  }
  if (all.length === 0) {
    html += `<div style="text-align:center;padding:60px 20px;background:var(--bg-card);border-radius:20px">
      <i class="fas fa-history" style="font-size:3rem;color:var(--text-faint);margin-bottom:14px"></i>
      <p style="color:var(--text-muted)">No sessions yet.</p>
    </div>`;
    return html;
  }
  html += `<div class="table-wrapper"><table>
    <thead><tr><th>Date</th><th>PC</th><th>Reservation</th><th>Check-In</th><th>Check-Out</th><th>Duration</th></tr></thead><tbody>`;
  all.forEach(s => {
    html += `<tr>
      <td>${formatDate(s.date)}</td>
      <td><strong>${esc(s.room)}</strong></td>
      <td>${s.reservationId ? `<code style="font-size:.72rem">${esc(s.reservationId)}</code>` : '—'}</td>
      <td>${esc(s.checkIn || '—')}</td>
      <td>${s.checkOut ? esc(s.checkOut) : '<span class="badge checked-in">Active</span>'}</td>
      <td>${s.durationMin ? `<span class="session-badge-dur">${formatDuration(s.durationMin)}</span>` : '<span class="badge pending">In progress</span>'}</td>
    </tr>`;
  });
  html += `</tbody></table></div>`;
  return html;
}

function renderSessions() {
  const all = db.sessions.slice().sort((a,b) => (b.checkIn || '').localeCompare(a.checkIn || ''));
  const activeCount = db.sessions.filter(s => !s.checkOut).length;
  let html = `<div class="page-title"><i class="fas fa-clock"></i> Library Sessions</div>
    <div class="page-sub">${all.length} log${all.length !== 1 ? 's' : ''} · ${activeCount} currently inside</div>`;
  if (all.length === 0) {
    html += `<div style="text-align:center;padding:60px 20px;background:var(--bg-card);border-radius:20px">
      <i class="fas fa-clock" style="font-size:3rem;color:var(--text-faint);margin-bottom:14px"></i>
      <p style="color:var(--text-muted)">No sessions yet.</p>
    </div>`;
    return html;
  }
  html += `<div class="table-wrapper"><table>
    <thead><tr><th>User</th><th>PC</th><th>Reservation</th><th>Date</th><th>Check-In</th><th>Check-Out</th><th>Duration</th></tr></thead><tbody>`;
  all.forEach(s => {
    html += `<tr>
      <td><strong>${esc(s.userName)}</strong><br><span style="font-size:.72rem;color:var(--text-muted)">${esc(s.userId)}</span></td>
      <td>${esc(s.room)}</td>
      <td>${s.reservationId ? `<code style="font-size:.72rem">${esc(s.reservationId)}</code>` : '—'}</td>
      <td>${formatDate(s.date)}</td>
      <td>${esc(s.checkIn || '—')}</td>
      <td>${s.checkOut ? esc(s.checkOut) : '<span class="badge checked-in">Inside</span>'}</td>
      <td>${s.durationMin ? `<span class="session-badge-dur">${formatDuration(s.durationMin)}</span>` : '—'}</td>
    </tr>`;
  });
  html += `</tbody></table></div>`;
  return html;
}

function renderRooms() {
  let html = `<div class="page-title"><i class="fas fa-desktop"></i> PCs</div>
    <div class="page-sub">Tap a PC to reserve instantly</div>
    <div class="table-wrapper"><table>
      <thead><tr><th>PC</th><th>Type</th><th>Capacity</th><th>Location</th><th>Status</th><th>Action</th></tr></thead><tbody>`;
  db.rooms.forEach(r => {
    const canReserve = r.status === 'available' && (state.currentRole === 'student' || state.currentRole === 'faculty');
    html += `<tr>
      <td><strong>${esc(r.name)}</strong></td>
      <td style="text-transform:capitalize">${esc(r.type)}</td>
      <td>${r.capacity} pax</td>
      <td>${esc(r.location)}</td>
      <td><span class="badge ${r.status}">${r.status}</span></td>
      <td>${canReserve ? `<button class="btn btn-sm btn-primary" onclick="quickReserveRoom('${esc(r.id)}')"><i class="fas fa-bolt"></i> Reserve</button>` : `<span style="color:var(--text-faint);font-size:.78rem">${r.status === 'available' ? '—' : 'Unavailable'}</span>`}</td>
    </tr>`;
  });
  html += `</tbody></table></div>`;
  return html;
}

function quickReserveRoom(roomId) {
  navigateTo('newreservation');
  setTimeout(() => {
    const sel = $('resRoom');
    if (sel) { sel.value = roomId; updateRoomInfo(); }
  }, 30);
}

function renderGuidelines() {
  return `
    <div class="page-title"><i class="fas fa-scroll"></i> Guidelines</div>
    <div class="page-sub">Guidelines on the Use of PC Stations</div>
    <div class="guidelines-box">
      <h3><i class="fas fa-list-ol" style="color:var(--uv-green)"></i> Rules & Guidelines</h3>
      <ol class="guidelines-list">
        <li>The user shall make reservation at the <strong>Circulation Counter</strong> before their scheduled utilization.</li>
        <li>The user shall leave his or her <strong>ID</strong> at the librarian In-charge upon utilization at the Circulation Counter.</li>
        <li>Use of the PC is limited to <strong>one (1) person</strong> per station.</li>
        <li>The maximum number of users shall not exceed the designated number of users.</li>
        <li>Only users with a <strong>confirmed reservation</strong> at the specified time shall be allowed to use the PC.</li>
        <li>The <strong>DVARC reserves the right to cancel</strong> reservation of users who fail to show up after <strong>fifteen (15) minutes</strong>.</li>
        <li>Users of the PC shall be held <strong>liable for damages and/or losses</strong> caused by negligent use of the facility.</li>
        <li>Use of PC is limited to a maximum of <strong>1½ hours per day</strong>.</li>
        <li>Prohibited inside the PC area: eating, sleeping, chatting/dating, playing cards/board games/musical instruments, gambling, leaving personal belongings unattended, and making of industrial works and artworks and visual aids.</li>
        <li>The <strong>DVLRC reserves the right to approve/disapprove</strong> use of the PC stations.</li>
      </ol>
    </div>
  `;
}

function renderMyProfile() {
  const u = state.currentUser;
  return `
    <div class="page-title"><i class="fas fa-id-badge"></i> My Profile</div>
    <div class="page-sub">Your information · Tap your photo to change it</div>
    <div class="profile-hero">
      <div class="profile-hero-avatar" onclick="openEditProfile()" title="Change profile picture">
        ${u.image ? `<img src="${u.image}" alt="${esc(u.name)}">` : initials(u.name)}
      </div>
      <div class="profile-hero-info">
        <h2>${esc(u.name)}</h2>
        <p><i class="fas fa-id-card"></i> ${esc(u.id)}</p>
        ${u.email ? `<p><i class="fas fa-envelope"></i> ${esc(u.email)}</p>` : ''}
        <span class="hero-role">${esc(u.role)}</span>
      </div>
      <div class="profile-hero-actions">
        <button class="btn" onclick="openEditProfile()"><i class="fas fa-camera"></i> Change Photo</button>
        <button class="btn" onclick="openChangePassword()"><i class="fas fa-key"></i> Password</button>
      </div>
    </div>
    <div class="info-grid">
      <div class="info-card">
        <h4><i class="fas fa-user"></i> Personal</h4>
        <div class="info-row"><span class="label">Name</span><span class="value">${esc(u.name)}</span></div>
        <div class="info-row"><span class="label">ID</span><span class="value">${esc(u.id)}</span></div>
        <div class="info-row"><span class="label">Role</span><span class="value" style="text-transform:capitalize">${esc(u.role)}</span></div>
        <div class="info-row"><span class="label">Email</span><span class="value">${esc(u.email || '—')}</span></div>
      </div>
      <div class="info-card">
        <h4><i class="fas fa-graduation-cap"></i> Academic</h4>
        ${u.section ? `<div class="info-row"><span class="label">Section</span><span class="value">${esc(u.section)}</span></div>` : ''}
        ${u.dept ? `<div class="info-row"><span class="label">Department</span><span class="value">${esc(u.dept)}</span></div>` : ''}
      </div>
      <div class="info-card">
        <h4><i class="fas fa-info-circle"></i> About</h4>
        <p style="color:var(--text-secondary);font-size:.88rem;line-height:1.6">${esc(u.bio || 'No bio yet.')}</p>
      </div>
    </div>
  `;
}

function renderNewReservation() {
  const u = state.currentUser;
  const available = db.rooms.filter(r => r.status === 'available');
  const draft = db.draft || {};
  const roomOpts = available.map(r => `<option value="${r.id}" ${draft.roomId === r.id ? 'selected' : ''}>${esc(r.name)} (${esc(r.type)} · ${r.capacity} pax)</option>`).join('');
  const lastRes = db.reservations.filter(r => r.filedById === u.id).sort((a, b) => new Date(b.dateFiled) - new Date(a.dateFiled))[0];
  const defaultMembers = lastRes ? lastRes.members.map(m => `${m.name}, ${m.course}`).join('\n') : '';
  const defaultContact = lastRes ? lastRes.contact : '';

  return `
    <div class="page-title"><i class="fas fa-plus-circle"></i> New Reservation</div>
    <div class="page-sub">Takes under 30 seconds · Drafts auto-saved</div>
    <div class="slip">
      <div class="slip-header">
        <h2>PC RESERVATION</h2>
        <p>E-LIBRARY</p>
      </div>
      <form id="reservationForm">
        <div class="slip-grid">
          <div class="slip-row"><span class="label">Name:</span><span class="value">${esc(u.name)}</span></div>
          <div class="slip-row"><span class="label">Date Filed:</span><span class="value">${formatDate(todayISO())}</span></div>
          <div class="slip-row"><span class="label">Dept:</span><span class="value">${esc(u.dept || u.section || '—')}</span></div>
        </div>
        <div class="form-group">
          <label>PC Station</label>
          <select class="form-control" id="resRoom" required>
            <option value="">— Select a PC —</option>
            ${roomOpts}
          </select>
          <div id="roomInfo" style="font-size:.78rem;color:var(--text-muted);margin-top:6px"></div>
        </div>
        <div class="flex-row">
          <div class="form-group" style="flex:1;min-width:150px">
            <label>Date</label>
            <input type="date" class="form-control" id="resDate" required min="${todayISO()}" value="${draft.useDate || tomorrowISO()}">
          </div>
          <div class="form-group" style="flex:1;min-width:150px">
            <label>Time</label>
            <input type="time" class="form-control" id="resTime" required value="${draft.useTime || '09:00'}">
          </div>
        </div>
        <div class="flex-row">
          <div class="form-group" style="flex:1;min-width:150px">
            <label>Participants</label>
            <input type="number" class="form-control" id="resParticipants" required min="1" max="1" value="${esc(draft.participants || '1')}">
            <div id="participantHint" style="font-size:.78rem;color:var(--text-muted);margin-top:6px"></div>
          </div>
          <div class="form-group" style="flex:1;min-width:150px">
            <label>Contact</label>
            <input type="tel" class="form-control" id="resContact" required value="${esc(draft.contact || defaultContact)}" placeholder="09171234567">
          </div>
        </div>
        <div class="form-group">
          <label>Purpose</label>
          <input type="text" class="form-control" id="resPurpose" required value="${esc(draft.purpose || '')}" placeholder="e.g., Thesis Research">
        </div>
        <div class="form-group">
          <label>User <span style="color:var(--text-muted);font-size:.8rem">— one per line</span></label>
          <textarea class="form-control" id="resMembers" rows="2" required placeholder="Juan Dela Cruz, BSIT 3-A">${esc(draft.members || defaultMembers)}</textarea>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-outline" onclick="clearDraft(); navigateTo('dashboard')">Cancel</button>
          <button type="submit" class="btn btn-primary" id="submitResBtn"><i class="fas fa-paper-plane"></i> Submit</button>
        </div>
      </form>
    </div>
  `;
}

function updateRoomInfo() {
  const rid = $('resRoom').value;
  const info = $('roomInfo');
  const hint = $('participantHint');
  if (!rid) { info.textContent = ''; hint.textContent = ''; return; }
  const r = db.rooms.find(x => x.id === rid);
  if (!r) return;
  info.innerHTML = `<i class="fas fa-map-marker-alt"></i> ${esc(r.location)} · ${esc(r.type)}`;
  hint.innerHTML = `<i class="fas fa-user"></i> Capacity: <strong>${r.capacity}</strong>`;
  $('resParticipants').min = r.capacityMin;
  $('resParticipants').max = r.capacityMax;
  $('resParticipants').value = r.capacity;
}

async function saveDraft() {
  if (!state.currentUser) return;
  const previous = db.draft;
  db.draft = {
    roomId: $('resRoom')?.value || '',
    useDate: $('resDate')?.value || '',
    useTime: $('resTime')?.value || '',
    participants: $('resParticipants')?.value || '',
    contact: $('resContact')?.value || '',
    purpose: $('resPurpose')?.value || '',
    members: $('resMembers')?.value || '',
    savedAt: new Date().toISOString(),
  };
  if (!await persistWithFeedback()) db.draft = previous;
}
async function clearDraft() {
  const previous = db.draft;
  db.draft = null;
  if (!await persistWithFeedback()) db.draft = previous;
}

async function submitReservation(e) {
  e.preventDefault();
  if (state.submitting) return;
  const u = state.currentUser;
  const roomId = $('resRoom').value;
  const room = db.rooms.find(r => r.id === roomId);
  const date = $('resDate').value;
  const time = $('resTime').value;
  const participants = parseInt($('resParticipants').value);
  const contact = $('resContact').value.trim();
  const purpose = $('resPurpose').value.trim();
  const membersRaw = $('resMembers').value.trim();

  if (!room) { showToast('Please select a PC', 'error'); return; }
  if (participants < room.capacityMin || participants > room.capacityMax) {
    showToast(`Participants must be ${room.capacityMin}-${room.capacityMax}`, 'error'); return;
  }
  const members = membersRaw.split('\n').map(l => {
    const p = l.split(',');
    return { name: p[0]?.trim() || '', course: p[1]?.trim() || '' };
  }).filter(m => m.name);
  if (members.length < 1) { showToast('At least 1 user required', 'error'); return; }

  const conflict = db.reservations.some(r =>
    r.roomId === roomId && r.useDate === date && r.status !== 'cancelled' &&
    Math.abs(timeToMin(r.useTime) - timeToMin(time)) < 90
  );
  if (conflict) { showToast('PC already reserved for this time', 'error'); return; }

  const button = $('submitResBtn');
  state.submitting = true;
  setFormSubmitting(button, true, 'Saving reservation...');
  await new Promise(resolve => setTimeout(resolve, 0));
  const previousDraft = db.draft;
  let reservationAdded = false;
  try {
    const newReservation = {
      roomId: room.id, roomName: room.name, roomType: room.type,
      filedBy: u.name, filedById: u.id,
      dept: u.dept || u.section || '—',
      dateFiled: todayISO(), useDate: date, useTime: time,
      participants, contact, purpose, members,
      status: 'pending', remarks: '', checkedIn: false,
    };
    const savedReservation = await api.createReservation(newReservation);
    db.reservations.push(savedReservation);
    reservationAdded = true;
    db.nextResId = Math.max(db.nextResId, Number(savedReservation.id.split('-').pop()) + 1);
    db.draft = null;
    try { await persist({ sync: false }); } catch (error) {
      showToast(error.message || 'Reservation saved, but this device could not cache it.', 'error');
    }

    $('successResId').textContent = savedReservation.id;
    $('successViewBtn').onclick = () => {
      closeSuccess();
      navigateTo('myreservations');
      setTimeout(() => viewReservation(savedReservation.id), 120);
    };
    $('successOverlay').classList.remove('hidden');
    showToast('✅ Reservation saved!', 'success');
  } catch (error) {
    if (reservationAdded) db.reservations.pop();
    db.draft = previousDraft;
    showToast(error.message || 'Could not submit your reservation. Please try again.', 'error');
  } finally {
    state.submitting = false;
    setFormSubmitting(button, false);
  }
}

function timeToMin(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function closeSuccess() {
  $('successOverlay').classList.add('hidden');
  if (state.currentPage !== 'myreservations') navigateTo('myreservations');
}

function renderMyReservations() {
  const u = state.currentUser;
  const mine = db.reservations.filter(r => r.filedById === u.id);
  let html = `<div class="page-title"><i class="fas fa-history"></i> My Reservations</div>
    <div class="page-sub">${mine.length} reservation${mine.length !== 1 ? 's' : ''}</div>`;
  if (mine.length === 0) {
    html += `<div style="text-align:center;padding:60px 20px;background:var(--bg-card);border-radius:20px">
      <i class="fas fa-calendar-plus" style="font-size:3rem;color:var(--text-faint);margin-bottom:14px"></i>
      <p style="color:var(--text-muted);margin-bottom:14px">No reservations yet.</p>
      <button class="btn btn-primary" onclick="navigateTo('newreservation')"><i class="fas fa-plus"></i> Make a Reservation</button>
    </div>`;
    return html;
  }
  html += `<div class="table-wrapper"><table>
    <thead><tr><th>PC</th><th>Date</th><th>Time</th><th>Status</th><th></th></tr></thead><tbody>`;
  mine.slice().reverse().forEach(r => {
    html += `<tr>
      <td><strong>${esc(r.roomName)}</strong><br><span style="font-size:.72rem;color:var(--text-muted)">${esc(r.id)}</span></td>
      <td>${formatDate(r.useDate)}</td>
      <td>${formatTime(r.useTime)}</td>
      <td><span class="badge ${r.status}">${r.status}</span></td>
      <td style="white-space:nowrap">
        <button class="btn btn-sm btn-primary" onclick="viewReservation('${esc(r.id)}')"><i class="fas fa-eye"></i></button>
        <button class="btn btn-sm btn-outline" onclick="openReservationQr('${esc(r.id)}')"><i class="fas fa-qrcode"></i></button>
      </td>
    </tr>`;
  });
  html += `</tbody></table></div>`;
  return html;
}

function renderCheckin() {
  const activeCount = db.sessions.filter(s => !s.checkOut).length;
  return `
    <div class="page-title"><i class="fas fa-camera"></i> Check-In / Out Scanner</div>
    <div class="page-sub">Scan reservation QRs to log users in and out of the library · ${activeCount} currently inside</div>
    <div class="camera-blocker">
      <div class="block-icon"><i class="fas fa-shield-alt"></i></div>
      <h3>Open Camera Scanner</h3>
      <p>Tap below to open your device's camera. Scan a QR, then choose an action.</p>
      <p style="font-size:.82rem;color:var(--text-muted);margin-top:8px">Your camera only activates while scanning — no images are stored.</p>
      <div class="block-actions">
        <button class="btn btn-outline" onclick="checkCameraPermission()"><i class="fas fa-sync"></i> Check Permission</button>
        <button class="btn btn-primary" onclick="openCheckinScanner()"><i class="fas fa-video"></i> Open Camera</button>
      </div>
    </div>
    <h3 style="margin:18px 0 10px;color:var(--text-primary);font-size:1.05rem">🕐 Currently Inside (${activeCount})</h3>
    <div class="table-wrapper"><table>
      <thead><tr><th>User</th><th>PC</th><th>Reservation</th><th>Check-In</th></tr></thead><tbody>
        ${db.sessions.filter(s => !s.checkOut).length === 0
          ? '<tr><td colspan="4" style="text-align:center;padding:30px;color:var(--text-faint)">Nobody is currently inside</td></tr>'
          : db.sessions.filter(s => !s.checkOut).map(s => `<tr><td><strong>${esc(s.userName)}</strong><br><span style="font-size:.72rem;color:var(--text-muted)">${esc(s.userId)}</span></td><td>${esc(s.room)}</td><td>${s.reservationId ? `<code style="font-size:.72rem">${esc(s.reservationId)}</code>` : '—'}</td><td>${esc(s.checkIn)}</td></tr>`).join('')}
      </tbody>
    </table></div>
  `;
}

async function checkCameraPermission() {
  if (!navigator.permissions || !navigator.permissions.query) {
    showToast('Permission API not supported', 'info'); return;
  }
  try {
    const result = await navigator.permissions.query({ name: 'camera' });
    if (result.state === 'granted') showToast('✅ Camera granted', 'success');
    else if (result.state === 'denied') showToast('❌ Camera denied. Reset in browser settings.', 'error');
    else showToast('Camera permission not yet granted', 'info');
  } catch (e) { showToast('Could not query camera permission', 'info'); }
}

function renderApprovals() {
  const pending = db.reservations.filter(r => r.status === 'pending');
  let html = `<div class="page-title"><i class="fas fa-check-double"></i> Approvals</div>
    <div class="page-sub">${pending.length} pending</div>`;
  if (pending.length === 0) {
    html += `<div style="text-align:center;padding:60px 20px;background:var(--bg-card);border-radius:20px">
      <i class="fas fa-check-circle" style="font-size:3rem;color:#16a34a;margin-bottom:14px"></i>
      <p style="color:var(--text-muted)">All caught up! 🎉</p>
    </div>`;
    return html;
  }
  html += `<div class="table-wrapper"><table>
    <thead><tr><th>Filed By</th><th>PC</th><th>Date / Time</th><th>Actions</th></tr></thead><tbody>`;
  pending.forEach(r => {
    html += `<tr>
      <td>${esc(r.filedBy)}<br><span style="font-size:.72rem;color:var(--text-muted)">${esc(r.id)}</span></td>
      <td>${esc(r.roomName)}</td>
      <td>${formatDate(r.useDate)}<br><span style="font-size:.72rem;color:var(--text-muted)">${formatTime(r.useTime)}</span></td>
      <td style="white-space:nowrap">
        <button class="btn btn-sm btn-primary" onclick="viewReservation('${esc(r.id)}')"><i class="fas fa-eye"></i></button>
        <button class="btn btn-sm btn-success" onclick="approveReservation('${esc(r.id)}')"><i class="fas fa-check"></i> Approve</button>
        <button class="btn btn-sm btn-danger" onclick="rejectReservation('${esc(r.id)}')"><i class="fas fa-times"></i></button>
      </td>
    </tr>`;
  });
  html += `</tbody></table></div>`;
  return html;
}

function renderAllReservations() {
  let html = `<div class="page-title"><i class="fas fa-list-alt"></i> All Reservations</div>
    <div class="page-sub">${db.reservations.length} total</div>
    <div class="table-wrapper"><table>
      <thead><tr><th>ID</th><th>Filed By</th><th>PC</th><th>Date / Time</th><th>Status</th><th></th></tr></thead><tbody>`;
  if (db.reservations.length === 0) {
    html += `<tr><td colspan="6" style="text-align:center;padding:30px">No reservations.</td></tr>`;
  } else {
    db.reservations.slice().reverse().forEach(r => {
      html += `<tr>
        <td><code style="font-size:.72rem">${esc(r.id)}</code></td>
        <td>${esc(r.filedBy)}</td>
        <td>${esc(r.roomName)}</td>
        <td>${formatDate(r.useDate)}<br><span style="font-size:.72rem;color:var(--text-muted)">${formatTime(r.useTime)}</span></td>
        <td><span class="badge ${r.status}">${r.status}</span></td>
        <td style="white-space:nowrap">
          <button class="btn btn-sm btn-primary" onclick="viewReservation('${esc(r.id)}')"><i class="fas fa-eye"></i></button>
          <button class="btn btn-sm btn-outline" onclick="openReservationQr('${esc(r.id)}')"><i class="fas fa-qrcode"></i></button>
        </td>
      </tr>`;
    });
  }
  html += `</tbody></table></div>`;
  return html;
}

function renderAccounts() {
  let html = `<div class="page-title"><i class="fas fa-users-cog"></i> Accounts</div>
    <div class="page-sub">${db.users.length} registered</div>
    <div style="margin-bottom:14px"><button class="btn btn-primary" onclick="navigateTo('createaccount')"><i class="fas fa-user-plus"></i> Create Account</button></div>
    <div class="table-wrapper"><table>
      <thead><tr><th>Name</th><th>ID</th><th>Role</th><th>Section/Dept</th><th>Actions</th></tr></thead><tbody>`;
  db.users.forEach(u => {
    html += `<tr>
      <td><strong>${esc(u.name)}</strong></td>
      <td>${esc(u.id)}</td>
      <td style="text-transform:capitalize">${esc(u.role)}</td>
      <td>${esc(u.section || u.dept || '—')}</td>
      <td style="white-space:nowrap">
        <button class="btn btn-sm btn-primary" onclick="openQrModal('${esc(u.id)}')"><i class="fas fa-qrcode"></i></button>
        <button class="btn btn-sm btn-outline" onclick="openAccountDetails('${esc(u.id)}')"><i class="fas fa-eye"></i></button>
      </td>
    </tr>`;
  });
  html += `</tbody></table></div>`;
  return html;
}

function generateAccountId(role) {
  const identifiers = [...db.users.map(user => user.id), ...Object.keys(db.registry)];
  let prefix;
  let padding;
  let pattern;

  if (role === 'faculty') {
    prefix = 'F-';
    padding = 4;
    pattern = /^F-(\d+)$/i;
  } else if (role === 'admin') {
    prefix = 'A-';
    padding = 3;
    pattern = /^A-(\d+)$/i;
  } else {
    prefix = `${new Date().getFullYear()}-`;
    padding = 5;
    pattern = /^\d{4}-(\d+)$/;
  }

  const highestNumber = identifiers.reduce((highest, identifier) => {
    const match = String(identifier).match(pattern);
    return match ? Math.max(highest, Number(match[1])) : highest;
  }, 0);
  let number = highestNumber + 1;
  let id = `${prefix}${String(number).padStart(padding, '0')}`;
  while (identifiers.some(identifier => normalizeId(identifier) === normalizeId(id))) {
    number += 1;
    id = `${prefix}${String(number).padStart(padding, '0')}`;
  }
  return id;
}

function renderCreateAccount() {
  return `
    <div class="page-title"><i class="fas fa-user-plus"></i> Create Account</div>
    <div class="page-sub">Create a Student or Faculty account. Admin accounts are managed separately.</div>
    <div style="background:var(--bg-card);padding:clamp(16px,3vw,28px);border-radius:20px;border:1px solid var(--border);max-width:640px;margin-bottom:20px">
      <form id="createAccountForm">
        <div class="form-group">
          <label>Role</label>
          <select class="form-control" id="newRole">
            <option value="student">Student</option>
            <option value="faculty">Faculty</option>
          </select>
        </div>
        <div class="form-group"><label>Full Name</label><input type="text" class="form-control" id="newName" required></div>
        <div class="form-group"><label>Generated ID Number</label><input type="text" class="form-control" id="newId" value="${generateAccountId('student')}" readonly></div>
        <div class="form-group"><label>Email</label><input type="email" class="form-control" id="newEmail" required></div>
        <div class="form-group">
          <label>Password</label>
          <div class="pw-input-wrap">
            <input type="password" class="form-control" id="newPassword" required minlength="8" autocomplete="new-password">
            <button type="button" class="toggle-pw" data-toggle-pw="newPassword"><i class="fas fa-eye"></i></button>
          </div>
        </div>
        <div class="form-group" id="sectionField"><label>Section</label><input type="text" class="form-control" id="newSection" placeholder="e.g., BSIT 3-A"></div>
        <div class="form-group hidden" id="subjectsField"><label>Department</label><input type="text" class="form-control" id="newDept" placeholder="e.g., College of Computer Studies"></div>
        <button type="submit" class="btn btn-primary" style="padding:12px 28px;width:100%"><i class="fas fa-user-plus"></i> Create Account</button>
      </form>
    </div>
  `;
}

function toggleRoleFields() {
  const r = $('newRole').value;
  $('sectionField').classList.toggle('hidden', r !== 'student');
  $('subjectsField').classList.toggle('hidden', r !== 'faculty');
  $('newId').value = generateAccountId(r);
}

async function createAccount(e) {
  e.preventDefault();
  if (state.submitting) return;
  const name = $('newName').value.trim();
  const email = $('newEmail').value.trim();
  const password = $('newPassword').value;
  const role = $('newRole').value;
  const id = generateAccountId(role);
  $('newId').value = id;
  if (!name || !password) { showToast('Please fill in all fields', 'error'); return; }
  if (db.users.some(u => normalizeId(u.id) === normalizeId(id))) { showToast('ID already exists', 'error'); return; }
  const button = $('createAccountForm').querySelector('button[type="submit"]');
  state.submitting = true;
  setFormSubmitting(button, true, 'Creating account...');
  await new Promise(resolve => setTimeout(resolve, 0));
  try {
    const createdUser = await api.createUser({
      id, password, name, role, email,
      section: role === 'student' ? $('newSection').value.trim() : '',
      dept: role === 'faculty' ? $('newDept').value.trim() : '',
    });
    const newUser = { ...(createdUser || {}) };
    delete newUser.password;
    delete newUser.passwordHash;
    delete newUser.token;
    db.users.push(newUser);
    db.registry[id] = { name, section: newUser.section, dept: newUser.dept, email };
    await persist({ sync: false });
    showToast(`✅ ${role} account created`, 'success');
    navigateTo('accounts');
  } catch (error) {
    showToast(error.message || 'Could not create the account. Please try again.', 'error');
  } finally {
    state.submitting = false;
    setFormSubmitting(button, false);
  }
}

function renderManageRooms() {
  let html = `<div class="page-title"><i class="fas fa-cog"></i> Manage PCs</div>
    <div class="page-sub">Update PC status</div>
    <div class="table-wrapper"><table>
      <thead><tr><th>PC</th><th>Type</th><th>Capacity</th><th>Status</th></tr></thead><tbody>`;
  db.rooms.forEach(r => {
    html += `<tr>
      <td><strong>${esc(r.name)}</strong></td>
      <td style="text-transform:capitalize">${esc(r.type)}</td>
      <td>${r.capacity}</td>
      <td>
        <select onchange="changeRoomStatus('${esc(r.id)}', this.value)" class="form-control" style="min-height:36px;padding:4px 8px;font-size:.8rem;width:auto">
          <option value="available" ${r.status==='available'?'selected':''}>Available</option>
          <option value="occupied" ${r.status==='occupied'?'selected':''}>Occupied</option>
          <option value="maintenance" ${r.status==='maintenance'?'selected':''}>Maintenance</option>
        </select>
      </td>
    </tr>`;
  });
  html += `</tbody></table></div>`;
  return html;
}

async function changeRoomStatus(id, status) {
  const r = db.rooms.find(x => x.id === id);
  if (!r) return;
  const previousStatus = r.status;
  r.status = status;
  if (!await persistWithFeedback()) {
    r.status = previousStatus;
    renderContent();
    return;
  }
  showToast(`Updated to ${status}`, 'success');
}

function renderReports() {
  const total = db.reservations.length;
  const confirmed = db.reservations.filter(r => r.status === 'confirmed').length;
  const cancelled = db.reservations.filter(r => r.status === 'cancelled').length;
  const pending = db.reservations.filter(r => r.status === 'pending').length;
  const activeSessions = db.sessions.filter(s => !s.checkOut).length;
  const totalMinutes = db.sessions.reduce((a, s) => a + (s.durationMin || 0), 0);
  return `
    <div class="page-title"><i class="fas fa-chart-bar"></i> Reports</div>
    <div class="page-sub">Statistics overview</div>
    <div class="card-grid">
      <div class="stat-card"><div class="stat-icon"><i class="fas fa-calendar-check"></i></div><div class="stat-info"><h3>${total}</h3><p>Reservations</p></div></div>
      <div class="stat-card"><div class="stat-icon"><i class="fas fa-check-circle" style="color:#166534"></i></div><div class="stat-info"><h3>${confirmed}</h3><p>Confirmed</p></div></div>
      <div class="stat-card"><div class="stat-icon"><i class="fas fa-clock" style="color:#92400e"></i></div><div class="stat-info"><h3>${pending}</h3><p>Pending</p></div></div>
      <div class="stat-card"><div class="stat-icon"><i class="fas fa-times-circle" style="color:#b91c1c"></i></div><div class="stat-info"><h3>${cancelled}</h3><p>Cancelled</p></div></div>
      <div class="stat-card"><div class="stat-icon"><i class="fas fa-users"></i></div><div class="stat-info"><h3>${db.users.length}</h3><p>Users</p></div></div>
      <div class="stat-card"><div class="stat-icon"><i class="fas fa-sign-in-alt"></i></div><div class="stat-info"><h3>${db.sessions.length}</h3><p>Sessions</p></div></div>
      <div class="stat-card"><div class="stat-icon"><i class="fas fa-user-clock" style="color:#16a34a"></i></div><div class="stat-info"><h3>${activeSessions}</h3><p>Inside Now</p></div></div>
      <div class="stat-card"><div class="stat-icon"><i class="fas fa-hourglass-half"></i></div><div class="stat-info"><h3>${formatDuration(totalMinutes)}</h3><p>Total Time</p></div></div>
    </div>
    <button class="btn btn-primary" onclick="exportReport()"><i class="fas fa-download"></i> Export CSV</button>
  `;
}

function exportReport() {
  const rows = [['ID','Filed By','PC','Date','Time','Participants','Purpose','Status']];
  db.reservations.forEach(r => rows.push([r.id, r.filedBy, r.roomName, r.useDate, r.useTime, r.participants, r.purpose, r.status]));
  const csv = rows.map(row => row.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `E-LIBRARY-Reservations-${todayISO()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Downloaded', 'success');
}

/* ============================================================
   RESERVATION MODAL
   ============================================================ */
function viewReservation(id) {
  const r = db.reservations.find(x => x.id === id);
  if (!r) { navigateTo('notfound'); return; }
  state.currentReservationId = id;
  const isAdmin = state.currentRole === 'admin';
  const session = db.sessions.find(s => s.reservationId === id);
  $('reservationModalContent').innerHTML = `
    <div class="slip">
      <div class="slip-header"><h2>RESERVATION SLIP</h2><p style="font-size:.78rem">${esc(r.id)}</p></div>
      <div class="slip-grid">
        <div class="slip-row"><span class="label">Name:</span><span class="value">${esc(r.filedBy)}</span></div>
        <div class="slip-row"><span class="label">Date Filed:</span><span class="value">${formatDate(r.dateFiled)}</span></div>
        <div class="slip-row"><span class="label">Dept:</span><span class="value">${esc(r.dept)}</span></div>
        <div class="slip-row"><span class="label">Date of Use:</span><span class="value">${formatDate(r.useDate)}</span></div>
        <div class="slip-row"><span class="label">PC:</span><span class="value">${esc(r.roomName)}</span></div>
        <div class="slip-row"><span class="label">Time:</span><span class="value">${formatTime(r.useTime)}</span></div>
        <div class="slip-row"><span class="label">Participants:</span><span class="value">${r.participants}</span></div>
        <div class="slip-row"><span class="label">Contact:</span><span class="value">${esc(r.contact)}</span></div>
        <div class="slip-row"><span class="label">Purpose:</span><span class="value">${esc(r.purpose)}</span></div>
        <div class="slip-row"><span class="label">Status:</span><span class="value"><span class="badge ${r.status}">${r.status}</span></span></div>
      </div>
      <h4 style="color:var(--text-primary);font-size:.85rem;text-transform:uppercase;margin:14px 0 8px">Users</h4>
      <div style="background:var(--bg-subtle);border-radius:10px;padding:10px 14px;font-size:.85rem">
        ${r.members.map((m, i) => `<div style="padding:5px 0;border-bottom:1px dotted var(--border-strong)">${i+1}. <strong>${esc(m.name)}</strong>${m.course ? ' — ' + esc(m.course) : ''}</div>`).join('')}
      </div>
    </div>
    ${session ? `
      <div class="session-card" style="margin-bottom:16px">
        <h3><i class="fas fa-clock"></i> Library Session</h3>
        <div class="info-row"><span class="label">Check-In</span><span class="value">${esc(session.checkIn)}</span></div>
        <div class="info-row"><span class="label">Check-Out</span><span class="value">${session.checkOut ? esc(session.checkOut) : '<span class="badge checked-in">Still inside</span>'}</span></div>
        <div class="info-row"><span class="label">Duration</span><span class="value">${session.durationMin ? formatDuration(session.durationMin) : '—'}</span></div>
      </div>
    ` : ''}
    <div class="res-qr-wrap">
      <div class="res-qr-label"><i class="fas fa-qrcode"></i> Reservation QR Code</div>
      <div class="qr-holder" id="resQrHolder"></div>
      <code>${esc(r.qrData || generateResQrData(r.id))}</code>
      <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-top:6px">
        <button class="btn btn-sm btn-primary" onclick="printReservationQr('${esc(r.id)}')"><i class="fas fa-print"></i> Print QR</button>
      </div>
      <p style="font-size:.75rem;color:var(--text-muted);text-align:center;max-width:320px">Show this QR at the library desk. Scanning it logs you <strong>in</strong>, and scanning again logs you <strong>out</strong>.</p>
    </div>
    ${isAdmin && r.status === 'pending' ? `<div class="modal-actions" style="justify-content:space-between"><button class="btn btn-danger" onclick="rejectReservation('${esc(r.id)}'); closeReservationModal();"><i class="fas fa-times"></i> Reject</button><button class="btn btn-success" onclick="approveReservation('${esc(r.id)}'); closeReservationModal();"><i class="fas fa-check"></i> Approve</button></div>` : ''}
  `;
  $('reservationModal').classList.remove('hidden');
  setTimeout(() => {
    const holder = $('resQrHolder');
    if (holder) renderQrCode(holder, r.qrData || generateResQrData(r.id), 180);
  }, 40);
}

function closeReservationModal() {
  $('reservationModal').classList.add('hidden');
  state.currentReservationId = null;
}

async function approveReservation(id) {
  const r = db.reservations.find(x => x.id === id);
  if (!r) return;
  const previous = { status: r.status, remarks: r.remarks };
  r.status = 'confirmed'; r.remarks = 'Approved';
  if (!await persistWithFeedback()) { Object.assign(r, previous); return; }
  showToast(`✅ ${id} approved`, 'success'); renderContent();
}
async function rejectReservation(id) {
  const r = db.reservations.find(x => x.id === id);
  if (!r) return;
  const previous = { status: r.status, remarks: r.remarks };
  r.status = 'cancelled'; r.remarks = 'Rejected';
  if (!await persistWithFeedback()) { Object.assign(r, previous); return; }
  showToast(`${id} rejected`, 'error'); renderContent();
}

function printReservationSlip() {
  const r = db.reservations.find(x => x.id === state.currentReservationId);
  if (!r) return;
  const w = window.open('', '_blank');
  w.document.write(`<html><head><title>Reservation ${esc(r.id)}</title>
  <style>
    body{font-family:Arial,sans-serif;padding:30px;color:#1e293b}
    .slip{max-width:640px;margin:0 auto;border:2px dashed #0a5c36;border-radius:16px;padding:24px;position:relative}
    .slip::before{content:'RESERVATION SLIP';position:absolute;top:-12px;left:24px;background:#fff;padding:0 10px;color:#0a5c36;font-weight:800;font-size:12px;letter-spacing:1px}
    h2{text-align:center;color:#0a5c36;margin:0 0 4px}
    .sub{text-align:center;color:#666;font-size:13px;margin-bottom:16px;border-bottom:2px solid #0a5c36;padding-bottom:12px}
    .row{display:flex;gap:8px;font-size:14px;padding:6px 0;border-bottom:1px dotted #ccc}
    .row .label{color:#666;min-width:130px;font-weight:500}
    .row .value{font-weight:600;flex:1}
    .qr{display:flex;flex-direction:column;align-items:center;margin:20px 0;padding:16px;border:1px solid #bbf7d0;border-radius:12px;background:#f0fdf4}
    .ft{text-align:center;font-size:11px;color:#888;margin-top:16px;border-top:1px solid #ddd;padding-top:12px;font-style:italic}
    @media print{body{padding:0}}
  </style></head><body>
  <div class="slip">
    <h2>PC RESERVATION</h2>
    <div class="sub">E-LIBRARY</div>
    <div class="row"><span class="label">Reservation ID:</span><span class="value">${esc(r.id)}</span></div>
    <div class="row"><span class="label">Name:</span><span class="value">${esc(r.filedBy)}</span></div>
    <div class="row"><span class="label">Dept:</span><span class="value">${esc(r.dept)}</span></div>
    <div class="row"><span class="label">Date Filed:</span><span class="value">${formatDate(r.dateFiled)}</span></div>
    <div class="row"><span class="label">Date of Use:</span><span class="value">${formatDate(r.useDate)}</span></div>
    <div class="row"><span class="label">Time:</span><span class="value">${formatTime(r.useTime)}</span></div>
    <div class="row"><span class="label">PC:</span><span class="value">${esc(r.roomName)}</span></div>
    <div class="row"><span class="label">Participants:</span><span class="value">${r.participants}</span></div>
    <div class="row"><span class="label">Contact:</span><span class="value">${esc(r.contact)}</span></div>
    <div class="row"><span class="label">Purpose:</span><span class="value">${esc(r.purpose)}</span></div>
    <div class="row"><span class="label">Status:</span><span class="value">${r.status}</span></div>
    <div class="qr"><div id="qrTarget"></div><p style="font-family:monospace;font-size:10px;color:#666;margin-top:10px;word-break:break-all;text-align:center">${esc(r.qrData || generateResQrData(r.id))}</p></div>
    <div class="ft">Present this slip and QR code at the library desk.</div>
  </div>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"><\/script>
  <script>
    new QRCode(document.getElementById('qrTarget'), { text: '${r.qrData || generateResQrData(r.id)}', width: 200, height: 200, colorDark: '#0a5c36', colorLight: '#ffffff' });
    setTimeout(() => window.print(), 700);
  <\/script></body></html>`);
  w.document.close();
}

function openReservationQr(id) { viewReservation(id); }

function printReservationQr(id) {
  const r = db.reservations.find(x => x.id === id);
  if (!r) return;
  const w = window.open('', '_blank');
  w.document.write(`<html><head><title>QR - ${esc(r.id)}</title>
  <style>body{font-family:Arial,sans-serif;text-align:center;padding:40px}.card{border:3px solid #0a5c36;border-radius:20px;padding:36px;max-width:420px;margin:0 auto}h1{color:#0a5c36;margin:0 0 4px}.sub{color:#666;font-size:12px;margin-bottom:16px}h2{color:#0a5c36;margin:14px 0 4px;font-size:18px}.pc{color:#333;font-size:14px;margin-bottom:4px}.id{font-family:monospace;font-size:12px;color:#666}.qr{display:flex;justify-content:center;margin:18px 0}.ft{font-size:11px;color:#888;margin-top:16px;border-top:1px solid #ddd;padding-top:12px}</style></head><body>
  <div class="card"><h1>E-LIBRARY</h1><div class="sub">University of the Visayas</div>
  <h2>${esc(r.filedBy)}</h2><div class="pc">${esc(r.roomName)} · ${formatDate(r.useDate)} · ${formatTime(r.useTime)}</div><div class="id">${esc(r.id)}</div>
  <div class="qr" id="t"></div><div class="ft">Present this QR at the library desk. Scanning logs you in and out.</div></div>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"><\/script>
  <script>new QRCode(document.getElementById('t'), { text: '${r.qrData || generateResQrData(r.id)}', width: 240, height: 240, colorDark: '#0a5c36', colorLight: '#ffffff' });setTimeout(() => window.print(), 700);<\/script></body></html>`);
  w.document.close();
}

/* ============================================================
   ACCOUNT QR MODAL
   ============================================================ */
function openQrModal(userId) {
  const u = userById(userId);
  if (!u) { navigateTo('notfound'); return; }
  state.currentQrUserId = userId;
  $('qrModalContent').innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;gap:12px">
      <div id="modalQrContainer" style="background:white;padding:18px;border-radius:16px;border:1px solid var(--border)"></div>
      <h3 style="color:var(--text-primary);font-size:1.1rem">${esc(u.name)}</h3>
      <p style="color:var(--text-muted);font-size:.85rem">${esc(u.id)}</p>
      <code style="background:var(--bg-subtle);padding:6px 14px;border-radius:8px;font-size:.72rem;color:var(--uv-green);word-break:break-all;text-align:center">${esc(u.qrData)}</code>
    </div>
  `;
  $('qrModal').classList.remove('hidden');
  setTimeout(() => {
    const c = $('modalQrContainer');
    if (c) renderQrCode(c, u.qrData, 200);
  }, 30);
}
function closeQrModal() { $('qrModal').classList.add('hidden'); state.currentQrUserId = null; }

function printQrCode() {
  const u = state.currentQrUserId ? userById(state.currentQrUserId) : state.currentUser;
  if (!u) return;
  const w = window.open('', '_blank');
  w.document.write(`<html><head><title>QR - ${esc(u.name)}</title><style>body{font-family:Arial,sans-serif;text-align:center;padding:40px}.card{border:3px solid #0a5c36;border-radius:20px;padding:40px;max-width:400px;margin:0 auto}h1{color:#0a5c36}.role{color:#666;text-transform:uppercase;font-size:12px;letter-spacing:1px}.id{color:#333;font-size:14px}.qr{display:flex;justify-content:center;margin:20px 0}.ft{font-size:11px;color:#888;margin-top:20px;border-top:1px solid #ddd;padding-top:14px}</style></head><body><div class="card"><h1>E-LIBRARY</h1><p style="font-size:12px;color:#666">University of the Visayas</p><h2 style="color:#0a5c36;margin:20px 0 6px">${esc(u.name)}</h2><p class="role">${esc(u.role)}</p><p class="id">ID: ${esc(u.id)}</p><div class="qr" id="t"></div><p style="font-family:monospace;font-size:10px;color:#666;word-break:break-all">${esc(u.qrData)}</p><div class="ft">Present this QR code at the library desk.</div></div><script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"><\/script><script>new QRCode(document.getElementById('t'),{text:'${u.qrData}',width:220,height:220,colorDark:'#0a5c36',colorLight:'#ffffff'});setTimeout(()=>window.print(),600)<\/script></body></html>`);
  w.document.close();
}

/* ============================================================
   ACCOUNT DETAILS / PROFILE / PASSWORD
   ============================================================ */
function openAccountDetails(userId) {
  const u = userById(userId);
  if (!u) { navigateTo('notfound'); return; }
  $('accountDetailsContent').innerHTML = `
    <div style="text-align:center;margin-bottom:18px">
      ${u.image ? `<img src="${u.image}" style="width:80px;height:80px;border-radius:50%;object-fit:cover;margin:0 auto 12px;display:block">` : `<div style="width:80px;height:80px;border-radius:50%;background:${u.role==='admin'?'#053d23':u.role==='faculty'?'#0f7a48':'#0a5c36'};color:#f9c74f;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:1.6rem;margin:0 auto 12px">${initials(u.name)}</div>`}
      <h3 style="color:var(--text-primary);margin-bottom:4px">${esc(u.name)}</h3>
      <span style="background:var(--table-header-bg);color:var(--text-primary);font-size:.72rem;font-weight:700;padding:4px 14px;border-radius:40px;text-transform:uppercase">${esc(u.role)}</span>
    </div>
    <div style="background:var(--bg-subtle);border-radius:14px;padding:16px">
      <div class="info-row"><span class="label">ID</span><span class="value">${esc(u.id)}</span></div>
      <div class="info-row"><span class="label">Email</span><span class="value">${esc(u.email || '—')}</span></div>
      <div class="info-row"><span class="label">Section/Dept</span><span class="value">${esc(u.section || u.dept || '—')}</span></div>
    </div>
  `;
  $('accountDetailsModal').classList.remove('hidden');
}
function closeAccountDetails() { $('accountDetailsModal').classList.add('hidden'); }

function openEditProfile() {
  const u = state.currentUser;
  state.editingUserId = u.id;
  state.pendingImageData = u.image || null;
  $('editName').value = u.name || '';
  $('editEmail').value = u.email || '';
  $('editBio').value = u.bio || '';
  $('editSectionGroup').classList.toggle('hidden', u.role !== 'student');
  $('editDeptGroup').classList.toggle('hidden', u.role !== 'faculty');
  if (u.role === 'student') $('editSection').value = u.section || '';
  if (u.role === 'faculty') $('editDept').value = u.dept || '';
  updateEditPreview(u.image, u.name);
  $('editProfileModal').classList.remove('hidden');
}
function updateEditPreview(image, name) {
  const p = $('editPreview');
  if (image) p.innerHTML = `<img src="${image}" alt="preview">`;
  else { p.innerHTML = initials(name || 'User'); p.style.background = 'var(--uv-green)'; p.style.color = 'var(--uv-gold)'; }
}
function previewImage(e) {
  const f = e.target.files[0];
  if (!f) return;
  if (f.size > 2 * 1024 * 1024) { showToast('Image too large (max 2MB)', 'error'); return; }
  const r = new FileReader();
  r.onload = ev => { state.pendingImageData = ev.target.result; updateEditPreview(ev.target.result, $('editName').value); };
  r.readAsDataURL(f);
}
async function saveProfile(e) {
  e.preventDefault();
  const u = userById(state.editingUserId);
  if (!u) return;
  const name = $('editName').value.trim();
  if (!name) {
    showToast('Please enter your name.', 'error');
    $('editName').focus();
    return;
  }
  const updates = {
    name,
    bio: $('editBio').value.trim(),
  };
  if (u.role === 'student') updates.section = $('editSection').value.trim();
  if (u.role === 'faculty') updates.dept = $('editDept').value.trim();
  if (state.pendingImageData !== undefined) updates.image = state.pendingImageData;
  try {
    const updated = await api.updateUser(u.id, updates);
    Object.assign(u, updated);
    await persist({ sync: false });
  } catch (error) {
    showToast(error.message || 'Could not update your profile.', 'error');
    return;
  }
  updateHeader();
  closeEditProfile();
  showToast('✅ Profile updated', 'success');
  renderContent();
}
function closeEditProfile() {
  $('editProfileModal').classList.add('hidden');
  state.editingUserId = null;
  state.pendingImageData = null;
  $('profileImageInput').value = '';
}

function openChangePassword() {
  $('changePasswordForm').reset();
  ['strengthBar1','strengthBar2','strengthBar3'].forEach(id => $(id).className = 'strength-bar');
  $('strengthText').textContent = '—';
  $('matchHint').textContent = '';
  $('changePasswordModal').classList.remove('hidden');
}
function closeChangePassword() { $('changePasswordModal').classList.add('hidden'); }
function checkPasswordStrength() {
  const pw = $('newPw').value;
  const bars = [$('strengthBar1'), $('strengthBar2'), $('strengthBar3')];
  const text = $('strengthText');
  let score = 0;
  if (pw.length >= 6) score++;
  if (pw.length >= 10) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++;
  const level = Math.min(3, Math.max(0, score - 1));
  bars.forEach((b, i) => {
    b.className = 'strength-bar';
    if (i < level) b.classList.add(level === 1 ? 'weak' : level === 2 ? 'medium' : 'strong');
  });
  if (!pw) { text.textContent = '—'; text.style.color = 'var(--text-muted)'; }
  else if (level <= 1) { text.textContent = 'Weak'; text.style.color = '#dc2626'; }
  else if (level === 2) { text.textContent = 'Medium'; text.style.color = '#f59e0b'; }
  else { text.textContent = 'Strong'; text.style.color = '#16a34a'; }
  checkPasswordMatch();
}
function checkPasswordMatch() {
  const a = $('newPw').value, b = $('confirmPw').value;
  const h = $('matchHint');
  if (!b) { h.textContent = ''; return; }
  if (a === b) { h.textContent = '✓ Match'; h.style.color = '#16a34a'; }
  else { h.textContent = '✗ Do not match'; h.style.color = '#dc2626'; }
}
async function submitChangePassword(e) {
  e.preventDefault();
  const u = state.currentUser;
  const cur = $('currentPw').value, np = $('newPw').value, cp = $('confirmPw').value;
  if (np.length < 8) { showToast('Password must be at least 8 characters', 'error'); return; }
  if (np === cur) { showToast('New password must be different', 'error'); return; }
  if (np !== cp) { showToast('Passwords do not match', 'error'); return; }
  try {
    await api.changePassword(np, cur);
  } catch (error) {
    showToast(error.message || 'Could not change your password.', 'error');
    return;
  }
  closeChangePassword();
  showToast('✅ Password changed', 'success');
}

/* ============================================================
   LOGIN / LOGOUT / HEADER
   ============================================================ */
async function handleLogin(e) {
  e.preventDefault();
  if (state.submitting) return;
  const id = $('loginId').value.trim();
  const pw = $('loginPassword').value;
  const err = $('loginError');
  const button = $('loginForm').querySelector('button[type="submit"]');
  state.submitting = true;
  setFormSubmitting(button, true, 'Signing in...');
  err.textContent = '';
  try {
    const profile = await api.login(id, pw);
    await hydrateDB(sessionStorage.getItem('uv_arc_access_token'));
    const user = db.users.find(item => item.id === profile.id) || profile;
    if (!db.users.some(item => item.id === user.id)) db.users.push(user);
    state.currentUser = user;
    state.currentRole = user.role;
    try { localStorage.setItem('uv_arc_last_id', id); } catch {}
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
    $('loginForm').reset();
    hideDemoAccounts();
    showToast(`Welcome back, ${user.name.split(' ')[0]}!`, 'success');
  } catch (error) {
    api.logout();
    err.textContent = error.message || 'Something went wrong signing in. Please try again.';
  } finally {
    state.submitting = false;
    setFormSubmitting(button, false);
  }
}
function handleLogout() {
  stopScanner();
  closeSidebar();
  closeBottomSheet();
  state.currentUser = null;
  state.currentRole = null;
  api.logout();
  $('appContainer').classList.add('hidden');
  $('bottomNav').classList.add('hidden');
  $('fab').classList.add('hidden');
  $('loginScreen').classList.remove('hidden');
  $('loginForm').reset();
  $('loginError').textContent = '';
  showToast('Logged out', 'info');
}
function updateHeader() {
  const u = state.currentUser;
  if (!u) return;
  $('headerUserName').textContent = u.name;
  $('headerRoleTag').textContent = u.role.charAt(0).toUpperCase() + u.role.slice(1);
  const av = $('headerAvatar');
  if (u.image) {
    av.innerHTML = `<img src="${u.image}" alt="${esc(u.name)}">`;
    av.style.background = 'transparent';
  } else {
    av.textContent = initials(u.name);
    av.style.background = u.role === 'admin' ? '#053d23' : u.role === 'faculty' ? '#0f7a48' : '#0a5c36';
    av.style.color = 'white';
  }
}

/* ============================================================
   BOTTOM SHEET
   ============================================================ */
function openBottomSheet(content) {
  $('bottomSheetContent').innerHTML = content;
  $('sheetBackdrop').classList.add('show');
  setTimeout(() => $('bottomSheet').classList.add('show'), 40);
}
function closeBottomSheet() {
  $('bottomSheet').classList.remove('show');
  $('sheetBackdrop').classList.remove('show');
}
function openQuickActions() {
  const role = state.currentRole;
  let items = '';
  if (role === 'student' || role === 'faculty') {
    items = `
      <div class="sheet-action" onclick="closeBottomSheet(); navigateTo('newreservation');"><i class="fas fa-plus-circle"></i> New Reservation <span class="arrow"><i class="fas fa-chevron-right"></i></span></div>
      <div class="sheet-action" onclick="closeBottomSheet(); navigateTo('myqr');"><i class="fas fa-qrcode"></i> Show My QR Code <span class="arrow"><i class="fas fa-chevron-right"></i></span></div>
      <div class="sheet-action" onclick="closeBottomSheet(); navigateTo('myreservations');"><i class="fas fa-calendar-check"></i> My Reservations <span class="arrow"><i class="fas fa-chevron-right"></i></span></div>
      <div class="sheet-action" onclick="closeBottomSheet(); navigateTo('rooms');"><i class="fas fa-desktop"></i> Check PC Availability <span class="arrow"><i class="fas fa-chevron-right"></i></span></div>
    `;
  } else {
    items = `
      <div class="sheet-action" onclick="closeBottomSheet(); navigateTo('checkin');"><i class="fas fa-camera"></i> Open Scanner <span class="arrow"><i class="fas fa-chevron-right"></i></span></div>
      <div class="sheet-action" onclick="closeBottomSheet(); navigateTo('sessions');"><i class="fas fa-clock"></i> Library Sessions <span class="arrow"><i class="fas fa-chevron-right"></i></span></div>
      <div class="sheet-action" onclick="closeBottomSheet(); navigateTo('approvals');"><i class="fas fa-check-double"></i> Pending Approvals <span class="arrow"><i class="fas fa-chevron-right"></i></span></div>
      <div class="sheet-action" onclick="closeBottomSheet(); navigateTo('createaccount');"><i class="fas fa-user-plus"></i> Create Account <span class="arrow"><i class="fas fa-chevron-right"></i></span></div>
      <div class="sheet-action" onclick="closeBottomSheet(); navigateTo('accounts');"><i class="fas fa-users-cog"></i> Manage Accounts <span class="arrow"><i class="fas fa-chevron-right"></i></span></div>
    `;
  }
  openBottomSheet(`<h3><i class="fas fa-bolt" style="color:var(--uv-gold)"></i> Quick Actions</h3><div class="sheet-actions">${items}</div>`);
}
function openUserSheet() {
  const u = state.currentUser;
  if (!u) return;
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
  const active = activeSessionFor(u.id);
  openBottomSheet(`
    <h3><i class="fas fa-user-circle" style="color:var(--uv-green)"></i> ${esc(u.name)}</h3>
    <p style="color:var(--text-muted);font-size:.82rem;margin-bottom:16px">${esc(u.id)} · <span style="text-transform:capitalize">${esc(u.role)}</span></p>
    ${active ? `<div class="session-active" style="margin-bottom:14px">
      <div class="sess-icon"><i class="fas fa-sign-in-alt"></i></div>
      <div class="sess-info">
        <h4>Currently checked in</h4>
        <p>${esc(active.room)} · since ${esc(active.checkIn)}</p>
      </div>
    </div>` : ''}
    <div class="sheet-actions">
      <div class="sheet-action" onclick="closeBottomSheet(); navigateTo('myprofile');"><i class="fas fa-id-badge"></i> View Profile <span class="arrow"><i class="fas fa-chevron-right"></i></span></div>
      <div class="sheet-action" onclick="closeBottomSheet(); openEditProfile();"><i class="fas fa-user-edit"></i> Edit Profile & Photo <span class="arrow"><i class="fas fa-chevron-right"></i></span></div>
      <div class="sheet-action" onclick="closeBottomSheet(); openChangePassword();"><i class="fas fa-key"></i> Change Password <span class="arrow"><i class="fas fa-chevron-right"></i></span></div>
      <div class="theme-toggle-label" onclick="toggleTheme(); closeBottomSheet(); openUserSheet();">
        <i class="fas ${currentTheme === 'dark' ? 'fa-sun' : 'fa-moon'}" style="color:var(--uv-green)"></i>
        <span>${currentTheme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
        <span class="toggle-indicator"></span>
      </div>
      <div class="sheet-action" onclick="closeBottomSheet(); handleLogout();" style="color:#b91c1c"><i class="fas fa-sign-out-alt" style="color:#b91c1c"></i> Logout <span class="arrow"><i class="fas fa-chevron-right"></i></span></div>
    </div>
  `);
}

/* ============================================================
   EVENT WIRING
   ============================================================ */
function wireEvents() {
  $('loginForm')?.addEventListener('submit', handleLogin);
  ['loginId', 'loginPassword'].forEach(id => {
    const input = $(id);
    input?.addEventListener('focus', revealDemoAccounts);
    input?.addEventListener('click', revealDemoAccounts);
  });
  $('demoAccounts')?.querySelectorAll('[data-demo-role]').forEach(button => {
    button.addEventListener('click', () => fillDemoAccount(button.dataset.demoRole));
  });
  document.addEventListener('click', event => {
    if (!event.target.closest('#loginId, #loginPassword, #demoAccounts')) hideDemoAccounts();
  });
  document.querySelectorAll('[data-toggle-pw]').forEach(btn => {
    btn.addEventListener('click', () => togglePw(btn.dataset.togglePw, btn));
  });

  $('mobileMenuBtn')?.addEventListener('click', toggleSidebar);
  $('sidebarBackdrop')?.addEventListener('click', toggleSidebar);
  $('themeToggleBtn')?.addEventListener('click', toggleTheme);
  $('userBadge')?.addEventListener('click', openUserSheet);
  $('fab')?.addEventListener('click', openQuickActions);
  $('popupCloseBtn')?.addEventListener('click', closePopup);

  document.querySelectorAll('.bottom-nav-item').forEach(el => {
    el.addEventListener('click', () => navigateTo(el.dataset.page));
  });

  // Modals
  $('closeReservationModalBtn')?.addEventListener('click', closeReservationModal);
  $('printReservationSlipBtn')?.addEventListener('click', printReservationSlip);
  $('closeQrModalBtn')?.addEventListener('click', closeQrModal);
  $('printQrCodeBtn')?.addEventListener('click', printQrCode);
  $('cancelEditProfileBtn')?.addEventListener('click', closeEditProfile);
  $('cancelChangePasswordBtn')?.addEventListener('click', closeChangePassword);
  $('closeAccountDetailsBtn')?.addEventListener('click', closeAccountDetails);
  $('closeSuccessBtn')?.addEventListener('click', closeSuccess);
  $('sheetBackdrop')?.addEventListener('click', closeBottomSheet);

  // Forms
  $('editProfileForm')?.addEventListener('submit', saveProfile);
  $('profileImageInput')?.addEventListener('change', previewImage);
  $('changePasswordForm')?.addEventListener('submit', submitChangePassword);
  $('newPw')?.addEventListener('input', checkPasswordStrength);
  $('confirmPw')?.addEventListener('input', checkPasswordMatch);

  // Reservation form (event delegation for dynamic content)
  document.addEventListener('submit', e => {
    if (e.target && e.target.id === 'reservationForm') submitReservation(e);
    if (e.target && e.target.id === 'createAccountForm') createAccount(e);
  });
  document.addEventListener('change', e => {
    if (e.target && e.target.id === 'resRoom') { updateRoomInfo(); saveDraft(); }
    if (e.target && e.target.id === 'resDate') saveDraft();
    if (e.target && e.target.id === 'resTime') saveDraft();
    if (e.target && e.target.id === 'resContact') saveDraft();
    if (e.target && e.target.id === 'resPurpose') saveDraft();
    if (e.target && e.target.id === 'resMembers') saveDraft();
    if (e.target && e.target.id === 'newRole') toggleRoleFields();
  });

  // Scanner buttons
  $('idStartBtn')?.addEventListener('click', startScanner);
  $('idStopBtn')?.addEventListener('click', stopScanner);
  $('switchCamBtn')?.addEventListener('click', switchCamera);
  $('closeIdCaptureBtn')?.addEventListener('click', closeIdCapture);
  $('backToScanBtn')?.addEventListener('click', backToScan);
  $('proceedBtn')?.addEventListener('click', proceedChoice);

  // Keyboard
  document.addEventListener('keydown', e => {
    const tag = (e.target.tagName || '').toLowerCase();
    const isTyping = tag === 'input' || tag === 'textarea' || tag === 'select';
    if (e.key === 'Escape') {
      if (!$('successOverlay').classList.contains('hidden')) closeSuccess();
      if (!$('idCaptureModal').classList.contains('hidden')) closeIdCapture();
      if (!$('reservationModal').classList.contains('hidden')) closeReservationModal();
      if (!$('qrModal').classList.contains('hidden')) closeQrModal();
      if (!$('editProfileModal').classList.contains('hidden')) closeEditProfile();
      if (!$('changePasswordModal').classList.contains('hidden')) closeChangePassword();
      if (!$('accountDetailsModal').classList.contains('hidden')) closeAccountDetails();
      if ($('sheetBackdrop').classList.contains('show')) closeBottomSheet();
    }
    if (isTyping) return;
    if ((e.ctrlKey || e.metaKey) && e.key === 'k' && state.currentUser) { e.preventDefault(); openQuickActions(); }
    if ((e.ctrlKey || e.metaKey) && e.key === 'q' && state.currentUser) { e.preventDefault(); navigateTo('myqr'); }
    if ((e.ctrlKey || e.metaKey) && e.key === 'd' && state.currentUser) { e.preventDefault(); toggleTheme(); }
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth >= 1024) {
      closeSidebar();
      $('bottomNav').classList.add('hidden');
      $('fab').classList.add('hidden');
    } else if (state.currentUser) {
      $('bottomNav').classList.remove('hidden');
      $('fab').classList.remove('hidden');
    }
  });
}

/* ============================================================
   INIT
   ============================================================ */
function closePopup() {
  $('politePopup').classList.add('hidden');
  $('loginScreen').classList.remove('hidden');
}

async function init() {
  await hydrateDB();
  initTheme();
  wireEvents();
  window.addEventListener('uv:sync-error', event => {
    showToast(event.detail?.message || 'Your changes could not be synced with the server.', 'error');
  });

  // Restore last ID
  try {
    const last = localStorage.getItem('uv_arc_last_id');
    if (last) $('loginId').value = last;
  } catch (e) {}

  // Show the login screen when the splash animation finishes.
  setTimeout(async () => {
    $('splashScreen').classList.add('hidden');
    $('loginScreen').classList.remove('hidden');
    if (!await checkBackendAvailability()) {
      showToast('The library service is unavailable. Sign-in and shared data require a server connection.', 'error');
    }
  }, 2200);
}

window.addEventListener('DOMContentLoaded', () => {
  init();
});