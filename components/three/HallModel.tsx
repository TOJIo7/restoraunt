"use client";

// Зал в 3D: пол, две стены, кухня, касса, вход и столы со стульями.
// Простая геометрия в коде — без загрузки моделей, поэтому быстро и без интернета.

import { useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import type { Anchor } from "./Labels";
import { Color, type Group, type MeshStandardMaterial } from "three";
import { HALL_COLS, HALL_ROWS, tableSpan, type TableStatus } from "@/lib/constants";
import type { Palette } from "./support";

export const CELL = 2;
export const FLOOR_W = HALL_COLS * CELL;
export const FLOOR_D = HALL_ROWS * CELL;
const WALL_H = 2.4;

export type Table3D = {
  id: number;
  number: number;
  seats: number;
  x: number;
  y: number;
  shape: string;
  status: TableStatus;
  caption?: string;
  /** долго ждёт оплаты — пульсирует */
  pulse?: boolean;
};

export const STATUS_COLOR: Record<TableStatus, keyof Palette> = {
  FREE: "mint",
  BUSY: "pomegranate",
  RESERVED: "lapis",
  BILL: "saffron",
};

/** Центр стола в координатах сцены. */
export function tableCenter(t: Pick<Table3D, "x" | "y" | "shape">): [number, number] {
  const span = tableSpan(t.shape);
  return [(t.x + span / 2) * CELL - FLOOR_W / 2, (t.y + 0.5) * CELL - FLOOR_D / 2];
}

function chairSpots(shape: string, seats: number) {
  const n = Math.min(seats, shape === "long" ? 10 : 8);
  const out: { x: number; z: number; rot: number }[] = [];
  if (shape === "round") {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      out.push({ x: Math.cos(a) * 0.95, z: Math.sin(a) * 0.95, rot: -a - Math.PI / 2 });
    }
    return out;
  }
  const half = shape === "long" ? 1.45 : 0.55;
  const sides = shape === "long" ? ["top", "bottom"] : ["top", "bottom", "left", "right"];
  const per: Record<string, number> = {};
  for (let i = 0; i < n; i++) per[sides[i % sides.length]] = (per[sides[i % sides.length]] ?? 0) + 1;
  for (const side of sides) {
    const c = per[side] ?? 0;
    for (let k = 0; k < c; k++) {
      const along = -half + ((k + 1) / (c + 1)) * half * 2;
      const across = shape === "long" ? 0.85 : 0.85;
      if (side === "top") out.push({ x: along, z: -across, rot: 0 });
      if (side === "bottom") out.push({ x: along, z: across, rot: Math.PI });
      if (side === "left") out.push({ x: -across, z: along, rot: Math.PI / 2 });
      if (side === "right") out.push({ x: across, z: along, rot: -Math.PI / 2 });
    }
  }
  return out;
}

function Chair({ x, z, rot, color }: { x: number; z: number; rot: number; color: string }) {
  return (
    <group position={[x, 0, z]} rotation={[0, rot, 0]}>
      <mesh position={[0, 0.42, 0]} castShadow>
        <boxGeometry args={[0.42, 0.08, 0.42]} />
        <meshStandardMaterial color={color} roughness={0.8} />
      </mesh>
      {/* спинка — со стороны от стола */}
      <mesh position={[0, 0.68, -0.19]} castShadow>
        <boxGeometry args={[0.42, 0.46, 0.06]} />
        <meshStandardMaterial color={color} roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.2, 0]}>
        <cylinderGeometry args={[0.04, 0.05, 0.4, 6]} />
        <meshStandardMaterial color={color} roughness={0.8} />
      </mesh>
    </group>
  );
}

