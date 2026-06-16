<script lang="ts">
	import './files.scss';
	import type { PageProps } from './$types';
	import { UploadManager } from './upload.svelte';

	let { data }: PageProps = $props();

	// --- dropdown "..." menu on each row ---
	let menuOpen = $state<string | null>(null);

	// --- inline rename form, swapped in for a row's link when active ---
	let renaming = $state<string | null>(null);
	let renameValue = $state('');

	// --- multi-select mode (checkboxes + bulk delete) ---
	let selecting = $state(false);
	let selected = $state(new Set<string>());
	let lastSelectedIndex = $state<number | null>(null); // anchor for shift-click range select

	// --- upload picker visibility (separate from the upload's own progress UI) ---
	let uploading = $state(false);

	const upload = new UploadManager();

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
						upload.start(data.path, fileInput.files);
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
						upload.start(data.path, folderInput.files, true);
						folderInput.value = '';
					}
				}}
				style="display:none"
			/>

			{#if upload.phase !== 'idle'}
				<div class="upload-banner">
					{#if upload.phase === 'uploading'}
						<span class="banner-label">uploading... {upload.percent}%</span>
						<span class="banner-filename"
							>{upload.uploadingFilename}{upload.uploadingTotal > 1
								? ` (${upload.uploadingIndex}/${upload.uploadingTotal})`
								: ''}</span
						>
						<div class="progress-bar">
							<div class="progress-fill" style="width:{upload.percent}%"></div>
						</div>
					{:else if upload.phase === 'saving'}
						<span class="banner-label">saving to cloud</span>
						<span class="banner-filename"
							>{upload.savingFilename}{upload.savingTotal > 1
								? ` (${upload.savingIndex}/${upload.savingTotal})`
								: ''}</span
						>
					{:else if upload.phase === 'done'}
						<span class="banner-label">done</span>
					{:else if upload.phase === 'error'}
						<span class="banner-label error-text">{upload.error}</span>
						<button class="banner-dismiss" onclick={() => upload.dismissError()}>dismiss</button>
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
