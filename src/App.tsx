import React, { useRef, useMemo, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, OrbitControls, ContactShadows, MeshTransmissionMaterial } from '@react-three/drei';
import * as THREE from 'three';
import { FluidMPM, num_particles } from './mpm';
import { MarchingCubes } from 'three-stdlib';

const Simulation = () => {
  const mpm = useMemo(() => new FluidMPM(), []);
  
  const mCubes = useMemo(() => {
    // We pass a dummy material first, it will be replaced by MeshTransmissionMaterial
    const mc = new MarchingCubes(64, new THREE.MeshBasicMaterial(), false, false, 100000);
    mc.scale.set(5, 5, 5);
    return mc;
  }, []);

  const handlePointerMove = (e: any) => {
    // Convert from 3D space back to 0-1 simulation space
    // Simulation space is mapped to [-5, 5] in 3D
    const x = (e.point.x / 10) + 0.5;
    const y = (e.point.y / 10) + 0.5;
    mpm.mouse_x = x;
    mpm.mouse_y = y;
  };

  useFrame(() => {
    // Run multiple steps per frame for stability
    for (let i = 0; i < 25; i++) {
      mpm.step();
    }

    mCubes.reset();
    
    // Add particles to marching cubes
    // mpm.x is in [0, 1] range.
    // MarchingCubes addBall takes x, y, z in [0, 1] range.
    for (let i = 0; i < num_particles; i++) {
      const px = mpm.x[i * 2];
      const py = mpm.x[i * 2 + 1];
      // We add a small amount of strength per particle
      mCubes.addBall(px, py, 0.5, 0.012, 12);
    }
    
    mCubes.update();
  });

  // The fluid boundaries are at bound = 3/64 = 0.046875 in [0, 1] space.
  // This maps to (0.046875 - 0.5) * 10 = -4.53125 in 3D space.
  const wallOffset = 4.53125;

  return (
    <group>
      <primitive object={mCubes}>
        <MeshTransmissionMaterial
          attach="material"
          backside
          samples={4}
          thickness={0.5}
          chromaticAberration={0.05}
          anisotropy={0.1}
          distortion={0.1}
          distortionScale={0.5}
          temporalDistortion={0.1}
          ior={1.33}
          color="#aaddff"
          resolution={512}
        />
      </primitive>
      
      {/* Invisible plane for mouse interaction */}
      <mesh 
        visible={false} 
        position={[0, 0, 0]} 
        onPointerMove={handlePointerMove}
        onPointerDown={(e) => { mpm.mouse_active = true; handlePointerMove(e); }}
        onPointerUp={() => { mpm.mouse_active = false; }}
        onPointerOut={() => { mpm.mouse_active = false; }}
      >
        <planeGeometry args={[20, 20]} />
      </mesh>
      
      {/* Container walls */}
      <mesh position={[0, -wallOffset - 0.1, 0]}>
        <boxGeometry args={[wallOffset * 2 + 0.4, 0.2, 2]} />
        <meshStandardMaterial color="#333" roughness={0.2} metalness={0.8} />
      </mesh>
      <mesh position={[-wallOffset - 0.1, 0, 0]}>
        <boxGeometry args={[0.2, wallOffset * 2, 2]} />
        <meshStandardMaterial color="#333" roughness={0.2} metalness={0.8} />
      </mesh>
      <mesh position={[wallOffset + 0.1, 0, 0]}>
        <boxGeometry args={[0.2, wallOffset * 2, 2]} />
        <meshStandardMaterial color="#333" roughness={0.2} metalness={0.8} />
      </mesh>
    </group>
  );
};

export default function App() {
  return (
    <div className="w-full h-screen bg-neutral-950 overflow-hidden">
      <Canvas camera={{ position: [0, 0, 12], fov: 45 }}>
        <color attach="background" args={['#050505']} />
        <ambientLight intensity={0.4} />
        <directionalLight position={[10, 10, 10]} intensity={1.5} castShadow />
        <pointLight position={[-10, -10, -10]} intensity={0.5} color="#0044ff" />
        <Simulation />
        <Environment preset="city" />
        <OrbitControls enablePan={false} maxPolarAngle={Math.PI / 2 + 0.1} minPolarAngle={Math.PI / 2 - 0.1} />
        <ContactShadows position={[0, -4.7, 0]} opacity={0.8} scale={20} blur={2} far={10} />
      </Canvas>
      
      <div className="absolute top-6 left-6 text-white font-mono pointer-events-none select-none">
        <h1 className="text-2xl font-bold tracking-tighter mb-1">MLS-MPM WATER</h1>
        <p className="text-neutral-400 text-sm mb-4">Material Point Method Simulation</p>
        
        <div className="flex flex-col gap-2 text-xs text-neutral-500">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
            <span>{num_particles} Particles</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500"></div>
            <span>Real-time CPU Compute</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-purple-500"></div>
            <span>Surface Reconstruction (Marching Cubes)</span>
          </div>
        </div>
        
        <div className="mt-8 p-3 bg-white/5 border border-white/10 rounded-lg backdrop-blur-sm inline-block">
          <p className="text-neutral-300 text-sm">Drag cursor to interact with fluid</p>
        </div>
      </div>
    </div>
  );
}

