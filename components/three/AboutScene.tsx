"use client";

// «О проекте»: камера облетает 3D-зал по мере прокрутки.
// progress — дробный номер раздела (0 = начало, 1 = заказы, … 5 = финал), его считает страница.

import { useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { FpsGuard } from "./FpsGuard";
import { Vector3, type Group, type Mesh, type PerspectiveCamera } from "three";
import type { MotionValue } from "motion/react";
import { Lights, Room, Tables, tableCenter, hallAnchors, FLOOR_D, FLOOR_W, type Table3D } from "./HallModel";
import { LabelOverlay, LabelProjector, useLabelRefs } from "./Labels";
import { usePalette, type Palette } from "./support";

// [позиция камеры, куда смотрит] для каждого раздела
const SHOTS: [number, number, number][][] = [
  [[15, 14, 19], [0, 0, 0.5]], // начало: весь зал
  [[3.5, 4.4, 8.5], [-1.5, 0.6, 0]], // заказы: столы крупно
  [[9, 3.8, 0.5], [5.4, 1, -5.5]], // склад: кухня и мешки
  [[-2, 3.8, 2], [-6.2, 1, -4.8]], // персонал: касса и люди
  [[0, 18, 12.5], [0, 0, 0]], // отчёты: сверху, столбцы над столами
  [[-15, 12, 16], [0, 0.4, 0]], // финал
];

const smooth = (x: number) => x * x * (3 - 2 * x);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

function CameraRig({ progress }: { progress: MotionValue<number> }) {
  const { camera, size } = useThree();
  const pos = useMemo(() => new Vector3(...SHOTS[0][0]), []);
  const look = useMemo(() => new Vector3(...SHOTS[0][1]), []);
  const wantPos = useMemo(() => new Vector3(), []);
  const wantLook = useMemo(() => new Vector3(), []);
  const tmp = useMemo(() => new Vector3(), []);

  useFrame((_, dt) => {
    const p = Math.min(SHOTS.length - 1, Math.max(0, progress.get()));
    const i = Math.min(SHOTS.length - 2, Math.floor(p));
    const k = smooth(p - i);
    wantPos.fromArray(SHOTS[i][0]).lerp(tmp.fromArray(SHOTS[i + 1][0]), k);
    wantLook.fromArray(SHOTS[i][1]).lerp(tmp.fromArray(SHOTS[i + 1][1]), k);
    // инерция: камера догоняет нужную точку, а не прыгает
    const a = Math.min(1, dt * 3);
    pos.lerp(wantPos, a);
    look.lerp(wantLook, a);
    camera.position.copy(pos);
    camera.lookAt(look);

    // на широком экране текст слева — сдвигаем картинку вправо
    const cam = camera as PerspectiveCamera;
    if (size.width >= 1024) cam.setViewOffset(size.width, size.height, -size.width * 0.17, 0, size.width, size.height);
    else cam.clearViewOffset();
  });
  return null;
}

/** Люди в зале: официанты у столов, кассир, повар. Появляются в разделе «Персонал». */
function Staff({ tables, palette, progress }: { tables: Table3D[]; palette: Palette; progress: MotionValue<number> }) {
  const group = useRef<Group>(null);
  const spots = useMemo(() => {
    const near = tables.slice(0, 3).map((t) => {
      const [x, z] = tableCenter(t);
      return { x: x + 1.05, z: z + 0.7, color: palette.saffron };
    });
    return [
      ...near,
      { x: -FLOOR_W / 2 + 1.6, z: -FLOOR_D / 2 + 0.6, color: palette.lapis }, // кассир
      { x: FLOOR_W / 2 - 2.6, z: -FLOOR_D / 2 + 0.6, color: palette.text }, // повар
    ];
  }, [tables, palette]);

  useFrame((state) => {
    const g = group.current;
    if (!g) return;
    const s = smooth(clamp01((progress.get() - 2.4) / 0.5));
    g.children.forEach((c, i) => {
      c.scale.setScalar(Math.max(0.001, s));
      c.position.y = s > 0.99 ? Math.abs(Math.sin(state.clock.elapsedTime * 2 + i)) * 0.04 : 0;
    });
  });

  return (
    <group ref={group}>
      {spots.map((s, i) => (
        <group key={i} position={[s.x, 0, s.z]}>
          <mesh position={[0, 0.55, 0]} castShadow>
            <cylinderGeometry args={[0.16, 0.26, 1.1, 7]} />
            <meshStandardMaterial color={s.color} flatShading roughness={0.7} />
          </mesh>
          <mesh position={[0, 1.3, 0]} castShadow>
            <icosahedronGeometry args={[0.2, 1]} />
            <meshStandardMaterial color="#d9a77c" flatShading roughness={0.8} />
          </mesh>
          {/* тюбетейка */}
          <mesh position={[0, 1.47, 0]}>
            <cylinderGeometry args={[0.15, 0.17, 0.1, 4]} />
            <meshStandardMaterial color={palette.pomegranate} flatShading />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** Столбцы над столами: выручка каждого стола за месяц (относительная высота). */
function Columns({ tables, palette, progress }: { tables: (Table3D & { share: number })[]; palette: Palette; progress: MotionValue<number> }) {
  const refs = useRef<(Mesh | null)[]>([]);
  useFrame(() => {
    const g = smooth(clamp01((progress.get() - 3.35) / 0.55));
    tables.forEach((t, i) => {
      const m = refs.current[i];
      if (!m) return;
      const h = Math.max(0.001, (0.25 + t.share * 3.6) * g);
      m.scale.y = h;
      m.position.y = 0.9 + h / 2;
      m.visible = g > 0.01;
    });
  });
  return (
    <>
      {tables.map((t, i) => {
        const [x, z] = tableCenter(t);
        return (
          <mesh key={t.id} ref={(m) => void (refs.current[i] = m)} position={[x, 0.9, z]} castShadow>
            <boxGeometry args={[0.55, 1, 0.55]} />
            <meshStandardMaterial color={palette.saffron} emissive={palette.saffron} emissiveIntensity={0.35} roughness={0.4} />
          </mesh>
        );
      })}
    </>
  );
}

export default function AboutScene({
  tables,
  progress,
  labels,
  onSlow,
}: {
  tables: (Table3D & { share: number })[];
  progress: MotionValue<number>;
  labels: { kitchen: string; cash: string; entrance: string };
  onSlow: () => void;
}) {
  const palette = usePalette();
  const refs = useLabelRefs();
  const anchors = useMemo(() => hallAnchors(tables, labels, false), [tables, labels]);
  if (!palette) return null;
  return (
    <div className="relative h-full w-full">
    <Canvas shadows dpr={[1, 1.5]} camera={{ position: SHOTS[0][0], fov: 42, near: 0.1, far: 200 }} gl={{ alpha: true, antialias: true }}>
      <FpsGuard onSlow={onSlow} minFps={25} />
      <fog attach="fog" args={[palette.bg, 30, 60]} />
      <CameraRig progress={progress} />
      <Lights palette={palette} />
      <Room palette={palette} />
      <LabelProjector anchors={anchors} refs={refs} />
      <Tables tables={tables} palette={palette} />
      <Staff tables={tables} palette={palette} progress={progress} />
      <Columns tables={tables} palette={palette} progress={progress} />
    </Canvas>
    <LabelOverlay anchors={anchors} refs={refs} />
    </div>
  );
}
