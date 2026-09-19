<script lang="ts">
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<main>
	<h1>pending folder requests</h1>
	{#if data.requests.length === 0}
		<p class="empty">no pending requests</p>
	{:else}
		<table>
			<thead>
				<tr><th>requester</th><th>requested name</th><th>created</th></tr>
			</thead>
			<tbody>
				{#each data.requests as r (r.id)}
					<tr>
						<td>{r.tailscaleLogin}</td>
						<td>{r.requestedName}</td>
						<td>{r.createdAt.toLocaleString()}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
</main>

<style>
	:global(body) {
		background: #1e1f2e;
		margin: 0;
	}

	main {
		font-family: 'Cascadia Code', 'JetBrains Mono', 'Fira Code', 'Courier New', monospace;
		color: #c4c6d4;
		min-height: 100vh;
		padding: 24px;
		box-sizing: border-box;
	}

	h1 {
		font-size: 1.1rem;
		font-weight: 400;
		letter-spacing: 0.05em;
		margin: 0 0 16px;
	}

	.empty {
		color: #6b728e;
	}

	table {
		border-collapse: collapse;
		font-size: 0.9rem;
	}

	th {
		color: #6b728e;
		font-weight: 400;
		text-align: left;
	}

	th,
	td {
		padding: 6px 24px 6px 0;
	}
</style>
