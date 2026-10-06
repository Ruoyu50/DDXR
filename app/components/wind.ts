// Shared wind state for the whole scene.
// Anything that reacts to wind (the plant, the debug HUD, future objects) reads `wind`.
// Anything that drives the wind calls `steerWind`, and one driver calls `updateWind` once per frame.
// This file knows nothing about mice, touches or cameras - it only deals in world-space directions.

// The gentle breeze that is always present, even when nobody is gesturing
export const BASE_STRENGTH = 0.15;

// Gesture speed (viewport heights per second) that produces a full-strength gust
const FULL_GUST_SPEED = 2.5;
// Gestures slower than this are treated as noise and ignored
const MIN_GESTURE_SPEED = 0.05;
// How quickly a full-speed gesture pulls the wind direction toward itself (per second)
const STEER_RATE = 10;
// Time constants in seconds - larger means slower, smoother changes
const GUST_DECAY = 1.2; // how long a gust lingers after the gesture stops
const STRENGTH_SMOOTHING = 0.18; // how quickly the strength follows its target
const DIRECTION_SMOOTHING = 0.3; // how quickly the direction follows its target

// READ-ONLY for consumers: the current wind
// direction is a unit vector on the horizontal plane (world X and Z), strength is 0-1
export const wind = {
  direction: { x: 1, z: 0 },
  strength: BASE_STRENGTH,
};

// Internal state. The direction is stored as an angle so it can turn smoothly
// (x = cos(angle), z = sin(angle)) instead of shrinking through zero when it reverses.
let angle = 0;
let targetAngle = 0;
let gust = 0; // 0-1, the extra wind added by gestures on top of the base breeze

// Smallest signed difference between two angles, in the range -PI..PI
const shortestAngle = (delta: number) => Math.atan2(Math.sin(delta), Math.cos(delta));

// Feed a gesture into the wind.
// The gesture does not create wind out of nothing: it turns the existing wind toward
// (dirX, dirZ) and strengthens it. Faster gestures turn it harder and gust it more.
// speed is in viewport heights per second, dt is the frame time in seconds.
export function steerWind(dirX: number, dirZ: number, speed: number, dt: number) {
  if (speed < MIN_GESTURE_SPEED || (dirX === 0 && dirZ === 0)) return;

  const intensity = Math.min(1, speed / FULL_GUST_SPEED);
  const gestureAngle = Math.atan2(dirZ, dirX);

  targetAngle += shortestAngle(gestureAngle - targetAngle) * (1 - Math.exp(-STEER_RATE * intensity * dt));
  gust = Math.max(gust, intensity);
}

// Advance the wind by one frame: the gust fades back to the base breeze and the
// visible direction/strength ease toward their targets so nothing ever jumps.
export function updateWind(dt: number) {
  gust *= Math.exp(-dt / GUST_DECAY);

  const targetStrength = BASE_STRENGTH + (1 - BASE_STRENGTH) * gust;
  wind.strength += (targetStrength - wind.strength) * (1 - Math.exp(-dt / STRENGTH_SMOOTHING));

  angle += shortestAngle(targetAngle - angle) * (1 - Math.exp(-dt / DIRECTION_SMOOTHING));
  wind.direction.x = Math.cos(angle);
  wind.direction.z = Math.sin(angle);
}
