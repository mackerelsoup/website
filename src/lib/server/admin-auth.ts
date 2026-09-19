import { createHash, timingSafeEqual } from 'node:crypto';

/** The admin dashboard and everything beneath it. Takes a SvelteKit route id, not a raw URL path. */
export function isAdminRoute(routeId: string): boolean {
	return routeId === '/cloud/admin' || routeId.startsWith('/cloud/admin/');
}

// Hash first so timingSafeEqual gets equal-length buffers and length doesn't leak.
const digest = (s: string) => createHash('sha256').update(s).digest();
const same = (a: string, b: string) => timingSafeEqual(digest(a), digest(b));

/**
 * Checks an HTTP Basic `Authorization` header against the configured admin credentials.
 * Deliberately independent of the Tailscale Identity / isAdmin() allowlist. Fails closed
 * when either credential is unset or empty.
 */
export function isValidAdminAuth(
	header: string | null,
	expectedUser: string | undefined,
	expectedPass: string | undefined
): boolean {
	if (!expectedUser || !expectedPass || !header?.startsWith('Basic ')) return false;
	const decoded = Buffer.from(header.slice(6), 'base64').toString();
	const i = decoded.indexOf(':');
	if (i < 0) return false;
	// compute both before combining so timing doesn't reveal which half was wrong
	const userOk = same(decoded.slice(0, i), expectedUser);
	const passOk = same(decoded.slice(i + 1), expectedPass);
	return userOk && passOk;
}
