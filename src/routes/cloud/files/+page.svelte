<script lang="ts">
	import type { PageProps } from './$types';
	import type { FileStat } from 'webdav';
	import { UploadManager } from './upload.svelte';
	import { onMount, tick } from 'svelte';
	import { goto } from '$app/navigation';
	import Modal from './folder-modal.svelte';
	import Header from './components/Header.svelte';
	import ParentPane from './components/ParentPane.svelte';
	import ListPane from './components/ListPane.svelte';
	import PreviewPane from './components/PreviewPane.svelte';
	import StatusBar from './components/StatusBar.svelte';
	import UploadBlock from './components/UploadBlock.svelte';
	import SelectBlock from './components/SelectBlock.svelte';
	import HelpOverlay from './components/HelpOverlay.svelte';
	import { parentPath, neighborImages } from './format';

	let { data, form }: PageProps = $props();

	const upload = new UploadManager();
	const access = $derived(data.accessLevel as 'view' | 'edit' | null);
	const canEdit = $derived(access === 'edit');

	// --- the list: folders first, narrowed by the filter box ---
	let filter = $state('');
	let filterEl = $state<HTMLInputElement>();
	const rows = $derived(
		[...(data.files as FileStat[])]
			.sort((a, b) =>
				a.type === b.type ? a.basename.localeCompare(b.basename) : a.type === 'directory' ? -1 : 1
			)
			.filter((f) => f.basename.toLowerCase().includes(filter.trim().toLowerCase()))
	);

	// --- cursor (the highlighted row) ---
	let cursorRaw = $state(0);
	const cursor = $derived(Math.max(0, Math.min(cursorRaw, rows.length - 1)));
	const cur = $derived<FileStat | null>(rows[cursor] ?? null);

  $effect(() => {
          const imgs = neighborImages(rows, cursor).map((f) => {
                  const img = new Image();
                  img.src = `/cloud/file?path=${encodeURIComponent(f.filename)}`;
                  return img;
          });
          return () => imgs.forEach((img) => (img.src = ''));
  });

	// --- modes & transient UI state ---
	let selecting = $state(false);
	let selected = $state(new Set<string>());
	let anchor = $state<number | null>(null); // anchor for shift range select
	let renaming = $state<string | null>(null);
	let renameValue = $state('');
	let confirming = $state(false); // delete confirm step (keyboard + sheet)
	let helpOpen = $state(false);
	let sheetOpen = $state(false); // bottom-sheet preview on narrow screens
	let copied = $state(false);
	let showModal = $state(false);
	let fileInput: HTMLInputElement | undefined = $state();
	let folderInput: HTMLInputElement | undefined = $state();

	const mode = $derived(selecting ? 'select' : upload.phase !== 'idle' ? 'upload' : 'normal');
	const position = $derived(
		selecting
			? `${selected.size} of ${rows.length}`
			: `${rows.length ? cursor + 1 : 0} of ${rows.length}`
	);
	const selectedBytes = $derived(
		(data.files as FileStat[]).reduce((n, f) => n + (selected.has(f.filename) ? f.size : 0), 0)
	);

	// a new folder starts with a clean slate
	$effect.pre(() => {
		void data.path;
		cursorRaw = 0;
		filter = '';
		selecting = false;
		selected = new Set();
		anchor = null;
		renaming = null;
		confirming = false;
		sheetOpen = false;
	});

	function exitSelect() {
		selecting = false;
		selected = new Set();
		anchor = null;
		confirming = false;
	}

	function enterSelect() {
		selecting = true;
		selected = new Set();
		anchor = null;
	}

	// toggles a row; shift extends a range from the last touched row
	function toggleSelect(i: number, shift: boolean) {
		const next = new Set(selected);
		const name = rows[i].filename;
		if (shift && anchor !== null) {
			const adding = !next.has(name);
			for (let j = Math.min(anchor, i); j <= Math.max(anchor, i); j++) {
				if (adding) next.add(rows[j].filename);
				else next.delete(rows[j].filename);
			}
		} else {
			if (next.has(name)) next.delete(name);
			else next.add(name);
			anchor = i;
		}
		selected = next;
	}

	async function move(delta: number, extend = false) {
		if (!rows.length) return;
		const to = Math.max(0, Math.min(cursor + delta, rows.length - 1));
		if (extend && canEdit) {
			if (!selecting) enterSelect();
			if (anchor === null) {
				anchor = cursor;
				selected = new Set(selected).add(rows[cursor].filename);
			}
			const next = new Set(selected);
			for (let j = Math.min(anchor, to); j <= Math.max(anchor, to); j++) next.add(rows[j].filename);
			selected = next;
		}
		cursorRaw = to;
		await tick();
		document.getElementById(`row-${to}`)?.focus();
	}

	function open(f: FileStat | null = cur) {
		if (!f) return;
		if (f.type === 'directory') goto(`/cloud/files?path=${encodeURIComponent(f.filename)}`);
		else window.open(`/cloud/file?path=${encodeURIComponent(f.filename)}`, '_blank', 'noopener');
	}

	function up() {
		if (data.path !== '/') goto(`/cloud/files?path=${encodeURIComponent(parentPath(data.path))}`);
	}

	function startRename() {
		if (!canEdit || !cur) return;
		sheetOpen = false;
		renaming = cur.filename;
		renameValue = cur.basename;
	}

	function askDelete() {
		if (!canEdit) return;
		if (selecting ? selected.size > 0 : cur) confirming = true;
	}

	function confirmDelete() {
		(
			document.getElementById(selecting ? 'delete-many' : 'delete-one') as HTMLFormElement
		)?.requestSubmit();
	}

	async function copyLink() {
		if (!cur || cur.type !== 'file') return;
		const url = `${location.origin}/cloud/file?path=${encodeURIComponent(cur.filename)}`;
		try {
			await navigator.clipboard.writeText(url);
		} catch {
			// navigator.clipboard needs a secure context; this site may be served over plain http
			const ta = document.createElement('textarea');
			ta.value = url;
			document.body.append(ta);
			ta.select();
			document.execCommand('copy');
			ta.remove();
		}
		copied = true;
		setTimeout(() => (copied = false), 1500);
	}

	function onkeydown(e: KeyboardEvent) {
		if (e.ctrlKey || e.metaKey || e.altKey || showModal) return;
		const t = e.target as HTMLElement;
		// never act while typing; the inputs handle their own Escape/Enter
		if (t.closest('input, textarea, select, [contenteditable="true"]')) return;
		// leave Enter/space to focused buttons and plain links (but not list rows)
		if ((e.key === 'Enter' || e.key === ' ') && t.closest('button, a:not([data-row])')) return;

		if (e.key === 'Escape') {
			if (confirming) confirming = false;
			else if (helpOpen) helpOpen = false;
			else if (sheetOpen) sheetOpen = false;
			else if (renaming) renaming = null;
			else if (selecting) exitSelect();
			else filter = '';
			return;
		}
		if (helpOpen) {
			if (e.key === '?') helpOpen = false;
			return;
		}
		if (confirming) {
			e.preventDefault();
			if (e.key === 'y' || e.key === 'Enter') confirmDelete();
			else confirming = false;
			return;
		}

		const key = e.key;
		const run = (fn: () => void) => {
			e.preventDefault();
			fn();
		};
		switch (key) {
			case 'j':
			case 'ArrowDown':
				return run(() => move(1));
			case 'k':
			case 'ArrowUp':
				return run(() => move(-1));
			case 'J':
				return run(() => move(1, true));
			case 'K':
				return run(() => move(-1, true));
			case 'l':
			case 'o':
			case 'Enter':
				return run(() => open());
			case 'h':
			case 'Backspace':
				return run(up);
			case '/':
				return run(() => filterEl?.focus());
			case '?':
				return run(() => (helpOpen = true));
			case 'y':
				return run(copyLink);
			case 'p':
				if (upload.phase === 'uploading')
					run(() => (upload.paused ? upload.resume() : upload.pause()));
				return;
		}
		if (!canEdit) return;
		switch (key) {
			case ' ':
				return run(() => {
					if (!selecting) enterSelect();
					if (cur) toggleSelect(cursor, false);
				});
			case 'a':
				return run(() => {
					if (!selecting) enterSelect();
					selected = new Set(rows.map((f) => f.filename));
				});
			case 'u':
				return run(() => fileInput?.click());
			case 'U':
				return run(() => folderInput?.click());
			case 'r':
				return run(startRename);
			case 'd':
				return run(askDelete);
			case 'n':
				return run(() => (showModal = true));
		}
	}

	onMount(() => {
		// sheet is only meaningful on narrow screens; drop it when the viewport widens
		const mq = matchMedia('(max-width: 899px)');
		const onChange = () => !mq.matches && (sheetOpen = false);
		mq.addEventListener('change', onChange);
		return () => mq.removeEventListener('change', onChange);
	});
