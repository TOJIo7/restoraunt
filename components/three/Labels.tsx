"use client";

// Подписи над 3D-объектами обычным DOM поверх холста.
// Каждый кадр 3D-точка проецируется в координаты экрана, и подписи двигается через transform.
// (Вместо Html из drei: тот создаёт свой React-корень на каждую подпись и ломается при размонтировании.)

import { useMemo, useRef, type ReactNode, type RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Vector3 } from "three";

export type Anchor = { key: string; pos: [number, number, number]; content: ReactNode };
type Refs = RefObject<Map<string, HTMLDivElement>>;

export function useLabelRefs(): Refs {
  return useRef(new Map<string, HTMLDivElement>());
}

/** Слой подписей — кладётся рядом с <Canvas> внутри relative-контейнера. */
export function LabelOverlay({ anchors, refs }: { anchors: Anchor[]; refs: Refs }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {anchors.map((a) => (
        <div
          key={a.key}
          ref={(el) => {
            if (el) refs.current.set(a.key, el);
            else refs.current.delete(a.key);
          }}
          className="absolute left-0 top-0 will-change-transform"
          style={{ visibility: "hidden" }}
        >
          <div className="-translate-x-1/2 -translate-y-1/2">{a.content}</div>
        </div>
      ))}
    </div>
  );
}

/** Внутри <Canvas>: каждый кадр двигает подписи за своими точками. */
export function LabelProjector({ anchors, refs }: { anchors: Anchor[]; refs: Refs }) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const v = useMemo(() => new Vector3(), []);
  useFrame(() => {
    for (const a of anchors) {
      const el = refs.current.get(a.key);
      if (!el) continue;
      v.set(a.pos[0], a.pos[1], a.pos[2]).project(camera);
      const behind = v.z > 1 || v.z < -1;
      el.style.visibility = behind ? "hidden" : "visible";
      if (behind) continue;
      const x = ((v.x + 1) / 2) * size.width;
      const y = ((1 - v.y) / 2) * size.height;
      el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
    }
  });
  return null;
}
