export interface Sibling {
	basename: string;
	filename: string;
}

interface Entry extends Sibling {
	type: 'file' | 'directory';
}

/**
 * Sibling Folders of `current` that the identity may see, for the parent pane.
 * `canSee` is injected (getAccessLevel in production) so the leak rule is testable without a DB.
 * Only directories the identity holds a Grant on are returned; the current Folder is always
 * included because the identity already passed the access check to be here.
 */
export async function visibleSiblings(
	entries: Entry[],
	current: Sibling,
	canSee: (path: string) => Promise<boolean>
): Promise<Sibling[]> {
	const dirs = entries.filter((e) => e.type === 'directory' && e.filename !== current.filename);
	const allowed = await Promise.all(dirs.map((d) => canSee(d.filename)));
	const visible = dirs
		.filter((_, i) => allowed[i])
		.map(({ basename, filename }) => ({ basename, filename }));
	return [...visible, current].sort((a, b) => a.basename.localeCompare(b.basename));
}
