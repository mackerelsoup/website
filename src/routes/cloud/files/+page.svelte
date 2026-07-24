<script lang="ts">
	import './files.scss';
	import type { PageProps } from './$types';
	import { UploadManager } from './upload.svelte';
	import IconPlay from '~icons/tdesign/play';
	import IconPause from '~icons/gg/play-pause';
	import { onMount } from 'svelte';

	let { data }: PageProps = $props();
	// --- cloud disk space ---
	let diskSpace = $state<{
		totalBytes: number;
		usedBytes: number;
		freeBytes: number;
		checkedAt: number;
	} | null>(null);
	let diskSpaceError = $state<string | null>(null);
	let diskSpacePercent = $derived(
		diskSpace ? Math.round((diskSpace.usedBytes / diskSpace.totalBytes) * 100) : 0
	);

	async function fetchDiskSpace() {
		try {
			const res = await fetch('https://homelab.tail3fdd8a.ts.net:8080/cloud/api/disk-space');
			const body = await res.json();
			if (!res.ok) {
				diskSpaceError = body.error ?? `HTTP ${res.status}`;
				return;
			}
			diskSpace = body;
			diskSpaceError = null;
		} catch (e) {
			diskSpaceError = e instanceof Error ? e.message : String(e);
		}
	}

	onMount(() => {
		fetchDiskSpace();
		const interval = setInterval(fetchDiskSpace, 60_000);
		return () => clearInterval(interval);
	});

	// --- navigation ---
	// strips the last path segment to get the parent directory URL
	function parentPath(path: string): string {
		const parts = path.replace(/\/$/, '').split('/');
		parts.pop();
		return parts.join('/') || '/';
	}

	// --- dropdown "..." menu ---
	let menuOpen = $state<string | null>(null);

	// opens the menu for a row, or closes it if already open
	function toggleMenu(filename: string) {
		menuOpen = menuOpen === filename ? null : filename;
	}

	// closes whatever menu is currently open (used by the background overlay)
	function closeMenu() {
		menuOpen = null;
	}

	// --- rename ---
	let renaming = $state<string | null>(null); // filename of the row currently showing the rename input
	let renameValue = $state('');

	// opens the inline rename form for a row
	function startRename(filename: string, basename: string) {
		menuOpen = null;
		renaming = filename;
		renameValue = basename;
	}

	// dismisses the rename form without submitting
	function cancelRename() {
		renaming = null;
	}

	// --- multi-select (checkboxes + bulk delete) ---
	let selecting = $state(false);
	let selected = $state(new Set<string>());
	let lastSelectedIndex = $state<number | null>(null); // anchor for shift-click range select

	// enters select mode and clears any previous selection
	function enterSelect() {
		selecting = true;
		selected = new Set();
		lastSelectedIndex = null;
		menuOpen = null;
	}

	// exits select mode and clears the selection
	function exitSelect() {
		selecting = false;
		selected = new Set();
		lastSelectedIndex = null;
	}

	// toggles a single row; shift-click extends the selection from the last touched row
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

	// --- upload ---
	let uploading = $state(false); // controls whether the file/folder picker buttons are shown
	let fileInput: HTMLInputElement = $state()!;
	let folderInput: HTMLInputElement = $state()!;

	const upload = new UploadManager();

	// shows the upload picker buttons in the toolbar
	function startUploading() {
		uploading = true;
	}

	// hides the upload picker buttons (e.g. on cancel or Escape)
	function stopUploading() {
		uploading = false;
	}

	// opens the hidden <input type="file"> for individual files
	function triggerUpload() {
		fileInput.click();
	}

	// opens the hidden <input type="file" webkitdirectory> for whole folders
	function triggerFolderUpload() {
		folderInput.click();
	}

	function triggerPause() {
		upload.pause();
	}

	function triggerUnpause() {
		upload.resume();
	}
</script>

<svelte:window
	onkeydown={(e) => {
		if (e.key === 'Escape') {
			if (selecting) exitSelect();
			stopUploading();
		}
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
									<input
										type="hidden"
										name="isDirectory"
										value={data.files.find((f) => f.filename === path)?.type === 'directory'}
									/>
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

			<div class="disk-space-banner">
				{#if !diskSpaceError}
					<div class="disk-space-bar">
						<div class="disk-space-fill" style="width:{diskSpacePercent}%"></div>
					</div>
					<span class="disk-space-used">{diskSpacePercent}% used</span>
				{:else}
					<div>{diskSpaceError}</div>
				{/if}
			</div>

			{#if upload.phase !== 'idle'}
				<div class="upload-banner">
					{#if upload.phase === 'uploading'}
						{#if upload.paused}
							<span class="banner-label">Upload paused</span>
							<div class="progress-bar">
								<div class="progress-fill" style="width:{upload.percent}%"></div>
							</div>
							<button class="pause-play-btn" onclick={triggerUnpause}>
								<IconPlay></IconPlay>
							</button>
						{:else}
							<span class="banner-label">uploading... {upload.percent}%</span>
							<span class="banner-filename"
								>{upload.uploadingFilename}{upload.uploadingTotal > 1
									? ` (${upload.uploadingIndex}/${upload.uploadingTotal})`
									: ''}</span
							>
							<div class="progress-bar">
								<div class="progress-fill" style="width:{upload.percent}%"></div>
							</div>
							<button class="pause-play-btn" onclick={triggerPause}>
								<IconPause></IconPause>
							</button>
						{/if}
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
						<input type="hidden" name="isDirectory" value={file.type === 'directory'} />
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
									<input type="hidden" name="isDirectory" value={file.type === 'directory'} />
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
