// Логотип: ляган (плоское блюдо) с горкой плова, вид сверху-сбоку. Гранат + шафран.
export function LaganMark({ size = 40, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" className={className} aria-hidden>
      <ellipse cx="24" cy="31" rx="21" ry="9" fill="var(--pomegranate)" />
      <ellipse cx="24" cy="29.5" rx="17" ry="6.5" fill="none" stroke="var(--on-pomegranate)" strokeOpacity="0.55" strokeWidth="1" strokeDasharray="1.5 2.5" />
      <path d="M11 29 C 13 19, 19 14, 24 14 C 29 14, 35 19, 37 29 C 31 32, 17 32, 11 29 Z" fill="var(--saffron)" />
      <path d="M17 24 q2 -2 4 0 M24 20 q2 -2 4 0 M27 26 q2 -2 4 0 M19 28 q2 -1.5 4 0" stroke="var(--on-saffron)" strokeOpacity="0.45" strokeWidth="1.1" fill="none" strokeLinecap="round" />
      <circle cx="24" cy="12.5" r="2.4" fill="var(--mint)" />
    </svg>
  );
}

export function Wordmark({ name, tagline }: { name: string; tagline?: string }) {
  return (
    <div className="flex items-center gap-3">
      <LaganMark />
      <div className="leading-tight">
        <div className="font-display text-lg font-semibold tracking-tight">{name}</div>
        {tagline && <div className="text-xs text-muted">{tagline}</div>}
      </div>
    </div>
  );
}
