// src/lib/server/disk-space.ts
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export interface DiskSpace {
	totalBytes: number
	usedBytes: number
	freeBytes: number
	checkedAt: number
}

let cached: DiskSpace | null = null
let lastError: string | null = null

async function refresh(): Promise<DiskSpace | null> {
	try {
		const { stdout } = await execFileAsync('df', ['-B1', '--output=size,used,avail', '/'])

		// stdout looks like:
		//        1B-blocks         Used    Avail
		//   103081984000  45097984000  52984000000
		const dataLine = stdout.trim().split('\n')[1]
		const [total, used, avail] = dataLine.trim().split(/\s+/).map(Number)

		cached = { totalBytes: total, usedBytes: used, freeBytes: avail, checkedAt: Date.now() }
		lastError = null
		return cached
	} catch (err) {
		// e.g. ENOENT on Windows dev machines where `df` doesn't exist
		lastError = err instanceof Error ? err.message : String(err)
		return null
	}
}

// prime immediately, then poll every 10s
refresh()
setInterval(refresh, 10_000)

// value from the last background poll (up to 10s stale) — cheap, no subprocess spawned
export function getCachedDiskSpace(): DiskSpace | null {
	return cached
}

// force a fresh df call right now — use before finalize, not on every request
export function getFreshDiskSpace(): Promise<DiskSpace | null> {
	return refresh()
}

export function getDiskSpaceError(): string | null {
	return lastError
}