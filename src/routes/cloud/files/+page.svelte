<script lang="ts">
	import type { PageProps } from './$types';
	import { UploadManager } from './upload.svelte';
	import IconPlay from '~icons/tdesign/play';
	import IconPause from '~icons/gg/play-pause';
	import { onMount } from 'svelte';
	import Modal from './folder-modal.svelte';
	import {enhance} from '$app/forms'

	let { data, form }: PageProps = $props();
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
	let diskSpaceStatus = $derived(
		diskSpacePercent < 60 ? 'healthy' : diskSpacePercent < 85 ? 'warning' : 'critical'
	);

	function formatBytes(bytes: number): string {
		if (bytes < 1024) return `${bytes}B`;
		const units = ['KB', 'MB', 'GB', 'TB'];
		let value = bytes / 1024;
		let unitIndex = 0;
		while (value >= 1024 && unitIndex < units.length - 1) {
			value /= 1024;
			unitIndex++;
		}
		return `${value.toFixed(1)}${units[unitIndex]}`;
	}

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

	let creating = $state(false);
	let showModal = $state(false);
	let error = $state("")

	// shows the option to create a new file or folder
	function startCreating() {
		creating = true;
	}

	function stopCreating() {
		creating = false;
	}

	function createFolder() {
		showModal = true;
	}
</script>

<svelte:window
	onkeydown={(e) => {
		if (e.key === 'Escape') {
			if (selecting) exitSelect();
			stopUploading();
			stopCreating();
		}
	}}
/>

<Modal bind:showModal>
	<div class="head">
		<h2>New folder</h2>
		<p>Choose a name to get started.</p>
	</div>
	<form
		method="POST"
		action="?/createFolder"
		use:enhance={() =>
			async ({ result, update }) => {
				if (result.type === 'failure') {
					error = (result.data?.message as string) ?? 'Failed';
				} else {
					error = '';
					showModal = false;
					creating = false;
				}
				await update();
			}}
	>
		<input type="hidden" name="returnPath" value={data.path} />
		<input
			name="name"
			aria-label="Folder name"
			placeholder="Folder name"
			required
			pattern="\S.*"
			autocomplete="off"
		/>
		<button type="submit">Create</button>
	</form>
