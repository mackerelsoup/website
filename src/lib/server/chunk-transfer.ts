import { mkdir, writeFile, readFile, readdir, rm, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const ROOT = join(tmpdir(), 'cloud-uploads')

export interface ChunkTransfer {
	transferId: string
	destPath: string
	filename: string
	size: number
	totalChunks: number
	createdAt: number
	dir: string
	finalizing: boolean   // claimed by the first finalize attempt
	done: boolean         // file written to WebDAV; chunk dir already removed
}

const transfers = new Map<string, ChunkTransfer>()

// idempotent: returns existing entry if transferId already seen
export async function createChunkTransfer(meta: {
	transferId: string; destPath: string; filename: string
	size: number; totalChunks: number
}): Promise<ChunkTransfer> {
	const existing = transfers.get(meta.transferId)
	if (existing) return existing

	const dir = join(ROOT, meta.transferId)
	await mkdir(dir, { recursive: true })
	const transfer: ChunkTransfer = { ...meta, createdAt: Date.now(), dir, finalizing: false, done: false }
	transfers.set(meta.transferId, transfer)
	return transfer
}

export function getTransfer(id: string) {
	return transfers.get(id)
}

// for resume: which chunk indices are already on disk
export async function receivedChunks(t: ChunkTransfer): Promise<number[]> {
	if (!existsSync(t.dir)) return []
	const files = await readdir(t.dir)
	return files
		.filter((f) => f.startsWith('chunk.'))
		.map((f) => Number(f.slice('chunk.'.length)))
		.filter((n) => Number.isInteger(n))
		.sort((a, b) => a - b)
}

export async function writeChunk(t: ChunkTransfer, index: number, data: Buffer) {
	// reject garbage indices: an out-of-range chunk.N would inflate the count
	// isComplete relies on and corrupt assembly.
	if (!Number.isInteger(index) || index < 0 || index >= t.totalChunks) {
		throw new Error(`chunk index ${index} out of range [0, ${t.totalChunks})`)
	}
	await writeFile(join(t.dir, `chunk.${index}`), data)
}

export async function isComplete(t: ChunkTransfer): Promise<boolean> {
	const got = await receivedChunks(t) // sorted ascending, one entry per index on disk
	if (got.length !== t.totalChunks) return false
	for (let i = 0; i < t.totalChunks; i++) {
		if (got[i] !== i) return false // a hole at i, even if the count happens to match
	}
	return true
}

// concatenate chunk.0..chunk.{n-1} in order → single Buffer
export async function assemble(t: ChunkTransfer): Promise<Buffer> {
	const parts: Buffer[] = []
	for (let i = 0; i < t.totalChunks; i++) {
		parts.push(await readFile(join(t.dir, `chunk.${i}`)))
	}
	return Buffer.concat(parts)
}

// claim the exclusive right to finalize; sync check-and-set is atomic under
// Node's single-threaded event loop, so two concurrent "last chunk" requests
// can't both write.
export function claimFinalize(t: ChunkTransfer): boolean {
	if (t.finalizing) return false
	t.finalizing = true
	return true
}

// mark finalized: free the chunk files from disk but KEEP a lightweight record,
// so a retried last chunk (whose success response was lost in transit) gets
// answered with finalized:true instead of a confusing 404.
export async function markDone(t: ChunkTransfer) {
	t.done = true
	await rm(t.dir, { recursive: true, force: true }).catch(() => {})
}

export async function cleanupStaleTransfers() {
	const cutoff = Date.now() - 30 * 60 * 1000 // 30 min, longer than a stalled upload
	for (const [id, t] of transfers) {
		if (t.createdAt < cutoff) {
			transfers.delete(id)
			await rm(t.dir, { recursive: true, force: true }).catch(() => { })
		}
	}
}