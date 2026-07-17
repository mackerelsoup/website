import { WEBDAV_PASSWORD, WEBDAV_URL } from '$env/static/private';
import { getClient } from '$lib/webdav';
import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { hasAccess } from '$lib/server/permissions';

const WEBDAV_USERNAME = 'homelab';

export const GET: RequestHandler = async ({ url, locals }) => {
	const path = url.searchParams.get('path');
	if (!path) error(400, 'Missing path');

	if (!(await hasAccess(locals.tailscaleIdentity?.login, path))) {
		error(403, 'Forbidden');
	}

	try {
		const client = getClient(WEBDAV_URL, WEBDAV_USERNAME, WEBDAV_PASSWORD);
		const stat = (await client.stat(path)) as { mime?: string };
		const buffer = (await client.getFileContents(path)) as ArrayBuffer;

		return new Response(buffer, {
			headers: {
				'Content-Type': stat.mime ?? 'application/octet-stream',
				'Content-Disposition': 'inline'
			}
		});
	} catch {
		error(404, 'File not found');
	}
};
