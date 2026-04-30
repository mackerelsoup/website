<script lang="ts">
	import './files.scss';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let menuOpen = $state<string | null>(null);
	let renaming = $state<string | null>(null);
	let renameValue = $state('');

	let fileInput: HTMLInputElement = $state()!;
	let uploadForm: HTMLFormElement = $state()!;

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
    if (fileInput.files?.length) {
      uploadForm.requestSubmit();
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

{#if menuOpen}
	<button class="overlay" aria-label="Close menu" onclick={closeMenu}></button>
{/if}

<div class="files">
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

        <form bind:this={uploadForm} method="POST" action="?/upload" enctype="multipart/form-data" style="display:none">
          <input type="hidden" name="path" value={data.path} />
          <input type="file" name="files" multiple bind:this={fileInput} onchange={handleFileSelect} />
        </form>
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
