<script lang="ts">
	import type { UploadManager } from '../upload.svelte';
	import { barCells, formatBytes, formatDuration } from '../format';

	let { upload }: { upload: UploadManager } = $props();

	const WIDTH = 28;
	const savingPercent = $derived(
		upload.savingTotal > 0 ? Math.round((upload.savingWritten / upload.savingTotal) * 100) : 0
	);
	const percent = $derived(upload.phase === 'saving' ? savingPercent : upload.percent);
	const cells = $derived(barCells(percent, WIDTH));
</script>

{#if upload.phase !== 'idle'}
	<div class="block" class:error={upload.phase === 'error'} role="status">
		{#if upload.phase === 'error'}
			<div class="title danger">✖ upload failed</div>
			<div class="danger">{upload.error}</div>
			<button type="button" onclick={() => upload.dismissError()}><kbd>dismiss</kbd></button>
		{:else if upload.phase === 'done'}
			<div class="title ok">✔ done</div>
		{:else}
			<div class="row">
				<span class="title accent">
					{#if upload.phase === 'saving'}▲ saving to cloud…{:else if upload.paused}▲ paused {upload.uploadingIndex}/{upload.uploadingTotal}{:else}▲
						uploading {upload.uploadingIndex}/{upload.uploadingTotal}{/if}
				</span>
				<span>{percent}%</span>
			</div>
			<div class="strong">
				{upload.phase === 'saving' ? upload.savingFilename : upload.uploadingFilename}
			</div>
			<div
				class="bar"
				role="progressbar"
				aria-label="upload progress"
				aria-valuemin="0"
				aria-valuemax="100"
				aria-valuenow={percent}
			>
				<span class="accent">▕{'█'.repeat(cells.filled)}</span><span class="empty"
					>{'█'.repeat(cells.empty)}</span
				><span class="accent">▏</span>
			</div>
			{#if upload.phase === 'saving'}
				<div class="muted">
					{formatBytes(upload.savingWritten)} / {formatBytes(upload.savingTotal)}
				</div>
			{:else}
				<div class="row muted">
					<span>{upload.speed > 0 ? `${formatBytes(upload.speed)}/s` : '—'}</span>
					<span>{upload.eta !== null ? `~${formatDuration(upload.eta)} left` : ''}</span>
				</div>
				<div class="muted actions">
					<button type="button" onclick={() => (upload.paused ? upload.resume() : upload.pause())}
						>{upload.paused ? 'resume' : 'pause'} <kbd>p</kbd></button
					>
				</div>
			{/if}
		{/if}
	</div>
{/if}

<style lang="scss">
	.block {
		border: 1px solid var(--m-accent);
		border-radius: 4px;
		padding: 10px 12px;
		&.error {
			border-color: var(--m-danger);
		}
	}
	.row {
		display: flex;
		justify-content: space-between;
	}
	.title {
		font-weight: 700;
	}
	.accent {
		color: var(--m-accent);
	}
	.ok {
		color: var(--m-ok);
	}
	.danger {
		color: var(--m-danger);
	}
	.strong {
		color: var(--m-text-strong);
		word-break: break-all;
	}
	.muted {
		color: var(--m-muted);
	}
	.empty {
		color: var(--m-line);
	}
	.bar {
		margin: 4px 0;
		white-space: nowrap;
		overflow: hidden;
	}
	button {
		background: none;
		border: 0;
		padding: 0;
		font: inherit;
		color: var(--m-muted);
		cursor: pointer;
		border-radius: 3px;
	}
	kbd {
		font: inherit;
		color: var(--m-accent);
	}
	.actions {
		margin-top: 2px;
	}
</style>
