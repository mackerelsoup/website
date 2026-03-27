<script lang="ts">
	import './layout.scss';
	// import { onMount } from 'svelte';

	// onMount(async () => {
	// 	const { init } = await import('./border.js');
	// 	init();
	// });

</script>

<!-- <div>
<form id="gui" name="inputs">
    <table>
        <tr> <td> <font color= #FF8000>distortion</font> </td>
            <td> <input type="range" id="distortion" min="0" max="100" value="10"/> 
        </td> </tr>
        <tr> <td> <font color= #FF8000>stripes</font> </td>
            <td> <input type="range" id="stripes"  min="0" max="100" value="70"/> 
        </td> </tr>
        <tr> <td> <font color= #FF8000>RGB shift</font> </td>
            <td> <input type="range" id="rgbshift" min="0" max="100" value="10"/> 
        </td> </tr>
    </table>
</form>
</div> -->


<!-- <canvas id="retro-canvas" style="border: none
 display: block; width: 100vw; height: 100vh;">
      
</canvas> -->

<div class="scanlines">
    <div class="jpg"></div>
    <div class="overlay">AV-1</div>
    <div class="ascii-container">
      <div class="flex h-screen items-center justify-center align-items">
      <pre class="ascii-letter" >
  .oooooo.  
 d8P'  `Y8b
888      888
888      888
888      888 
`88b    d88'
 `Y8bood8P'</pre>
      <pre class="ascii-letter" >
 .o88o. 
 888 `" 
o888oo  
 888    
 888    
 888    
o888o</pre>
      <pre class="ascii-letter" >
 .o88o. 
 888 `" 
o888oo  
 888    
 888    
 888    
o888o</pre>
      <pre class="ascii-letter" >
oooo  
`888  
 888  
 888  
 888  
 888  
o888o </pre>
      <pre class="ascii-letter" >
 o8o  
 `"'  
oooo  
`888  
 888  
 888  
o888o </pre>
      <pre class="ascii-letter" >
        
        
 ooo. .oo. 
`888P"Y88b  
 888   888  
 888   888
o888o o888o</pre>
      <pre class="ascii-letter" >
        
        
 .ooooo.  
d88' `88b 
888ooo888 
888    .o 
`Y8bod8P'</pre>
	</div>
</div>
</div>


