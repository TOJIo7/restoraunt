"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";

/**
 * Следит за частотой кадров. Первые секунды пропускает (там компилируются шейдеры),
 * дальше меряет окнами по 1,5 с; если три окна подряд ниже minFps — зовёт onSlow (переход на 2D / картинку).
 */
export function FpsGuard({ onSlow, minFps = 30, warmup = 3 }: { onSlow?: () => void; minFps?: number; warmup?: number }) {
  const s = useRef({ t: 0, frames: 0, win: 0, bad: 0, done: false });
  useFrame((_, dt) => {
    const st = s.current;
    if (st.done || !onSlow) return;
    // вкладка была скрыта или долгая пауза — окно не считаем
    if (dt > 0.5) {
      st.frames = 0;
      st.win = 0;
      return;
    }
    st.t += dt;
    if (st.t < warmup) return;
    st.frames++;
    st.win += dt;
    if (st.win < 1.5) return;
    const fps = st.frames / st.win;
    st.bad = fps < minFps ? st.bad + 1 : 0;
    st.frames = 0;
    st.win = 0;
    if (st.bad >= 3) {
      st.done = true;
      onSlow();
    }
  });
  return null;
}
