<script lang="ts">
	let {
		mode,
		position,
		canEdit
	}: { mode: 'normal' | 'select' | 'upload'; position: string; canEdit: boolean } = $props();

	const hints = $derived(
		mode === 'select'
			? [
					['space', 'toggle'],
					['shift+j/k', 'range'],
					['a', 'all'],
					['d', 'delete'],
					['esc', 'exit']
				]
			: mode === 'upload'
				? [
						['p', 'pause/resume'],
						['j/k', 'move'],
						['?', 'help']
					]
				: [
						['j/k', 'move'],
						['l', 'open'],
						['h', 'up'],
						...(canEdit
							? [
									['space', 'select'],
									['u', 'upload']
								]
							: []),
						['/', 'filter'],
						['?', 'help']
					]
	);
</script>

<footer>
	<div class="left">
		<span class="chip {mode}">{mode.toUpperCase()}</span>
		<span class="muted">{position}</span>
	</div>
	<div class="hints muted">
		{#each hints as [key, label] (key)}<span><kbd>{key}</kbd> {label}</span>{/each}
	</div>
</footer>

<style lang="scss">
	footer {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 16px;
	}
	.left {
		display: flex;
		gap: 12px;
		align-items: center;
	}
	.muted {
		color: var(--m-muted);
	}
	.chip {
		background: var(--m-accent);
		color: var(--m-ground);
		font-weight: 700;
		padding: 0 8px;
		border-radius: 3px;

		&.select {
			background: var(--m-danger);
		}
	}
	.hints {
		display: flex;
		gap: 12px;
		white-space: nowrap;
		overflow: hidden;
	}
	kbd {
		font: inherit;
		color: var(--m-accent);
	}
	@media (max-width: 899px) {
		.hints {
			display: none;
		}
	}
</style>
