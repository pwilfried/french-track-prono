/**
 * A running track bend behind every page (#346, #365, board A): eight numbered lanes in thin
 * lines. Fixed to the screen and framed on the centre column, so a computer shows it like a phone;
 * the lanes run on to the edge of a wide screen.
 * Decorative only, no animation; quieter in light mode.
 */
export function TrackBackground() {
  const lanes = [0, 1, 2, 3, 4, 5, 6, 7, 8];
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="relative mx-auto h-full w-full max-w-3xl">
        <svg
          focusable="false"
          viewBox="0 0 390 844"
          preserveAspectRatio="xMaxYMin slice"
          className="absolute inset-0 h-full w-full overflow-visible text-foreground opacity-[0.08] dark:opacity-[0.14]"
        >
          <g fill="none" stroke="currentColor" strokeWidth="1.5">
            {lanes.map((i) => (
              <path
                key={i}
                d={`M -40 ${520 + 46 * i} C ${40 + 10 * i} ${250 + 34 * i}, ${260 + 10 * i} ${120 + 40 * i}, 470 ${110 + 42 * i} L 1400 ${80 + 44 * i}`}
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
      </div>
    </div>
  );
}
