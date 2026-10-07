import { $ } from './dom.js';
import { state } from './state.js';

export function setupKeyboardShortcuts() {
  document.addEventListener('keydown', e => {
    const tag = (e.target.tagName || '').toLowerCase();
    const isTyping = tag === 'input' || tag === 'textarea' || tag === 'select';

    if (e.key === 'Escape') {
      if (!$('successOverlay').classList.contains('hidden')) window.closeSuccess();
      if (!$('idCaptureModal').classList.contains('hidden')) window.closeIdCapture();
      if (!$('reservationModal').classList.contains('hidden')) window.closeReservationModal();
      if (!$('qrModal').classList.contains('hidden')) window.closeQrModal();
      if (!$('editProfileModal').classList.contains('hidden')) window.closeEditProfile();
      if (!$('changePasswordModal').classList.contains('hidden')) window.closeChangePassword();
      if (!$('resetPasswordModal').classList.contains('hidden')) window.closeResetPassword();
      if (!$('accountDetailsModal').classList.contains('hidden')) window.closeAccountDetails();
      if ($('sheetBackdrop').classList.contains('show')) window.closeBottomSheet();
    }

    if (isTyping) return;

    if ((e.ctrlKey || e.metaKey) && e.key === 'k' && state.currentUser) {
      e.preventDefault();
      window.openQuickActions();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'q' && state.currentUser) {
      e.preventDefault();
      window.navigateTo('myqr');
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'd' && state.currentUser) {
      e.preventDefault();
      window.toggleTheme();
    }
  });
}