<script lang="ts">
	import { formatBytes } from '../format';

	let {
		count,
		bytes,
		confirming,
		oncancel,
		ondelete
	}: {
		count: number;
		bytes: number;
		confirming: boolean;
		oncancel: () => void;
		ondelete: () => void;
	} = $props();
</script>

<div class="block" role="status">
	<div class="title">{count} selected · {formatBytes(bytes)}</div>
	{#if confirming}
		<div class="muted">delete {count} item{count === 1 ? '' : 's'}? this cannot be undone</div>
		<div class="actions">
			<button type="submit" form="delete-many" class="danger"><kbd>y</kbd> confirm delete</button>
			<button type="button" onclick={oncancel}><kbd class="a">esc</kbd> cancel</button>
		</div>
	{:else}
		<div class="actions muted">
			<button type="button" class="danger" onclick={ondelete}><kbd>d</kbd> delete</button>
			<button type="button" onclick={oncancel}><kbd class="a">esc</kbd> clear</button>
		</div>
	{/if}
</div>

<style lang="scss">
	.block {
		border: 1px solid var(--m-danger);
		border-radius: 4px;
		padding: 10px 12px;
	}
	.title {
		color: var(--m-danger);
		font-weight: 700;
	}
	.muted {
		color: var(--m-muted);
	}
	.actions {
		display: flex;
		gap: 14px;
		flex-wrap: wrap;
	}
	button {
		background: none;
		border: 0;
		padding: 0;
		font: inherit;
		color: var(--m-muted);
		cursor: pointer;
		border-radius: 3px;
	}
	.danger kbd {
		color: var(--m-danger);
	}
	kbd {
		font: inherit;
		color: var(--m-danger);
		&.a {
			color: var(--m-accent);
		}
	}
</style>
