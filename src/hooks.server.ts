import type { Handle } from '@sveltejs/kit';
import { TAILSCALE_OAUTH_CLIENT, TAILSCALE_OAUTH_PASSWORD } from '$env/static/private';
import '$lib/server/disk-space'

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccesesToken(): Promise<string> {
	if (cachedToken && Date.now() < cachedToken.expiresAt) {
		return cachedToken.token;
	}

	const res = await fetch('https://api.tailscale.com/api/v2/oauth/token', {
		method: 'POST',
		body: new URLSearchParams({
			client_id: TAILSCALE_OAUTH_CLIENT,
			client_secret: TAILSCALE_OAUTH_PASSWORD,
			grant_type: 'client_credentials'
		})
	});

	if (!res.ok) {
		throw new Error(`Failed to fetch Tailscale OAuth token: ${res.status} ${await res.text()}`);
	}

	const data = await res.json();

	cachedToken = {
		token: data.access_token,
		expiresAt: Date.now() + (data.expires_in - 60) * 1000
	};

	return cachedToken.token;
}

export const handle: Handle = async ({ event, resolve }) => {
	await getAccesesToken();

	const tailscaleUser = event.request.headers.get('Tailscale-User-Login');
	const tailscaleName = event.request.headers.get('Tailscale-User-Name');

	if (tailscaleUser) {
		event.locals.tailscaleIdentity = {
			login: tailscaleUser,
			name: tailscaleName
		};
	}

	event.locals.tailscaleIdentity = {
		login: "mackerelsoup@github",
		name : "fucking billy"
	}

	return resolve(event);
};