function TableMesh({
  table,
  palette,
  interactive,
  onPick,
}: {
  table: Table3D;
  palette: Palette;
  interactive: boolean;
  onPick?: (t: Table3D) => void;
}) {
  const group = useRef<Group>(null);
  const topMat = useRef<MeshStandardMaterial>(null);
  const [hover, setHover] = useState(false);
  const [cx, cz] = tableCenter(table);
  const statusKey = STATUS_COLOR[table.status];

  // цвет плавно перетекает при смене статуса
  const target = useMemo(() => new Color(palette[statusKey]), [palette, statusKey]);
  const chairColor = useMemo(() => new Color(palette[statusKey]).lerp(new Color(palette["surface-2"]), 0.55).getStyle(), [palette, statusKey]);

  useFrame((state, dt) => {
    const g = group.current;
    if (g) g.position.y += ((hover ? 0.28 : 0) - g.position.y) * Math.min(1, dt * 12);
    const m = topMat.current;
    if (m) {
      m.color.lerp(target, Math.min(1, dt * 4));
      m.emissive.copy(m.color);
      m.emissiveIntensity = table.pulse ? 0.15 + Math.sin(state.clock.elapsedTime * 4) * 0.12 : hover ? 0.18 : 0.06;
    }
  });

  const top =
    table.shape === "round" ? (
      <cylinderGeometry args={[0.62, 0.62, 0.1, 20]} />
    ) : table.shape === "long" ? (
      <boxGeometry args={[3.1, 0.1, 1.15]} />
    ) : (
      <boxGeometry args={[1.15, 0.1, 1.15]} />
    );

  return (
    <group position={[cx, 0, cz]}>
      <group
        ref={group}
        onPointerOver={(e) => {
          if (!interactive) return;
          e.stopPropagation();
          setHover(true);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          if (!interactive) return;
          setHover(false);
          document.body.style.cursor = "";
        }}
        onClick={(e) => {
          if (!interactive || !onPick) return;
          e.stopPropagation();
          document.body.style.cursor = "";
          onPick(table);
        }}
      >
        <mesh position={[0, 0.78, 0]} castShadow receiveShadow>
          {top}
          <meshStandardMaterial ref={topMat} color={palette[statusKey]} roughness={0.55} />
        </mesh>
        {table.shape === "long" ? (
          [-1.2, 1.2].map((lx) => (
            <mesh key={lx} position={[lx, 0.38, 0]}>
              <boxGeometry args={[0.1, 0.76, 0.8]} />
              <meshStandardMaterial color={palette.line} />
            </mesh>
          ))
        ) : (
          <mesh position={[0, 0.38, 0]}>
            <cylinderGeometry args={[0.07, 0.18, 0.76, 8]} />
            <meshStandardMaterial color={palette.line} />
          </mesh>
        )}
        {chairSpots(table.shape, table.seats).map((c, i) => (
          <Chair key={i} {...c} color={chairColor} />
        ))}
        {/* невидимая «подушка» под мышь — легче попасть в стол */}
        <mesh position={[0, 0.6, 0]} visible={false}>
          <boxGeometry args={[table.shape === "long" ? 3.6 : 1.9, 1.2, 1.9]} />
        </mesh>
      </group>
    </group>
  );
}

function Sack({ position, color }: { position: [number, number, number]; color: string }) {
  return (
    <mesh position={position} castShadow>
      <dodecahedronGeometry args={[0.28, 0]} />
      <meshStandardMaterial color={color} flatShading roughness={0.9} />
    </mesh>
  );
}

