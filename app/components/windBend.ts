// Reusable "bend in the wind" effect for any mesh.
// It patches a material's vertex shader so that vertices above a height threshold
// are pushed downwind on the GPU. Nothing below the threshold moves, so a pot or
// the root of a grass blade stays planted while the top bends.
//
// Usage:
//   const material = applyWindBend(someMaterial, { minY, maxY });
//   const depthMaterial = createWindDepthMaterial({ minY, maxY }); // only if the mesh casts shadows
//   useFrame(({ clock }) => syncWindUniforms(clock.elapsedTime));
//
// The wind itself comes from the shared wind state in wind.ts.

import * as THREE from 'three';
import { wind } from './wind';

export type WindBendOptions = {
  // Height in the geometry's own local Y coordinates (before any scale) where bending starts.
  // Everything below it stays perfectly still.
  minY: number;
  // Local height that bends the most (normally the top of the geometry)
  maxY: number;
  // How far the top moves at full wind strength, as a fraction of the bending height (maxY - minY)
  bend?: number;
  // Shape of the bend along the height: 1 = eases in gently, 2 = stays stiff low down and whips at the top
  power?: number;
  // Size of the flutter, as a fraction of the bending height
  flutter?: number;
  // How fast the flutter oscillates (it also speeds up automatically as the wind gets stronger)
  flutterFrequency?: number;
  // How much the flutter differs from place to place, in radians per world unit.
  // Higher values make neighbouring vertices move less like one solid piece.
  flutterScale?: number;
  // How strongly the rolling gusts modulate the bend: 0 = constant lean, 1 = fully relaxes between gusts
  gustDepth?: number;
  // Set to true for instanced meshes whose geometry has a per-instance 'aWindPhase' attribute
  instancePhase?: boolean;
};

// Rolling gusts: bands of stronger wind that travel downwind across the whole scene
const GUST_WAVE_SCALE = 1.6; // radians per world unit - larger means narrower bands
const GUST_WAVE_SPEED = 2.0; // how fast the bands travel

// The wind clock runs faster in stronger wind, so everything moves quicker
const WIND_TIME_BASE_RATE = 0.5;
const WIND_TIME_STRENGTH_RATE = 2.5;

// Uniforms shared by every wind-bent material, updated once per frame from the wind state
const windUniforms = {
  uWindDirection: { value: new THREE.Vector2(wind.direction.x, wind.direction.z) },
  uWindStrength: { value: wind.strength },
  uWindTime: { value: 0 },
};

let lastSyncTime = -1;

// Copy the current wind state into the shader uniforms.
// Call it from useFrame with the clock's elapsed time. It is safe to call from several
// components - only the first call in each frame does any work.
export function syncWindUniforms(elapsedTime: number) {
  if (elapsedTime === lastSyncTime) return;
  const dt = lastSyncTime < 0 ? 0 : Math.min(Math.max(elapsedTime - lastSyncTime, 0), 0.1);
  lastSyncTime = elapsedTime;

  windUniforms.uWindDirection.value.set(wind.direction.x, wind.direction.z);
  windUniforms.uWindStrength.value = wind.strength;
  windUniforms.uWindTime.value += dt * (WIND_TIME_BASE_RATE + WIND_TIME_STRENGTH_RATE * wind.strength);
}

const vertexDeclarations = /* glsl */ `
uniform vec2 uWindDirection;
uniform float uWindStrength;
uniform float uWindTime;
uniform float uBendMinY;
uniform float uBendMaxY;
uniform float uBendAmount;
uniform float uBendPower;
uniform float uFlutterAmount;
uniform float uFlutterFrequency;
uniform float uFlutterScale;
uniform float uGustDepth;
#ifdef WIND_INSTANCE_PHASE
attribute float aWindPhase;
#endif
`;

