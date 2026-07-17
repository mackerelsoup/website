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
	<a class="back" href="/">← back to root</a>
</div>

<style>
	:global(body) {
		background: #1e1f2e;
		margin: 0;
	}

	.no-access {
		font-family: 'Cascadia Code', 'JetBrains Mono', 'Fira Code', 'Courier New', monospace;
		background: #1e1f2e;
		color: #c4c6d4;
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
		color: #f87171;
		margin: 0 0 8px;
	}

	h1 {
		font-size: 1.1rem;
		font-weight: 400;
		letter-spacing: 0.05em;
		margin: 0 0 16px;
		color: #f87171;
	}

	.path {
		color: #6b728e;
		margin: 0 0 8px;
		word-break: break-all;
	}

	.detail {
		color: #c4c6d4;
		font-size: 0.9rem;
		max-width: 40ch;
		margin: 0 0 32px;
	}

	.login {
		color: #c4c6d4;
		font-weight: 600;
	}

	.back {
		color: #6b728e;
		text-decoration: none;
		font-size: 0.85rem;

		&:hover {
			color: #c4c6d4;
		}
	}
</style>