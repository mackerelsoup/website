import { test, expect } from 'bun:test';
import { validateFolderName } from './path-utils';

test('rejects empty and whitespace-only names', () => {
	expect(validateFolderName('')).toMatchObject({ ok: false });
	expect(validateFolderName('   ')).toMatchObject({ ok: false });
	expect(validateFolderName(undefined)).toMatchObject({ ok: false });
	expect(validateFolderName(null)).toMatchObject({ ok: false });
});

test('rejects traversal attempts', () => {
	expect(validateFolderName('..')).toMatchObject({ ok: false });
	expect(validateFolderName('.')).toMatchObject({ ok: false });
	expect(validateFolderName('../../etc')).toMatchObject({ ok: false });
	expect(validateFolderName('..\\..\\windows')).toMatchObject({ ok: false });
	expect(validateFolderName('.hidden')).toMatchObject({ ok: false });
});

test('rejects path separators', () => {
	expect(validateFolderName('a/b')).toMatchObject({ ok: false });
	expect(validateFolderName('a\\b')).toMatchObject({ ok: false });
	expect(validateFolderName('/absolute')).toMatchObject({ ok: false });
});

test('accepts a valid name and trims it', () => {
	expect(validateFolderName('  billy-files_1  ')).toEqual({ ok: true, name: 'billy-files_1' });
	expect(validateFolderName('My Folder')).toEqual({ ok: true, name: 'My Folder' });
});
