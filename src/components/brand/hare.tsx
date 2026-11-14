import { HARE_VIEW_BOX, hareStrokes, type HareVariant } from "./hare-art";

type HareProps = {
  /** Width in pixels; the height follows the drawing. */
  size: number;
  /** The running hare, or its head alone. */
  variant?: HareVariant;
  className?: string;
};

/** The FrenchTrack hare, decorative: the text next to it says what it stands for. */
export function Hare({ size, variant = "full", className }: HareProps) {
  const [, , width, height] = HARE_VIEW_BOX[variant].split(" ").map(Number);
  return (
    <svg
      viewBox={HARE_VIEW_BOX[variant]}
      width={size}
      height={Math.round((size * height) / width)}
      strokeLinejoin="round"
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
      className={className}
      data-variant={variant}
    >
      {hareStrokes(variant).map(({ d, fill, stroke, strokeWidth }, index) => (
        <path key={index} d={d} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
      ))}
    </svg>
  );
}
