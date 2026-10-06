// Debug overlay: shows the current wind direction and strength in a corner of the screen.
// This is plain HTML rendered on top of the canvas, not part of the 3D scene.

import { useEffect, useRef } from 'react';
import { wind } from './wind';

export function WindHud() {
  const text = useRef<HTMLPreElement>(null);

  useEffect(() => {
    let frame = 0;

    // Write the text directly to the DOM each frame so React doesn't re-render 60 times a second
    const update = () => {
      if (text.current) {
        const { x, z } = wind.direction;
        // 0 deg = blowing toward -Z (away from the starting camera), 90 deg = toward +X
        const degrees = (Math.atan2(x, -z) * 180) / Math.PI;
        const bar = '#'.repeat(Math.round(wind.strength * 20)).padEnd(20, '.');
        text.current.textContent =
          `wind dir  ${degrees.toFixed(0).padStart(4)} deg  (x ${x.toFixed(2)}, z ${z.toFixed(2)})\n` +
          `strength  ${wind.strength.toFixed(2)}  ${bar}`;
      }
      frame = requestAnimationFrame(update);
    };

    frame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <pre
      ref={text}
      style={{
        position: 'fixed',
        top: 12,
        left: 12,
        margin: 0,
        padding: '8px 10px',
        font: '12px/1.5 ui-monospace, Menlo, monospace',
        color: '#1f2a33',
        background: 'rgba(255, 255, 255, 0.7)',
        borderRadius: 6,
        pointerEvents: 'none', // let mouse events pass through to the canvas
      }}
    />
  );
}
