import type { Actions, PageServerLoad } from './$types';
import { fail } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { folder, folderPermission, folderRequest } from '$lib/server/db/schema';
import { asc, eq } from 'drizzle-orm';
import { approveFolderRequest, denyFolderRequest } from '$lib/server/folder-admin';
import { grantAccess, listPermissions, revokeAccess } from '$lib/server/permissions';
import { normalizePath } from '$lib/server/path-utils';

// Auth is enforced for this whole subtree in hooks.server.ts.
export const load: PageServerLoad = async () => {
	const [requests, folders, permissions] = await Promise.all([
		db.select().from(folderRequest).where(eq(folderRequest.status, 'pending')).orderBy(asc(folderRequest.createdAt)),
		db.select().from(folder).orderBy(asc(folder.path)),
		listPermissions()
	]);
	const pathById = new Map(folders.map((f) => [f.id, f.path]));
	return {
		requests,
		folders,
		grants: permissions.map((g) => ({
			id: g.id,
			path: pathById.get(g.folderId) ?? '?',
			login: g.tailscaleLogin,
			access: g.access
		}))
	};
};

const idOf = (form: FormData) => Number(form.get('id'));

/** Turn a thrown refusal into a form error the page can show. */
async function attempt(fn: () => Promise<void>) {
	try {
		await fn();
	} catch (e) {
		return fail(400, { message: e instanceof Error ? e.message : 'Failed' });
	}
	return { success: true };
}

export const actions: Actions = {
	approve: async ({ request }) => {
		const form = await request.formData();
		return attempt(() => approveFolderRequest(idOf(form), form.get('path')));
	},

	deny: async ({ request }) => {
		const form = await request.formData();
		return attempt(() => denyFolderRequest(idOf(form)));
	},

	revoke: async ({ request }) => {
		const form = await request.formData();
		return attempt(() => revokeAccess(idOf(form)));
	},

	grant: async ({ request }) => {
		const form = await request.formData();
		const access = form.get('access');
		if (access !== 'view' && access !== 'edit') return fail(400, { message: 'Invalid access level' });
		const path = normalizePath(String(form.get('path') ?? ''));
		return attempt(() => grantAccess(path, String(form.get('login') ?? ''), access));
	}
};
