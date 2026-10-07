import { test } from 'node:test';
import assert from 'node:assert';
import {
  initials,
  formatDate,
  formatTime,
  normalizeId,
  extractIdFromText,
  minutesBetween,
  formatDuration,
} from '../src/js/utils/format.js';

test('initials returns up to 2 characters', () => {
  assert.strictEqual(initials('Maria Santos'), 'MS');
  assert.strictEqual(initials('John'), 'J');
  assert.strictEqual(initials(''), '?');
});

test('normalizeId strips separators and uppercases', () => {
  assert.strictEqual(normalizeId('2023-00123'), '202300123');
  assert.strictEqual(normalizeId('f-1024'), 'F1024');
});

test('extractIdFromText extracts student IDs', () => {
  assert.strictEqual(extractIdFromText('2023-00123'), '2023-00123');
  assert.strictEqual(extractIdFromText('F-1024'), 'F-1024');
  assert.strictEqual(extractIdFromText('A-001'), 'A-001');
});

test('minutesBetween calculates correct difference', () => {
  assert.strictEqual(minutesBetween('09:00', '10:30'), 90);
  assert.strictEqual(minutesBetween('22:00', '01:00'), 180);
});

test('formatDuration returns human readable string', () => {
  assert.strictEqual(formatDuration(0), '—');
  assert.strictEqual(formatDuration(45), '45m');
  assert.strictEqual(formatDuration(90), '1h 30m');
});