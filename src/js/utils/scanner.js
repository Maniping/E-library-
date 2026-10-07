import { state } from './state.js';
import { $, showToast, esc } from './dom.js';
import { db, persist } from './storage.js';
import { nowTime, todayISO, normalizeId, extractIdFromText, minutesBetween, formatDuration } from './format.js';

export function startScanner() {
  const video = $('idVideo');
  const status = $('idScannerStatus');
  if (state.scannerActive) return;
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    status.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Camera not supported on this device';
    status.className = 'scanner-status error';
    showToast('Camera API not supported.', 'error');
    return;
  }
  navigator.mediaDevices.getUserMedia({
    video: { facingMode: state.cameraFacing, width: { ideal: 1280 }, height: { ideal: 720 } },
    audio: false
  }).then(stream => {
    state.scannerStream = stream;
    video.srcObject = stream;
    video.setAttribute('playsinline', 'true');
    video.setAttribute('muted', 'true');
    return video.play();
  }).then(() => {
    state.scannerActive = true;
    status.innerHTML = '<span class="pulse-dot"></span> Scanning for QR...';
    status.className = 'scanner-status active';
    $('idStartBtn').style.display = 'none';
    $('idStopBtn').style.display = 'inline-flex';
    navigator.mediaDevices.enumerateDevices().then(devices => {
      const cams = devices.filter(d => d.kind === 'videoinput');
      if (cams.length > 1) $('switchCamBtn').style.display = 'inline-flex';
    }).catch(() => {});
    state.scannerLoop = requestAnimationFrame(scanLoop);
  }).catch(err => {
    let msg = 'Camera unavailable.';
    if (err.name === 'NotAllowedError') msg = 'Camera permission denied. Please allow camera access in your browser settings.';
    else if (err.name === 'NotFoundError') msg = 'No camera found on this device.';
    else if (err.name === 'NotReadableError') msg = 'Camera is in use by another app.';
    showToast(msg, 'error');
    status.innerHTML = '<i class="fas fa-exclamation-triangle"></i> ' + msg;
    status.className = 'scanner-status error';
  });
}

export function stopScanner() {
  if (state.scannerLoop) { cancelAnimationFrame(state.scannerLoop); state.scannerLoop = null; }
  if (state.scannerStream) {
    state.scannerStream.getTracks().forEach(t => t.stop());
    state.scannerStream = null;
  }
  state.scannerActive = false;
  const v = $('idVideo');
  if (v) v.srcObject = null;
  const s = $('idScannerStatus');
  if (s && state.scannerStep === 'scan') {
    s.innerHTML = '<i class="fas fa-camera"></i> Camera is stopped';
    s.className = 'scanner-status';
  }
  if ($('idStartBtn')) $('idStartBtn').style.display = 'inline-flex';
  if ($('idStopBtn')) $('idStopBtn').style.display = 'none';
  if ($('switchCamBtn')) $('switchCamBtn').style.display = 'none';
}

export function switchCamera() {
  state.cameraFacing = state.cameraFacing === 'environment' ? 'user' : 'environment';
  showToast(`Switching to ${state.cameraFacing === 'environment' ? 'back' : 'front'} camera`, 'info');
  stopScanner();
  setTimeout(() => startScanner(), 150);
}

function scanLoop() {
  if (!state.scannerActive) return;
  const v = $('idVideo');
  if (v && v.readyState === v.HAVE_ENOUGH_DATA) {
    try {
      const w = v.videoWidth, h = v.videoHeight;
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(v, 0, 0, w, h);
      let detected = null;
      let imgData = ctx.getImageData(0, 0, w, h);
      let code = jsQR(imgData.data, w, h, { inversionAttempts: 'attemptBoth' });
      if (code && code.data) detected = code.data;
      if (!detected) {
        const cx = Math.floor(w * 0.15), cy = Math.floor(h * 0.15);
        const cw = Math.floor(w * 0.7), ch = Math.floor(h * 0.7);
        const c2 = document.createElement('canvas');
        c2.width = cw; c2.height = ch;
        const ctx2 = c2.getContext('2d', { willReadFrequently: true });
        ctx2.drawImage(v, cx, cy, cw, ch, 0, 0, cw, ch);
        const img2 = ctx2.getImageData(0, 0, cw, ch);
        code = jsQR(img2.data, cw, ch, { inversionAttempts: 'attemptBoth' });
        if (code && code.data) detected = code.data;
      }
      if (detected) handleDetected(detected);
    } catch (e) {}
  }
  state.scannerLoop = requestAnimationFrame(scanLoop);
}

