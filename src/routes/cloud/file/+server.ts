import { WEBDAV_PASSWORD, WEBDAV_URL } from '$env/static/private';
import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAccessLevel } from '$lib/server/permissions';

const WEBDAV_USERNAME = 'homelab';
const AUTH = `Basic ${Buffer.from(`${WEBDAV_USERNAME}:${WEBDAV_PASSWORD}`).toString('base64')}`;

// Headers worth forwarding so Range/seek, caching and sizing keep working.
const PASS = ['content-type', 'content-length', 'content-range', 'accept-ranges', 'etag', 'last-modified'];

export const GET: RequestHandler = async ({ url, locals, request }) => {
	const path = url.searchParams.get('path');
	if (!path) error(400, 'Missing path');

	if (!(await getAccessLevel(locals.tailscaleIdentity?.login, path))) {
		error(403, 'Forbidden');
	}

	const headers: Record<string, string> = { Authorization: AUTH };
	for (const h of ['range', 'if-none-match', 'if-modified-since']) {
		const v = request.headers.get(h);
		if (v) headers[h] = v;
	}

	// Stream straight through instead of buffering the whole file in memory first.
	let upstream: Response;
	try {
		upstream = await fetch(`${WEBDAV_URL.replace(/\/$/, '')}${encodeURI(path)}`, {
			headers,
			signal: request.signal
		});
	} catch {
		error(502, 'Storage unreachable');
	}
	if (upstream.status === 304) return new Response(null, { status: 304 });
	if (!upstream.ok) error(upstream.status === 404 ? 404 : 502, 'File not found');

	const out = new Headers({ 'Content-Disposition': 'inline', 'Cache-Control': 'private, max-age=300' });
	for (const h of PASS) {
		const v = upstream.headers.get(h);
		if (v) out.set(h, v);
	}
	return new Response(upstream.body, { status: upstream.status, headers: out });
};
