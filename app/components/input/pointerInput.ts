// Mouse / touch implementation of GestureSource.
// Moving the mouse (no button held) or dragging one finger counts as waving a hand.
// This module only measures the motion - it does not know about the wind or the 3D scene.

import { Gesture, GestureSource } from './gesture';

export function createPointerInput(target: Window | HTMLElement = window): GestureSource {
  // Pointer travel in pixels accumulated since the last sample() call
  let accumulatedX = 0;
  let accumulatedY = 0;
  let lastX: number | null = null;
  let lastY: number | null = null;
  let lastSampleTime = performance.now();

  const onPointerDown = (e: Event) => {
    const event = e as PointerEvent;
    if (!event.isPrimary) return;
    // A new touch starts somewhere else on screen - don't count the jump as motion
    lastX = event.clientX;
    lastY = event.clientY;
  };

  const onPointerMove = (e: Event) => {
    const event = e as PointerEvent;
    if (!event.isPrimary) return;

    // Dragging with a mouse button held is OrbitControls moving the camera, not a wave
    const isWave = !(event.pointerType === 'mouse' && event.buttons !== 0);
    if (isWave && lastX !== null && lastY !== null) {
      accumulatedX += event.clientX - lastX;
      accumulatedY += event.clientY - lastY;
    }
    lastX = event.clientX;
    lastY = event.clientY;
  };

  target.addEventListener('pointerdown', onPointerDown);
  target.addEventListener('pointermove', onPointerMove);

  return {
    sample(): Gesture | null {
      const now = performance.now();
      const seconds = (now - lastSampleTime) / 1000;
      lastSampleTime = now;

      const distance = Math.hypot(accumulatedX, accumulatedY);
      const x = accumulatedX;
      const y = accumulatedY;
      accumulatedX = 0;
      accumulatedY = 0;

      if (distance < 1 || seconds <= 0) return null;

      return {
        x: x / distance,
        y: -y / distance, // screen Y grows downward, gestures use Y up
        speed: distance / window.innerHeight / seconds,
      };
    },

    dispose() {
      target.removeEventListener('pointerdown', onPointerDown);
      target.removeEventListener('pointermove', onPointerMove);
    },
  };
}
