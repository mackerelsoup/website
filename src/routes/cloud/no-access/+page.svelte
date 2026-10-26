<script lang="ts">
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<div class="no-access">
	<pre class="glyph">✕</pre>
	<h1>access denied</h1>
	<p class="detail">
		{#if data.login}
			<span class="login">{data.login}</span> does not have permission to view this folder.
		{:else}
			no Tailscale identity was found on this request.
		{/if}
	</p>
	{#if typeof window !== 'undefined' && window.history.length > 1}
		<button class="back" onclick={() => window.history.back()}>← back</button>
	{:else}
		<a class="back" href="/cloud">← back to root</a>
	{/if}
</div>

<style>
	:global(body) {
		background: var(--bg);
		margin: 0;
	}

	.no-access {
		font-family: var(--mono);
		background: var(--bg);
		color: var(--fg);
		min-height: 100vh;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		text-align: center;
		padding: 24px;
		box-sizing: border-box;
	}

	.glyph {
		font-size: 3rem;
		color: var(--danger);
		margin: 0 0 8px;
		animation: slam 0.35s var(--ease-out);
	}

	h1 {
		font-size: 1.1rem;
		font-weight: 400;
		letter-spacing: 0.05em;
		margin: 0 0 16px;
		color: var(--danger);
	}

	.detail {
		font-size: 0.9rem;
		max-width: 40ch;
		margin: 0 0 32px;
		text-wrap: balance;
	}

	.login {
		font-weight: 600;
	}

	.back {
		background: none;
		border: none;
		border-radius: 3px;
		padding: 2px 6px;
		color: var(--muted);
		text-decoration: none;
		font-family: inherit;
		font-size: 0.85rem;
		cursor: pointer;
		transition:
			color var(--fast),
			background var(--fast);

		&:hover {
			color: var(--fg);
			background: var(--raised);
		}
	}

	/* lands oversized, then a short shake */
	@keyframes slam {
		0% {
			transform: scale(2.6);
			opacity: 0;
		}
		35% {
			transform: scale(1);
			opacity: 1;
		}
		50% {
			transform: translateX(-10px);
		}
		65% {
			transform: translateX(8px);
		}
		80% {
			transform: translateX(-4px);
		}
		100% {
			transform: none;
		}
	}
</style>
