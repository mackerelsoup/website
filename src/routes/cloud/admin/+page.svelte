<script lang="ts">
	import type { PageProps } from './$types';
	import { enhance } from '$app/forms';

	let { data, form }: PageProps = $props();
</script>

<main>
	{#if form?.message}<p class="error">{form.message}</p>{/if}
	<h1>pending folder requests</h1>
	{#if data.requests.length === 0}
		<p class="empty">no pending requests</p>
	{:else}
		<table>
			<thead>
				<tr><th>requester</th><th>requested name</th><th>created</th><th></th></tr>
			</thead>
			<tbody>
				{#each data.requests as r (r.id)}
					<tr>
						<td>{r.tailscaleLogin}</td>
						<td>{r.requestedName}</td>
						<td>{r.createdAt.toLocaleString()}</td>
						<td>
							<form method="POST" action="?/approve" use:enhance class="inline">
								<input type="hidden" name="id" value={r.id} />
								<input name="path" value={`/${r.requestedName}`} aria-label="folder path" />
								<button>approve</button>
							</form>
							<form method="POST" action="?/deny" use:enhance class="inline">
								<input type="hidden" name="id" value={r.id} />
								<button>deny</button>
							</form>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}

	<h1>grants</h1>
	<table>
		<thead>
			<tr><th>folder</th><th>login</th><th>access</th><th></th></tr>
		</thead>
		<tbody>
			{#each data.grants as g (g.id)}
				<tr>
					<td>{g.path}</td>
					<td>{g.login ?? 'general'}</td>
					<td>{g.access}</td>
					<td>
						<form method="POST" action="?/revoke" use:enhance>
							<input type="hidden" name="id" value={g.id} />
							<button>revoke</button>
						</form>
					</td>
				</tr>
			{/each}
		</tbody>
	</table>

	<h1>add grant</h1>
	<form method="POST" action="?/grant" use:enhance class="inline">
		<select name="path" aria-label="folder">
			{#each data.folders as f (f.id)}<option value={f.path}>{f.path}</option>{/each}
		</select>
		<input name="login" placeholder="tailscale login" required />
		<select name="access" aria-label="access level">
			<option value="view">view</option>
			<option value="edit">edit</option>
		</select>
		<button>add</button>
	</form>
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

	.error {
		color: #f7768e;
	}

	.inline {
		display: inline-flex;
		gap: 6px;
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
