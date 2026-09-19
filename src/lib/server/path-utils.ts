import { resolveUploadPath } from '$lib/server/safe-path';

/** Normalize a WebDAV-style path: leading slash, no trailing slash (except root itself). */
export function normalizePath(path: string): string {
	let p = path.trim();
	if (!p.startsWith('/')) p = `/${p}`;
	if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
	return p || '/';
}

/**
 * Validate a user-chosen Personal Folder name. Must be a single safe path segment:
 * no separators, no traversal, no leading dot. Returns the trimmed name or a message.
 */
export function validateFolderName(
	raw: unknown
): { ok: true; name: string } | { ok: false; message: string } {
	const name = typeof raw === 'string' ? raw.trim() : '';
	if (!name) return { ok: false, message: 'Enter a folder name' };
	if (name.length > 64) return { ok: false, message: 'Folder name must be 64 characters or fewer' };
	if (/[/\\]/.test(name)) return { ok: false, message: 'Folder name cannot contain / or \\' };
	if (name.startsWith('.')) return { ok: false, message: 'Folder name cannot start with a dot' };
	if (!/^[A-Za-z0-9 ._-]+$/.test(name))
		return { ok: false, message: 'Use letters, numbers, spaces, dots, dashes or underscores' };
	// Belt and braces: the joined path must not escape its parent.
	if (!resolveUploadPath('/', name)) return { ok: false, message: 'Invalid folder name' };
	return { ok: true, name };
}
