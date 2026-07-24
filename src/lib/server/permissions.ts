//This file checks whether the currently logged in tailscale user has access to a particular folder

import { db } from '$lib/server/db';
import { folderPermission, folder } from '$lib/server/db/schema';
import { and, eq, inArray, isNull } from 'drizzle-orm';

/**
 * Hardcoded admin allowlist for the /cloud/admin/permissions UI.
 * Anyone whose Tailscale-User-Login is in this list can manage grants.
 * (No roles table yet — see ARCHITECTURE.md known gaps. Revisit if more admins are needed.)
 */
const ADMIN_LOGINS = new Set<string>([
	// 'mackerelsoup@github'
]);

export function isAdmin(login: string | undefined | null): boolean {
	if (!login) return false;
	return ADMIN_LOGINS.has(login);
}

/** Normalize a WebDAV-style path: leading slash, no trailing slash (except root itself). */
export function normalizePath(path: string): string {
	let p = path.trim();
	if (!p.startsWith('/')) p = `/${p}`;
	if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
	return p || '/';
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
export async function listViewOnlyPermissions(): Promise<FolderPermissionRow[]> {
	return db.query.folderPermission.findMany({
		where: and(isNull(folderPermission.tailscaleLogin), eq(folderPermission.access, 'view')) 
	});
}

//** Get the access level for a particular `login` and `path` */
export async function getAccessLevel(login: string | undefined | null, path: string): Promise<string|null> {
	if (!login) return null

	//Admins will have edit powers for all folders
	if (isAdmin(login)) {
		return 'edit'
	}
	
	const requestFolder = normalizePath(path);

	const viewOnlyFoldersPermissions = await listViewOnlyPermissions();
	const viewOnlyFolderIds = viewOnlyFoldersPermissions.map((viewOnlyFoldersPermissions) => viewOnlyFoldersPermissions.folderId);
	const viewOnlyFolders = await db.query.folder.findMany({
		where: inArray(folder.id, viewOnlyFolderIds)
	})

	if (viewOnlyFolders.some((folder) => folder.path == requestFolder)) {
		return 'view';
	}
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

export async function grantAccess(folderPath: string, tailscaleLogin: string): Promise<void> {
	const path = normalizePath(folderPath);
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
		.values({ folderId: folderRow.id, tailscaleLogin: login, access: 'view' })
		.onConflictDoNothing();
}

export async function revokeAccess(id: number): Promise<void> {
	await db.delete(folderPermission).where(eq(folderPermission.id, id));
}
