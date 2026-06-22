import { posix } from 'node:path'

/**
 * Join destPath + filename and confirm the result stays inside destPath.
 * Folder uploads legitimately go *deeper*; nothing should ever go up or out.
 * Returns the normalized path, or null if it traverses out.
 */
export function resolveUploadPath(destPath: string, filename: string): string | null {
	if (typeof destPath !== 'string' || typeof filename !== 'string') return null
	const base = posix.normalize(destPath.endsWith('/') ? destPath : destPath + '/')
	const full = posix.normalize(posix.join(base, filename))
	if (full !== base.replace(/\/$/, '') && !full.startsWith(base)) return null
	return full
}