export function handleDetected(rawValue) {
  const now = Date.now();
  if (state.scanCooldown && now - state.lastScanTime < 1500) return;
  state.scanCooldown = true;
  state.lastScanTime = now;
  setTimeout(() => { state.scanCooldown = false; }, 1500);

  stopScanner();

  let reservation = null;
  if (/^E-LIBRARY-RES-/i.test(rawValue)) {
    const resId = rawValue.replace(/^E-LIBRARY-RES-/i, '').trim();
    reservation = db.reservations.find(r => normalizeId(r.id) === normalizeId(resId));
  }
  if (!reservation) {
    reservation = db.reservations.find(r => (r.qrData || '').toUpperCase() === rawValue.trim().toUpperCase());
  }
  if (reservation) {
    state.scannedReservation = reservation;
    state.scannedUserData = null;
    state.capturedId = reservation.id;
    buildChoiceUI({ type: 'reservation', reservation });
    return;
  }

  const extracted = extractIdFromText(rawValue);
  state.capturedId = extracted;
  const norm = normalizeId(extracted);
  let matchedUser = null;
  for (const key of Object.keys(db.registry)) {
    if (normalizeId(key) === norm) {
      matchedUser = { id: key, ...db.registry[key] };
      break;
    }
  }
  if (!matchedUser) {
    const u = db.users.find(x => normalizeId(x.id) === norm);
    if (u) matchedUser = { id: u.id, name: u.name, section: u.section, dept: u.dept, email: u.email };
  }

  if (matchedUser) {
    state.scannedUserData = matchedUser;
    state.scannedReservation = null;
    buildChoiceUI({ type: 'user', user: matchedUser });
    return;
  }

  state.scannedUserData = null;
  state.scannedReservation = null;
  buildChoiceUI({ type: 'unknown', rawId: extracted || rawValue });
}

export function buildChoiceUI(scanResult) {
  const grid = $('choiceGrid');
  const details = $('chooseDetails');
  const icon = $('chooseIcon');
  const title = $('chooseTitle');
  const sub = $('chooseSubtitle');
  state.chosenAction = null;
  $('proceedBtn').disabled = true;

  let choices = [];
  let detailHtml = '';
  let iconHtml = '';
  let iconStyle = '';

  if (scanResult.type === 'reservation') {
    const r = scanResult.reservation;
    const activeSession = db.sessions.find(s => s.reservationId === r.id && !s.checkOut);
    iconHtml = '<i class="fas fa-qrcode"></i>';
    iconStyle = 'background:#dcfce7;color:#16a34a';
    title.textContent = 'Reservation QR Detected';
    sub.textContent = r.filedBy + ' · ' + r.roomName;
    detailHtml = `
      <div style="display:flex;justify-content:space-between;padding:6px 0"><span style="color:var(--text-muted)">Reservation</span><strong style="font-family:monospace">${esc(r.id)}</strong></div>
      <div style="display:flex;justify-content:space-between;padding:6px 0"><span style="color:var(--text-muted)">User</span><strong>${esc(r.filedBy)}</strong></div>
      <div style="display:flex;justify-content:space-between;padding:6px 0"><span style="color:var(--text-muted)">PC</span><strong>${esc(r.roomName)}</strong></div>
      <div style="display:flex;justify-content:space-between;padding:6px 0"><span style="color:var(--text-muted)">Schedule</span><strong>${r.useDate} · ${r.useTime}</strong></div>
      ${activeSession ? `<div style="margin-top:6px;padding:8px 10px;background:#fef3c7;color:#92400e;border-radius:8px;font-size:.78rem"><i class="fas fa-clock"></i> Already checked in since ${esc(activeSession.checkIn)}</div>` : ''}
    `;
    choices = [
      { action:'checkin', icon:'fa-sign-in-alt', cls:'checkin', label:'Check-In', desc:'Log user in', disabled: !!activeSession },
      { action:'checkout', icon:'fa-sign-out-alt', cls:'checkout', label:'Check-Out', desc:'Log user out', disabled: !activeSession },
      { action:'register', icon:'fa-user-plus', cls:'register', label:'Register', desc:'Register ID', disabled: false },
    ];
  } else if (scanResult.type === 'user') {
    const u = scanResult.user;
    iconHtml = '<i class="fas fa-user-check"></i>';
    iconStyle = 'background:#dcfce7;color:#16a34a';
    title.textContent = 'User ID Detected';
    sub.textContent = u.name + ' · ' + u.id;
    const activeSession = db.sessions.find(s => s.userId === u.id && !s.checkOut);
    detailHtml = `
      <div style="display:flex;justify-content:space-between;padding:6px 0"><span style="color:var(--text-muted)">Name</span><strong>${esc(u.name)}</strong></div>
      <div style="display:flex;justify-content:space-between;padding:6px 0"><span style="color:var(--text-muted)">ID</span><strong style="font-family:monospace">${esc(u.id)}</strong></div>
      ${u.section ? `<div style="display:flex;justify-content:space-between;padding:6px 0"><span style="color:var(--text-muted)">Section</span><strong>${esc(u.section)}</strong></div>` : ''}
      ${activeSession ? `<div style="margin-top:6px;padding:8px 10px;background:#fef3c7;color:#92400e;border-radius:8px;font-size:.78rem"><i class="fas fa-clock"></i> Already checked in at ${esc(activeSession.room)}</div>` : ''}
    `;
    choices = [
      { action:'checkin', icon:'fa-sign-in-alt', cls:'checkin', label:'Check-In', desc:'Log user in', disabled: !!activeSession },
      { action:'checkout', icon:'fa-sign-out-alt', cls:'checkout', label:'Check-Out', desc:'Log user out', disabled: !activeSession },
      { action:'register', icon:'fa-user-plus', cls:'register', label:'Register', desc:'Create account', disabled: false },
    ];
  } else {
    iconHtml = '<i class="fas fa-exclamation-triangle"></i>';
    iconStyle = 'background:#fef3c7;color:#92400e';
    title.textContent = 'Unknown QR';
    sub.textContent = scanResult.rawId || 'Could not recognize';
    detailHtml = `
      <div style="display:flex;justify-content:space-between;padding:6px 0"><span style="color:var(--text-muted)">Raw</span><strong style="font-family:monospace;font-size:.78rem;word-break:break-all">${esc(scanResult.rawId || '—')}</strong></div>
    `;
    choices = [
      { action:'register', icon:'fa-user-plus', cls:'register', label:'Register', desc:'Register ID', disabled: false },
    ];
  }

  icon.setAttribute('style', iconStyle + ';width:64px;height:64px;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 12px;font-size:1.8rem');
  icon.innerHTML = iconHtml;
  details.innerHTML = detailHtml;

  grid.innerHTML = choices.map(c => `
    <div class="choice-card ${c.cls} ${c.disabled ? 'disabled' : ''}" data-action="${c.action}" ${c.disabled ? 'style="opacity:.45;pointer-events:none"' : ''} onclick="selectChoice('${c.action}')">
      <div class="cc-icon"><i class="fas ${c.icon}"></i></div>
      <div class="cc-label">${c.label}</div>
      <div class="cc-desc">${c.desc}</div>
    </div>
  `).join('');
  showChooseStep();
}

