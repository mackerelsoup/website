export const CHUNK_SIZE = 5 * 1024 * 1024 // keep server in sync

export async function computeTransferId(
	destPath: string, filename: string, size: number, lastModified: number
): Promise<string> {
	const input = `${destPath}::${filename}::${size}::${lastModified}`
	const bytes = new TextEncoder().encode(input)
	const digest = await crypto.subtle.digest('SHA-256', bytes)
	return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function totalChunks(size: number): number {
	return Math.max(1, Math.ceil(size / CHUNK_SIZE))
}