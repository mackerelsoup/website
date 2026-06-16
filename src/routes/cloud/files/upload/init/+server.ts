import type { RequestHandler } from './$types'
import { createChunkTransfer, receivedChunks, cleanupStaleTransfers } from '$lib/server/chunk-transfer'
import { createUploadSession, cleanupStaleSessions } from '$lib/server/upload-state'

const CLOUD_DIR : string = '/cloud'

export const POST: RequestHandler = async ({ request }) => {
	await cleanupStaleTransfers()
	await cleanupStaleSessions()

	const { uploadId, transferId, destPath, filename, size, totalChunks } = await request.json()
	
	createUploadSession(uploadId)

	const transfer = await createChunkTransfer({ transferId, destPath, filename, size, totalChunks })
	const received = await receivedChunks(transfer)

	return new Response(JSON.stringify({ received }), {
		headers: { 'Content-Type': 'application/json' }
	})
}