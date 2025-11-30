"use client";

import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { ReactNode, useMemo, useEffect } from "react";
import { cn } from "@/lib/utils";

// Floating gradient orbs that move organically
export function GradientOrbs({ className }: { className?: string }) {
  return (
    <div className={cn("absolute inset-0 overflow-hidden pointer-events-none", className)}>
      <motion.div
        animate={{
          x: [0, 100, 50, -50, 0],
          y: [0, -80, 40, -40, 0],
          scale: [1, 1.2, 0.9, 1.1, 1],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] bg-gradient-to-br from-secondary/30 via-secondary/10 to-transparent rounded-full blur-[100px]"
      />
      <motion.div
        animate={{
          x: [0, -80, 60, -30, 0],
          y: [0, 60, -80, 40, 0],
          scale: [1, 0.9, 1.15, 0.95, 1],
        }}
        transition={{
          duration: 25,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 2,
        }}
        className="absolute bottom-[-10%] left-[-15%] w-[500px] h-[500px] bg-gradient-to-tr from-secondary/20 via-primary/10 to-transparent rounded-full blur-[120px]"
      />
      <motion.div
        animate={{
          x: [0, 50, -60, 30, 0],
          y: [0, -50, 30, -60, 0],
          scale: [1, 1.1, 0.85, 1.05, 1],
        }}
        transition={{
          duration: 18,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 5,
        }}
        className="absolute top-[40%] left-[50%] w-[400px] h-[400px] bg-gradient-to-bl from-secondary/15 to-transparent rounded-full blur-[80px]"
      />
    </div>
  );
}

// Animated mesh gradient background
export function MeshGradient({ className }: { className?: string }) {
  return (
    <div className={cn("absolute inset-0 overflow-hidden pointer-events-none", className)}>
      <svg className="absolute w-full h-full opacity-30" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="goo">
            <feGaussianBlur in="SourceGraphic" stdDeviation="40" result="blur" />
            <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -10" result="goo" />
          </filter>
          <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="hsl(var(--secondary))" stopOpacity="0.4" />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.1" />
          </linearGradient>
        </defs>
        <g filter="url(#goo)">
          <motion.circle
            cx="20%"
            cy="30%"
            r="200"
            fill="url(#grad1)"
            animate={{ cx: ["20%", "30%", "25%", "20%"], cy: ["30%", "40%", "25%", "30%"] }}
            transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.circle
            cx="70%"
            cy="60%"
            r="180"
            fill="url(#grad1)"
            animate={{ cx: ["70%", "60%", "75%", "70%"], cy: ["60%", "50%", "65%", "60%"] }}
            transition={{ duration: 18, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          />
          <motion.circle
            cx="50%"
            cy="80%"
            r="150"
            fill="url(#grad1)"
            animate={{ cx: ["50%", "55%", "45%", "50%"], cy: ["80%", "75%", "85%", "80%"] }}
            transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 4 }}
          />
        </g>
      </svg>
    </div>
  );
}

// Animated grid lines
export function AnimatedGrid({ className }: { className?: string }) {
  return (
    <div className={cn("absolute inset-0 overflow-hidden pointer-events-none", className)}>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1 }}
        className="absolute inset-0"
        style={{
          backgroundImage: `
            linear-gradient(to right, hsl(var(--secondary) / 0.05) 1px, transparent 1px),
            linear-gradient(to bottom, hsl(var(--secondary) / 0.05) 1px, transparent 1px)
          `,
          backgroundSize: "80px 80px",
        }}
      />
      {/* Animated highlight line horizontal */}
      <motion.div
        animate={{ y: ["-100%", "200%"] }}
        transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
        className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-secondary/30 to-transparent"
      />
      {/* Animated highlight line vertical */}
      <motion.div
        animate={{ x: ["-100%", "200%"] }}
        transition={{ duration: 10, repeat: Infinity, ease: "linear", delay: 2 }}
        className="absolute top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-secondary/30 to-transparent"
      />
    </div>
  );
}

