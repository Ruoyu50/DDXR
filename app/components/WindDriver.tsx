// Connects an input device to the wind state. Renders nothing.
// Each frame it asks the input for the latest gesture, converts it from screen space
// into a horizontal world direction as seen from the camera, and updates the wind.
// To add another input later (e.g. camera hand tracking), create a different
// GestureSource here - the wind and the plant do not need to change.

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { GestureSource } from './input/gesture';
import { createPointerInput } from './input/pointerInput';
import { steerWind, updateWind } from './wind';

const forward = new THREE.Vector3();

export function WindDriver() {
  const source = useRef<GestureSource | null>(null);

  useEffect(() => {
    const input = createPointerInput();
    source.current = input;
    return () => {
      input.dispose();
      source.current = null;
    };
  }, []);

  useFrame(({ camera }, delta) => {
    // Clamp the frame time so a background tab coming back doesn't cause a jump
    const dt = Math.min(delta, 0.1);

    const gesture = source.current?.sample();
    if (gesture) {
      // Camera's forward direction flattened onto the ground plane
      camera.getWorldDirection(forward);
      forward.y = 0;

      // Looking straight down has no horizontal forward - skip steering for that frame
      if (forward.lengthSq() > 1e-6) {
        forward.normalize();
        // Camera's right direction on the ground plane (forward x up)
        const rightX = -forward.z;
        const rightZ = forward.x;

        // Waving right pushes the wind to the camera's right, waving up pushes it away from the camera
        steerWind(
          rightX * gesture.x + forward.x * gesture.y,
          rightZ * gesture.x + forward.z * gesture.y,
          gesture.speed,
          dt
        );
      }
    }

    updateWind(dt);
  });

  return null;
}
