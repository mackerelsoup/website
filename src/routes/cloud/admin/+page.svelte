<script lang="ts">
	import type { PageProps } from './$types';
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';

	let { data, form }: PageProps = $props();

	// One in-flight request at a time: disables every button, so no double-submit.
	let pending = $state(false);

	/** use:enhance callback: optional confirm, then hold `pending` until the page has updated. */
	const submit =
		(confirmMessage?: string): SubmitFunction =>
		({ cancel }) => {
			if (confirmMessage && !confirm(confirmMessage)) return cancel();
			pending = true;
			return async ({ update }) => {
				try {
					await update();
				} finally {
					pending = false;
				}
			};
		};
</script>

<svelte:head><title>cloud admin</title></svelte:head>

<main aria-busy={pending}>
	<h1 class="sr">cloud admin</h1>
	{#if form?.message}<p class="error" role="alert">{form.message}</p>
	{:else if form?.success}<p class="ok" role="status">done</p>{/if}
	<h2>pending folder requests</h2>
	{#if data.requests.length === 0}
		<p class="empty">no pending requests</p>
	{:else}
		<div class="table-wrap"><table>
			<thead>
				<tr><th scope="col">requester</th><th scope="col">requested name</th><th scope="col">created</th><th scope="col"><span class="sr">actions</span></th></tr>
			</thead>
			<tbody>
				{#each data.requests as r (r.id)}
					<tr>
						<td>{r.tailscaleLogin}</td>
						<td>{r.requestedName}</td>
						<td>{r.createdAt.toLocaleString()}</td>
						<td>
							<form method="POST" action="?/approve" use:enhance={submit()} class="inline">
								<input type="hidden" name="id" value={r.id} />
								<input name="path" value={`/${r.requestedName}`} aria-label="folder path" />
								<button class="primary" disabled={pending} aria-label="approve {r.requestedName}">approve</button>
							</form>
							<form method="POST" action="?/deny" use:enhance={submit(`Deny ${r.tailscaleLogin}'s request for ${r.requestedName}?`)} class="inline">
								<input type="hidden" name="id" value={r.id} />
								<button class="danger" disabled={pending} aria-label="deny {r.requestedName}">deny</button>
							</form>
						</td>
					</tr>
				{/each}
			</tbody>
		</table></div>
	{/if}

	<h2>grants</h2>
	<div class="table-wrap"><table>
		<thead>
			<tr><th scope="col">folder</th><th scope="col">login</th><th scope="col">access</th><th scope="col"><span class="sr">actions</span></th></tr>
		</thead>
		<tbody>
			{#each data.grants as g (g.id)}
				<tr>
					<td>{g.path}</td>
					<td>{g.login ?? 'general'}</td>
					<td>{g.access}</td>
					<td>
						<form method="POST" action="?/revoke" use:enhance={submit(`Revoke ${g.login ?? 'general'}'s ${g.access} access to ${g.path}?`)}>
							<input type="hidden" name="id" value={g.id} />
							<button class="danger" disabled={pending} aria-label="revoke {g.login ?? 'general'} on {g.path}">revoke</button>
						</form>
					</td>
				</tr>
			{/each}
		</tbody>
	</table></div>
	{#if data.grants.length === 0}<p class="empty">no grants yet</p>{/if}

	<h2>add grant</h2>
	<form method="POST" action="?/grant" use:enhance={submit()} class="inline">
		<select name="path" aria-label="folder">
			{#each data.folders as f (f.id)}<option value={f.path}>{f.path}</option>{/each}
		</select>
		<input name="login" placeholder="tailscale login" required />
		<select name="access" aria-label="access level">
			<option value="view">view</option>
			<option value="edit">edit</option>
		</select>
		<button class="primary" disabled={pending}>add</button>
	</form>
</main>

<style>
	:global(body) {
		background: var(--bg);
		margin: 0;
	}

	main {
		font-family: var(--mono);
		color: var(--fg);
		min-height: 100vh;
		padding: 24px 32px;
		box-sizing: border-box;
	}

	h2 {
		font-size: 1.1rem;
		font-weight: 400;
		letter-spacing: 0.05em;
		margin: 32px 0 16px;
	}

	main > h2:first-of-type {
		margin-top: 0;
	}

	.sr {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}

	.error {
		color: var(--danger);
	}

	.ok {
		color: var(--ok);
	}

	.inline {
		display: inline-flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.empty {
		color: var(--muted);
	}

	button {
		font: inherit;
		color: inherit;
		background: transparent;
		border: 1px solid var(--line);
		border-radius: 3px;
		padding: 2px 10px;
		cursor: pointer;
		transition:
			background var(--fast),
			border-color var(--fast);
	}

	button:hover {
		background: var(--surface);
		border-color: var(--line-strong);
	}

	button:disabled {
		opacity: 0.5;
		cursor: progress;
		pointer-events: none;
	}

	input,
	select {
		font: inherit;
		color: inherit;
		background: var(--surface);
		border: 1px solid var(--line);
		border-radius: 3px;
		padding: 2px 6px;
		transition: border-color var(--fast);
	}

	input:hover,
	select:hover {
		border-color: var(--line-strong);
	}

	input::placeholder {
		color: var(--muted);
	}

	/* constructive: the one filled button per row (approve, add) */
	.primary {
		color: var(--accent-ink);
		background: var(--accent);
		border-color: var(--accent);
	}

	.primary:hover {
		background: var(--accent-hover);
		border-color: var(--accent-hover);
	}

	/* destructive: red at rest, so deny/revoke never read as neutral */
	.danger {
		color: var(--danger);
		border-color: #a84e63;
	}

	.danger:hover {
		border-color: var(--danger);
		background: var(--danger-bg);
	}

	.table-wrap {
		overflow-x: auto;
	}

	table {
		border-collapse: collapse;
		font-size: 0.9rem;
	}

	th {
		color: var(--muted);
		font-weight: 400;
		text-align: left;
	}

	th,
	td {
		padding: 6px 24px 6px 0;
		font-variant-numeric: tabular-nums;
	}

	tbody tr {
		border-top: 1px solid var(--line);
	}
</style>