/** Стены, пол, кухня, касса, вход. */
export function Room({ palette }: { palette: Palette }) {
  const halfW = FLOOR_W / 2;
  const halfD = FLOOR_D / 2;
  const sackColor = useMemo(() => new Color(palette.apricot).lerp(new Color(palette.surface), 0.5).getStyle(), [palette]);

  return (
    <group>
      {/* пол с запасом под проходы */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0.6]} receiveShadow>
        <planeGeometry args={[FLOOR_W + 2, FLOOR_D + 3.2]} />
        <meshStandardMaterial color={palette.surface} roughness={0.95} />
      </mesh>
      {/* ковёр-сюзане по центру — тонкая плитка шафранового оттенка */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
        <planeGeometry args={[FLOOR_W - 3, FLOOR_D - 3]} />
        <meshStandardMaterial color={palette["surface-2"]} roughness={1} />
      </mesh>

      {/* задняя и левая стены */}
      <mesh position={[0, WALL_H / 2, -halfD - 1.1]} receiveShadow>
        <boxGeometry args={[FLOOR_W + 2, WALL_H, 0.2]} />
        <meshStandardMaterial color={palette["surface-2"]} roughness={0.9} />
      </mesh>
      <mesh position={[-halfW - 1.1, WALL_H / 2, 0.5]} receiveShadow>
        <boxGeometry args={[0.2, WALL_H, FLOOR_D + 3.2]} />
        <meshStandardMaterial color={palette["surface-2"]} roughness={0.9} />
      </mesh>
      {/* шафрановая полоса орнамента по верху стен */}
      <mesh position={[0, WALL_H - 0.25, -halfD - 0.99]}>
        <boxGeometry args={[FLOOR_W + 2, 0.12, 0.02]} />
        <meshStandardMaterial color={palette.saffron} emissive={palette.saffron} emissiveIntensity={0.2} />
      </mesh>
      <mesh position={[-halfW - 0.99, WALL_H - 0.25, 0.5]}>
        <boxGeometry args={[0.02, 0.12, FLOOR_D + 3.2]} />
        <meshStandardMaterial color={palette.saffron} emissive={palette.saffron} emissiveIntensity={0.2} />
      </mesh>

      {/* кухня: стойка выдачи и полка с мешками (склад) — справа у задней стены */}
      <group position={[halfW - 2.6, 0, -halfD - 0.55]}>
        <mesh position={[0, 0.5, 0]} castShadow>
          <boxGeometry args={[4.6, 1, 0.8]} />
          <meshStandardMaterial color={palette.line} roughness={0.7} />
        </mesh>
        <mesh position={[0, 1.02, 0]}>
          <boxGeometry args={[4.7, 0.05, 0.9]} />
          <meshStandardMaterial color={palette.apricot} roughness={0.5} />
        </mesh>
        <Sack position={[-1.6, 1.3, 0]} color={sackColor} />
        <Sack position={[-1.05, 1.28, 0.05]} color={sackColor} />
        <Sack position={[1.5, 1.3, 0]} color={sackColor} />
        {/* казан */}
        <mesh position={[0.2, 1.22, 0]}>
          <sphereGeometry args={[0.36, 10, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
          <meshStandardMaterial color={palette.muted} flatShading metalness={0.3} roughness={0.5} side={2} />
        </mesh>
      </group>

      {/* касса — слева у задней стены */}
      <group position={[-halfW + 1.6, 0, -halfD - 0.55]}>
        <mesh position={[0, 0.55, 0]} castShadow>
          <boxGeometry args={[2.4, 1.1, 0.8]} />
          <meshStandardMaterial color={palette.line} roughness={0.7} />
        </mesh>
        <mesh position={[0.3, 1.35, 0]} rotation={[-0.25, 0, 0]}>
          <boxGeometry args={[0.8, 0.5, 0.05]} />
          <meshStandardMaterial color={palette.lapis} emissive={palette.lapis} emissiveIntensity={0.35} />
        </mesh>
      </group>

      {/* вход — арка спереди по центру */}
      <group position={[0, 0, halfD + 1.9]}>
        {[-0.9, 0.9].map((x) => (
          <mesh key={x} position={[x, 1, 0]}>
            <boxGeometry args={[0.16, 2, 0.16]} />
            <meshStandardMaterial color={palette.saffron} />
          </mesh>
        ))}
        <mesh position={[0, 2.05, 0]}>
          <boxGeometry args={[2, 0.16, 0.16]} />
          <meshStandardMaterial color={palette.saffron} />
        </mesh>
      </group>
    </group>
  );
}

export function Lights({ palette }: { palette: Palette }) {
  return (
    <>
      {/* небо — тёплый белый в обеих темах (иначе в светлой теме свет брал бы тёмный цвет текста) */}
      <hemisphereLight args={["#fff3e0", palette.bg, 0.9]} />
      <directionalLight position={[8, 14, 6]} intensity={1.6} color="#ffe2b8" castShadow shadow-mapSize={[1024, 1024]}>
        <orthographicCamera attach="shadow-camera" args={[-14, 14, 12, -12, 1, 40]} />
      </directionalLight>
      <pointLight position={[0, 4, 0]} intensity={8} distance={18} color={palette.saffron} />
    </>
  );
}

export function Tables({
  tables,
  palette,
  interactive = false,
  onPick,
}: {
  tables: Table3D[];
  palette: Palette;
  interactive?: boolean;
  onPick?: (t: Table3D) => void;
}) {
  return (
    <>
      {tables.map((t) => (
        <TableMesh key={t.id} table={t} palette={palette} interactive={interactive} onPick={onPick} />
      ))}
    </>
  );
}

const CHIP = "whitespace-nowrap rounded-full border bg-surface px-3 py-1 text-xs font-medium uppercase tracking-wider select-none";

/** Подписи: номера столов (и статус), кухня, касса, вход. Цвета — CSS-переменные темы. */
export function hallAnchors(tables: Table3D[], room: { kitchen: string; cash: string; entrance: string }, captions = true): Anchor[] {
  const halfW = FLOOR_W / 2;
  const halfD = FLOOR_D / 2;
  return [
    ...tables.map((t): Anchor => {
      const [x, z] = tableCenter(t);
      const color = `var(--${STATUS_COLOR[t.status]})`;
      return {
        key: `t${t.id}`,
        pos: [x, 1.25, z],
        content: (
          <div className="flex select-none flex-col items-center gap-0.5 whitespace-nowrap">
            <span className="num rounded-lg border bg-surface px-2 py-0.5 font-display text-base font-semibold leading-tight text-text" style={{ borderColor: color }}>
              {t.number}
            </span>
            {captions && t.caption && t.status !== "FREE" && (
              <span className="num rounded-md bg-bg/80 px-1.5 text-[11px] font-medium" style={{ color }}>
                {t.caption}
              </span>
            )}
          </div>
        ),
      };
    }),
    { key: "kitchen", pos: [halfW - 2.6, 2.1, -halfD - 0.55], content: <span className={`${CHIP} border-line text-muted`}>{room.kitchen}</span> },
    { key: "cash", pos: [-halfW + 1.6, 2.1, -halfD - 0.55], content: <span className={`${CHIP} border-line text-muted`}>{room.cash}</span> },
    { key: "entrance", pos: [0, 0.1, halfD + 2.8], content: <span className={`${CHIP} border-saffron/40 text-saffron`}>{room.entrance}</span> },
  ];
}
