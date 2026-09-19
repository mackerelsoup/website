import { test, expect } from 'bun:test';
import { assertEditGrantAllowed, assertFolderProvisionAllowed } from './protected-roots';

test('rejects an edit grant on / and /cloud', () => {
	expect(() => assertEditGrantAllowed('/')).toThrow();
	expect(() => assertEditGrantAllowed('/cloud')).toThrow();
	expect(() => assertEditGrantAllowed('/cloud/')).toThrow();
});

test('rejects provisioning a Folder at / and /cloud', () => {
	expect(() => assertFolderProvisionAllowed('/')).toThrow();
	expect(() => assertFolderProvisionAllowed('/cloud')).toThrow();
});

test('allows both on a non-protected path', () => {
	expect(() => assertEditGrantAllowed('/family')).not.toThrow();
	expect(() => assertFolderProvisionAllowed('/family')).not.toThrow();
});
