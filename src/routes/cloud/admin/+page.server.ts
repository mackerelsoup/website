import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { folderRequest } from '$lib/server/db/schema';
import { asc, eq } from 'drizzle-orm';

// Auth is enforced for this whole subtree in hooks.server.ts.
export const load: PageServerLoad = async () => ({
	requests: await db
		.select()
		.from(folderRequest)
		.where(eq(folderRequest.status, 'pending'))
		.orderBy(asc(folderRequest.createdAt))
});
