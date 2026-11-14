"use client";

// 3D-схема зала для раздела «Зал». Грузится отдельно (next/dynamic), только когда включили 3D.

import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, OrthographicCamera } from "@react-three/drei";
import { FpsGuard } from "./FpsGuard";
import { useMemo } from "react";
import { FLOOR_D, FLOOR_W, Lights, Room, Tables, hallAnchors, type Table3D } from "./HallModel";
import { LabelOverlay, LabelProjector, useLabelRefs } from "./Labels";
import { usePalette } from "./support";

/** Изометрия: камера по диагонали; масштаб подобран под размер окна, чтобы зал помещался целиком. */
function IsoCamera() {
  const size = useThree((s) => s.size);
  const zoom = Math.min(size.width / (FLOOR_W + 8), size.height / (FLOOR_D + 7.5));
  return <OrthographicCamera makeDefault position={[16, 15, 18]} zoom={zoom} near={0.1} far={200} />;
}

export default function Hall3D({
  tables,
  onPick,
  labels,
  onSlow,
}: {
  tables: Table3D[];
  onPick: (t: Table3D) => void;
  labels: { kitchen: string; cash: string; entrance: string };
  /** 3D тормозит — родитель переключит на 2D */
  onSlow: () => void;
}) {
  const palette = usePalette();
  const refs = useLabelRefs();
  const anchors = useMemo(() => hallAnchors(tables, labels), [tables, labels]);
  if (!palette) return null;
  return (
    <div className="relative h-full w-full">
    <Canvas shadows dpr={[1, 1.75]} gl={{ antialias: true }} onPointerMissed={() => (document.body.style.cursor = "")}>
      {/* если 3D стабильно тянет меньше 30 кадров — уходим в 2D */}
      <FpsGuard onSlow={onSlow} />
      <color attach="background" args={[palette.bg]} />
      <IsoCamera />
      <Lights palette={palette} />
      <Room palette={palette} />
      <LabelProjector anchors={anchors} refs={refs} />
      <Tables tables={tables} palette={palette} interactive onPick={onPick} />
      <OrbitControls
        target={[0, 0, 0.5]}
        enablePan={false}
        enableDamping
        minPolarAngle={0.35}
        maxPolarAngle={1.2}
        minZoom={15}
        maxZoom={120}
        zoomSpeed={0.6}
      />
    </Canvas>
    <LabelOverlay anchors={anchors} refs={refs} />
    </div>
  );
}
