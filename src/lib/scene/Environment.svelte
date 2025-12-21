<script lang="ts">
  import { T } from '@threlte/core';
</script>

<!-- Ground plane -->
<T.Mesh rotation.x={-Math.PI / 2} receiveShadow position.y={-0.01}>
  <T.PlaneGeometry args={[200, 200]} />
  <T.MeshStandardMaterial color="#ffffff" roughness={0.7} metalness={0} />
</T.Mesh>

<!-- Lighting -->
<T.AmbientLight intensity={0.8} />
<T.DirectionalLight 
  position={[10, 15, 5]} 
  intensity={1.5} 
  castShadow
  shadow.camera.left={-20}
  shadow.camera.right={20}
  shadow.camera.top={20}
  shadow.camera.bottom={-20}
  shadow.mapSize.width={2048}
  shadow.mapSize.height={2048}
/>

<!-- Rim light for better readability -->
<T.DirectionalLight position={[-5, 3, -10]} intensity={0.4} color="#b3d9ff" />

<!-- Fog for depth -->
<T.Fog attach="fog" args={['#e8f4f8', 30, 80]} />
