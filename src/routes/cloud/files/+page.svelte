<script lang="ts">
	import './files.scss';
	import { invalidateAll } from '$app/navigation';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let menuOpen = $state<string | null>(null);
	let renaming = $state<string | null>(null);
	let renameValue = $state('');

	let fileInput: HTMLInputElement = $state()!;

	type UploadPhase = 'idle' | 'uploading' | 'saving' | 'done' | 'error';
	let uploadPhase = $state<UploadPhase>('idle');
	let uploadPercent = $state(0);
	let savingFilename = $state('');
	let savingIndex = $state(0);
	let savingTotal = $state(0);
	let uploadError = $state('');

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

	function handleFileSelect() {
		if (!fileInput.files?.length) return;

		const formData = new FormData();
		formData.append('path', data.path);
		for (const file of fileInput.files) {
			formData.append('files', file);
		}
		fileInput.value = '';

		uploadPhase = 'uploading';
		uploadPercent = 0;

		const xhr = new XMLHttpRequest();
		xhr.open('POST', '/cloud/files/upload');

		xhr.upload.onprogress = (e) => {
			if (e.lengthComputable) {
				uploadPercent = Math.round((e.loaded / e.total) * 100);
			}
		};

		xhr.onload = () => {
			const { uploadId } = JSON.parse(xhr.responseText);
			uploadPhase = 'saving';

			const es = new EventSource(`/cloud/files/upload-progress?id=${uploadId}`);

			es.onmessage = (e) => {
				const event = JSON.parse(e.data);
				if (event.type === 'saving') {
					savingFilename = event.filename;
					savingIndex = event.index + 1;
					savingTotal = event.total;
				} else if (event.type === 'complete') {
					uploadPhase = 'done';
					es.close();
					setTimeout(() => {
						uploadPhase = 'idle';
						invalidateAll();
					}, 1200);
				} else if (event.type === 'error') {
					uploadPhase = 'error';
					uploadError = event.message;
					es.close();
				}
			};

			es.onerror = () => {
				uploadPhase = 'error';
				uploadError = 'connection lost';
				es.close();
			};
		};

		xhr.onerror = () => {
			uploadPhase = 'error';
			uploadError = 'upload failed';
		};

		xhr.send(formData);
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
				<div>
					<button class="upload-btn" type="button" onclick={triggerUpload}>Upload</button>
				</div>
			</div>

        <input type="file" name="files" multiple bind:this={fileInput} onchange={handleFileSelect} style="display:none" />

			{#if uploadPhase !== 'idle'}
				<div class="upload-banner">
					{#if uploadPhase === 'uploading'}
						<span class="banner-label">uploading... {uploadPercent}%</span>
						<div class="progress-bar"><div class="progress-fill" style="width:{uploadPercent}%"></div></div>
					{:else if uploadPhase === 'saving'}
						<span class="banner-label">saving to cloud</span>
						<span class="banner-filename">{savingFilename}{savingTotal > 1 ? ` (${savingIndex}/${savingTotal})` : ''}</span>
					{:else if uploadPhase === 'done'}
						<span class="banner-label">done</span>
					{:else if uploadPhase === 'error'}
						<span class="banner-label error-text">{uploadError}</span>
						<button class="banner-dismiss" onclick={() => uploadPhase = 'idle'}>dismiss</button>
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

		{#each data.files as file}
			<div class="row">
				{#if renaming === file.filename}
					<form class="rename-form" method="POST" action="?/rename">
						<input type="hidden" name="returnPath" value={data.path} />
						<input type="hidden" name="path" value={file.filename} />
						<input class="rename-input" name="newName" bind:value={renameValue} />
						<button type="submit" class="rename-confirm">ok</button>
						<button type="button" class="rename-cancel" onclick={cancelRename}>cancel</button>
					</form>
				{:else if file.type === 'directory'}
					<a class="entry dir" href="/cloud/files?path={encodeURIComponent(file.filename)}"
						>{file.basename}/</a
					>
				{:else}
					<a
						class="entry file"
						href="/cloud/file?path={encodeURIComponent(file.filename)}"
						target="_blank">{file.basename}</a
					>
				{/if}

				{#if renaming !== file.filename}
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
