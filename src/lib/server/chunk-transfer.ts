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
	const transfer: ChunkTransfer = { ...meta, createdAt: Date.now(), dir, finalizing: false, done: false }	transfers.set(meta.transferId, transfer)
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
	// TODO: optionally validate index < totalChunks
	await writeFile(join(t.dir, `chunk.${index}`), data)
}

export async function isComplete(t: ChunkTransfer): Promise<boolean> {
	const got = await receivedChunks(t)
	return got.length === t.totalChunks
}

// concatenate chunk.0..chunk.{n-1} in order → single Buffer
export async function assemble(t: ChunkTransfer): Promise<Buffer> {
	const parts: Buffer[] = []
	for (let i = 0; i < t.totalChunks; i++) {
		parts.push(await readFile(join(t.dir, `chunk.${i}`)))
	}
	return Buffer.concat(parts)
}

export async function disposeTransfer(t: ChunkTransfer) {
	transfers.delete(t.transferId)
	await rm(t.dir, { recursive: true, force: true })
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