export function selectChoice(action) {
  state.chosenAction = action;
  document.querySelectorAll('.choice-card').forEach(el => {
    el.classList.toggle('selected', el.dataset.action === action);
  });
  $('proceedBtn').disabled = false;
}

export function showScanStep() {
  state.scannerStep = 'scan';
  $('scanStepView').classList.remove('hidden');
  $('chooseStepView').classList.add('hidden');
  setStepIndicator('scan');
}
export function showChooseStep() {
  state.scannerStep = 'choose';
  stopScanner();
  $('scanStepView').classList.add('hidden');
  $('chooseStepView').classList.remove('hidden');
  setStepIndicator('choose');
}
export function setStepIndicator(step) {
  const s1 = $('stepScan'), s2 = $('stepChoose'), s3 = $('stepProceed');
  [s1,s2,s3].forEach(el => el.classList.remove('active','done'));
  if (step === 'scan') s1.classList.add('active');
  else if (step === 'choose') { s1.classList.add('done'); s2.classList.add('active'); }
  else if (step === 'proceed') { s1.classList.add('done'); s2.classList.add('done'); s3.classList.add('active'); }
}

export function backToScan() {
  state.chosenAction = null;
  state.scannedReservation = null;
  state.scannedUserData = null;
  state.capturedId = null;
  resetScannerUI();
  showScanStep();
  $('idCaptureHint').innerHTML = 'Point your camera at a reservation QR or University ID.';
  setTimeout(() => startScanner(), 120);
}

export function resetScannerUI() {
  $('idScannerStatus').innerHTML = '<i class="fas fa-camera"></i> Camera is stopped';
  $('idScannerStatus').className = 'scanner-status';
  $('idPreviewArea').innerHTML = `<i class="fas fa-barcode" style="font-size:2.4rem;color:var(--text-faint);margin-bottom:10px"></i><p style="color:var(--text-faint);font-size:.85rem">No QR detected yet</p>`;
  $('idStartBtn').style.display = 'inline-flex';
  $('idStopBtn').style.display = 'none';
  $('switchCamBtn').style.display = 'none';
  const v = $('idVideo'); if (v) v.srcObject = null;
}

