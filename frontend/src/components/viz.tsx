import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

/** Reveal once when scrolled into view (IntersectionObserver, no library). */
export function Reveal({
  children,
  className = "",
  delay = 0,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  as?: "div" | "li" | "section";
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <Tag
      ref={ref as never}
      data-in={inView}
      className={`iq-reveal ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </Tag>
  );
}

export const delay = (ms: number): CSSProperties => ({ animationDelay: `${ms}ms` });

/** Thin horizontal bar; value in 0..1. Animates 0 → value. */
export function SuccessBar({ value, tone = "accent" }: { value: number; tone?: "accent" | "warning" | "failed" }) {
  const v = Math.max(0, Math.min(1, value));
  const bg = tone === "accent" ? "bg-accent" : tone === "warning" ? "bg-warning" : "bg-failed";
  return (
    <div className="relative h-[3px] w-full bg-border" role="meter" aria-valuenow={Math.round(v * 100)} aria-valuemin={0} aria-valuemax={100}>
      <div className="absolute inset-y-0 left-0" style={{ width: `${v * 100}%` }}>
        <div className={`iq-grow h-full ${bg}`} />
      </div>
    </div>
  );
}

export const norm = (v?: number) => (v === undefined || v === null ? undefined : v > 1 ? v / 100 : v);
