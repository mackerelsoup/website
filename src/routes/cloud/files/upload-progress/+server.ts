import type { RequestHandler } from './$types'
import { getUploadSession } from '$lib/server/upload-state'
import type { UploadEvent } from '$lib/server/upload-state'

export const GET: RequestHandler = ({ url }) => {
	const id = url.searchParams.get('id') ?? ''
	const session = getUploadSession(id)

	if (!session) {
		return new Response('Session not found', { status: 404 })
	}

	const stream = new ReadableStream({
		start(controller) {
			const encode = (event: UploadEvent) =>
				`data: ${JSON.stringify(event)}\n\n`

			for (const event of session.events) {
				controller.enqueue(encode(event))
				if (event.type === 'complete' || event.type === 'error') {
					controller.close()
					return
				}
			}

			const handler = (event: UploadEvent) => {
				controller.enqueue(encode(event))
				if (event.type === 'complete' || event.type === 'error') {
					session.emitter.off('event', handler)
					controller.close()
				}
			}

			session.emitter.on('event', handler)
		}
	})

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache'
		}
	})
}
