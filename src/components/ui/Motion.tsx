"use client";

import { motion, HTMLMotionProps, useMotionValue, useTransform, useSpring } from "framer-motion";
import { ReactNode, useRef } from "react";
import { cn } from "@/lib/utils";

interface MotionProps extends HTMLMotionProps<"div"> {
  children: ReactNode;
  delay?: number;
  duration?: number;
  className?: string;
}

// Smooth easing curves
const smoothEase: [number, number, number, number] = [0.25, 0.1, 0.25, 1];
const bounceEase: [number, number, number, number] = [0.68, -0.55, 0.265, 1.55];

export function FadeIn({ children, delay = 0, duration = 0.6, className, ...props }: MotionProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration, delay, ease: smoothEase }}
      className={cn(className)}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export function SlideUp({ children, delay = 0, duration = 0.6, className, ...props }: MotionProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration, delay, ease: smoothEase }}
      className={cn(className)}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export function SlideIn({ children, delay = 0, duration = 0.6, className, direction = "left", ...props }: MotionProps & { direction?: "left" | "right" }) {
  const x = direction === "left" ? -60 : 60;
  return (
    <motion.div
      initial={{ opacity: 0, x }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration, delay, ease: smoothEase }}
      className={cn(className)}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export function ScaleIn({ children, delay = 0, duration = 0.6, className, ...props }: MotionProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration, delay, ease: bounceEase }}
      className={cn(className)}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export function BlurIn({ children, delay = 0, duration = 0.8, className, ...props }: MotionProps) {
  return (
    <motion.div
      initial={{ opacity: 0, filter: "blur(10px)" }}
      whileInView={{ opacity: 1, filter: "blur(0px)" }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration, delay, ease: smoothEase }}
      className={cn(className)}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export function RotateIn({ children, delay = 0, duration = 0.7, className, ...props }: MotionProps) {
  return (
    <motion.div
      initial={{ opacity: 0, rotate: -5, y: 20 }}
      whileInView={{ opacity: 1, rotate: 0, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration, delay, ease: smoothEase }}
      className={cn(className)}
      {...props}
    >
      {children}
    </motion.div>
  );
}

// Magnetic hover effect for buttons and cards
export function MagneticHover({ children, className, strength = 0.3 }: { children: ReactNode, className?: string, strength?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  
  const springConfig = { damping: 15, stiffness: 150 };
  const xSpring = useSpring(x, springConfig);
  const ySpring = useSpring(y, springConfig);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    x.set((e.clientX - centerX) * strength);
    y.set((e.clientY - centerY) * strength);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      ref={ref}
      style={{ x: xSpring, y: ySpring }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={cn(className)}
    >
      {children}
    </motion.div>
  );
}

// 3D Tilt Card Effect
export function TiltCard({ children, className }: { children: ReactNode, className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const rotateX = useTransform(y, [-0.5, 0.5], [8, -8]);
  const rotateY = useTransform(x, [-0.5, 0.5], [-8, 8]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const xPos = (e.clientX - rect.left) / rect.width - 0.5;
    const yPos = (e.clientY - rect.top) / rect.height - 0.5;
    x.set(xPos);
    y.set(yPos);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      ref={ref}
      style={{
        rotateX,
        rotateY,
        transformStyle: "preserve-3d",
        perspective: 1000,
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      transition={{ type: "spring", damping: 20, stiffness: 100 }}
      className={cn(className)}
    >
      {children}
    </motion.div>
  );
}

// Glowing border animation
export function GlowCard({ children, className }: { children: ReactNode, className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.6, ease: smoothEase }}
      whileHover={{ 
        scale: 1.02,
        boxShadow: "0 0 40px rgba(198, 168, 124, 0.4)",
      }}
      className={cn("relative overflow-hidden rounded-xl", className)}
    >
      {children}
    </motion.div>
  );
}

// Text reveal animation (character by character)
export function TextReveal({ children, className, delay = 0 }: { children: string, className?: string, delay?: number }) {
  const words = children.split(" ");
  
  return (
    <motion.span className={cn("inline-flex flex-wrap", className)}>
      {words.map((word, wordIndex) => (
        <span key={wordIndex} className="inline-flex mr-[0.25em]">
          {word.split("").map((char, charIndex) => (
            <motion.span
              key={charIndex}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{
                duration: 0.4,
                delay: delay + (wordIndex * 0.1) + (charIndex * 0.03),
                ease: smoothEase,
              }}
            >
              {char}
            </motion.span>
          ))}
        </span>
      ))}
    </motion.span>
  );
}

// Counter animation
export function CountUp({ 
  target, 
  duration = 2, 
  delay = 0, 
  suffix = "", 
  className 
}: { 
  target: number, 
  duration?: number, 
  delay?: number, 
  suffix?: string, 
  className?: string 
}) {
  const count = useMotionValue(0);
  const rounded = useTransform(count, (latest) => Math.round(latest));
  
  return (
    <motion.span
      className={cn(className)}
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
      onViewportEnter={() => {
        setTimeout(() => {
          const controls = { count: 0 };
          const animate = () => {
            controls.count += (target - controls.count) * 0.1;
            count.set(controls.count);
            if (Math.abs(target - controls.count) > 0.5) {
              requestAnimationFrame(animate);
            } else {
              count.set(target);
            }
          };
          animate();
        }, delay * 1000);
      }}
    >
      <motion.span>{rounded}</motion.span>{suffix}
    </motion.span>
  );
}

// Floating element
export function Float({ children, className, duration = 6, distance = 20 }: { children: ReactNode, className?: string, duration?: number, distance?: number }) {
  return (
    <motion.div
      animate={{
        y: [-distance / 2, distance / 2, -distance / 2],
      }}
      transition={{
        duration,
        repeat: Infinity,
        ease: "easeInOut",
      }}
      className={cn(className)}
    >
      {children}
    </motion.div>
  );
}

// Parallax scroll effect
export function ParallaxSection({ children, className, speed = 0.5 }: { children: ReactNode, className?: string, speed?: number }) {
  return (
    <motion.div
      initial={{ y: 0 }}
      whileInView={{ y: 0 }}
      viewport={{ once: false, amount: 0.3 }}
      style={{ willChange: "transform" }}
      className={cn(className)}
    >
      {children}
    </motion.div>
  );
}

export const StaggerContainer = ({ 
  children, 
  className, 
  delay = 0, 
  staggerChildren = 0.1 
}: { 
  children: ReactNode, 
  className?: string, 
  delay?: number, 
  staggerChildren?: number 
}) => {
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-50px" }}
      variants={{
        visible: {
          transition: {
            staggerChildren,
            delayChildren: delay
          }
        }
      }}
      className={cn(className)}
    >
      {children}
    </motion.div>
  );
};

export const StaggerItem = ({ children, className }: { children: ReactNode, className?: string }) => {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 30, scale: 0.95 },
        visible: { 
          opacity: 1, 
          y: 0, 
          scale: 1,
          transition: { 
            duration: 0.6,
            ease: smoothEase
          } 
        }
      }}
      className={cn(className)}
    >
      {children}
    </motion.div>
  );
};

// Page transition wrapper
export function PageTransition({ children, className }: { children: ReactNode, className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.5, ease: smoothEase }}
      className={cn(className)}
    >
      {children}
    </motion.div>
  );
}

// Hover scale with glow
export function HoverGlow({ children, className }: { children: ReactNode, className?: string }) {
  return (
    <motion.div
      whileHover={{ 
        scale: 1.05,
        transition: { duration: 0.3 }
      }}
      whileTap={{ scale: 0.98 }}
      className={cn("transition-shadow duration-300 hover:shadow-[0_0_30px_rgba(198,168,124,0.3)]", className)}
    >
      {children}
    </motion.div>
  );
}
