// 3D model component that loads a GLTF file and bends in the wind
// The pot stays still - only the stem and leaves above the rim move (see windBend.ts)

import * as THREE from 'three'
import React, { useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { TessellateModifier } from 'three/examples/jsm/modifiers/TessellateModifier.js'
import { GLTFResult } from '../types/gltf'
import { applyWindBend, createWindDepthMaterial, syncWindUniforms, WindBendOptions } from './windBend'

// MODEL MEASUREMENTS
// These are in the model's own coordinates (the raw numbers stored in potted-plant.glb,
// before the scale={100} on the mesh and the scale on the group).
// The model is one mesh made of 16 separate pieces: the pot, the stem and 14 leaves.
//   - whole model: y from 0 to 0.002817
//   - pot:         y from 0 to 0.001295 (its rim is the top ring of vertices)
//   - stem:        starts inside the pot at y = 0.00112
//   - lowest leaf: starts at y = 0.00140
// So the rim height cleanly separates "pot" from "plant". Raise POT_RIM_Y to keep more
// of the plant stiff, lower it and the pot itself starts to deform.
const POT_RIM_Y = 0.00129
const PLANT_TOP_Y = 0.00282

const WIND_BEND: WindBendOptions = {
  minY: POT_RIM_Y,
  maxY: PLANT_TOP_Y,
  bend: 0.45,            // top moves up to 45% of the foliage height at full wind
  power: 1,              // lets the lower leaves move too, not just the top
  flutter: 0.05,
  flutterFrequency: 4,
  flutterScale: 6,       // leaves shake out of step with each other
  gustDepth: 0.3,
}

// The original model has only 390 triangles and the stem has just 3 segments, which would
// bend as a visible zigzag. Splitting every edge longer than this (in model coordinates)
// gives about 1500 triangles and a smooth curve without changing the shape.
const MAX_EDGE_LENGTH = 0.0003
const TESSELLATE_ITERATIONS = 6

// Component that renders a 3D potted plant model
// It accepts group props, which means you can position, rotate, and scale the entire model
export function Model(props: React.ComponentProps<'group'>) {

  // GLTF LOADING
  // useGLTF hook loads a 3D model file and extracts its parts
  // The file '/potted-plant.glb' must be in the public folder
  const { nodes, materials } = useGLTF('/potted-plant.glb') as unknown as GLTFResult

  // Add extra vertices so the bend is smooth
  // We cast to THREE.Mesh because our generic type doesn't know the specific node type
  const geometry = useMemo(
    () => new TessellateModifier(MAX_EDGE_LENGTH, TESSELLATE_ITERATIONS)
      .modify((nodes.Potted_Plant000 as unknown as THREE.Mesh).geometry),
    [nodes]
  )

  // Copy the model's material and add the wind bending to its vertex shader
  const material = useMemo(() => applyWindBend(materials.Material.clone(), WIND_BEND), [materials])
  // The shadow is drawn with a separate material, which needs the same bending
  const depthMaterial = useMemo(() => createWindDepthMaterial(WIND_BEND), [])

  // Push the current wind into the shader once per frame
  useFrame(({ clock }) => syncWindUniforms(clock.elapsedTime))

  return (
    // group is like a container that holds multiple 3D objects together
    // dispose={null} prevents automatic cleanup
    <group {...props} dispose={null}>
      <mesh
        geometry={geometry}
        material={material}
        customDepthMaterial={depthMaterial}

        // Scale up the model (the original is only a few millimeters big)
        scale={100}

        // Cast a shadow onto the ground
        castShadow
      />
    </group>
  )
}

// PERFORMANCE OPTIMIZATION
// Preload the GLTF file so it's ready when the component mounts
// This prevents loading delays when the component first renders
useGLTF.preload('/potted-plant.glb')
