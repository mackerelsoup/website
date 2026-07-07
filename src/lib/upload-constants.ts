export const CHUNK_SIZE = 5 * 1024 * 1024 // keep server in sync

export async function computeTransferId(
	destPath: string, filename: string, size: number, lastModified: number
): Promise<string> {
	const input = `${destPath}::${filename}::${size}::${lastModified}`


	if (typeof crypto != 'undefined' && crypto.subtle?.digest) {
		const bytes = new TextEncoder().encode(input)
		const digest = await crypto.subtle.digest('SHA-256', bytes)
		return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
	}

	let hash = 5321
	for (let index = 0; index < input.length; ++index) {
		hash = ((hash << 5) + hash) ^ input.charCodeAt(index);
		hash = hash & 0xffffffff;
	}
  return Math.abs(hash).toString(16).padStart(8, "0");
}

export function totalChunks(size: number): number {
	return Math.max(1, Math.ceil(size / CHUNK_SIZE))
}