</script>

<svelte:window {onkeydown} />

<div class="files">
	<Modal bind:showModal path={data.path} />
	<Header accessLevel={access} />

	{#if data.requestState === 'pending'}
		<p class="notice">folder request pending approval</p>
	{:else if data.requestState === 'eligible'}
		<form class="notice request" method="POST" action="?/requestFolder">
			<label for="folder-request-name">request a folder:</label>
			<input
				id="folder-request-name"
				name="name"
				maxlength="64"
				placeholder="folder name"
				required
				autocomplete="off"
			/>
			<button type="submit">request</button>
		</form>
	{/if}
	{#if form?.message}
		<p class="notice" class:bad={!form.success} role="status">{form.message}</p>
	{/if}

	{#if canEdit && !data.error}
		<div class="toolbar">
			{#if selecting}
				<button type="button" onclick={exitSelect}>cancel</button>
				{#if selected.size > 0}
					<button type="button" class="danger" onclick={askDelete}>delete ({selected.size})</button>
				{/if}
			{:else}
				<button type="button" onclick={enterSelect}>select</button>
				<button type="button" onclick={() => fileInput?.click()}>upload files</button>
				<button type="button" onclick={() => folderInput?.click()}>upload folder</button>
				<button type="button" onclick={() => (showModal = true)}>new folder</button>
			{/if}
		</div>
	{/if}

	{#if upload.phase !== 'idle' || selecting}
		<div class="mobile-only stack">
			<UploadBlock {upload} />
			{#if selecting}
				<SelectBlock
					count={selected.size}
					bytes={selectedBytes}
					{confirming}
					oncancel={() => (confirming ? (confirming = false) : exitSelect())}
					ondelete={askDelete}
				/>
			{/if}
		</div>
	{/if}

	{#if data.error}
		<p class="error">connection refused</p>
	{:else}
		<div class="body">
			<ParentPane path={data.path} siblings={data.siblings} />
			<ListPane
				{rows}
				total={data.files.length}
				path={data.path}
				{cursor}
				{selected}
				{selecting}
				{renaming}
				bind:renameValue
				bind:filter
				bind:filterEl
				onpick={(i, e) => (selecting ? toggleSelect(i, e.shiftKey) : (cursorRaw = i))}
				onopen={(i) => open(rows[i])}
				onmenu={(i) => {
					cursorRaw = i;
					sheetOpen = true;
				}}
				oncancelRename={() => (renaming = null)}
			/>
			<PreviewPane
				entry={cur}
				accessLevel={access}
				{upload}
				{selecting}
				selectedCount={selected.size}
				{selectedBytes}
				{confirming}
				{copied}
				{sheetOpen}
				onopen={() => open()}
				onrename={startRename}
				oncopy={copyLink}
				ondelete={askDelete}
				oncancelConfirm={() => (confirming = false)}
				onclose={() => {
					sheetOpen = false;
					confirming = false;
				}}
			/>
		</div>
	{/if}

	<StatusBar {mode} {position} {canEdit} />

	<!-- inside .files so it inherits the --m-* colour variables -->
	{#if helpOpen}
		<HelpOverlay {canEdit} onclose={() => (helpOpen = false)} />
	{/if}
</div>

<!-- forms behind the delete confirm step; submitted via requestSubmit() or `form=` buttons -->
{#if canEdit}
	<form id="delete-one" method="POST" action="?/delete" hidden>
		<input type="hidden" name="path" value={cur?.filename ?? ''} />
		<input type="hidden" name="isDirectory" value={cur?.type === 'directory'} />
		<input type="hidden" name="returnPath" value={data.path} />
	</form>
	<form id="delete-many" method="POST" action="?/deleteMany" hidden>
		<input type="hidden" name="returnPath" value={data.path} />
		{#each (data.files as FileStat[]).filter((f) => selected.has(f.filename)) as f (f.filename)}
			<input type="hidden" name="path" value={f.filename} />
			<input type="hidden" name="isDirectory" value={f.type === 'directory'} />
		{/each}
	</form>
{/if}

<input
	type="file"
	multiple
	bind:this={fileInput}
	tabindex="-1"
	aria-hidden="true"
	onchange={() => {
		if (fileInput?.files?.length) {
			upload.start(data.path, fileInput.files);
			fileInput.value = '';
		}
	}}
	style="display:none"
/>
<input
	type="file"
	multiple
	webkitdirectory
	bind:this={folderInput}
	tabindex="-1"
	aria-hidden="true"
	onchange={() => {
		if (folderInput?.files?.length) {
			upload.start(data.path, folderInput.files, true);
			folderInput.value = '';
		}
	}}
	style="display:none"
/>

<style lang="scss">
	// All colours for this page live here; components read them via var(--m-*).
	.files {
		--m-ground: #12131c;
		--m-panel: #171826;
		--m-line: #2b2e45;
		--m-text: #c9cbe0;
		--m-text-strong: #e6e7f5;
		--m-muted: #8a90b3;
		--m-dim: #4a4f70; // decorative only, never text
		--m-selected: #23253a;
		--m-selected-danger: #2a2630;
		--m-accent: #f2b659;
		--m-ok: #7fd6a4;
		--m-danger: #ff7a8a;

		box-sizing: border-box;
		height: 100dvh;
		padding: 20px 24px 16px;
		display: flex;
		flex-direction: column;
		gap: 14px;
		background: var(--m-ground);
		color: var(--m-text);
		font-family: 'JetBrains Mono', 'Cascadia Code', 'Fira Code', monospace;
		font-size: 13px;
		line-height: 1.55;

	}

	.body {
		flex: 1;
		min-height: 0;
		display: grid;
		grid-template-columns: 200px minmax(0, 1fr) 360px;		border: 1px solid var(--m-line);
		border-radius: 6px;
		overflow: hidden;
		background: var(--m-panel);
	}

	.notice {
		margin: 0;
		color: var(--m-muted);

		&.bad {
			color: var(--m-danger);
		}
	}
	.error {
		margin: 0;
		color: var(--m-danger);
		flex: 1;
	}
	.request {
		display: flex;
		align-items: center;
		gap: 8px;
		input {
			background: transparent;
			border: 0;
			border-bottom: 1px solid var(--m-line);
			color: var(--m-text);
			font: inherit;
			padding: 0 4px;
			&:focus {
				outline: none;
				border-bottom-color: var(--m-accent);
			}
		}
		button {
			background: none;
			border: 0;
			color: var(--m-accent);
			font: inherit;
			cursor: pointer;
		}
	}

	.toolbar {
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		gap: 4px 14px;
		margin: -6px 0;
		button {
			background: none;
			border: 0;
			padding: 0;
			font: inherit;
			color: var(--m-muted);
			cursor: pointer;
			border-radius: 3px;
			&:hover {
				color: var(--m-text-strong);
			}
			&.danger {
				color: var(--m-danger);
			}
		}
	}

	.mobile-only {
		display: none;
	}

	@media (max-width: 899px) {
		.files {
			padding: 14px 16px 12px;
			overflow-x: hidden;
		}
		.body {
			grid-template-columns: minmax(0, 1fr);
		}
		.mobile-only {
			display: flex;
			flex-direction: column;
			gap: 8px;
		}
	}
</style>
