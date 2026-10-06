export function generateQrData(id, role) {
  return `UV-ARC-${role.toUpperCase()}-${id}`;
}

export function generateResQrData(resId) {
  return `UV-ARC-RES-${resId}`;
}

export function renderQrCode(element, text, size = 200) {
  if (!element || typeof QRCode === 'undefined') return;
  element.innerHTML = '';
  new QRCode(element, {
    text, width: size, height: size,
    colorDark: '#0a5c36', colorLight: '#ffffff',
  });
}
