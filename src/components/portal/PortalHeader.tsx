'use client';

import { motion } from 'framer-motion';
import { Shield } from 'lucide-react';
import { GradientOrbs, AnimatedGrid, NoiseOverlay } from '@/components/ui/AnimatedBackground';

interface PortalHeaderProps {
  userName: string;
}

export default function PortalHeader({ userName }: PortalHeaderProps) {
  return (
    <section className="relative pt-32 pb-16 md:pt-40 md:pb-20 overflow-hidden">
      <GradientOrbs className="opacity-50" />
      <AnimatedGrid className="opacity-20" />
      <NoiseOverlay opacity={0.02} />
      <div className="absolute inset-0 bg-gradient-to-b from-background/70 via-background/50 to-background z-[1]" />

      <div className="container relative z-10 mx-auto px-4 md:px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="relative inline-flex">
              <div className="absolute -inset-1 bg-secondary/20 rounded-full blur-md" />
              <div className="relative inline-flex items-center gap-2 px-4 py-2 rounded-full bg-background/80 backdrop-blur-sm border border-secondary/30 text-foreground text-sm font-medium">
                <Shield className="w-4 h-4 text-secondary" />
                Client Portal
              </div>
            </div>
          </div>
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-serif font-bold mb-4 text-foreground">
            Welcome back, <span className="text-gradient-gold">{userName}</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl">
            Track your credit repair progress, view updates, and manage your documents all in one place.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
