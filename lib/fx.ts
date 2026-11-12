"use client";

// Эффекты оплаты: звук «дзынь» (Web Audio, без файлов) и всплеск частиц (canvas, без библиотек).

const reduceMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Короткий двойной «дзынь», как у кассы. */
export function playChime() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const notes = [
      { f: 1318.5, t: 0 }, // E6
      { f: 1975.5, t: 0.09 }, // B6
    ];
    for (const n of notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = n.f;
      const start = ctx.currentTime + n.t;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.18, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.9);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 1);
    }
    setTimeout(() => ctx.close(), 1500);
  } catch {
    // нет звука — не страшно
  }
}

/** Всплеск шафрановых и гранатовых частиц из точки (x, y) в координатах окна. */
export function burst(x: number, y: number) {
  if (reduceMotion()) return;
  const canvas = document.createElement("canvas");
  const dpr = window.devicePixelRatio || 1;
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  Object.assign(canvas.style, { position: "fixed", inset: "0", width: "100%", height: "100%", pointerEvents: "none", zIndex: "80" });
  document.body.appendChild(canvas);
  const g = canvas.getContext("2d")!;
  g.scale(dpr, dpr);

  const css = getComputedStyle(document.documentElement);
  const colors = [css.getPropertyValue("--saffron"), css.getPropertyValue("--pomegranate"), css.getPropertyValue("--saffron"), css.getPropertyValue("--mint")].map(
    (c) => c.trim() || "#f2a93b",
  );
  const parts = Array.from({ length: 70 }, () => {
    const a = Math.random() * Math.PI * 2;
    const v = 3 + Math.random() * 7;
    return {
      x,
      y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v - 4,
      r: 2 + Math.random() * 3.5,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      color: colors[Math.floor(Math.random() * colors.length)],
      rhombus: Math.random() < 0.5, // половина — ромбики, как в орнаменте
    };
  });

  const start = performance.now();
  const DURATION = 1100;
  const frame = (now: number) => {
    const t = now - start;
    g.clearRect(0, 0, window.innerWidth, window.innerHeight);
    g.globalAlpha = Math.max(0, 1 - t / DURATION);
    for (const p of parts) {
      p.vy += 0.28; // гравитация
      p.vx *= 0.985;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      g.save();
      g.translate(p.x, p.y);
      g.rotate(p.rot);
      g.fillStyle = p.color;
      g.beginPath();
      if (p.rhombus) {
        g.moveTo(0, -p.r * 1.6);
        g.lineTo(p.r, 0);
        g.lineTo(0, p.r * 1.6);
        g.lineTo(-p.r, 0);
      } else g.arc(0, 0, p.r, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
    if (t < DURATION) requestAnimationFrame(frame);
    else canvas.remove();
  };
  requestAnimationFrame(frame);
}
