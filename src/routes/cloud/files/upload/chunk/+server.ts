import type { RequestHandler } from './$types'
import { getTransfer, writeChunk, isComplete } from '$lib/server/chunk-transfer'
import { finalizeFile } from '$lib/server/finalize-upload'
import { hasAccess } from '$lib/server/permissions'

export const PUT: RequestHandler = async ({ request, url, locals }) => {
	const transferId = url.searchParams.get('transferId')
	const uploadId = url.searchParams.get('uploadId')
	const index = Number(url.searchParams.get('index'))
	const fileIndex = Number(url.searchParams.get('fileIndex'))
	const totalFiles = Number(url.searchParams.get('totalFiles'))

	if (!transferId || !uploadId) {
		return new Response('Missing transferId or uploadId', { status: 400 })
	}

	const transfer = getTransfer(transferId)
	if (!transfer) return new Response('Unknown transfer', { status: 404 })

	// defense in depth: /upload/init already checked destPath access when the transfer
	// was created, but re-check here too since a transferId can be reused across requests.
	if (!(await hasAccess(locals.tailscaleIdentity?.login, transfer.destPath))) {
		return new Response('Forbidden', { status: 403 })
	}

	// already saved (this is a retried last chunk whose response got lost) — tell the
	// client it's fine rather than 404ing and tripping its error path.
	if (transfer.done) {
		return new Response(JSON.stringify({ index, finalized: true }), {
			headers: { 'Content-Type': 'application/json' }
		})
	}

	try {
		await writeChunk(transfer, index, Buffer.from(await request.arrayBuffer()))
	} catch (e) {
		return new Response(String(e), { status: 400 })
	}

	let finalized = false
	if (await isComplete(transfer)) {
		finalized = true
		await finalizeFile(transfer, { uploadId, fileIndex, totalFiles })
	}

	return new Response(JSON.stringify({ index, finalized }), {
		headers: { 'Content-Type': 'application/json' }
	})
}