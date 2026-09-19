import { WEBDAV_PASSWORD, WEBDAV_URL } from '$env/static/private';
import type { PageServerLoad, Actions } from './$types';
import { listDirectory, moveItem, deleteItem } from '$lib/webdav';
import { redirect, fail } from '@sveltejs/kit';
import { getAccessLevel, isAdmin } from '$lib/server/permissions';
import { validateFolderName } from '$lib/server/path-utils';
import { db } from '$lib/server/db';
import { folderPermission, folderRequest } from '$lib/server/db/schema';
import { and, eq } from 'drizzle-orm';

const WEBDAV_USERNAME: string = 'homelab';

/** Redirect to the no-access page for a denied path, carrying the path along for context. */
function denyRedirect(path: string): never {
	throw redirect(303, `/cloud/no-access?path=${encodeURIComponent(path)}`);
}

async function requireAccess(login: string | undefined | null, path: string) {
	if (!(await getAccessLevel(login, path))) {
		denyRedirect(path);
	}
}

/** Shared tail for every action: send the user back to where they were. */
function backToPath(returnPath: string): never {
	throw redirect(303, `/cloud/files?path=${encodeURIComponent(returnPath)}`);
}

/**
 * What the Folder Request UI should show for this identity on the top-level listing:
 * 'pending' — they already asked and it's unresolved; 'eligible' — they may ask; null — neither.
 * "Has a Personal Folder" is detected as "holds any edit Grant of their own": a Personal Folder
 * is exactly the Folder its identity holds `edit` on, and General Grants are view-only by
 * definition, so an edit row with their login is the only thing that can represent one.
 */
async function folderRequestState(
	login: string | undefined | null
): Promise<'pending' | 'eligible' | null> {
	if (!login || isAdmin(login)) return null; // admins already have edit everywhere

	const pending = await db.query.folderRequest.findFirst({
		where: and(eq(folderRequest.tailscaleLogin, login), eq(folderRequest.status, 'pending'))
	});
	if (pending) return 'pending';

	const ownEditGrant = await db.query.folderPermission.findFirst({
		where: and(eq(folderPermission.tailscaleLogin, login), eq(folderPermission.access, 'edit'))
	});
	return ownEditGrant ? null : 'eligible';
}

export const actions: Actions = {
	/** Record a pending Folder Request. Provisioning happens on approval, not here. */
	requestFolder: async ({ request, locals }) => {
		const login = locals.tailscaleIdentity?.login;
		if (!login) return fail(401, { message: 'No Tailscale identity' });

		const form = await request.formData();
		const result = validateFolderName(form.get('name'));
		if (!result.ok) return fail(400, { message: result.message });

		if ((await folderRequestState(login)) !== 'eligible') {
			return fail(409, { message: 'You already have a pending request or a personal folder' });
		}

		try {
			await db.insert(folderRequest).values({ tailscaleLogin: login, requestedName: result.name });
		} catch (e) {
			// The partial unique index is what actually settles two concurrent submits.
			// drizzle wraps driver errors in DrizzleQueryError, so the pg code is on `cause`.
			const code = ((e as { cause?: { code?: string } }).cause ?? (e as { code?: string })).code;
			if (code !== '23505') throw e;
			return fail(409, { message: 'You already have a pending folder request' });
		}

		return { success: true, message: 'Folder request submitted — waiting for approval' };
	},

	rename: async ({ request, locals }) => {
		const form = await request.formData();
		const path = form.get('path') as string;
		const newName = form.get('newName') as string;
		const returnPath = form.get('returnPath') as string;
		const isDirectory = form.get('isDirectory') === 'true';

		await requireAccess(locals.tailscaleIdentity?.login, path);

		const dir = path.substring(0, path.lastIndexOf('/'));
		const newPath = `${dir}/${newName}`;

		await moveItem(WEBDAV_URL, WEBDAV_USERNAME, WEBDAV_PASSWORD, path, newPath, isDirectory);

		backToPath(returnPath);
	},

	delete: async ({ request, locals }) => {
		const form = await request.formData();
		const path = form.get('path') as string;
		const returnPath = form.get('returnPath') as string;
		const isDirectory = form.get('isDirectory') === 'true';

		if (!await getAccessLevel(locals.tailscaleIdentity?.login, path)) {
			denyRedirect(path);
		}

		await deleteItem(WEBDAV_URL, WEBDAV_USERNAME, WEBDAV_PASSWORD, path, isDirectory);

		backToPath(returnPath);
	},

	deleteMany: async ({ request, locals }) => {
		const form = await request.formData();
		const paths = form.getAll('path') as string[];
		const isDirectoryType = form.getAll('isDirectory') as string[];
		const returnPath = form.get('returnPath') as string;
		const login = locals.tailscaleIdentity?.login;

		// check every path before deleting any of them — a partial bulk-delete where
		// some files vanish and others silently don't (due to a denied path) is worse
		// than failing the whole batch up front.
		const accessLevels = await Promise.all(paths.map((p) => getAccessLevel(login, p)));
		if (accessLevels.some((level) => level !== 'edit')) {
			return fail(403, { message: 'Forbidden: no access to one or more selected items' });
		}

		await Promise.all(
			paths.map((p, i) =>
				deleteItem(WEBDAV_URL, WEBDAV_USERNAME, WEBDAV_PASSWORD, p, isDirectoryType[i] === 'true')
			)
		);

		backToPath(returnPath);
	}
};

export const load: PageServerLoad = async ({ url, locals }) => {
	const path = url.searchParams.get('path') ?? '/';

	const accessLevel = await getAccessLevel(locals.tailscaleIdentity?.login, path)
	if (!accessLevel) {
		denyRedirect(path)
	}

	// Only the landing listing carries the Folder Request action — asking for a Personal Folder
	// from three directories deep makes no sense, and it keeps the extra queries off every load.
	const requestState = path === '/' ? await folderRequestState(locals.tailscaleIdentity?.login) : null;

	try {
		const contents = await listDirectory(WEBDAV_URL, WEBDAV_USERNAME, WEBDAV_PASSWORD, path);
		return { files: contents, path, accessLevel, requestState };
	} catch {
		return { files: [], path, accessLevel, requestState, error: true };
	}
};
