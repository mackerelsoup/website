import { WEBDAV_PASSWORD, WEBDAV_URL } from '$env/static/private';
import type { PageServerLoad, Actions } from './$types';
import { listDirectory, moveItem, deleteItem } from '$lib/webdav';
import { redirect } from '@sveltejs/kit';
import { hasAccess } from '$lib/server/permissions';

const WEBDAV_USERNAME: string = 'homelab';

/** Redirect to the no-access page for a denied path, carrying the path along for context. */
function denyRedirect(path: string): never {
	throw redirect(303, `/cloud/no-access?path=${encodeURIComponent(path)}`);
}

/** Require access to `path` for the current Tailscale identity, or bail out. */
async function requireAccess(login: string | undefined | null, path: string) {
	if (!(await hasAccess(login, path))) {
		denyRedirect(path);
	}
}

export const actions: Actions = {
	rename: async ({ request }) => {
		const form = await request.formData();
		const path = form.get('path') as string;
		const newName = form.get('newName') as string;
		const returnPath = form.get('returnPath') as string;
    const isDirectory = form.get('isDirectory') === 'true'

		const dir = path.substring(0, path.lastIndexOf('/'));
		const newPath = `${dir}/${newName}`;

		console.log('new path: ', newPath);
		console.log('original path:', path);

		await moveItem(WEBDAV_URL, WEBDAV_USERNAME, WEBDAV_PASSWORD, path, newPath, isDirectory);

		throw redirect(303, `/cloud/files?path=${encodeURIComponent(returnPath)}`);
	},

	delete: async ({ request }) => {
		const form = await request.formData();
		const path = form.get('path') as string;
		const returnPath = form.get('returnPath') as string;
    const isDirectory = form.get('isDirectory') === 'true'

		await deleteItem(WEBDAV_URL, WEBDAV_USERNAME, WEBDAV_PASSWORD, path, isDirectory);

		throw redirect(303, `/cloud/files?path=${encodeURIComponent(returnPath)}`);
	},

	deleteMany: async ({ request }) => {
		const form = await request.formData();
		const paths = form.getAll('path') as string[];
    const isDirectoryType = form.getAll('isDirectory') as string[]
		const returnPath = form.get('returnPath') as string;

    await Promise.all(paths.map((p, i) =>
      deleteItem(WEBDAV_URL, WEBDAV_USERNAME, WEBDAV_PASSWORD, p, isDirectoryType[i] === 'true')
    ))

		throw redirect(303, `/cloud/files?path=${encodeURIComponent(returnPath)}`);
	}
};

export const load: PageServerLoad = async ({ url, locals }) => {
	const path = url.searchParams.get('path') ?? '/';

	if (path != '/' && path != '/cloud') {
		await requireAccess(locals.tailscaleIdentity?.login, path);
	}

	try {
		const contents = await listDirectory(WEBDAV_URL, WEBDAV_USERNAME, WEBDAV_PASSWORD, path);
		return { files: contents, path };
	} catch {
		return { files: [], path, error: true };
	}
};
