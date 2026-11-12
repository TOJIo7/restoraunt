// Орнамент сюзане — тонкой линией, в деталях, не обоями.

/** Горизонтальная полоса: ромбы с розеткой, между ними — бутоны. */
export function SuzaniStrip({ className = "" }: { className?: string }) {
  return (
    <svg className={className} width="100%" height="14" aria-hidden>
      <defs>
        <pattern id="suzani-strip" width="56" height="14" patternUnits="userSpaceOnUse">
          <g fill="none" stroke="currentColor" strokeWidth="1" strokeLinejoin="round">
            <path d="M28 1 L37 7 L28 13 L19 7 Z" />
            <circle cx="28" cy="7" r="2.2" />
            <path d="M5 7 q4 -5 8 0 q-4 5 -8 0 Z" />
            <path d="M43 7 q4 -5 8 0 q-4 5 -8 0 Z" />
          </g>
          <circle cx="28" cy="7" r="0.9" fill="currentColor" />
          <circle cx="0" cy="7" r="1" fill="currentColor" />
          <circle cx="56" cy="7" r="1" fill="currentColor" />
        </pattern>
      </defs>
      <rect width="100%" height="14" fill="url(#suzani-strip)" />
    </svg>
  );
}

/** Розетка сюзане — для экрана входа и крупных декоративных мест. */
export function SuzaniRosette({ className = "", size = 240 }: { className?: string; size?: number }) {
  const petals = Array.from({ length: 12 }, (_, i) => i * 30);
  return (
    <svg className={className} width={size} height={size} viewBox="-100 -100 200 200" aria-hidden>
      <g fill="none" stroke="currentColor" strokeWidth="0.8">
        <circle r="96" />
        <circle r="88" strokeDasharray="2 4" />
        {petals.map((a) => (
          <g key={a} transform={`rotate(${a})`}>
            <path d="M0 -84 C 14 -66, 14 -50, 0 -38 C -14 -50, -14 -66, 0 -84 Z" />
            <path d="M0 -76 C 6 -66, 6 -56, 0 -48 C -6 -56, -6 -66, 0 -76 Z" />
            <circle cy="-90" r="2" />
          </g>
        ))}
        <circle r="34" />
        {petals.map((a) => (
          <path key={`i${a}`} transform={`rotate(${a + 15})`} d="M0 -32 L6 -18 L0 -8 L-6 -18 Z" />
        ))}
        <circle r="7" />
      </g>
      <circle r="2.5" fill="currentColor" />
    </svg>
  );
}

/** Пустое состояние: повторяющийся ромб на фоне + текст. */
export function EmptyState({ title, text, badge }: { title: string; text: string; badge?: string }) {
  return (
    <div className="relative flex min-h-[360px] flex-col items-center justify-center overflow-hidden rounded-[var(--radius-card)] border border-dashed border-line bg-surface px-6 py-16 text-center">
      <svg className="pointer-events-none absolute inset-0 h-full w-full text-line" aria-hidden>
        <defs>
          <pattern id="rhombus-bg" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M20 6 L32 20 L20 34 L8 20 Z" fill="none" stroke="currentColor" strokeWidth="0.75" />
            <circle cx="20" cy="20" r="1.2" fill="currentColor" />
          </pattern>
          <radialGradient id="rhombus-fade">
            <stop offset="0" stopColor="white" stopOpacity="0" />
            <stop offset="1" stopColor="white" stopOpacity="1" />
          </radialGradient>
          <mask id="rhombus-mask">
            <rect width="100%" height="100%" fill="url(#rhombus-fade)" />
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="url(#rhombus-bg)" mask="url(#rhombus-mask)" opacity="0.7" />
      </svg>
      <div className="relative flex max-w-md flex-col items-center gap-3">
        {badge && (
          <span className="rounded-full border border-saffron/40 bg-saffron/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-saffron">
            {badge}
          </span>
        )}
        <h2 className="font-display text-2xl font-semibold">{title}</h2>
        <p className="text-balance text-muted">{text}</p>
      </div>
    </div>
  );
}
