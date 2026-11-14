"use client";

// Экран входа: low-poly чайник на ляганe с двумя пиалами. Медленно вращается, мягкий тёплый свет.
// Вся геометрия — в коде (LatheGeometry с малым числом граней + flatShading = «low-poly»).

import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { FpsGuard } from "./FpsGuard";
import { DoubleSide, LatheGeometry, Vector2, type Group } from "three";
import { usePalette, type Palette } from "./support";

const lathe = (pts: [number, number][], segments: number) => new LatheGeometry(pts.map(([x, y]) => new Vector2(x, y)), segments);

function Teapot({ p }: { p: Palette }) {
  const body = useMemo(
    () =>
      lathe(
        [
          [0, 0],
          [0.5, 0],
          [0.72, 0.1],
          [0.88, 0.36],
          [0.92, 0.6],
          [0.84, 0.86],
          [0.64, 1.04],
          [0.44, 1.12],
        ],
        10,
      ),
    [],
  );
  const lid = useMemo(
    () =>
      lathe(
        [
          [0.47, 1.1],
          [0.4, 1.24],
          [0.2, 1.33],
          [0, 1.35],
        ],
        10,
      ),
    [],
  );
  const band = useMemo(
    () =>
      lathe(
        [
          [0.925, 0.52],
          [0.935, 0.6],
          [0.925, 0.68],
        ],
        10,
      ),
    [],
  );

  return (
    <group>
      <mesh geometry={body} castShadow>
        <meshStandardMaterial color={p.lapis} flatShading roughness={0.35} metalness={0.05} side={DoubleSide} />
      </mesh>
      {/* золотой поясок — как роспись на чайнике */}
      <mesh geometry={band}>
        <meshStandardMaterial color={p.saffron} flatShading metalness={0.6} roughness={0.3} />
      </mesh>
      <mesh geometry={lid} castShadow>
        <meshStandardMaterial color={p.lapis} flatShading roughness={0.35} />
      </mesh>
      <mesh position={[0, 1.43, 0]}>
        <icosahedronGeometry args={[0.1, 0]} />
        <meshStandardMaterial color={p.saffron} flatShading metalness={0.6} roughness={0.3} />
      </mesh>
      {/* носик */}
      <mesh position={[1.1, 0.74, 0]} rotation={[0, 0, -0.85]} castShadow>
        <cylinderGeometry args={[0.055, 0.15, 0.9, 6]} />
        <meshStandardMaterial color={p.lapis} flatShading roughness={0.35} />
      </mesh>
      {/* ручка */}
      <mesh position={[-0.78, 0.64, 0]} rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[0.36, 0.06, 5, 10, Math.PI]} />
        <meshStandardMaterial color={p.saffron} flatShading metalness={0.5} roughness={0.35} />
      </mesh>
    </group>
  );
}

function Piala({ p, position }: { p: Palette; position: [number, number, number] }) {
  const geo = useMemo(
    () =>
      lathe(
        [
          [0, 0],
          [0.12, 0],
          [0.2, 0.04],
          [0.29, 0.22],
          [0.3, 0.24],
        ],
        9,
      ),
    [],
  );
  return (
    <group position={position}>
      <mesh geometry={geo} castShadow>
        <meshStandardMaterial color={p.text} flatShading roughness={0.4} side={DoubleSide} />
      </mesh>
      {/* чай внутри */}
      <mesh position={[0, 0.16, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.24, 9]} />
        <meshStandardMaterial color={p.apricot} roughness={0.2} />
      </mesh>
    </group>
  );
}

function Lagan({ p }: { p: Palette }) {
  const geo = useMemo(
    () =>
      lathe(
        [
          [0, 0.03],
          [0.7, 0],
          [1.55, 0.07],
          [1.78, 0.22],
          [1.84, 0.26],
        ],
        14,
      ),
    [],
  );
  const rim = useMemo(
    () =>
      lathe(
        [
          [1.72, 0.18],
          [1.8, 0.235],
          [1.84, 0.262],
        ],
        14,
      ),
    [],
  );
  return (
    <group>
      <mesh geometry={geo} receiveShadow>
        <meshStandardMaterial color={p.mint} flatShading roughness={0.45} side={DoubleSide} />
      </mesh>
      <mesh geometry={rim}>
        <meshStandardMaterial color={p.saffron} flatShading metalness={0.4} roughness={0.4} side={DoubleSide} />
      </mesh>
    </group>
  );
}

function Still({ p }: { p: Palette }) {
  const group = useRef<Group>(null);
  useFrame((state, dt) => {
    const g = group.current;
    if (!g) return;
    g.rotation.y += dt * 0.25;
    g.position.y = Math.sin(state.clock.elapsedTime * 0.8) * 0.06 - 0.35;
  });
  return (
    <group ref={group} rotation={[0.08, 0, 0]}>
      <Lagan p={p} />
      <group position={[-0.25, 0.04, -0.2]}>
        <Teapot p={p} />
      </group>
      <Piala p={p} position={[1.05, 0.05, 0.55]} />
      <Piala p={p} position={[0.2, 0.04, 1.2]} />
    </group>
  );
}

export default function TeapotScene({ onSlow }: { onSlow?: () => void }) {
  const p = usePalette();
  if (!p) return null;
  return (
    <Canvas
      shadows
      dpr={[1, 1.5]}
      camera={{ position: [0, 3.4, 8.6], fov: 34 }}
      onCreated={({ camera }) => camera.lookAt(0, 0.1, 0)}
      gl={{ alpha: true, antialias: true }}
    >
      {/* медленный компьютер — вместо 3D останется орнамент */}
      <FpsGuard onSlow={onSlow} minFps={24} />
      <hemisphereLight args={["#fff1dc", p.bg, 0.8]} />
      <directionalLight position={[3, 5, 3]} intensity={2.2} color="#ffd9a3" castShadow />
      <pointLight position={[-3, 1.5, 2]} intensity={6} color={p.saffron} distance={10} />
      <Still p={p} />
    </Canvas>
  );
}
