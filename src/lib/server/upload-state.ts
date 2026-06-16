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
	lastActivity: number
}

export const uploads = new Map<string, UploadSession>()

export function createUploadSession(id: string): UploadSession {
	const existing = uploads.get(id)
	if (existing) return existing
	const now = Date.now()
	const session: UploadSession = { events: [], emitter: new EventEmitter(), createdAt: now, lastActivity: now }
	uploads.set(id, session)
	return session
}

export function getUploadSession(id: string): UploadSession | undefined {
	return uploads.get(id)
}

// SSE connects before the upload/init request creates the session (the client opens
// it immediately on start()), so the session must be created on demand here too.
export function getOrCreateUploadSession(id: string): UploadSession {
	return createUploadSession(id)
}

export function emitUploadEvent(id: string, event: UploadEvent): void {
	const session = uploads.get(id)
	if (!session) return
	session.events.push(event)
	session.lastActivity = Date.now() // keep the session alive while work is happening
	session.emitter.emit('event', event)
}

export function cleanupStaleSessions(): void {
	const cutoff = Date.now() - 30 * 60 * 1000 // match chunk-transfer's window
	for (const [id, session] of uploads) {
		if (session.lastActivity < cutoff) uploads.delete(id)
	}
}
