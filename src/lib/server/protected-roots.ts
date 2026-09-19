import { normalizePath } from '$lib/server/path-utils';

/** Folders that can never receive an edit Grant or be auto-provisioned onto directly. */
export const PROTECTED_ROOTS = new Set(['/', '/cloud']);

export function isProtectedRoot(path: string): boolean {
	return PROTECTED_ROOTS.has(normalizePath(path));
}

function assertNotProtectedRoot(path: string, action: string): void {
	if (isProtectedRoot(path)) {
		throw new Error(`${normalizePath(path)} is a Protected Root and cannot ${action}`);
	}
}

/** Call before creating an edit Grant. Throws if `path` is a Protected Root. */
export function assertEditGrantAllowed(path: string): void {
	assertNotProtectedRoot(path, 'receive an edit grant');
}

/** Call before provisioning a new Folder. Throws if `path` is a Protected Root. */
export function assertFolderProvisionAllowed(path: string): void {
	assertNotProtectedRoot(path, 'be provisioned as a Folder');
}
