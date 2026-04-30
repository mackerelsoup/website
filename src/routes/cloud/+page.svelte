<script lang="ts">
	import './layout.scss';
	import Offline from './components/Offline.svelte';
      import type { PageProps } from './$types';

      let {data}: PageProps = $props();

</script>

<div class="scanlines">
	<div class="jpg"></div>
	<div class="overlay">AV-1</div>
      {#if !data.isOnline}
      <Offline />
      {/if}

</div>
