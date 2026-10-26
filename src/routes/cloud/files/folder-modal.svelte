<script>
	let { showModal = $bindable(), children } = $props();

	let dialog = $state(); // HTMLDialogElement

	$effect(() => {
		if (showModal && !dialog.open) dialog.showModal();
		else if (!showModal && dialog.open) dialog.close();
	});
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
<dialog
	bind:this={dialog}
	onclose={() => (showModal = false)}
	onclick={(e) => {
		if (e.target === dialog) dialog.close();
	}}
>
	<div class="card">
		<div class="badge" aria-hidden="true">
			<svg width="172" height="172" viewBox="0 0 160 160" fill="none">
				<defs>
					<clipPath id="nf-disc"><circle cx="80" cy="80" r="76" /></clipPath>
				</defs>
				<circle cx="80" cy="80" r="76" fill="#2f3354" />
				<circle cx="116" cy="46" r="11" fill="#ee8f6c" />
				<path clip-path="url(#nf-disc)" d="M4 118C38 98 78 112 156 94V156H4Z" fill="#262946" />
				<path
					d="M28 50a8 8 0 0 1 8-8h24a6 6 0 0 1 4.5 2L75 54h50a8 8 0 0 1 8 8v54a8 8 0 0 1-8 8H36a8 8 0 0 1-8-8z"
					fill="#b98f48"
				/>
				<g transform="rotate(-6 80 66)">
					<rect x="42" y="36" width="76" height="62" rx="5" fill="#eceaf5" />
					<path d="M54 52h40M54 63h52M54 74h30" stroke="#c3c2d6" stroke-width="3" stroke-linecap="round" />
				</g>
				<path
					d="M28 74a8 8 0 0 1 8-8h88a8 8 0 0 1 8 8v42a8 8 0 0 1-8 8H36a8 8 0 0 1-8-8z"
					fill="#e2b865"
				/>
				<path d="M36 67.5h88" stroke="#fff" stroke-opacity=".32" stroke-width="1.5" stroke-linecap="round" />
			</svg>
		</div>

		{@render children?.()}

		<div class="actions">
			<!-- svelte-ignore a11y_autofocus -->
			<button type="button" class="cancel" autofocus onclick={() => dialog.close()}>Cancel</button>
		</div>
	</div>
</dialog>

<style>
	dialog {
		--field-border: var(--line);

		margin: auto;
		overflow: visible; /* badge pops out of the top */
		padding: 0;
		width: min(560px, calc(100vw - 2rem));
		background: var(--bg);
		color: var(--fg-strong);
		border: 1px solid var(--line);
		border-radius: 28px;
		box-shadow:
			0 8px 24px rgba(10, 11, 19, 0.5),
			0 36px 70px rgba(4, 5, 12, 0.6);
		font-family: var(--mono);
	}
	dialog::backdrop {
		background: rgba(5, 8, 12, 0.7);
		backdrop-filter: blur(2px);
	}
	.card {
		position: relative;
		padding: 36px 40px 28px;
		display: flex;
		flex-direction: column;
		gap: 24px;
	}
	.badge {
		position: absolute;
		left: 30px;
		top: -44px;
		width: 172px;
		height: 172px;
	}
	.badge svg {
		display: block;
		overflow: visible;
	}

	/* header content comes from the parent, so scoped selectors can't reach it */
	dialog :global(.head) {
		margin-left: 184px;
		min-height: 92px;
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 8px;
	}
	dialog :global(h2) {
		margin: 0;
		font-size: 28px;
		line-height: 1.15;
		font-weight: 600;
		letter-spacing: -0.03em;
	}
	dialog :global(.head p) {
		margin: 0;
		font-size: 14px;
		line-height: 1.5;
		color: var(--muted);
	}
	dialog :global(form) {
		height: 54px;
		display: flex;
		overflow: hidden;
		background: var(--surface);
		border: 1px solid var(--field-border);
		border-radius: 999px;
		transition:
			border-color 0.15s,
			box-shadow 0.15s;
	}
	dialog :global(form:hover) {
		border-color: var(--line-strong);
	}
	dialog :global(form:focus-within) {
		border-color: var(--accent);
		box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent) 22%, transparent);
	}
	dialog :global(input:not([type='hidden'])) {
		flex: 1;
		min-width: 0;
		padding: 0 24px;
		border: 0;
		background: transparent;
		color: inherit;
		font: inherit;
		font-size: 15px;
	}
	dialog :global(input:focus) {
		outline: none;
	}
	dialog :global(input::placeholder) {
		color: var(--muted);
		text-transform: uppercase;
		letter-spacing: 0.06em;
		font-size: 13px;
	}
	button {
		border: 0;
		font: inherit;
		font-size: 13px;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		cursor: pointer;
		transition:
			background 0.15s,
			color 0.15s,
			transform 0.05s;
	}
	button:active {
		transform: translateY(1px);
	}
	dialog :global(button[type='submit']) {
		flex: none;
		padding: 0 28px;
		border: 0;
		font: inherit;
		font-size: 13px;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		cursor: pointer;
		background: var(--accent);
		color: var(--accent-ink);
	}
	dialog :global(button[type='submit']:hover) {
		background: var(--accent-hover);
	}
	dialog :global(button[type='submit']:focus-visible) {
		outline: 2px solid var(--accent-ink);
		outline-offset: -5px;
	}
	/* block submit until the name is valid */
	dialog :global(input:invalid + button[type='submit']) {
		opacity: 0.45;
		cursor: not-allowed;
		pointer-events: none;
	}
	dialog :global(.error) {
		margin: 0;
		color: var(--danger);
		font-size: 0.875rem;
	}
	.actions {
		display: flex;
		justify-content: flex-end;
		margin-top: -12px;
	}
	.cancel {
		height: 44px;
		padding: 0 18px;
		border-radius: 999px;
		background: transparent;
		color: var(--muted);
	}
	.cancel:hover {
		color: var(--fg-strong);
		background: var(--raised);
	}
	.cancel:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	dialog[open] {
		animation: zoom 0.3s cubic-bezier(0.25, 1, 0.5, 1);
	}
	@keyframes zoom {
		from {
			transform: scale(0.95);
		}
		to {
			transform: scale(1);
		}
	}
	dialog[open]::backdrop {
		animation: fade 0.2s ease-out;
	}
	@keyframes fade {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	@media (max-width: 520px) {
		.card {
			padding: 120px 20px 20px;
		}
		.badge {
			left: 50%;
			transform: translateX(-50%);
		}
		dialog :global(.head) {
			margin-left: 0;
			min-height: 0;
			text-align: center;
		}
	}
</style>