</Modal>

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
				{#if data.accessLevel === 'edit'}
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
						{:else if creating}
							<button type="button" class="upload-btn" onclick={stopCreating}>cancel</button>
							<button type="button" class="upload-btn" onclick={createFolder}>folder</button>
						{:else}
							<button type="button" class="upload-btn" onclick={enterSelect}>select</button>
							<button type="button" class="upload-btn" onclick={startUploading}>upload</button>
							<button type="button" class="upload-btn" onclick={startCreating}>new</button>
						{/if}
					</div>
				{/if}
			</div>

			{#if data.requestState === 'pending'}
				<p class="prompt">folder request pending approval</p>
			{:else if data.requestState === 'eligible'}
				<form class="rename-form" method="POST" action="?/requestFolder">
					<label for="folder-request-name">request a folder:</label>
					<input
						id="folder-request-name"
						class="rename-input"
						name="name"
						maxlength="64"
						placeholder="folder name"
						required
					/>
					<button type="submit" class="rename-confirm">request</button>
				</form>
			{/if}
			{#if form?.message}
				<p class={form.success ? 'prompt' : 'error'}>{form.message}</p>
			{/if}

			<div class="disk-space-banner">
				{#if !diskSpaceError}
					<div class="disk-space-bar">
						<div class="disk-space-fill {diskSpaceStatus}" style="width:{diskSpacePercent}%"></div>
					</div>
					<span class="disk-space-used {diskSpaceStatus}">{diskSpacePercent}% used</span>
				{:else}
					<div>{diskSpaceError}</div>
				{/if}
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
						{@const savingPercent =
							upload.savingTotal > 0
								? Math.round((upload.savingWritten / upload.savingTotal) * 100)
								: 0}
						<span class="banner-label">saving to cloud... {savingPercent}%</span>
						<span class="banner-filename"
							>{upload.savingFilename}{upload.savingTotal > 0
								? ` (${formatBytes(upload.savingWritten)}/${formatBytes(upload.savingTotal)})`
								: ''}</span
						>
						<div class="progress-bar">
							<div class="progress-fill" style="width:{savingPercent}%"></div>
						</div>
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
						<button class="dots" aria-label="actions for {file.basename}" aria-expanded={menuOpen === file.filename} onclick={() => toggleMenu(file.filename)}>...</button>
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

<style lang="scss">
	.files {
		font-family: var(--mono);
		background: var(--bg);
		color: var(--fg);
		min-height: 100vh;
		padding: 24px 32px;
		box-sizing: border-box;

		@media (max-width: 520px) {
			padding: 16px;
		}
	}

	.overlay {
		position: fixed;
		inset: 0;
		z-index: 51;
	}

	.error {
		color: var(--danger);
		font-size: 0.9rem;

		&::before {
			content: 'bash: ';
			color: var(--line-strong);
		}
	}

	// ---- prompt bar: path + upload/select/delete actions ----
	.prompt {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: center;
		row-gap: 8px;
		font-size: 0.95rem;
		margin-bottom: 8px;
		user-select: none;
	}

	.prompt-user,
	.prompt-path {
		color: var(--muted);
	}

	.prompt-actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 2px;
		form {
			display: contents;
		}
	}

	// shared bracketed text button: [ label ]
	.upload-btn,
	.delete-btn {
		background: none;
		border: 0;
		border-radius: 3px;
		color: var(--muted);
		font-family: inherit;
		font-size: 0.85rem;
		padding: 1px 5px;
		cursor: pointer;
		transition:
			background var(--fast),
			color var(--fast);

		&::before {
			content: '[ ';
		}
		&::after {
			content: ' ]';
		}

		&:hover {
			background: var(--raised);
			color: var(--fg);
		}
	}

	.delete-btn {
		color: var(--danger);

		&:hover {
			background: var(--danger-bg);
			color: var(--danger);
		}
	}

	// ---- disk space banner ----
	.disk-space-banner {
		display: flex;
		flex: 1;
		align-items: center;
		margin-bottom: 8px;
		font-size: 0.85rem;
		color: var(--muted);
	}

	.disk-space-bar {
		flex: 1;
		height: 6px;
		margin-right: 10px;
		border-radius: 75px;
		background: var(--raised);
		overflow: hidden;
	}

	.disk-space-fill {
		height: 100%;
		background: var(--muted);
		border-radius: 75px;
		transition:
			width 0.4s var(--ease-out),
			background var(--fast);

		&.healthy {
			background: #7a9e7e;
		}
		&.warning {
			background: #c9a15a;
		}
		&.critical {
			background: #c9636f;
		}
	}

	.disk-space-used {
		font-variant-numeric: tabular-nums;
	}

	// ---- upload progress banner ----
	.upload-banner {
		display: flex;
		align-items: center;
		gap: 8px;
		border-left: 1px solid var(--line-strong);
		padding: 5px 10px;
		margin-bottom: 12px;
		font-size: 0.85rem;
		color: var(--muted);
		font-variant-numeric: tabular-nums;
		animation: rise 0.25s var(--ease-out);
	}

	.pause-play-btn {
		font-size: 1.4rem; // controls icon size
		background: none;
		border: 0;
		border-radius: 3px;
		color: var(--muted);
		cursor: pointer;
		padding: 2px;
		display: flex;
		transition:
			background var(--fast),
			color var(--fast);

		&:hover {
			background: var(--raised);
			color: var(--fg);
		}
	}

	.banner-filename {
		color: var(--fg);
	}
	.error-text {
		color: var(--danger);
	}

	.banner-dismiss {
		background: none;
		border: 0;
		color: var(--muted);
		font-family: inherit;
		font-size: 0.85rem;
		cursor: pointer;
		padding: 0;
		transition: color var(--fast);

		&:hover {
			color: var(--fg);
		}
	}

	.progress-bar {
		flex: 1;
		height: 2px;
		background: var(--raised);
	}

	.progress-fill {
		height: 100%;
		background: var(--accent);
		transition: width 0.2s linear;
	}

	// ---- file/directory list rows ----
	.row {
		position: relative;
		display: flex;
		align-items: center;
		margin-bottom: 1px;
		border-radius: 3px;
		user-select: none;
		transition: background var(--fast);
	}

	.row-selected {
		background: var(--surface);
	}

	.entry {
		flex: 1;
		display: flex;
		align-items: center;
		padding: 2px 6px;
		border-radius: 3px;
		text-decoration: none;
		font-size: 0.95rem;
		transition: background var(--fast);

		&:hover {
			background: var(--raised);
		}
	}

	.dir {
		color: var(--muted);
		font-weight: bold;
	}
	.file {
		color: var(--fg);
	}

	.select-check {
		appearance: none;
		width: 12px;
		height: 12px;
		border: 1px solid var(--line-strong);
		border-radius: 2px;
		background: transparent;
		cursor: pointer;
		margin: 0 6px 0 4px;
		flex-shrink: 0;
		transition:
			background var(--fast),
			border-color var(--fast);

		&:checked {
			background: var(--accent);
			border-color: var(--accent);
		}
	}

	// ---- per-row "..." dropdown menu ----
	.dots {
		background: none;
		border: 0;
		border-radius: 3px;
		color: var(--muted);
		font-size: 0.9rem;
		cursor: pointer;
		padding: 2px 8px;
		line-height: 1;
		font-family: inherit;
		transition:
			color var(--fast),
			background var(--fast);

		&:hover {
			color: var(--fg);
			background: var(--raised);
		}
	}

	.menu-wrapper {
		position: relative;
	}

	.dropdown {
		position: absolute;
		right: 0;
		top: calc(100% + 2px);
		background: var(--raised);
		border: 1px solid var(--line-strong);
		border-radius: 4px;
		overflow: hidden;
		z-index: 100;
		min-width: 120px;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
		font-family: inherit;
		transform-origin: top right;
		animation: pop 0.15s var(--ease-out);

		button,
		form {
			display: block;
			width: 100%;
			margin: 0;
		}

		button {
			background: none;
			border: 0;
			color: var(--fg);
			padding: 7px 14px;
			text-align: left;
			cursor: pointer;
			font-size: 0.9rem;
			font-family: inherit;
			transition: background var(--fast);

			&:hover {
				background: var(--hover);
				color: var(--fg-strong);
			}
			&.delete {
				color: var(--danger);
			}
			&.delete:hover {
				background: var(--danger-bg);
			}
			&:focus-visible {
				outline-offset: -2px;
			}
		}
	}

	// ---- inline rename / request form (swapped in for a row's link) ----
	.rename-form {
		flex: 1;
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 2px 6px;
		font-size: 0.95rem;
		color: var(--muted);
	}

	.rename-input {
		flex: 1;
		min-width: 0;
		background: transparent;
		border: 0;
		border-bottom: 1px solid var(--line-strong);
		color: var(--fg);
		padding: 2px 4px;
		font-size: 0.95rem;
		font-family: inherit;
		transition: border-color var(--fast);

		&:focus {
			outline: none;
			border-bottom-color: var(--accent);
		}
		&::placeholder {
			color: var(--muted);
		}
	}

	.rename-confirm,
	.rename-cancel {
		background: none;
		border: 0;
		border-radius: 3px;
		cursor: pointer;
		padding: 2px 6px;
		font-size: 0.9rem;
		font-family: inherit;
		transition: background var(--fast);

		&:hover {
			background: var(--raised);
		}
	}

	.rename-confirm {
		color: var(--accent);
	}
	.rename-cancel {
		color: var(--danger);
	}

	@keyframes rise {
		from {
			opacity: 0;
			transform: translateY(-4px);
		}
	}
	@keyframes pop {
		from {
			opacity: 0;
			transform: scale(0.96);
		}
	}
</style>
