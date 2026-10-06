// This directive tells Next.js that this component runs on the client-side
// It's needed because we're using browser-specific features like 3D graphics and WebXR
'use client';

// Import required components for 3D rendering
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Model as PottedPlant } from './components/PottedPlant';
import { Grass } from './components/Grass';
import { WindDriver } from './components/WindDriver';
import { WindHud } from './components/WindHud';

// Import XR components for WebXR functionality (AR/VR)
import { XR, createXRStore, XROrigin } from '@react-three/xr';

// Create an XR store that manages the WebXR session state
// This store handles entering/exiting AR/VR modes and manages XR-specific functionality
const store = createXRStore();

// Sky color, shared by the background and the fog so the ground fades into the sky
const SKY_COLOR = '#cfe8f7';

// Main homepage component that renders the wind scene
export default function Home() {
  return (
    // Container div that takes up the full viewport (100% width and height)
    <div style={{ width: '100vw', height: '100vh' }}>

      {/*
        Canvas is the main React Three Fiber component that creates a 3D scene
        shadows turns on shadow rendering
        The camera sits at eye height (1.6 units) a few steps in front of the plant
      */}
      <Canvas shadows camera={{ position: [0, 1.6, 3.2], fov: 50 }}>

        {/* XR WRAPPER - enables WebXR functionality for everything inside it */}
        <XR store={store}>

        {/* XR ORIGIN - where the user's feet are in VR/AR: on the ground, facing the plant */}
        <XROrigin position={[0, 0, 3]} />

        {/*
          ENVIRONMENT
          A bright sky color with soft fog that hides the edge of the ground
        */}
        <color attach="background" args={[SKY_COLOR]} />
        <fog attach="fog" args={[SKY_COLOR, 12, 60]} />

        {/*
          LIGHTING SETUP
          Ambient light is the soft light from the sky, directional light is the sun
        */}
        <ambientLight intensity={0.9} />
        <directionalLight
          position={[4, 8, 3]}            // High and to the side, like a mid-morning sun
          intensity={2}
          castShadow
          shadow-mapSize={[2048, 2048]}   // Sharper shadow
          shadow-camera-left={-4}         // Area around the plant that receives shadows
          shadow-camera-right={4}
          shadow-camera-top={4}
          shadow-camera-bottom={-4}
        />

        {/* WIND - reads the mouse/touch input and updates the shared wind state every frame */}
        <WindDriver />

        {/*
          3D OBJECTS
        */}

        {/* Potted plant standing on the ground - its stem and leaves bend in the wind */}
        <PottedPlant position={[0, 0, 0]} scale={3} />
        
        {/* Grass field around the plant that ripples with the wind */}
        <Grass />

        {/* Large pale ground plane that receives the plant's shadow */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[200, 200]} />
          <meshStandardMaterial color="#e3ead9" roughness={1} />
        </mesh>

        {/*
          CAMERA CONTROLS
          - Left click + drag: Rotate camera around the plant
          - Right click + drag: Pan the camera
          - Scroll wheel: Zoom in and out
          - Touch: two fingers rotate and zoom (one finger is reserved for waving at the wind)
          Moving the mouse without holding a button does not move the camera - it steers the wind
        */}
        <OrbitControls
          target={[0, 0.5, 0]}                 // Look slightly down at the plant
          maxPolarAngle={Math.PI / 2 - 0.05}   // Keep the camera above the ground
          touches={{ TWO: THREE.TOUCH.DOLLY_ROTATE }}
        />

        </XR> {/* End of XR wrapper - all 3D content above is now XR-enabled */}
      </Canvas>

      {/* Debug overlay showing the current wind direction and strength */}
      <WindHud />
    </div>
  );
}
