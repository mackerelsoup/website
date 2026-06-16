<script lang="ts">
	import './files.scss';
	import { invalidateAll } from '$app/navigation';
	import { tick } from 'svelte';
	import type { PageProps } from './$types';
	import { computeTransferId, totalChunks, CHUNK_SIZE } from '$lib/upload-constants';

	let { data }: PageProps = $props();

	let menuOpen = $state<string | null>(null);
	let renaming = $state<string | null>(null);
	let renameValue = $state('');

	let selecting = $state(false);
	let selected = $state(new Set<string>());
	let lastSelectedIndex = $state<number | null>(null);

	let uploading = $state(false);

	function enterSelect() {
		selecting = true;
		selected = new Set();
		lastSelectedIndex = null;
		menuOpen = null;
	}

	function exitSelect() {
		selecting = false;
		selected = new Set();
		lastSelectedIndex = null;
	}

	function startUploading() {
		uploading = true;
	}

	function stopUploading() {
		uploading = false;
	}

	function toggleSelect(filename: string, index: number, shiftKey: boolean) {
		const next = new Set(selected);
		if (shiftKey && lastSelectedIndex !== null) {
			const lo = Math.min(lastSelectedIndex, index);
			const hi = Math.max(lastSelectedIndex, index);
			const adding = !next.has(filename);
			for (let i = lo; i <= hi; i++) {
				const f = data.files[i].filename;
				if (adding) next.add(f);
				else next.delete(f);
			}
		} else {
			if (next.has(filename)) next.delete(filename);
			else next.add(filename);
			lastSelectedIndex = index;
		}
		selected = next;
	}

	let fileInput: HTMLInputElement = $state()!;
	let folderInput: HTMLInputElement = $state()!;

	function triggerFolderUpload() {
		folderInput.click();
	}

	type UploadPhase = 'idle' | 'uploading' | 'saving' | 'done' | 'error';
	let uploadPhase = $state<UploadPhase>('idle');
	let uploadPercent = $state(0);
	let savingFilename = $state('');
	let savingStatus = $state<'saving' | 'saved'>('saving');
	let savingIndex = $state(0);
	let savingTotal = $state(0);
	let uploadError = $state('');
	let uploadingFilename = $state('');
	let uploadingIndex = $state(0);
	let uploadingTotal = $state(0);

	function parentPath(path: string): string {
		const parts = path.replace(/\/$/, '').split('/');
		parts.pop();
		return parts.join('/') || '/';
	}

	function closeMenu() {
		menuOpen = null;
	}

	function toggleMenu(filename: string) {
		menuOpen = menuOpen === filename ? null : filename;
	}

	function triggerUpload() {
		fileInput.click();
	}

	async function startUpload(files: FileList, useRelativePaths = false) {
		const uploadId = crypto.randomUUID(); // ephemeral, SSE-only — not the transferId
		const fileList = [...files];

		const es = new EventSource(`/cloud/files/upload-progress?id=${uploadId}`);
		es.onmessage = (e) => {
			const ev = JSON.parse(e.data);
			if (ev.type === 'saving') {
				uploadPhase = 'saving';
				savingFilename = ev.filename;
				savingIndex = ev.index + 1;
				savingTotal = ev.total;
			} else if (ev.type === 'complete') {
				uploadPhase = 'done';
				es.close();
				setTimeout(() => {
					uploadPhase = 'idle';
					invalidateAll();
				}, 1200);
			} else if (ev.type === 'error') {
				uploadPhase = 'error';
				uploadError = ev.message;
				es.close();
			}
		};

		await tick();

		uploadingTotal = fileList.length;

		for (let f = 0; f < fileList.length; f++) {
			uploadPhase = 'uploading';
			const file = fileList[f];
			const filename = useRelativePaths ? file.webkitRelativePath || file.name : file.name;
			uploadingFilename = filename;
			uploadingIndex = f + 1;
			uploadPercent = 0;

			const transferId = await computeTransferId(data.path, filename, file.size, file.lastModified);
			const total = totalChunks(file.size);

			// 2. idempotent init → which chunks server already has
			const initRes = await fetch('/cloud/files/upload/init', {
				method: 'POST',
				body: JSON.stringify({
					uploadId,
					transferId,
					destPath: data.path,
					filename,
					size: file.size,
					totalChunks: total
				})
			});
			const { received } = await initRes.json();
			//This is the number of chunks that are on the temp folder in the server
			const have = new Set<number>(received);

			let confirmed = have.size;
			uploadPercent = Math.round((confirmed / total) * 100);

			// 3. upload missing chunks sequentially
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

				//Each chunk will have a 2 retry count
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
					} catch (e) {
						attempts++;
						if (attempts >= 2) {
							// re-init: server may have restarted, refresh `have` and restart the chunk loop
							// Don't do this first
						}
						await new Promise((r) => setTimeout(r, 500 * attempts)); // backoff
					}
				}

				uploadPercent = Math.round((confirmed / total) * 100); // client-driven, no SSE
			}
		}
	}

	function startRename(filename: string, basename: string) {
		menuOpen = null;
		renaming = filename;
		renameValue = basename;
	}

	function cancelRename() {
		renaming = null;
	}
</script>

<svelte:window
	onkeydown={(e) => {
		if (e.key === 'Escape' && selecting) exitSelect();
		stopUploading();
	}}
/>

