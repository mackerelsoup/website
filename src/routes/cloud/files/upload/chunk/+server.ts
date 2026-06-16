import type { RequestHandler } from './$types'
import { WEBDAV_PASSWORD, WEBDAV_URL } from '$env/static/private'
import { writeFile, createDirectory } from '$lib/webdav'
import { getTransfer, writeChunk, isComplete, assemble, disposeTransfer } from '$lib/server/chunk-transfer'
import { emitUploadEvent } from '$lib/server/upload-state'

const WEBDAV_USERNAME = 'homelab'

export const PUT: RequestHandler = async ({ request, url }) => {
	const transferId = url.searchParams.get('transferId')!
	const index = Number(url.searchParams.get('index'))
	// uploadId is the SSE channel for the whole multi-file upload; transferId is per-file
	const uploadId = url.searchParams.get('uploadId')!
	const fileIndex = Number(url.searchParams.get('fileIndex'))
	const totalFiles = Number(url.searchParams.get('totalFiles'))

	const transfer = getTransfer(transferId)
	if (!transfer) return new Response('Unknown transfer', { status: 404 })

	const data = Buffer.from(await request.arrayBuffer())
	await writeChunk(transfer, index, data)

	let finalized = false
	if (await isComplete(transfer)) {
		// TODO: guard against two concurrent "last chunk" requests double-finalizing
		//       (e.g. a per-transfer in-flight flag/lock in chunk-transfer.ts)
		emitUploadEvent(uploadId, {
			type: 'saving', filename: transfer.filename, index: fileIndex, total: totalFiles
		})

		const dir = transfer.destPath.replace(/\/$/, '')
		const uploadPath = `${dir}/${transfer.filename}`
		const parentDir = uploadPath.substring(0, uploadPath.lastIndexOf('/'))
		// only needed for folder uploads where filename contains subdirectories
		if (parentDir !== dir) {
			await createDirectory(WEBDAV_URL, WEBDAV_USERNAME, WEBDAV_PASSWORD, parentDir)
		}
		// assemble() loads the full file into memory before writing
		await writeFile(WEBDAV_URL, WEBDAV_USERNAME, WEBDAV_PASSWORD, uploadPath, await assemble(transfer))

		emitUploadEvent(uploadId, { type: 'saved', filename: transfer.filename })
		await disposeTransfer(transfer)
		finalized = true

    // Emit the complete upload event when all files have finished uploading
    if (fileIndex === totalFiles - 1) {
      emitUploadEvent(uploadId, {type: 'complete'})
    }
	}

	// finalized tells the client which PUT triggered assembly
	return new Response(JSON.stringify({ index, finalized }), {
		headers: { 'Content-Type': 'application/json' }
	})
}