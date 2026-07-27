import { WEBDAV_PASSWORD, WEBDAV_URL } from '$env/static/private';
import type { PageServerLoad, Actions } from './$types';
import { listDirectory, moveItem, deleteItem } from '$lib/webdav';
import { redirect, fail } from '@sveltejs/kit';
import { getAccessLevel } from '$lib/server/permissions';

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

export const actions: Actions = {
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
	console.log(accessLevel)
	if (!accessLevel) {
		denyRedirect(path)
	}

	try {
		const contents = await listDirectory(WEBDAV_URL, WEBDAV_USERNAME, WEBDAV_PASSWORD, path);
		return { files: contents, path, accessLevel };
	} catch {
		return { files: [], path, accessLevel, error: true };
	}
};
