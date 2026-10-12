import { test, expect } from 'bun:test';
import { formatBytes, formatModified, parentPath, barCells, isImage } from './format';

test('formatBytes', () => {
	expect(formatBytes(512)).toBe('512 B');
	expect(formatBytes(4.2 * 1024 * 1024)).toBe('4.2 MB');
	expect(formatBytes(212 * 1024)).toBe('212 KB');
});

test('formatModified is relative within a day, Mon DD after', () => {
	const now = new Date('2026-10-12T12:00:00Z').getTime();
	expect(formatModified('2026-10-12T10:00:00Z', now)).toBe('2h ago');
	expect(formatModified('2026-10-12T11:59:30Z', now)).toBe('just now');
	expect(formatModified('2026-09-19T12:00:00', now)).toBe('Sep 19');
});

test('parentPath', () => {
	expect(parentPath('/family/photos')).toBe('/family');
	expect(parentPath('/family')).toBe('/');
});

test('barCells clamps', () => {
	expect(barCells(42, 24)).toEqual({ filled: 10, empty: 14 });
	expect(barCells(150, 24)).toEqual({ filled: 24, empty: 0 });
});

test('isImage', () => {
	expect(isImage('a.JPG')).toBe(true);
	expect(isImage('a.pdf')).toBe(false);
});
