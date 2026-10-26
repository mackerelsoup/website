<script lang="ts">
	import type { FileStat } from 'webdav';
	import { formatBytes, formatModified, parentPath } from '../format';

	let {
		rows,
		total,
		path,
		cursor,
		selected,
		selecting,
		renaming,
		renameValue = $bindable(),
		filter = $bindable(),
		filterEl = $bindable(),
		onpick,
		onopen,
		onmenu,
		oncancelRename
	}: {
		rows: FileStat[];
		total: number;
		path: string;
		cursor: number;
		selected: Set<string>;
		selecting: boolean;
		renaming: string | null;
		renameValue: string;
		filter: string;
		filterEl: HTMLInputElement | undefined;
		onpick: (i: number, e: MouseEvent) => void;
		onopen: (i: number) => void;
		onmenu: (i: number) => void;
		oncancelRename: () => void;
	} = $props();

	const isNarrow = () => matchMedia('(max-width: 899px)').matches;
	const href = (f: FileStat) =>
		f.type === 'directory'
			? `/cloud/files?path=${encodeURIComponent(f.filename)}`
			: `/cloud/file?path=${encodeURIComponent(f.filename)}`;

	function click(e: MouseEvent, i: number) {
		if (e.ctrlKey || e.metaKey) return; // let the browser open in a new tab
		// on touch / narrow screens a tap opens; with a pointer a click only highlights
		if (!selecting && isNarrow()) return;
		e.preventDefault();
		onpick(i, e);
	}

	function focusOnMount(el: HTMLInputElement) {
		el.focus();
		el.select();
	}
</script>

