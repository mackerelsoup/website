import { WEBDAV_PASSWORD, WEBDAV_URL } from '$env/static/private';
import { and, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { folder, folderRequest } from '$lib/server/db/schema';
import { createDirectory } from '$lib/webdav';
import { validateFolderPath } from '$lib/server/path-utils';
import { assertFolderProvisionAllowed } from '$lib/server/protected-roots';
import { grantAccess } from '$lib/server/permissions';

const WEBDAV_USERNAME = 'homelab';

/**
 * Provision a pending Folder Request at `rawPath`: WebDAV directory, Folder row, and an `edit`
 * Grant for the requester. The DB writes share a transaction; the directory is created first
 * (idempotent), so only a race after the pre-checks can leave an empty directory.
 * Throws with a user-presentable message on any refusal.
 */
export async function approveFolderRequest(id: number, rawPath: unknown): Promise<void> {
	const parsed = validateFolderPath(rawPath);
	if (!parsed.ok) throw new Error(parsed.message);
	assertFolderProvisionAllowed(parsed.path);

	const req = await db.query.folderRequest.findFirst({
		where: and(eq(folderRequest.id, id), eq(folderRequest.status, 'pending'))
	});
	if (!req) throw new Error('Request is no longer pending');

	// Fail on ordinary bad input before touching WebDAV; the transaction below re-checks for races.
	if (await db.query.folder.findFirst({ where: eq(folder.path, parsed.path) })) {
		throw new Error(`${parsed.path} is already a Folder`);
	}

	await createDirectory(WEBDAV_URL, WEBDAV_USERNAME, WEBDAV_PASSWORD, parsed.path);

	await db.transaction(async (tx) => {
		const inserted = await tx
			.insert(folder)
			.values({ path: parsed.path })
			.onConflictDoNothing()
			.returning({ id: folder.id });
		if (inserted.length === 0) throw new Error(`${parsed.path} is already a Folder`);

		await grantAccess(parsed.path, req.tailscaleLogin, 'edit', tx);

		// status guard makes a double-click / concurrent approve fail instead of double-provisioning
		const updated = await tx
			.update(folderRequest)
			.set({ status: 'approved' })
			.where(and(eq(folderRequest.id, id), eq(folderRequest.status, 'pending')))
			.returning({ id: folderRequest.id });
		if (updated.length === 0) throw new Error('Request is no longer pending');
	});
}

export async function denyFolderRequest(id: number): Promise<void> {
	await db
		.update(folderRequest)
		.set({ status: 'denied' })
		.where(and(eq(folderRequest.id, id), eq(folderRequest.status, 'pending')));
}
