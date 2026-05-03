import { EventEmitter } from 'node:events'

export type UploadEvent =
	| { type: 'saving'; filename: string; index: number; total: number }
	| { type: 'saved'; filename: string }
	| { type: 'complete' }
	| { type: 'error'; message: string }

export interface UploadSession {
	events: UploadEvent[]
	emitter: EventEmitter
	createdAt: number
}

export const uploads = new Map<string, UploadSession>()

export function createUploadSession(id: string): UploadSession {
	const session: UploadSession = {
		events: [],
		emitter: new EventEmitter(),
		createdAt: Date.now()
	}
	uploads.set(id, session)
	return session
}

export function getUploadSession(id: string): UploadSession | undefined {
	return uploads.get(id)
}

export function emitUploadEvent(id: string, event: UploadEvent): void {
	const session = uploads.get(id)
	if (!session) return
	session.events.push(event)
	session.emitter.emit('event', event)
}

export function cleanupStaleSessions(): void {
	const cutoff = Date.now() - 5 * 60 * 1000
	for (const [id, session] of uploads) {
		if (session.createdAt < cutoff) {
			uploads.delete(id)
		}
	}
}
