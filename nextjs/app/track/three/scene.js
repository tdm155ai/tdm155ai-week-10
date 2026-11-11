// ─────────────────────────────────────────────────────────────────────────────
//  THE FILE TO CHANGE for /track/three: what's in the 3D scene, the sliders, and what your hand does.
//  Save it and the page updates. Three.js docs: https://threejs.org/docs/ (the manual's "Creating a scene" first).
//
//  The idea: a field of glowing blocks. A wave runs out from the middle; the sliders set how fast, how high,
//  what color, and how the field spins. Drag to look around, scroll to zoom.
// ─────────────────────────────────────────────────────────────────────────────

// The sliders. Each one's `value` arrives in `update()` as values.<name>.
export const controls = [
  { name: "speed", label: "Speed", min: 0, max: 3, step: 0.01, value: 1 },
  { name: "height", label: "Wave height", min: 0, max: 4, step: 0.01, value: 1.4 },
  { name: "ripples", label: "Ripples", min: 0.1, max: 1.5, step: 0.01, value: 0.55 },
  { name: "hue", label: "Color", min: 0, max: 1, step: 0.001, value: 0.55 },
  { name: "spin", label: "Spin", min: -1, max: 1, step: 0.01, value: 0.15 },
];

// Your hand (with "Use my hand" on): x and y go from 0 to 1 across the camera picture, `pinch` is true while your
// thumb and index finger touch. Here x spins the field, height lifts the wave, and a pinch sends a pulse out.
export function fromHand(hand, values) {
  return { ...values, spin: (hand.x - 0.5) * 2, height: (1 - hand.y) * 4 };
}

const SIZE = 40; // blocks along each side (40 × 40 = 1,600)
const GAP = 0.55; // distance between blocks

// Build the scene once. `THREE` is the library; `scene` is the empty world to fill.
// Return an update(seconds, values, hand) function that runs every frame.
export function makeScene(THREE, scene) {
  scene.background = new THREE.Color("#07080a");
  scene.fog = new THREE.Fog("#07080a", 18, 46);
  scene.add(new THREE.HemisphereLight("#ffffff", "#202030", 1.4));
  const sun = new THREE.DirectionalLight("#ffffff", 2.2);
  sun.position.set(6, 12, 4);
  scene.add(sun);

  // One box shape drawn 1,600 times (an InstancedMesh: fast, because it's one draw call).
  const field = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.42, 1, 0.42),
    new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.1 }),
    SIZE * SIZE,
  );
  scene.add(field);
  const holder = new THREE.Object3D(); // a helper we move around to write each block's position into the field
  const color = new THREE.Color();
  let pulse = -10; // when the last pinch pulse started (seconds)
  let wasPinched = false;

  return function update(t, values, hand) {
    if (hand?.pinch && !wasPinched) pulse = t;
    wasPinched = !!hand?.pinch;
    field.rotation.y += values.spin * 0.01;
    let i = 0;
    for (let ix = 0; ix < SIZE; ix++) {
      for (let iz = 0; iz < SIZE; iz++) {
        const x = (ix - SIZE / 2) * GAP;
        const z = (iz - SIZE / 2) * GAP;
        const d = Math.hypot(x, z); // distance from the middle
        const wave = Math.sin(d * values.ripples - t * values.speed * 2) * values.height;
        const ring = Math.exp(-((d - (t - pulse) * 8) ** 2)) * 3; // the pulse: a ring moving outwards
        const h = 0.2 + Math.max(0, wave + values.height + ring);
        holder.position.set(x, h / 2 - 2, z);
        holder.scale.set(1, h, 1);
        holder.updateMatrix();
        field.setMatrixAt(i, holder.matrix);
        color.setHSL((values.hue + d * 0.012 + h * 0.03) % 1, 0.75, 0.35 + Math.min(0.35, h * 0.06));
        field.setColorAt(i, color);
        i++;
      }
    }
    field.instanceMatrix.needsUpdate = true;
    field.instanceColor.needsUpdate = true;
  };
}
