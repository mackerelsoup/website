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
		<table>
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
		</table>
	{/if}

	<h2>grants</h2>
	<table>
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
	</table>
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
		color: #f7768e;
	}

	.ok {
		color: #9ece6a;
	}

	.inline {
		display: inline-flex;
		gap: 6px;
	}

	.empty {
		color: #8a90ab;
	}

	button {
		font: inherit;
		color: inherit;
		background: transparent;
		border: 1px solid #3b3e57;
		border-radius: 3px;
		padding: 2px 10px;
		cursor: pointer;
	}

	button:hover,
	button:focus-visible {
		background: #2a2c40;
		border-color: #6b728e;
		outline: 2px solid transparent; /* shows in forced-colors mode */
	}

	button:focus-visible {
		box-shadow: 0 0 0 2px #7aa2f7;
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
		background: #272940;
		border: 1px solid #3b3e57;
		border-radius: 3px;
		padding: 2px 6px;
	}

	input::placeholder {
		color: #8a90ab;
	}

	input:focus-visible,
	select:focus-visible {
		outline: 2px solid #7aa2f7;
		outline-offset: 1px;
	}

	/* constructive: the one filled button per row (approve, add) */
	.primary {
		color: #1e1f2e;
		background: #7aa2f7;
		border-color: #7aa2f7;
	}

	.primary:hover,
	.primary:focus-visible {
		background: #9db8f9;
		border-color: #9db8f9;
	}

	/* destructive: red at rest, so deny/revoke never read as neutral */
	.danger {
		color: #f7768e;
		border-color: #a84e63;
	}

	.danger:hover,
	.danger:focus-visible {
		border-color: #f7768e;
		background: #2d1f2b;
	}

	table {
		border-collapse: collapse;
		font-size: 0.9rem;
	}

	th {
		color: #8a90ab;
		font-weight: 400;
		text-align: left;
	}

	th,
	td {
		padding: 6px 24px 6px 0;
	}
</style>
