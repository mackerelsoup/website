import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, locals }) => {
	return {
		path: url.searchParams.get('path') ?? '/',
		login: locals.tailscaleIdentity?.login ?? null
	};
};