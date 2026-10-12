<script lang="ts">
	import { parentPath } from '../format';

	let { path, siblings }: { path: string; siblings: { basename: string; filename: string }[] } =
		$props();

	const parent = $derived(parentPath(path));
	const parentName = $derived(parent === '/' ? '/' : (parent.split('/').pop() ?? ''));
</script>

<nav aria-label="Folders in {parent}">
	{#if path !== '/'}
		<div class="title muted">{parentName}</div>
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