<section aria-label="Files in {path}">
	<div class="filter-row">
		<span aria-hidden="true">/</span>
		<input
			bind:this={filterEl}
			bind:value={filter}
			aria-label="Filter files"
			placeholder="filter"
			autocomplete="off"
			onkeydown={(e) => {
				if (e.key === 'Escape') {
					filter = '';
					filterEl?.blur();
				} else if (e.key === 'Enter') filterEl?.blur();
			}}
		/>
	</div>
	<div class="head" role="row">
		<span></span><span>name</span><span class="num">size</span><span class="num">modified</span>
	</div>

	<div class="list">
		{#if path !== '/'}
			<div class="row">
				<a class="entry dir" href="/cloud/files?path={encodeURIComponent(parentPath(path))}"
					><span></span><span>..</span><span></span><span></span></a
				>
			</div>
		{/if}

		{#each rows as f, i (f.filename)}
			{@const dir = f.type === 'directory'}
			{@const isSel = selected.has(f.filename)}
			<div class="row" class:cursor={i === cursor} class:picked={isSel}>
				{#if renaming === f.filename}
					<form class="rename" method="POST" action="?/rename">
						<input type="hidden" name="returnPath" value={path} />
						<input type="hidden" name="path" value={f.filename} />
						<input type="hidden" name="isDirectory" value={dir} />
						<input
							name="newName"
							aria-label="New name for {f.basename}"
							bind:value={renameValue}
							use:focusOnMount
							onkeydown={(e) => e.key === 'Escape' && oncancelRename()}
						/>
						<button type="submit">ok</button>
						<button type="button" class="cancel" onclick={oncancelRename}>cancel</button>
					</form>
				{:else}
					<a
						class="entry"
						class:dir
						data-row
						id="row-{i}"
						href={href(f)}
						target={dir ? undefined : '_blank'}
						rel={dir ? undefined : 'noopener'}
						tabindex={i === cursor ? 0 : -1}
						aria-current={i === cursor ? 'true' : undefined}
						onclick={(e) => click(e, i)}
						ondblclick={() => !selecting && onopen(i)}
					>
						<span class="marker" aria-hidden="true"
							>{#if selecting}<span class="box" class:on={isSel}></span>{:else if i === cursor}▌{/if}</span
						>
						<span class="name"
							>{f.basename}{dir ? '/' : ''}{#if isSel}<span class="sr"> (selected)</span>{/if}</span
						>
						<span class="num meta">{dir ? '—' : formatBytes(f.size)}</span>
						<span class="num meta">{formatModified(f.lastmod)}</span>
					</a>
					<button
						class="dots"
						class:ghost={selecting}
						tabindex={selecting ? -1 : 0}
						aria-hidden={selecting}
						aria-label="actions for {f.basename}"
						onclick={() => onmenu(i)}>...</button
					>
				{/if}
			</div>
		{:else}
			<p class="empty">{total && filter ? 'no match' : 'empty'}</p>
		{/each}
	</div>
</section>

<style lang="scss">
	section {
		border-right: 1px solid var(--m-line);
		padding: 10px 0;
		display: flex;
		flex-direction: column;
		min-width: 0;
		min-height: 0;
	}
	.filter-row {
		display: flex;
		gap: 6px;
		padding: 0 14px 6px;
		color: var(--m-accent);

		input {
			flex: 1;
			background: transparent;
			border: 0;
			border-bottom: 1px solid var(--m-line);
			color: var(--m-text);
			font: inherit;
			&:focus {
				outline: none;
				border-bottom-color: var(--m-accent);
			}
		}
	}
	.head,
	.entry {
		display: grid;
		grid-template-columns: 22px minmax(0, 1fr) 72px 92px;
	}
	.head {
		padding: 0 42px 6px 14px;
		color: var(--m-muted);
	}
	.list {
		overflow: auto;
		min-height: 0;
	}
	.row {
		display: flex;
		align-items: center;

		&.cursor {
			background: var(--m-selected);
		}
		&.picked {
			background: var(--m-selected-danger);
		}
	}
	.entry {
		flex: 1;
		min-width: 0;
		padding: 0 0 0 14px;
		color: var(--m-text);
		text-decoration: none;

		&.dir {
			color: var(--m-accent);
			font-weight: 700;
		}
		&:hover {
			background: color-mix(in srgb, var(--m-selected) 60%, transparent);
		}
		// the cursor row already has a background + marker; the gold ring was a clipped duplicate.
		// .row prefix outranks the page-wide a:focus-visible rule
		.row &:focus-visible {
			outline: none;
		}
	}
	.marker {
		color: var(--m-accent);
	}
	.picked .marker {
		color: var(--m-danger);
	}
	// selection checkbox; draws in the marker's colour so picked rows go red
	.box {
		display: inline-block;
		width: 9.5px;
		height: 9.5px;
		border: 1.5px solid currentColor;
		border-radius: 2.5px;
		vertical-align: -1px;
		&.on {
			background: currentColor;
		}
	}
	.cursor .name {
		color: var(--m-text-strong);
	}
	.cursor .dir .name {
		color: var(--m-accent);
	}
	.name {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.num {
		text-align: right;
	}
	.meta {
		color: var(--m-muted);
		font-weight: 400;
	}
	.sr {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
	}
	.ghost {
		visibility: hidden;
	}
	.dots {
		width: 28px;
		margin-right: 14px;
		background: none;
		border: 0;
		color: var(--m-muted);
		font: inherit;
		cursor: pointer;
		border-radius: 3px;
		&:hover {
			color: var(--m-text-strong);
		}
	}
	.rename {
		flex: 1;
		display: flex;
		gap: 8px;
		padding: 0 14px;
		input[name='newName'] {
			flex: 1;
			min-width: 0;
			background: transparent;
			border: 0;
			border-bottom: 1px solid var(--m-accent);
			color: var(--m-text);
			font: inherit;
			&:focus {
				outline: none;
			}
		}
		button {
			background: none;
			border: 0;
			color: var(--m-accent);
			font: inherit;
			cursor: pointer;
			&.cancel {
				color: var(--m-danger);
			}
		}
	}
	.empty {
		padding: 0 14px;
		color: var(--m-muted);
		margin: 0;
	}

	@media (max-width: 899px) {
		.head,
		.entry {
			grid-template-columns: 22px minmax(0, 1fr) 64px;
		}
		.head span:nth-child(4),
		.entry span:nth-child(4) {
			display: none;
		}
		.head {
			padding-right: 42px;
		}
	}

	// Dots are not needed on devices with a wider screen as the preview pane is always shown
	@media (min-width: 900px) {
		.dots {
			display: none;
		}
		// the dots column used to supply the right gutter; keep header and rows aligned without it
		.head {
			padding-right: 14px;
		}
		.entry {
			padding-right: 14px;
		}
	}
</style>
