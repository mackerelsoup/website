<script lang="ts">
	import DiskGauge from './DiskGauge.svelte';

	let { accessLevel }: { accessLevel: 'view' | 'edit' | null } = $props();
</script>

<header>
	<pre class="wordmark" aria-label="cloud">       oooo                              .o8
       `888                             "888
 .ooooo.  888   .ooooo.  oooo  oooo   .oooo888
d88' `"Y8 888  d88' `88b `888  `888  d88' `888
888       888  888   888  888   888  888   888
888   .o8 888  888   888  888   888  888   888
`Y8bod8P'o888o `Y8bod8P'  `V88V"V8P' `Y8bod88P"</pre>
	<div class="meta">
		<div>
			<span class="muted">zt@homelab</span> <span class="dim" aria-hidden="true">│</span>
			<span class:ok={accessLevel === 'edit'} class:muted={accessLevel !== 'edit'}
				>{accessLevel ?? 'no access'}</span
			>
			<span class="dim" aria-hidden="true">│</span> <span class="muted">tailscale</span>
		</div>
		<DiskGauge />
	</div>
</header>

<style lang="scss">
	header {
		display: flex;
		justify-content: space-between;
		align-items: flex-end;
		gap: 24px;
	}
	.wordmark {
		margin: 0;
		font: inherit;
		font-size: 11px;
		line-height: 1.05;
		color: var(--m-accent);
		white-space: pre;
		overflow: hidden;
	}
	.meta {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 2px;
		min-width: 0;
	}
	.muted {
		color: var(--m-muted);
	}
	.dim {
		color: var(--m-dim);
	}
	.ok {
		color: var(--m-ok);
	}
	@media (max-width: 899px) {
		.wordmark {
			display: none;
		}
		.meta {
			align-items: flex-start;
		}
		header {
			justify-content: flex-start;
		}
	}
</style>
