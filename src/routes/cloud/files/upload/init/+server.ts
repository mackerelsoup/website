import type { RequestHandler } from './$types'
import {
	createChunkTransfer, receivedChunks, isComplete, cleanupStaleTransfers
} from '$lib/server/chunk-transfer'
import { createUploadSession, cleanupStaleSessions } from '$lib/server/upload-state'
import { finalizeFile } from '$lib/server/finalize-upload'
import { resolveUploadPath } from '$lib/server/safe-path'

export const POST: RequestHandler = async ({ request }) => {
	await cleanupStaleTransfers()
	cleanupStaleSessions()

	const { uploadId, transferId, destPath, filename, size, totalChunks, fileIndex, totalFiles } =
		await request.json()

	if (!resolveUploadPath(destPath, filename)) {
		return new Response('Invalid path', { status: 400 })
	}

	createUploadSession(uploadId)
	const transfer = await createChunkTransfer({ transferId, destPath, filename, size, totalChunks })

	// resume edge case: server already has every chunk, so no chunk PUT will come
	// to trigger assembly. Finalize here and tell the client to skip this file.
	if (transfer.done || (await isComplete(transfer))) {
		await finalizeFile(transfer, { uploadId, fileIndex, totalFiles })
		return new Response(JSON.stringify({ received: [], done: true }), {
			headers: { 'Content-Type': 'application/json' }
		})
	}

	const received = await receivedChunks(transfer)
	return new Response(JSON.stringify({ received, done: false }), {
		headers: { 'Content-Type': 'application/json' }
	})
}