"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Quiet background treatments — "Midnight & Brass".
 *
 * These were previously infinite-loop animated orbs/particles/spotlights.
 * They are intentionally static now: ambient texture should never compete
 * with content, and constant motion costs battery for zero comprehension.
 * The exported API is preserved so existing pages keep working.
 */

// Soft static brass washes (was: floating animated orbs)
export function GradientOrbs({ className }: { className?: string }) {
  return (
    <div className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)} aria-hidden>
      <div className="absolute top-[-20%] right-[-10%] h-[480px] w-[480px] rounded-full bg-[radial-gradient(circle,hsl(var(--brass)/0.07),transparent_70%)]" />
      <div className="absolute bottom-[-12%] left-[-10%] h-[400px] w-[400px] rounded-full bg-[radial-gradient(circle,hsl(var(--brass)/0.05),transparent_70%)]" />
    </div>
  );
}

// Static warm wash (was: animated goo mesh)
export function MeshGradient({ className }: { className?: string }) {
  return (
    <div className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)} aria-hidden>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_-10%,hsl(var(--brass)/0.06),transparent_65%)]" />
    </div>
  );
}

// Hairline grid (was: grid with sweeping highlight lines)
export function AnimatedGrid({ className }: { className?: string }) {
  return (
    <div className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)} aria-hidden>
      <div className="rule-grid absolute inset-0 opacity-60" />
    </div>
  );
}

// Retired: particles add noise, not meaning. Renders nothing.
export function ParticleField({ count: _count = 30, className }: { count?: number; className?: string }) {
  void className;
  return null;
}

// Static container (was: cursor-tracking spotlight with global mousemove listener)
export function SpotlightEffect({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("relative overflow-hidden", className)}>{children}</div>;
}

// Static top glow (was: animated aurora)
export function AuroraBackground({ className }: { className?: string }) {
  return (
    <div className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)} aria-hidden>
      <div
        className="absolute inset-0 opacity-50"
        style={{
          background: `
            radial-gradient(ellipse 80% 50% at 20% -20%, hsl(var(--brass) / 0.12), transparent),
            radial-gradient(ellipse 60% 40% at 80% -10%, hsl(var(--brass) / 0.08), transparent)
          `,
        }}
      />
    </div>
  );
}

// Noise texture overlay (kept — static and subtle)
export function NoiseOverlay({ className, opacity = 0.03 }: { className?: string; opacity?: number }) {
  return (
    <div
      className={cn("pointer-events-none absolute inset-0 mix-blend-soft-light", className)}
      aria-hidden
      style={{
        opacity,
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
      }}
    />
  );
}

// Static centered glow (was: pulsing)
export function RadialGlow({ className, color = "secondary" }: { className?: string; color?: "secondary" | "primary" }) {
  return (
    <div className={cn("pointer-events-none absolute inset-0 flex items-center justify-center", className)} aria-hidden>
      <div
        className={cn(
          "h-[55%] w-[55%] rounded-full blur-[100px] opacity-40",
          color === "secondary" ? "bg-secondary/15" : "bg-primary/15"
        )}
      />
    </div>
  );
}

// Combined background — now a quiet grid + glow + noise for every variant
export function PremiumBackground({
  variant = "default",
  className,
}: {
  variant?: "default" | "hero" | "section" | "cta";
  className?: string;
}) {
  return (
    <div className={cn("absolute inset-0", className)} aria-hidden>
      {(variant === "hero" || variant === "default") && <AnimatedGrid />}
      {variant !== "default" && <AuroraBackground />}
      <NoiseOverlay opacity={0.02} />
    </div>
  );
}
