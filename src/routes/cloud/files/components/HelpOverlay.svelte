<script lang="ts">
	let { canEdit, onclose }: { canEdit: boolean; onclose: () => void } = $props();

	const keys: [string, string, boolean][] = [
		['j / k, ↑ / ↓', 'move highlight up / down', false],
		['l, Enter', 'open folder or file', false],
		['h, Backspace', 'go to parent', false],
		['/', 'filter the list', false],
		['y', 'copy link to file', false],
		['space', 'toggle select (enters SELECT mode)', true],
		['shift+j / k', 'extend selection', true],
		['a', 'select all', true],
		['u / shift+u', 'upload files / folder', true],
		['p', 'pause / resume upload', true],
		['n', 'new folder', true],
		['r', 'rename', true],
		['d', 'delete (asks to confirm)', true],
		['esc', 'leave current mode', false],
		['?', 'toggle this help', false]
	];
	let closeBtn: HTMLButtonElement | undefined = $state();
	$effect(() => closeBtn?.focus());
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<div class="scrim" role="presentation" onclick={onclose}>
	<div
		class="dialog"
		role="dialog"
		aria-modal="true"
		aria-label="Keyboard shortcuts"
		tabindex="-1"
		onclick={(e) => e.stopPropagation()}
	>
		<div class="head">
			<strong>keys</strong><button
				bind:this={closeBtn}
				type="button"
				onclick={onclose}
				aria-label="close help">✕</button
			>
		</div>
		<dl>
			{#each keys.filter(([, , edit]) => canEdit || !edit) as [key, what] (key)}
				<dt>{key}</dt>
				<dd>{what}</dd>
			{/each}
		</dl>
	</div>
</div>

<style lang="scss">
	.scrim {
		position: fixed;
		inset: 0;
		z-index: 40;
		background: rgb(0 0 0 / 0.6);
		display: grid;
		place-items: center;
		padding: 16px;
	}
	.dialog {
		background: var(--m-panel);
		border: 1px solid var(--m-line);
		border-radius: 6px;
		padding: 14px 18px;
		max-width: 460px;
		width: 100%;
		max-height: 90vh;
		overflow: auto;
	}
	.head {
		display: flex;
		justify-content: space-between;
		color: var(--m-text-strong);
		margin-bottom: 8px;
		button {
			background: none;
			border: 0;
			color: var(--m-muted);
			font: inherit;
			cursor: pointer;
		}
	}
	dl {
		margin: 0;
		display: grid;
		grid-template-columns: 130px 1fr;
		row-gap: 2px;
	}
	dt {
		color: var(--m-accent);
	}
	dd {
		margin: 0;
		color: var(--m-muted);
	}
</style>
