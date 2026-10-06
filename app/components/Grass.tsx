// Procedural grass field - the main visible carrier of the wind.
// Thousands of blades are drawn as ONE instanced mesh. Their positions are set once;
// all the motion happens in the vertex shader (see windBend.ts), so nothing is updated
// per blade on the CPU each frame.

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { applyWindBend, syncWindUniforms } from './windBend';

// DENSITY: total number of grass blades
const BLADE_COUNT = 12000;
// Grass grows in a ring around the centre: dense near the plant, thinning out toward the edge
const FIELD_RADIUS = 9;
const CLEAR_RADIUS = 0.3; // keep the pot itself free of grass
// Blade size in world units
const BLADE_MIN_HEIGHT = 0.18;
const BLADE_MAX_HEIGHT = 0.45;
const BLADE_WIDTH = 0.035;
// Segments along each blade - more segments give a smoother curve
const BLADE_SEGMENTS = 5;

const ROOT_COLOR = new THREE.Color('#5f8f45');
const TIP_COLOR = new THREE.Color('#b9d98a');

// Small seeded random generator so the field looks the same on every load
function createRandom(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// One blade: a narrow strip 1 unit tall with its root at y = 0, tapering to a point
// and curving slightly forward. Each instance scales it to its own height.
function createBladeGeometry() {
  const geometry = new THREE.PlaneGeometry(BLADE_WIDTH, 1, 1, BLADE_SEGMENTS);
  geometry.translate(0, 0.5, 0);

  const position = geometry.attributes.position;
  const colors = new Float32Array(position.count * 3);
  const color = new THREE.Color();
  for (let i = 0; i < position.count; i++) {
    const y = position.getY(i);
    position.setX(i, position.getX(i) * (1 - y * y)); // taper toward the tip
    position.setZ(i, 0.15 * y * y); // gentle natural curve
    color.lerpColors(ROOT_COLOR, TIP_COLOR, y).toArray(colors, i * 3); // darker at the root
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function createGrass() {
  const random = createRandom(7);
  const geometry = createBladeGeometry();

  // Random phase per blade so neighbours don't flutter in sync
  const phases = new Float32Array(BLADE_COUNT);
  geometry.setAttribute('aWindPhase', new THREE.InstancedBufferAttribute(phases, 1));

  const material = applyWindBend(
    new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.9 }),
    {
      minY: 0, // the root is fixed
      maxY: 1, // the tip bends the most
      bend: 0.8,
      power: 2,
      flutter: 0.07,
      flutterFrequency: 5,
      flutterScale: 1.5,
      gustDepth: 0.65,
      instancePhase: true,
    }
  );

  const mesh = new THREE.InstancedMesh(geometry, material, BLADE_COUNT);
  mesh.receiveShadow = true;
  // Blades bend outside their original bounds and the camera stands inside the field
  mesh.frustumCulled = false;

  const dummy = new THREE.Object3D();
  const tint = new THREE.Color();
  for (let i = 0; i < BLADE_COUNT; i++) {
    // Picking the radius uniformly (not its square) packs more blades near the centre
    const radius = CLEAR_RADIUS + (FIELD_RADIUS - CLEAR_RADIUS) * random();
    const angle = random() * Math.PI * 2;
    const height = BLADE_MIN_HEIGHT + (BLADE_MAX_HEIGHT - BLADE_MIN_HEIGHT) * random();

    dummy.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
    dummy.rotation.set(0, random() * Math.PI * 2, 0);
    dummy.scale.set(0.7 + random() * 0.8, height, 1);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);

    // Slight brightness variation per blade
    mesh.setColorAt(i, tint.setScalar(0.8 + random() * 0.4));
    phases[i] = random() * Math.PI * 2;
  }

  return mesh;
}

export function Grass() {
  const grass = useMemo(createGrass, []);

  useEffect(() => {
    return () => {
      grass.geometry.dispose();
      (grass.material as THREE.Material).dispose();
    };
  }, [grass]);

  // Push the current wind into the shader once per frame
  useFrame(({ clock }) => syncWindUniforms(clock.elapsedTime));

  return <primitive object={grass} />;
}