export function closeIdCapture() {
  stopScanner();
  $('idCaptureModal').classList.add('hidden');
  state.capturedId = null;
  state.scannedUserData = null;
  state.scannedReservation = null;
  state.chosenAction = null;
  state.scannerStep = 'scan';
}

export function openCheckinScanner() {
  state.scannerStep = 'scan';
  state.chosenAction = null;
  state.scannedReservation = null;
  state.scannedUserData = null;
  state.capturedId = null;
  resetScannerUI();
  $('idCaptureModal').classList.remove('hidden');
  showScanStep();
  setTimeout(() => startScanner(), 120);
}

export function openCreateAccountScanner() {
  state.scannerStep = 'scan';
  state.chosenAction = null;
  state.scannedReservation = null;
  state.scannedUserData = null;
  state.capturedId = null;
  resetScannerUI();
  $('idCaptureModal').classList.remove('hidden');
  showScanStep();
  $('idCaptureHint').innerHTML = 'Point your camera at the QR code or barcode on the student\'s ID.';
  setTimeout(() => startScanner(), 120);
}

export function proceedChoice() {
  const action = state.chosenAction;
  if (!action) return;

  if (action === 'register') {
    const s = state.scannedUserData;
    const rawId = state.capturedId;
    closeIdCapture();
    if (window.navigateTo) window.navigateTo('createaccount');
    setTimeout(() => {
      if (s) {
        if ($('newName')) $('newName').value = s.name || '';
        if ($('newId')) $('newId').value = s.id || '';
        if ($('newEmail')) $('newEmail').value = s.email || '';
        if (s.section && $('newSection')) $('newSection').value = s.section;
        if (s.dept && $('newDept')) $('newDept').value = s.dept;
        showToast(`✅ Auto-filled for ${s.name}`, 'success');
      } else if (rawId) {
        if ($('newId')) $('newId').value = rawId;
        showToast(`ID captured`, 'info');
      }
    }, 60);
    return;
  }

  const r = state.scannedReservation;
  const u = state.scannedUserData;

  if (action === 'checkin') {
    if (r) {
      const previousCheckedIn = r.checkedIn;
      const previousNextSessionId = db.nextSessionId;
      db.sessions.push({
        id: `SESS-${String(db.nextSessionId++).padStart(4, '0')}`,
        userId: r.filedById, userName: r.filedBy,
        reservationId: r.id, room: r.roomName,
        checkIn: nowTime(), checkOut: null, durationMin: 0, date: todayISO(),
      });
      r.checkedIn = true;
      try {
        persist();
      } catch (error) {
        db.sessions.pop();
        db.nextSessionId = previousNextSessionId;
        r.checkedIn = previousCheckedIn;
        showToast(error.message || 'Could not save the check-in. Please try again.', 'error');
        return;
      }
      setStepIndicator('proceed');
      showToast(`✅ ${r.filedBy} checked in at ${r.roomName}`, 'success');
      closeIdCapture();
      if (window.renderContent) window.renderContent();
      return;
    } else if (u) {
      const previousNextSessionId = db.nextSessionId;
      db.sessions.push({
        id: `SESS-${String(db.nextSessionId++).padStart(4, '0')}`,
        userId: u.id, userName: u.name,
        reservationId: null, room: 'ARC',
        checkIn: nowTime(), checkOut: null, durationMin: 0, date: todayISO(),
      });
      try {
        persist();
      } catch (error) {
        db.sessions.pop();
        db.nextSessionId = previousNextSessionId;
        showToast(error.message || 'Could not save the check-in. Please try again.', 'error');
        return;
      }
      setStepIndicator('proceed');
      showToast(`✅ ${u.name} checked in`, 'success');
      closeIdCapture();
      if (window.renderContent) window.renderContent();
      return;
    }
    showToast('Nothing to check in', 'error');
    return;
  }

  if (action === 'checkout') {
    let existing = null;
    if (r) existing = db.sessions.find(s => s.reservationId === r.id && !s.checkOut);
    if (!existing && u) existing = db.sessions.find(s => s.userId === u.id && !s.checkOut);
    if (!existing) { showToast('No active session found', 'error'); return; }
    const t = nowTime();
    const previous = { checkOut: existing.checkOut, durationMin: existing.durationMin };
    existing.checkOut = t;
    existing.durationMin = minutesBetween(existing.checkIn, t);
    try {
      persist();
    } catch (error) {
      Object.assign(existing, previous);
      showToast(error.message || 'Could not save the check-out. Please try again.', 'error');
      return;
    }
    setStepIndicator('proceed');
    showToast(`👋 ${existing.userName} checked out (${formatDuration(existing.durationMin)})`, 'success');
    closeIdCapture();
    if (window.renderContent) window.renderContent();
    return;
  }
}