// The contract between an input device and the wind.
// Every input (mouse/touch today, camera hand tracking later) reports the same thing:
// which way the hand is waving across the screen, and how fast.

export type Gesture = {
  // Unit vector of the wave direction in screen space: x points right, y points up
  x: number;
  y: number;
  // Wave speed in viewport heights per second
  speed: number;
};

export interface GestureSource {
  // Called once per frame. Returns the motion since the previous call, or null if there was none.
  sample(): Gesture | null;
  // Stop listening and release any resources
  dispose(): void;
}