// Pre-defined particle positions to avoid hydration mismatches
const PARTICLE_CONFIGS = [
  { x: 15, y: 20, size: 3, duration: 18, delay: 0, xOffset: 10 },
  { x: 85, y: 15, size: 4, duration: 22, delay: 1.5, xOffset: -15 },
  { x: 45, y: 80, size: 2.5, duration: 16, delay: 0.5, xOffset: 8 },
  { x: 70, y: 45, size: 3.5, duration: 20, delay: 2, xOffset: -12 },
  { x: 25, y: 65, size: 3, duration: 19, delay: 1, xOffset: 15 },
  { x: 90, y: 70, size: 4, duration: 24, delay: 2.5, xOffset: -8 },
  { x: 10, y: 50, size: 2, duration: 17, delay: 0.8, xOffset: 12 },
  { x: 55, y: 30, size: 3.5, duration: 21, delay: 1.2, xOffset: -10 },
  { x: 35, y: 90, size: 3, duration: 18, delay: 3, xOffset: 6 },
  { x: 80, y: 25, size: 4.5, duration: 23, delay: 0.3, xOffset: -14 },
  { x: 20, y: 40, size: 2.5, duration: 16, delay: 1.8, xOffset: 18 },
  { x: 65, y: 85, size: 3, duration: 20, delay: 2.2, xOffset: -6 },
  { x: 50, y: 10, size: 3.5, duration: 19, delay: 0.6, xOffset: 10 },
  { x: 5, y: 75, size: 2, duration: 22, delay: 1.4, xOffset: -16 },
  { x: 95, y: 55, size: 4, duration: 18, delay: 2.8, xOffset: 8 },
  { x: 40, y: 35, size: 3, duration: 21, delay: 0.9, xOffset: -12 },
  { x: 75, y: 60, size: 3.5, duration: 17, delay: 1.6, xOffset: 14 },
  { x: 30, y: 5, size: 2.5, duration: 24, delay: 2.4, xOffset: -8 },
  { x: 60, y: 95, size: 4, duration: 19, delay: 0.2, xOffset: 10 },
  { x: 12, y: 88, size: 3, duration: 20, delay: 3.2, xOffset: -18 },
  { x: 88, y: 42, size: 3.5, duration: 16, delay: 1.1, xOffset: 6 },
  { x: 48, y: 58, size: 2, duration: 23, delay: 2.6, xOffset: -10 },
  { x: 22, y: 12, size: 4, duration: 18, delay: 0.4, xOffset: 16 },
  { x: 78, y: 78, size: 3, duration: 21, delay: 1.9, xOffset: -14 },
  { x: 52, y: 48, size: 3.5, duration: 19, delay: 2.1, xOffset: 8 },
  { x: 8, y: 32, size: 2.5, duration: 22, delay: 0.7, xOffset: -6 },
  { x: 92, y: 92, size: 4, duration: 17, delay: 3.4, xOffset: 12 },
  { x: 38, y: 68, size: 3, duration: 20, delay: 1.3, xOffset: -16 },
  { x: 68, y: 18, size: 3.5, duration: 24, delay: 2.7, xOffset: 10 },
  { x: 18, y: 82, size: 2, duration: 18, delay: 0.1, xOffset: -8 },
];

