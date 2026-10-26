<script lang="ts">
	import { parentPath } from '../format';

	let { path, siblings }: { path: string; siblings: { basename: string; filename: string }[] } =
		$props();

	const parent = $derived(parentPath(path));
</script>

<nav aria-label="Folders in {parent}">
	{#if path !== '/'}
		<!-- rtl + inner ltr: a long path truncates at the start, keeping the nearest folders visible -->
		<div class="title muted" title={parent}><bdo dir="ltr">{parent}</bdo></div>
		{#each siblings as s (s.filename)}
			{@const current = s.filename === path}
			<a
				href="/cloud/files?path={encodeURIComponent(s.filename)}"
				class:current
				aria-current={current ? 'page' : undefined}
				>{#if current}<span aria-hidden="true">▌</span>{/if}{s.basename}/</a
			>
		{/each}
	{/if}
</nav>

<style lang="scss">
	nav {
		border-right: 1px solid var(--m-line);
		padding: 10px 0;
		overflow: auto;
	}
	.title {
		padding: 0 14px 6px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		direction: rtl;
		text-align: left;
	}
	.muted {
		color: var(--m-muted);
	}
	a {
		display: block;
		padding: 0 14px 0 22px;
		color: var(--m-text);
		text-decoration: none;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;

		&:hover {
			background: var(--m-selected);
		}
		&.current {
			padding-left: 14px;
			background: var(--m-selected);
			color: var(--m-accent);
			font-weight: 700;
		}
	}
	@media (max-width: 899px) {
		nav {
			display: none;
		}
	}
</style>
