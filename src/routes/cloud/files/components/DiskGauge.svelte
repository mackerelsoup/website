<script lang="ts">
	import { onMount } from 'svelte';
	import { barCells, formatBytes } from '../format';

	const WIDTH = 24;

	let space = $state<{ totalBytes: number; usedBytes: number } | null>(null);
	let error = $state<string | null>(null);

	let percent = $derived(space ? Math.round((space.usedBytes / space.totalBytes) * 100) : 0);
	let status = $derived(percent < 60 ? 'healthy' : percent < 85 ? 'warning' : 'critical');
	let cells = $derived(barCells(percent, WIDTH));

	async function fetchDiskSpace() {
		try {
			const res = await fetch('https://homelab.tail3fdd8a.ts.net:8080/cloud/api/disk-space');
			const body = await res.json();
			if (!res.ok) {
				error = body.error ?? `HTTP ${res.status}`;
				return;
			}
			space = body;
			error = null;
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		}
	}

	onMount(() => {
		fetchDiskSpace();
		const interval = setInterval(fetchDiskSpace, 60_000);
		return () => clearInterval(interval);
	});
</script>

<div class="gauge">
	<span class="muted">disk </span>
	{#if error}
		<span class="danger">{error}</span>
	{:else if space}
		<span class="bar" role="img" aria-label="{percent}% used, {status}">
			<span class="fill {status}">▕{'█'.repeat(cells.filled)}</span><span class="empty"
				>{'█'.repeat(cells.empty)}</span
			>
		</span>
		{percent}%
		<span class="muted">{formatBytes(space.usedBytes)} / {formatBytes(space.totalBytes)}</span>
		{#if status !== 'healthy'}<span class="muted">({status})</span>{/if}
	{:else}
		<span class="muted">…</span>
	{/if}
</div>

<style lang="scss">
	.muted {
		color: var(--m-muted);
	}
	.danger {
		color: var(--m-danger);
	}
	.bar {
		white-space: nowrap;
	}
	.empty {
		color: var(--m-line);
	}
	.fill {
		&.healthy {
			color: var(--m-ok);
		}
		&.warning {
			color: var(--m-accent);
		}
		&.critical {
			color: var(--m-danger);
		}
	}
	@media (max-width: 899px) {
		.gauge {
			text-align: left;
		}
	}
	.gauge {
		font-variant-numeric: tabular-nums;
		text-align: right;
		overflow-wrap: anywhere;
	}
</style>
