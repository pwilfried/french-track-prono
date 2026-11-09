/**
 * A running track bend behind the home (#346, board A): eight numbered lanes in thin lines.
 * Decorative only, no animation; quieter in light mode.
 */
export function TrackBackground() {
  const lanes = [0, 1, 2, 3, 4, 5, 6, 7, 8];
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 390 844"
      preserveAspectRatio="xMaxYMin slice"
      className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[844px] w-full text-foreground opacity-[0.08] dark:opacity-[0.14]"
    >
      <g fill="none" stroke="currentColor" strokeWidth="1.5">
        {lanes.map((i) => (
          <path
            key={i}
            d={`M -40 ${520 + 46 * i} C ${40 + 10 * i} ${250 + 34 * i}, ${260 + 10 * i} ${120 + 40 * i}, 470 ${110 + 42 * i}`}
          />
        ))}
      </g>
      <g fill="currentColor" className="font-display" fontWeight="800" fontSize="22">
        {lanes.slice(1).map((lane) => (
          <text key={lane} x="338" y={98 + 42 * lane}>
            {lane}
          </text>
        ))}
      </g>
    </svg>
  );
}
