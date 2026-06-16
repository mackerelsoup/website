import { tick } from 'svelte';
import { invalidateAll } from '$app/navigation';
import { computeTransferId, totalChunks, CHUNK_SIZE } from '$lib/upload-constants';

export type UploadPhase = 'idle' | 'uploading' | 'saving' | 'done' | 'error';

/**
 * Drives the chunked upload flow for the files page: sends each file in
 * CHUNK_SIZE pieces, retries failed chunks, and listens over SSE for the
 * server's save progress. All fields are reactive ($state) so the page
 * template can bind to them directly, e.g. `upload.phase`, `upload.percent`.
 */
export class UploadManager {
	phase = $state<UploadPhase>('idle');
	error = $state('');

	// "uploading" phase — client-driven, chunk-by-chunk progress
	percent = $state(0);
	uploadingFilename = $state('');
	uploadingIndex = $state(0);
	uploadingTotal = $state(0);

	// "saving" phase — server-driven, reported over SSE once all chunks land
	savingFilename = $state('');
	savingStatus = $state<'saving' | 'saved'>('saving');
	savingIndex = $state(0);
	savingTotal = $state(0);

	dismissError() {
		this.phase = 'idle';
	}

	async start(destPath: string, files: FileList, useRelativePaths = false) {
		const uploadId = crypto.randomUUID(); // ephemeral, SSE-only — not the transferId
		const fileList = [...files];

		// saving/saved/complete arrive in real time over SSE, often while later files
		// are still uploading — queue them and only replay once every chunk is sent,
		// so the UI shows one phase at a time instead of interleaving.
		let allChunksSent = false;
		const eventQueue: any[] = [];
		let draining = false;

		const es = new EventSource(`/cloud/files/upload-progress?id=${uploadId}`);

		const drainQueue = async () => {
			if (!allChunksSent || draining) return;
			draining = true;
			while (eventQueue.length > 0) {
				const ev = eventQueue.shift();
				if (ev.type === 'saving') {
					this.phase = 'saving';
					this.savingStatus = 'saving';
					this.savingFilename = ev.filename;
					this.savingIndex = ev.index + 1;
					this.savingTotal = ev.total;
					await new Promise((r) => setTimeout(r, 300));
				} else if (ev.type === 'saved') {
					this.savingStatus = 'saved';
					this.savingFilename = ev.filename;
					await new Promise((r) => setTimeout(r, 300));
				} else if (ev.type === 'complete') {
					this.phase = 'done';
					es.close();
					setTimeout(() => {
						this.phase = 'idle';
						invalidateAll();
					}, 1200);
				}
			}
			draining = false;
		};

		es.onmessage = (e) => {
			const ev = JSON.parse(e.data);
			if (ev.type === 'error') {
				this.phase = 'error';
				this.error = ev.message;
				es.close();
				return;
			}
			eventQueue.push(ev);
			drainQueue();
		};

		this.phase = 'uploading';
		await tick();

		this.uploadingTotal = fileList.length;

		for (let f = 0; f < fileList.length; f++) {
			const file = fileList[f];
			const filename = useRelativePaths ? file.webkitRelativePath || file.name : file.name;
			this.uploadingFilename = filename;
			this.uploadingIndex = f + 1;
			this.percent = 0;

			const transferId = await computeTransferId(destPath, filename, file.size, file.lastModified);
			const total = totalChunks(file.size);

			// idempotent init → which chunks the server already has (e.g. from a retry)
			const initRes = await fetch('/cloud/files/upload/init', {
				method: 'POST',
				body: JSON.stringify({
					uploadId,
					transferId,
					destPath,
					filename,
					size: file.size,
					totalChunks: total
				})
			});
			const { received } = await initRes.json();
			const have = new Set<number>(received); // chunks already sitting in the server's temp folder

			let confirmed = have.size;
			this.percent = Math.round((confirmed / total) * 100);

			// upload missing chunks sequentially, each with its own retry budget
			for (let i = 0; i < total; i++) {
				if (have.has(i)) continue;
				const blob = file.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
				const params = new URLSearchParams({
					transferId,
					index: String(i),
					uploadId,
					fileIndex: String(f),
					totalFiles: String(fileList.length)
				});

				let attempts = 0;
				while (attempts < 2) {
					try {
						const res = await fetch(`/cloud/files/upload/chunk?${params}`, {
							method: 'PUT',
							body: blob
						});
						if (!res.ok) throw new Error(`HTTP ${res.status}`);
						confirmed++;
						break;
					} catch {
						attempts++;
						await new Promise((r) => setTimeout(r, 500 * attempts)); // backoff
					}
				}

				this.percent = Math.round((confirmed / total) * 100); // client-driven, no SSE
			}
		}

		// every file's chunks are on the server — safe to start showing save progress
		allChunksSent = true;
		drainQueue();
	}
}
