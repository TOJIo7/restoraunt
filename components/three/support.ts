"use client";

import { useSyncExternalStore } from "react";

let webgl: boolean | null = null;
function hasWebGL() {
  if (webgl === null) {
    try {
      const c = document.createElement("canvas");
      webgl = !!(c.getContext("webgl2") || c.getContext("webgl"));
    } catch {
      webgl = false;
    }
  }
  return webgl;
}

const REDUCE = "(prefers-reduced-motion: reduce)";

/** Можно ли показывать 3D: есть WebGL и не включено «уменьшить движение». */
export function canUse3D() {
  if (typeof window === "undefined") return false;
  return !window.matchMedia(REDUCE).matches && hasWebGL();
}

function subscribeMotion(cb: () => void) {
  const mq = window.matchMedia(REDUCE);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

/** null — на сервере (ещё не знаем), в браузере true/false; следит за «уменьшить движение». */
export function use3DSupport() {
  return useSyncExternalStore<boolean | null>(subscribeMotion, canUse3D, () => null);
}

const VARS = ["bg", "surface", "surface-2", "line", "text", "muted", "saffron", "pomegranate", "mint", "lapis", "apricot"] as const;
export type Palette = Record<(typeof VARS)[number], string>;

let cache: { theme: string; palette: Palette } | null = null;
function readPalette(): Palette {
  const theme = document.documentElement.dataset.theme ?? "";
  if (!cache || cache.theme !== theme) {
    const css = getComputedStyle(document.documentElement);
    const palette = Object.fromEntries(VARS.map((v) => [v, css.getPropertyValue(`--${v}`).trim() || "#888"])) as Palette;
    cache = { theme, palette };
  }
  return cache.palette;
}

function subscribeTheme(cb: () => void) {
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => mo.disconnect();
}

/** Цвета темы из CSS-переменных; обновляются при переключении тёмной / светлой темы. */
export function usePalette() {
  return useSyncExternalStore<Palette | null>(subscribeTheme, readPalette, () => null);
}
