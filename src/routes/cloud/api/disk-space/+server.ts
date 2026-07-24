import { json } from '@sveltejs/kit'
import { getCachedDiskSpace, getDiskSpaceError } from '$lib/server/disk-space'
import type { RequestHandler } from './$types'

// allows the dev server (a different origin) to call the deployed API directly,
// so disk space reflects the real host instead of the dev machine during `df` calls
const CORS_HEADERS = { 'Access-Control-Allow-Origin': '*' }

export const GET: RequestHandler = async () => {
	const space = getCachedDiskSpace()
	if (!space) {
		return json({ error: getDiskSpaceError() ?? 'disk space unavailable' }, { status: 503, headers: CORS_HEADERS })
	}
	return json(space, { headers: CORS_HEADERS })
}