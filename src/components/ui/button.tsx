import { cva } from "class-variance-authority";

/** Button styles. Used on links today; the <button> component comes back with the first form (v0.2). */
export const buttonVariants = cva(
  "inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-full text-base font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        muted: "bg-muted text-foreground hover:bg-muted/80",
        outline: "border border-border bg-transparent hover:bg-muted",
      },
      size: {
        default: "px-6 py-2.5",
        lg: "px-8 py-3 text-lg",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);
