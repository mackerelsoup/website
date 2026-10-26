<script lang="ts">
	import { enhance } from '$app/forms';

	let { showModal = $bindable(), path }: { showModal: boolean; path: string } = $props();

	let dialog = $state<HTMLDialogElement>();
	let input = $state<HTMLInputElement>();
	let name = $state('');
	let serverError = $state('');

	// mirrors validateFolderName on the server; that stays the source of truth
	const clientError = $derived(
		/[/\\]/.test(name)
			? 'name cannot contain "/"'
			: name.trim() === '.' || name.trim() === '..'
				? 'that name is reserved'
				: ''
	);
	const error = $derived(clientError || serverError);
	const canCreate = $derived(name.trim().length > 0 && !clientError);

	$effect(() => {
		if (!dialog) return;
		if (showModal && !dialog.open) {
			name = '';
			serverError = '';
			dialog.showModal();
			input?.focus();
		} else if (!showModal && dialog.open) dialog.close();
	});
</script>

<dialog
	bind:this={dialog}
	aria-labelledby="nf-title"
	onclose={() => (showModal = false)}
	onclick={(e) => {
		if (e.target === dialog) dialog?.close();
	}}
>
	<form
		method="POST"
		action="?/createFolder"
		use:enhance={() =>
			async ({ result, update }) => {
				if (result.type === 'failure') {
					serverError = (result.data?.message as string) ?? 'Failed';
					return;
				}
				showModal = false;
				await update();
			}}
	>
		<input type="hidden" name="returnPath" value={path} />
		<div class="body">
			<h2 id="nf-title">new folder at</h2>
			<div class="path-row">
				<span class="prefix" aria-hidden="true">{path === '/' ? '/' : `${path}/`}</span>
				<input
					bind:this={input}
					bind:value={name}
					oninput={() => (serverError = '')}
					name="name"
					aria-label="Folder name"
					placeholder="name"
					autocomplete="off"
					spellcheck="false"
					aria-describedby="nf-error"
					aria-invalid={!!error}
				/>
			</div>
			<p class="error" id="nf-error" aria-live="polite">{error}</p>
		</div>
		<div class="footer">
			<span class="hint">enter to create, esc to cancel</span>
			<button type="button" class="cancel" onclick={() => dialog?.close()}>cancel</button>
			<button type="submit" class="create" disabled={!canCreate}>create</button>
		</div>
	</form>
</dialog>

<style>
	dialog {
		margin: auto;
		padding: 0;
		width: min(620px, calc(100vw - 32px));
		background: var(--m-panel);
		color: var(--m-text);
		border: 1px solid var(--m-line);
		box-shadow: 0 24px 60px rgb(0 0 0 / 0.5);
		font-family: inherit;
		font-size: 13px;
		line-height: 1.5;
	}
	dialog::backdrop {
		background: rgb(10 8 14 / 0.62);
	}
	.body {
		padding: 30px 32px 10px;
	}
	h2 {
		margin: 0 0 14px;
		font-size: 12px;
		font-weight: 400;
		color: var(--m-muted);
	}
	.path-row {
		display: flex;
		align-items: center;
		font-size: 24px;
		color: var(--m-muted);
		border-bottom: 1px solid var(--m-line);
		padding-bottom: 2px;

		&:focus-within {
			border-bottom-color: var(--m-accent);
		}
	}
	.prefix {
		flex: 0 1 auto;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	input[name='name'] {
		flex: 1;
		min-width: 0;
		height: 48px;
		border: 0;
		background: transparent;
		color: var(--m-accent);
		caret-color: var(--m-accent);
		font: inherit;
		font-size: 24px;
		font-weight: 700;

		&::placeholder {
			color: var(--m-dim);
			font-weight: 400;
		}
		&:focus {
			outline: none;
		}
	}
	.error {
		min-height: 20px;
		margin: 6px 0 0;
		font-size: 12px;
		line-height: 20px;
		color: var(--m-danger);
	}
	.footer {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 2px 16px 14px;
	}
	.hint {
		flex: 1;
		padding-left: 16px;
		font-size: 12px;
		color: var(--m-muted);
	}
	button {
		height: 44px; /* comfortable touch target */
		padding: 0 18px;
		border: 0;
		background: transparent;
		font: inherit;
		cursor: pointer;
		transition:
			background 0.12s,
			color 0.12s;

		&:focus-visible {
			outline: 2px dashed var(--m-accent);
			outline-offset: -5px;
		}
	}
	.cancel {
		color: var(--m-muted);
		&:hover {
			background: var(--m-selected);
			color: var(--m-text);
		}
	}
	.create {
		color: var(--m-accent);
		font-weight: 700;
		&:hover:not(:disabled) {
			background: var(--m-selected);
			box-shadow: inset 3px 0 0 var(--m-accent);
		}
		&:disabled {
			opacity: 0.45;
			cursor: not-allowed;
		}
	}

	@media (max-width: 520px) {
		.body {
			padding: 24px 20px 8px;
		}
		.path-row,
		input[name='name'] {
			font-size: 18px;
		}
		.hint {
			display: none;
		}
		.footer {
			justify-content: flex-end;
		}
	}
</style>
