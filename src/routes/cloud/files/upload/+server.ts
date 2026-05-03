import { randomUUID } from 'node:crypto'
import type { RequestHandler } from './$types'
import { WEBDAV_PASSWORD, WEBDAV_URL } from '$env/static/private'
import { writeFile } from '$lib/webdav'
import { createUploadSession, emitUploadEvent, cleanupStaleSessions } from '$lib/server/upload-state'

const WEBDAV_USERNAME = 'homelab'

export const POST: RequestHandler = async ({ request }) => {
	cleanupStaleSessions()

	const form = await request.formData()
	const dir = form.get('path') as string
	const files = form.getAll('files') as File[]

	const uploadId = randomUUID()
	createUploadSession(uploadId)

	;(async () => {
		try {
			for (let i = 0; i < files.length; i++) {
				const file = files[i]
				emitUploadEvent(uploadId, { type: 'saving', filename: file.name, index: i, total: files.length })
				const buffer = Buffer.from(await file.arrayBuffer())
				const uploadPath = `${dir.replace(/\/$/, '')}/${file.name}`
				await writeFile(WEBDAV_URL, WEBDAV_USERNAME, WEBDAV_PASSWORD, uploadPath, buffer)
				emitUploadEvent(uploadId, { type: 'saved', filename: file.name })
			}
			emitUploadEvent(uploadId, { type: 'complete' })
		} catch (e) {
			emitUploadEvent(uploadId, { type: 'error', message: String(e) })
		}
	})()

	return new Response(JSON.stringify({ uploadId }), {
		headers: { 'Content-Type': 'application/json' }
	})
}
