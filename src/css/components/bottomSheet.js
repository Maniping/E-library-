import { $ } from '../utils/dom.js';

export function setupBottomSheetHandlers() {
  $('sheetBackdrop')?.addEventListener('click', closeBottomSheet);
}

export function openBottomSheet(content) {
  $('bottomSheetContent').innerHTML = content;
  $('sheetBackdrop').classList.add('show');
  setTimeout(() => $('bottomSheet').classList.add('show'), 40);
}

export function closeBottomSheet() {
  $('bottomSheet').classList.remove('show');
  $('sheetBackdrop').classList.remove('show');
}

window.openBottomSheet = openBottomSheet;
window.closeBottomSheet = closeBottomSheet;