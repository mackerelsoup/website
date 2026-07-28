import { WEBDAV_PASSWORD, WEBDAV_URL } from '$env/static/private';
import { createDirectory, writeFileStream } from '$lib/webdav';
import {
	type ChunkTransfer,
	claimFinalize,
	markDone,
	streamChunksInOrder
} from '$lib/server/chunk-transfer';
import { emitUploadEvent } from '$lib/server/upload-state';

const WEBDAV_USERNAME = 'homelab';

interface FinalizeCtx {
	uploadId: string;
	fileIndex: number;
	totalFiles: number;
}

/**
 * Assemble a fully-received transfer and write it to WebDAV exactly once.
 * Callable from both the chunk handler and init — claimFinalize() ensures only
 * the first caller does the work. Failures are reported over SSE, never thrown
 * back into the route (which would 500 and leave the client retrying blindly).
 */
export async function finalizeFile(t: ChunkTransfer, ctx: FinalizeCtx): Promise<void> {
	if (!claimFinalize(t)) return; // someone else already finalized / is finalizing

	try {
		const dir = t.destPath.replace(/\/$/, '');
		const uploadPath = `${dir}/${t.filename}`;
		const parentDir = uploadPath.substring(0, uploadPath.lastIndexOf('/'));
		if (parentDir !== dir) {
			await createDirectory(WEBDAV_URL, WEBDAV_USERNAME, WEBDAV_PASSWORD, parentDir);
		}

		let lastEmit = 0;
		await writeFileStream(
			WEBDAV_URL,
			WEBDAV_USERNAME,
			WEBDAV_PASSWORD,
			uploadPath,
			streamChunksInOrder(t),
			(written) => {
				const now = Date.now();
				if (now - lastEmit > 250 || written >= t.size) {
					lastEmit = now;
					emitUploadEvent(ctx.uploadId, {
						type: 'saving',
						filename: t.filename,
						written: written,
						total: t.size
					});
				}
			}
		);

		await markDone(t); // frees chunk files but keeps the record for late duplicates

		if (ctx.fileIndex === ctx.totalFiles - 1) {
			emitUploadEvent(ctx.uploadId, { type: 'complete' });
		}
	} catch (e) {
		t.finalizing = false; // release so a genuine retry could try again
		emitUploadEvent(ctx.uploadId, { type: 'error', message: 'failed to save file' });
		console.error('[finalize] failed:', e);
	}
}
