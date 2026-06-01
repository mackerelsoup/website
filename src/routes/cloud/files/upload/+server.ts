import { randomUUID } from 'node:crypto'
import type { RequestHandler } from './$types'
import { WEBDAV_PASSWORD, WEBDAV_URL } from '$env/static/private'
import { writeFile, createDirectory } from '$lib/webdav'
import { createUploadSession, emitUploadEvent, cleanupStaleSessions } from '$lib/server/upload-state'

const WEBDAV_USERNAME = 'homelab'

export const POST: RequestHandler = async ({ request }) => {
	cleanupStaleSessions()

	const form = await request.formData()
	const dir = form.get('path') as string
	const files = form.getAll('files') as File[]
	const relativePaths = form.getAll('relativePaths') as string[]

	const uploadId = randomUUID()
	createUploadSession(uploadId)

	;(async () => {
		try {
			for (let i = 0; i < files.length; i++) {
				const file = files[i]
				const relativePath = relativePaths[i] || file.name
				emitUploadEvent(uploadId, { type: 'saving', filename: relativePath, index: i, total: files.length })
				const buffer = Buffer.from(await file.arrayBuffer())
				const uploadPath = `${dir.replace(/\/$/, '')}/${relativePath}`
				const parentDir = uploadPath.substring(0, uploadPath.lastIndexOf('/'))
				if (parentDir !== dir.replace(/\/$/, '')) {
					await createDirectory(WEBDAV_URL, WEBDAV_USERNAME, WEBDAV_PASSWORD, parentDir)
				}
				await writeFile(WEBDAV_URL, WEBDAV_USERNAME, WEBDAV_PASSWORD, uploadPath, buffer)
				emitUploadEvent(uploadId, { type: 'saved', filename: relativePath })
			}
			emitUploadEvent(uploadId, { type: 'complete' })
		} catch (e) {
			console.error('[upload] failed:', e)
			emitUploadEvent(uploadId, { type: 'error', message: String(e) })
		}
	})()

	return new Response(JSON.stringify({ uploadId }), {
		headers: { 'Content-Type': 'application/json' }
	})
}
