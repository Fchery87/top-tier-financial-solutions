'use client';

import * as React from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Loader2, User, Mail, Shield, ChevronRight, Home, Settings, LayoutDashboard } from 'lucide-react';
import { motion } from 'framer-motion';
import { GradientOrbs, AnimatedGrid, NoiseOverlay } from '@/components/ui/AnimatedBackground';

export default function ProfilePage() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-secondary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8">
        <Card className="max-w-md w-full bg-card/80 backdrop-blur-sm border-border/50">
          <CardHeader className="text-center">
            <CardTitle className="font-serif text-2xl">Profile</CardTitle>
            <CardDescription>Please sign in to view your profile.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Button asChild className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90">
              <Link href="/sign-in">Sign In</Link>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link href="/sign-up">Create Account</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
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
                  <User className="w-4 h-4 text-secondary" />
                  Profile
                </div>
              </div>
            </div>
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-serif font-bold mb-4 text-foreground">
              Welcome, <span className="text-gradient-gold">{user.name?.split(' ')[0] || 'Client'}</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl">
              View your account information and access your portal.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-8 md:py-12 bg-background relative">
        <div className="container mx-auto px-4 md:px-6 max-w-4xl">
          <div className="grid gap-6">
            {/* User Information */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card className="bg-card/80 backdrop-blur-sm border-border/50">
                <CardHeader>
                  <CardTitle className="font-serif text-xl flex items-center gap-2">
                    <User className="w-5 h-5 text-secondary" />
                    User Information
                  </CardTitle>
                  <CardDescription>
                    Your account details and authentication status.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
                      <dt className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                        <User className="w-4 h-4" />
                        Name
                      </dt>
                      <dd className="text-foreground font-medium">{user.name || 'Not set'}</dd>
                    </div>
                    <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
                      <dt className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                        <Mail className="w-4 h-4" />
                        Email
                      </dt>
                      <dd className="text-foreground font-medium">{user.email}</dd>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border border-border/50">
                    <div className="flex items-center gap-3">
                      <Shield className="w-5 h-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium text-foreground">Authentication Status</p>
                        <p className="text-sm text-muted-foreground">
                          Your account is active and secured
                        </p>
                      </div>
                    </div>
                    <div className="px-3 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-400">
                      Signed In
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Quick Links */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card className="bg-card/80 backdrop-blur-sm border-border/50">
                <CardHeader>
                  <CardTitle className="font-serif text-xl flex items-center gap-2">
                    <LayoutDashboard className="w-5 h-5 text-secondary" />
                    Quick Links
                  </CardTitle>
                  <CardDescription>
                    Access your portal and account settings.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Link
                    href="/portal"
                    className="flex items-center justify-between p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors border border-border/50"
                  >
                    <div className="flex items-center gap-3">
                      <LayoutDashboard className="w-5 h-5 text-secondary" />
                      <span className="font-medium text-foreground">Client Portal</span>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  </Link>
                  <Link
                    href="/settings"
                    className="flex items-center justify-between p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors border border-border/50"
                  >
                    <div className="flex items-center gap-3">
                      <Settings className="w-5 h-5 text-secondary" />
                      <span className="font-medium text-foreground">Account Settings</span>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  </Link>
                  <Link
                    href="/"
                    className="flex items-center justify-between p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors border border-border/50"
                  >
                    <div className="flex items-center gap-3">
                      <Home className="w-5 h-5 text-secondary" />
                      <span className="font-medium text-foreground">Home</span>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  </Link>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </section>
    </div>
  );
}
