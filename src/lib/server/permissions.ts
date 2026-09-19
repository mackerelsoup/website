//This file checks whether the currently logged in tailscale user has access to a particular folder

import { db } from '$lib/server/db';
import { folderPermission, folder } from '$lib/server/db/schema';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { normalizePath } from '$lib/server/path-utils';
import { assertEditGrantAllowed } from '$lib/server/protected-roots';

export { normalizePath };

/**
 * Hardcoded admin allowlist for the /cloud/admin/permissions UI.
 * Anyone whose Tailscale-User-Login is in this list can manage grants.
 * (No roles table yet — see ARCHITECTURE.md known gaps. Revisit if more admins are needed.)
 */
const ADMIN_LOGINS = new Set<string>([
	//'mackerelsoup@github'
]);

export function isAdmin(login: string | undefined | null): boolean {
	if (!login) return false;
	return ADMIN_LOGINS.has(login);
}

/**
 * True if `granted` covers `target`, using segment-aware prefix matching so a grant on
 * '/family' does not also match '/familyphotos'. A grant on '/' covers everything.
 */
function pathCovers(granted: string, target: string): boolean {
	if (granted === '/') return true;
	if (granted === target) return true;
	return target.startsWith(`${granted}/`);
}

export interface FolderPermissionRow {
	id: number;
	folderId: number;
	tailscaleLogin: string | null;
	createdAt: Date;
	access: string | null;
}

export interface FolderRow {
	id: number;
	path: string;
	label: string;
	createdAt: Date;
}

/** All permission grants, most-recent first. For the admin UI. */
export async function listPermissions(): Promise<FolderPermissionRow[]> {
	return db.query.folderPermission.findMany({
		orderBy: (t, { desc }) => [desc(t.createdAt)]
	});
}

//** List view only permissions, common folders which have view access only*/
export async function listGeneralViewOnlyFolders(): Promise<FolderPermissionRow[]> {
	return db.query.folderPermission.findMany({
		where: and(isNull(folderPermission.tailscaleLogin), eq(folderPermission.access, 'view')) 
	});
}

/** Higher number wins when multiple grants cover the same folder at the same specificity. */
const ACCESS_RANK: Record<string, number> = { edit: 2, view: 1 };

//** Get the access level for a particular `login` and `path` */
export async function getAccessLevel(login: string | undefined | null, path: string): Promise<string | null> {
	if (!login) return null

	//Admins will have edit powers for all folders
	if (isAdmin(login)) {
		return 'edit'
	}

	const requestFolder = normalizePath(path);

	const personalGrants = await db.query.folderPermission.findMany({
		where: eq(folderPermission.tailscaleLogin, login)
	});
	const generalGrants = await listGeneralViewOnlyFolders();

	const relevantGrants = [...personalGrants, ...generalGrants];
	if (relevantGrants.length === 0) return null;

	// General grants only apply to the exact folder they're on, they don't cascade to
	// subfolders (e.g. a general view grant on '/cloud' doesn't cover '/cloud/temp').
	// Personal grants keep the ancestor-covers-descendant behavior.
	const generalGrantIds = new Set(generalGrants.map((grant) => grant.id));

	const folders = await db.query.folder.findMany({
		where: inArray(folder.id, relevantGrants.map((grant) => grant.folderId))
	});
	const folderPathById = new Map(folders.map((f) => [f.id, normalizePath(f.path)]));

	// Prefer the most specific covering folder (longest path); break ties by access rank.
	// Eg. /cloud is 'view' only but 'xxx' has 'edit' access on cloud
	let best: { path: string; access: string } | null = null;
	for (const grant of relevantGrants) {
		const folderPath = folderPathById.get(grant.folderId);
		if (!folderPath || !grant.access) continue;

		const matches = generalGrantIds.has(grant.id)
			? folderPath === requestFolder
			: pathCovers(folderPath, requestFolder);
		if (!matches) continue;

		//the reason why the folder can be checked by length is because
		const isMoreSpecific = !best || folderPath.length > best.path.length;
		const isSameSpecificityHigherRank =
			best &&
			folderPath.length === best.path.length &&
			(ACCESS_RANK[grant.access] ?? 0) > (ACCESS_RANK[best.access] ?? 0);

		if (isMoreSpecific || isSameSpecificityHigherRank) {
			best = { path: folderPath, access: grant.access };
		}
	}

	return best?.access ?? null;
}

/**
 * Does `login` have access to `path`? Access is granted if there is any permission row
 * whose folderPath covers `path` (equal to it, or an ancestor of it) for that login.
 * No rows for a path at all means nobody has explicit access -> denied by default.
 */
export async function hasAccess(login: string | undefined | null, path: string): Promise<boolean> {
	if (!login) return false;

  if (isAdmin(login)) {
    return true;
  }

	const requestFolder = normalizePath(path);
	const grants = await db.query.folderPermission.findMany({
		where: eq(folderPermission.tailscaleLogin, login)
	});
	const folderIds = grants.map((grant) => grant.folderId);
	const grantedFolders = await db.query.folder.findMany({
		where: inArray(folder.id, folderIds)
	});

	return grantedFolders.some((f) => pathCovers(normalizePath(f.path), requestFolder));
}

export async function grantAccess(
	folderPath: string,
	tailscaleLogin: string,
	access: 'view' | 'edit'
): Promise<void> {
	const path = normalizePath(folderPath);
	if (access === 'edit') assertEditGrantAllowed(path);
	const login = tailscaleLogin.trim();
	if (!login) throw new Error('tailscaleLogin is required');

  //there should only be one folder per path
	const folderRow = await db.query.folder.findFirst({
		where: eq(folder.path, path)
	});

	if (!folderRow) {
    //add some error handling
    return 
	}

	await db
		.insert(folderPermission)
		.values({ folderId: folderRow.id, tailscaleLogin: login, access })
		.onConflictDoNothing();
}

export async function revokeAccess(id: number): Promise<void> {
	await db.delete(folderPermission).where(eq(folderPermission.id, id));
}
