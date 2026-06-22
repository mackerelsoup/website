import { WEBDAV_PASSWORD, WEBDAV_URL } from '$env/static/private'
import { writeFile, createDirectory } from '$lib/webdav'
import { type ChunkTransfer, claimFinalize, assemble, markDone } from '$lib/server/chunk-transfer'
import { emitUploadEvent } from '$lib/server/upload-state'

const WEBDAV_USERNAME = 'homelab'

interface FinalizeCtx {
	uploadId: string
	fileIndex: number
	totalFiles: number
}

/**
 * Assemble a fully-received transfer and write it to WebDAV exactly once.
 * Callable from both the chunk handler and init — claimFinalize() ensures only
 * the first caller does the work. Failures are reported over SSE, never thrown
 * back into the route (which would 500 and leave the client retrying blindly).
 */
export async function finalizeFile(t: ChunkTransfer, ctx: FinalizeCtx): Promise<void> {
	if (!claimFinalize(t)) return // someone else already finalized / is finalizing

	try {
		emitUploadEvent(ctx.uploadId, {
			type: 'saving', filename: t.filename, index: ctx.fileIndex, total: ctx.totalFiles
		})

		const dir = t.destPath.replace(/\/$/, '')
		const uploadPath = `${dir}/${t.filename}`
		const parentDir = uploadPath.substring(0, uploadPath.lastIndexOf('/'))
		if (parentDir !== dir) {
			await createDirectory(WEBDAV_URL, WEBDAV_USERNAME, WEBDAV_PASSWORD, parentDir)
		}

		await writeFile(WEBDAV_URL, WEBDAV_USERNAME, WEBDAV_PASSWORD, uploadPath, await assemble(t))

		emitUploadEvent(ctx.uploadId, { type: 'saved', filename: t.filename })
		await markDone(t) // frees chunk files but keeps the record for late duplicates

		if (ctx.fileIndex === ctx.totalFiles - 1) {
			emitUploadEvent(ctx.uploadId, { type: 'complete' })
		}
	} catch (e) {
		t.finalizing = false // release so a genuine retry could try again
		emitUploadEvent(ctx.uploadId, { type: 'error', message: 'failed to save file' })
		console.error('[finalize] failed:', e)
	}
}