export function ParticleField({ count = 30, className }: { count?: number; className?: string }) {
  const particles = useMemo(() => 
    PARTICLE_CONFIGS.slice(0, Math.min(count, PARTICLE_CONFIGS.length)).map((config, i) => ({
      id: i,
      ...config,
    })),
    [count]
  );

  return (
    <div className={cn("absolute inset-0 overflow-hidden pointer-events-none", className)}>
      {particles.map((particle) => (
        <motion.div
          key={particle.id}
          className="absolute rounded-full bg-secondary/40"
          style={{
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            width: particle.size,
            height: particle.size,
          }}
          animate={{
            y: [0, -100, 0],
            x: [0, particle.xOffset, 0],
            opacity: [0, 1, 0],
            scale: [0, 1, 0],
          }}
          transition={{
            duration: particle.duration,
            repeat: Infinity,
            delay: particle.delay,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

// Spotlight effect that follows cursor
export function SpotlightEffect({ className, children }: { className?: string; children: ReactNode }) {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const spotlightX = useSpring(mouseX, { damping: 30, stiffness: 200 });
  const spotlightY = useSpring(mouseY, { damping: 30, stiffness: 200 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mouseX.set(e.clientX);
      mouseY.set(e.clientY);
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [mouseX, mouseY]);

  return (
    <div className={cn("relative overflow-hidden", className)}>
      <motion.div
        className="pointer-events-none absolute -inset-px opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: useTransform(
            [spotlightX, spotlightY],
            ([x, y]) =>
              `radial-gradient(600px circle at ${x}px ${y}px, hsl(var(--secondary) / 0.15), transparent 40%)`
          ),
        }}
      />
      {children}
    </div>
  );
}

// Aurora/Northern lights effect
export function AuroraBackground({ className }: { className?: string }) {
  return (
    <div className={cn("absolute inset-0 overflow-hidden pointer-events-none", className)}>
      <div className="absolute inset-0 bg-gradient-to-b from-background via-background to-background" />
      <motion.div
        animate={{
          backgroundPosition: ["0% 0%", "100% 100%", "0% 0%"],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: "linear",
        }}
        className="absolute inset-0 opacity-40"
        style={{
          background: `
            radial-gradient(ellipse 80% 50% at 20% -20%, hsl(var(--secondary) / 0.3), transparent),
            radial-gradient(ellipse 60% 40% at 80% -10%, hsl(var(--secondary) / 0.2), transparent),
            radial-gradient(ellipse 50% 30% at 50% 0%, hsl(var(--secondary) / 0.15), transparent)
          `,
          backgroundSize: "200% 200%",
        }}
      />
    </div>
  );
}

// Noise texture overlay
export function NoiseOverlay({ className, opacity = 0.03 }: { className?: string; opacity?: number }) {
  return (
    <div
      className={cn("absolute inset-0 pointer-events-none mix-blend-soft-light", className)}
      style={{
        opacity,
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
      }}
    />
  );
}

// Radial glow behind content
export function RadialGlow({ className, color = "secondary" }: { className?: string; color?: "secondary" | "primary" }) {
  return (
    <div className={cn("absolute inset-0 pointer-events-none flex items-center justify-center", className)}>
      <motion.div
        animate={{
          scale: [1, 1.1, 1],
          opacity: [0.3, 0.5, 0.3],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className={cn(
          "w-[60%] h-[60%] rounded-full blur-[100px]",
          color === "secondary" ? "bg-secondary/20" : "bg-primary/20"
        )}
      />
    </div>
  );
}

// Combined premium background with all effects
export function PremiumBackground({
  variant = "default",
  className,
}: {
  variant?: "default" | "hero" | "section" | "cta";
  className?: string;
}) {
  switch (variant) {
    case "hero":
      return (
        <div className={cn("absolute inset-0", className)}>
          <GradientOrbs />
          <AnimatedGrid />
          <ParticleField count={20} />
          <NoiseOverlay opacity={0.02} />
        </div>
      );
    case "section":
      return (
        <div className={cn("absolute inset-0", className)}>
          <GradientOrbs />
          <NoiseOverlay opacity={0.02} />
        </div>
      );
    case "cta":
      return (
        <div className={cn("absolute inset-0", className)}>
          <AuroraBackground />
          <ParticleField count={15} />
          <NoiseOverlay opacity={0.03} />
        </div>
      );
    default:
      return (
        <div className={cn("absolute inset-0", className)}>
          <AnimatedGrid />
          <NoiseOverlay opacity={0.02} />
        </div>
      );
  }
}