<div class="files">
	{#if menuOpen}
		<button class="overlay" aria-label="Close menu" onclick={closeMenu}></button>
	{/if}
	{#if data.error}
		<div class="prompt">
			<span class="prompt-user">zt@homelab:</span><span class="prompt-path">{data.path}</span>
		</div>
		<p class="error">connection refused</p>
	{:else}
		<div>
			<div class="prompt">
				<div>
					<span class="prompt-user">zt@homelab:</span><span class="prompt-path">{data.path}</span>
				</div>
				<div class="prompt-actions">
					{#if selecting}
						<button type="button" class="upload-btn" onclick={exitSelect}>cancel</button>
						{#if selected.size > 0}
							<form method="POST" action="?/deleteMany">
								<input type="hidden" name="returnPath" value={data.path} />
								{#each [...selected] as path}
									<input type="hidden" name="path" value={path} />
								{/each}
								<button type="submit" class="delete-btn">delete ({selected.size})</button>
							</form>
						{/if}
					{:else if uploading}
						<button type="button" class="upload-btn" onclick={stopUploading}>cancel</button>
						<button class="upload-btn" type="button" onclick={triggerFolderUpload}>folder</button>
						<button class="upload-btn" type="button" onclick={triggerUpload}>files</button>
					{:else}
						<button type="button" class="upload-btn" onclick={enterSelect}>select</button>
						<button type="button" class="upload-btn" onclick={startUploading}>upload</button>
					{/if}
				</div>
			</div>

			<input
				type="file"
				name="files"
				multiple
				bind:this={fileInput}
				onchange={() => {
					if (fileInput.files?.length) {
						startUpload(fileInput.files);
						fileInput.value = '';
					}
				}}
				style="display:none"
			/>
			<input
				type="file"
				name="files"
				multiple
				webkitdirectory
				bind:this={folderInput}
				onchange={() => {
					if (folderInput.files?.length) {
						startUpload(folderInput.files, true);
						folderInput.value = '';
					}
				}}
				style="display:none"
			/>

			{#if uploadPhase !== 'idle'}
				<div class="upload-banner">
					{#if uploadPhase === 'uploading'}
						<span class="banner-label">uploading... {uploadPercent}%</span>
						<span class="banner-filename"
							>{uploadingFilename}{uploadingTotal > 1 ? ` (${uploadingIndex}/${uploadingTotal})` : ''}</span
						>
						<div class="progress-bar">
							<div class="progress-fill" style="width:{uploadPercent}%"></div>
						</div>
					{:else if uploadPhase === 'saving'}
						<span class="banner-label">saving to cloud</span>
						<span class="banner-filename"
							>{savingFilename}{savingTotal > 1 ? ` (${savingIndex}/${savingTotal})` : ''}</span
						>
					{:else if uploadPhase === 'done'}
						<span class="banner-label">done</span>
					{:else if uploadPhase === 'error'}
						<span class="banner-label error-text">{uploadError}</span>
						<button class="banner-dismiss" onclick={() => (uploadPhase = 'idle')}>dismiss</button>
					{/if}
				</div>
			{/if}
		</div>

		{#if data.path !== '/'}
			<div class="row">
				<a class="entry dir" href="/cloud/files?path={encodeURIComponent(parentPath(data.path))}"
					>..</a
				>
			</div>
		{/if}

		{#each data.files as file, i}
			<div class="row" class:row-selected={selected.has(file.filename)}>
				{#if selecting}
					<input
						type="checkbox"
						class="select-check"
						checked={selected.has(file.filename)}
						onclick={(e) => toggleSelect(file.filename, i, e.shiftKey)}
					/>
				{/if}

				{#if renaming === file.filename}
					<form class="rename-form" method="POST" action="?/rename">
						<input type="hidden" name="returnPath" value={data.path} />
						<input type="hidden" name="path" value={file.filename} />
						<input class="rename-input" name="newName" bind:value={renameValue} />
						<button type="submit" class="rename-confirm">ok</button>
						<button type="button" class="rename-cancel" onclick={cancelRename}>cancel</button>
					</form>
				{:else if file.type === 'directory'}
					<a
						class="entry dir"
						href="/cloud/files?path={encodeURIComponent(file.filename)}"
						onclick={selecting
							? (e) => {
									e.preventDefault();
									toggleSelect(file.filename, i, e.shiftKey);
								}
							: undefined}>{file.basename}/</a
					>
				{:else}
					<a
						class="entry file"
						href="/cloud/file?path={encodeURIComponent(file.filename)}"
						target="_blank"
						onclick={selecting
							? (e) => {
									e.preventDefault();
									toggleSelect(file.filename, i, e.shiftKey);
								}
							: undefined}>{file.basename}</a
					>
				{/if}

				{#if !selecting && renaming !== file.filename}
					<div class="menu-wrapper">
						<button class="dots" onclick={() => toggleMenu(file.filename)}>...</button>
						{#if menuOpen === file.filename}
							<div class="dropdown">
								<button onclick={() => startRename(file.filename, file.basename)}>rename</button>
								<form method="POST" action="?/delete">
									<input type="hidden" name="path" value={file.filename} />
									<input type="hidden" name="returnPath" value={data.path} />
									<button type="submit" class="delete">delete</button>
								</form>
							</div>
						{/if}
					</div>
				{/if}
			</div>
		{/each}
	{/if}
</div>
