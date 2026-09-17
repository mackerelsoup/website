/** Normalize a WebDAV-style path: leading slash, no trailing slash (except root itself). */
export function normalizePath(path: string): string {
	let p = path.trim();
	if (!p.startsWith('/')) p = `/${p}`;
	if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
	return p || '/';
}
