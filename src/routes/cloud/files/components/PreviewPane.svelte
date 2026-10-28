<script lang="ts">
	import type { FileStat } from 'webdav';
	import type { UploadManager } from '../upload.svelte';
	import { formatBytes, formatModified, isImage } from '../format';
	import UploadBlock from './UploadBlock.svelte';
	import SelectBlock from './SelectBlock.svelte';

	let {
		entry,
		accessLevel,
		upload,
		selecting,
		selectedCount,
		selectedBytes,
		confirming,
		copied,
		sheetOpen,
		onopen,
		onrename,
		oncopy,
		ondelete,
		oncancelConfirm,
		onclose
	}: {
		entry: FileStat | null;
		accessLevel: 'view' | 'edit' | null;
		upload: UploadManager;
		selecting: boolean;
		selectedCount: number;
		selectedBytes: number;
		confirming: boolean;
		copied: boolean;
		sheetOpen: boolean;
		onopen: () => void;
		onrename: () => void;
		oncopy: () => void;
		ondelete: () => void;
		oncancelConfirm: () => void;
		onclose: () => void;
	} = $props();

	const canEdit = $derived(accessLevel === 'edit');
	const isDir = $derived(entry?.type === 'directory');
	let imgFailed = $state(false);
	$effect(() => {
		void entry?.filename;
		imgFailed = false;
	});

</script>

<aside class:open={sheetOpen} aria-label="Preview">
	<button type="button" class="sheet-close" onclick={onclose} aria-label="close preview">✕</button>

	<div class="desktop-only">
		<UploadBlock {upload} />
	</div>

	{#if entry}
		<div class="preview">
			{#if entry.type === 'file' && isImage(entry.basename) && !imgFailed}
				<img
					src="/cloud/file?path={encodeURIComponent(entry.filename)}"
					alt="preview of {entry.basename}"
					loading="lazy"
					onerror={() => (imgFailed = true)}
				/>
			{:else}
				{#if isDir}
						<svg class="folder" viewBox="0 0 20 14" shape-rendering="crispEdges" aria-hidden="true">
							<path class="hi" d="M0 0h7v2h13v1H0z" />
							<path class="lo" d="M0 4h20v10H0z" />
						</svg>
					{:else}
						<svg class="doc" viewBox="0 0 12 14" shape-rendering="crispEdges" aria-hidden="true">
								<path class="hi" fill-rule="evenodd" d="M0 0h9v1h1v1h1v1h1v11H0zM2 5h6v1H2zM2 7h8v1H2zM2 9h4v1H2zM2 11h7v1H2z" />
								<path class="lo" d="M9 1h1v1h1v1H9z" />
							</svg>
					{/if}
			{/if}
		</div>
		<div class="name">{entry.basename}</div>
		<dl>
			<dt>type</dt>
			<dd>{isDir ? 'folder' : (entry.mime ?? 'file')}</dd>
			<dt>size</dt>
			<dd>{isDir ? '—' : formatBytes(entry.size)}</dd>
			<dt>modified</dt>
			<dd>{formatModified(entry.lastmod)}</dd>
			<dt>access</dt>
			<dd class="ok">{accessLevel ?? 'none'}</dd>
			<dt>path</dt>
			<dd class="break">{entry.filename}</dd>
		</dl>
		<div class="chips">
			{#if !selecting}
				<button type="button" onclick={onopen}><kbd>o</kbd> open</button>
				{#if canEdit}<button type="button" onclick={onrename}><kbd>r</kbd> rename</button>{/if}
			{/if}
			{#if !isDir && !selecting}<button type="button" onclick={oncopy}
					><kbd>y</kbd> {copied ? 'copied!' : 'copy link'}</button
				>{/if}
			{#if canEdit}
				{#if confirming && !selecting}
					<button type="submit" form="delete-one" class="danger"><kbd>y</kbd> confirm delete</button
					>
					<button type="button" onclick={oncancelConfirm}><kbd>esc</kbd> cancel</button>
				{:else}
					<button type="button" class="danger" onclick={ondelete}><span>d</span> delete</button>
				{/if}
			{/if}
		</div>
	{:else}
		<p class="muted">nothing selected</p>
	{/if}

	{#if selecting}
		<div class="desktop-only bottom">
			<SelectBlock
				count={selectedCount}
				bytes={selectedBytes}
				{confirming}
				oncancel={oncancelConfirm}
				{ondelete}
			/>
		</div>
	{/if}
</aside>

<style lang="scss">
	aside {
		padding: 14px 18px;
		overflow: auto;
		display: flex;
		flex-direction: column;
		gap: 12px;
		min-width: 0;
	}
	.preview {
		height: 350px;
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
		.folder,
		.doc {
			display: block;
			height: 70px;
			width: auto;
			.hi {
				fill: var(--m-accent);
			}
			.lo {
				fill: #886940; /* fallback */
				@supports (color: color-mix(in srgb, red, blue)) {
					fill: color-mix(in srgb, var(--m-accent) 50%, var(--m-bg, #1f1c28));
				}
			}
		}
		img {
			max-width: 100%;
			max-height: 100%;
			object-fit: contain;
			border-radius: 3px;
		}
	}
	.name {
		font-size: 15px;
		font-weight: 700;
		color: var(--m-text-strong);
		word-break: break-all;
	}
	dl {
		margin: 0;
		display: grid;
		grid-template-columns: 84px minmax(0, 1fr);
		row-gap: 2px;
	}
	dt {
		color: var(--m-muted);
	}
	dd {
		margin: 0;
	}
	.ok {
		color: var(--m-ok);
	}
	.break {
		word-break: break-all;
	}
	.muted {
		color: var(--m-muted);
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin-top: auto;
	}
	.bottom {
		margin-top: 0;
	}
	.chips button {
		background: none;
		border: 1px solid var(--m-line);
		border-radius: 4px;
		padding: 0 8px;
		font: inherit;
		color: var(--m-text);
		cursor: pointer;
		&:hover {
			border-color: var(--m-dim);
		}
		&.danger {
			color: var(--m-danger);
		}
	}
	kbd {
		font: inherit;
		color: var(--m-accent);
	}
	.sheet-close {
		display: none;
	}

	@media (max-width: 899px) {
		aside {
			display: none;
			position: fixed;
			left: 0;
			right: 0;
			bottom: 0;
			max-height: 70vh;
			z-index: 20;
			background: var(--m-panel);
			border-top: 1px solid var(--m-line);
			border-radius: 10px 10px 0 0;
			box-shadow: 0 -8px 24px rgb(0 0 0 / 0.5);

			&.open {
				display: flex;
			}
		}
		.desktop-only {
			display: none;
		}
		.sheet-close {
			display: block;
			align-self: flex-end;
			background: none;
			border: 0;
			color: var(--m-muted);
			font: inherit;
			cursor: pointer;
			padding: 4px 8px;
		}
	}
</style>