const vertexBend = /* glsl */ `
{
  mat4 windModel = modelMatrix;
  #ifdef USE_INSTANCING
    windModel = modelMatrix * instanceMatrix;
  #endif
  mat3 windBasis = mat3(windModel);
  vec3 windWorld = (windModel * vec4(transformed, 1.0)).xyz;

  // 0 below the threshold, rising smoothly to 1 at the top
  float windWeight = pow(smoothstep(uBendMinY, uBendMaxY, position.y), uBendPower);

  // Real-world size of the bending part, so the effect looks the same at any scale
  float windScaleY = length(windBasis[1]);
  float windRange = (uBendMaxY - uBendMinY) * windScaleY;
  float windHeight = max(position.y - uBendMinY, 0.0) * windScaleY;

  vec2 windCross = vec2(-uWindDirection.y, uWindDirection.x);

  // Rolling gusts travelling downwind, with slightly wavy fronts
  float windAlong = dot(windWorld.xz, uWindDirection);
  float windAcross = dot(windWorld.xz, windCross);
  float windGust = 0.5 + 0.5 * sin(windAlong * ${GUST_WAVE_SCALE.toFixed(2)} - uWindTime * ${GUST_WAVE_SPEED.toFixed(2)} + sin(windAcross * 0.7) * 1.5);
  float windLean = uWindStrength * uBendAmount * mix(1.0 - uGustDepth, 1.0, windGust);

  // Flutter: a faster shake whose phase depends on where the vertex is
  float windPhase = dot(windWorld, vec3(1.0, 0.6, 0.8)) * uFlutterScale;
  #ifdef WIND_INSTANCE_PHASE
    windPhase += aWindPhase;
  #endif
  float windFlutter = uFlutterAmount * (0.3 + 0.7 * uWindStrength);
  float windFlutterAlong = sin(uWindTime * uFlutterFrequency + windPhase) * windFlutter;
  float windFlutterAcross = sin(uWindTime * uFlutterFrequency * 1.7 + windPhase * 1.3 + 2.0) * windFlutter * 0.6;

  vec2 windPush = (uWindDirection * (windLean + windFlutterAlong) + windCross * windFlutterAcross) * windRange * windWeight;

  // Lower the vertex as it leans so it swings on an arc instead of stretching
  float windPushLength = length(windPush);
  float windMaxPush = windHeight * 0.9;
  if (windPushLength > windMaxPush) {
    windPush *= windMaxPush / max(windPushLength, 1e-6);
    windPushLength = windMaxPush;
  }
  float windDrop = windHeight - sqrt(max(windHeight * windHeight - windPushLength * windPushLength, 0.0));

  // The push is in world space - convert it back into the object's local space
  transformed += inverse(windBasis) * vec3(windPush.x, -windDrop, windPush.y);
}
`;

// Add wind bending to a material. Works with the built-in three.js materials
// (standard, lambert, depth, ...) and with instanced meshes. Returns the same material.
export function applyWindBend<T extends THREE.Material>(material: T, options: WindBendOptions): T {
  const uniforms = {
    ...windUniforms,
    uBendMinY: { value: options.minY },
    uBendMaxY: { value: options.maxY },
    uBendAmount: { value: options.bend ?? 0.5 },
    uBendPower: { value: options.power ?? 2 },
    uFlutterAmount: { value: options.flutter ?? 0.05 },
    uFlutterFrequency: { value: options.flutterFrequency ?? 4 },
    uFlutterScale: { value: options.flutterScale ?? 4 },
    uGustDepth: { value: options.gustDepth ?? 0.4 },
  };

  if (options.instancePhase) {
    // defines exists on every material at runtime but is missing from the base Material type
    const withDefines = material as THREE.Material & { defines?: Record<string, unknown> };
    withDefines.defines = { ...withDefines.defines, WIND_INSTANCE_PHASE: '' };
  }

  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `${vertexDeclarations}\n#include <common>`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${vertexBend}`);
  };

  return material;
}

// Shadow-pass material with the same bending, so the shadow moves with the mesh.
// Pass it to a mesh as customDepthMaterial.
export function createWindDepthMaterial(options: WindBendOptions) {
  return applyWindBend(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }), options);
}
