'use client';

import * as React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { 
  FileText, 
  MessageSquareQuote, 
  HelpCircle, 
  Scale,
  Users,
  Calendar,
  ArrowRight,
  TrendingUp,
  Clock
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

const quickLinks = [
  { name: 'Manage Pages', href: '/admin/content', icon: FileText, description: 'Edit website content and pages', color: 'bg-blue-500/10 text-blue-500' },
  { name: 'Testimonials', href: '/admin/testimonials', icon: MessageSquareQuote, description: 'Approve and manage client testimonials', color: 'bg-green-500/10 text-green-500' },
  { name: 'FAQs', href: '/admin/faqs', icon: HelpCircle, description: 'Update frequently asked questions', color: 'bg-purple-500/10 text-purple-500' },
  { name: 'Disclaimers', href: '/admin/disclaimers', icon: Scale, description: 'Manage legal disclaimers', color: 'bg-orange-500/10 text-orange-500' },
  { name: 'Contact Leads', href: '/admin/leads', icon: Users, description: 'View and manage contact form submissions', color: 'bg-pink-500/10 text-pink-500' },
  { name: 'Bookings', href: '/admin/bookings', icon: Calendar, description: 'Manage consultation bookings', color: 'bg-cyan-500/10 text-cyan-500' },
];

const stats = [
  { label: 'New Leads', value: '—', icon: Users, trend: 'View all', href: '/admin/leads' },
  { label: 'Pending Testimonials', value: '—', icon: MessageSquareQuote, trend: 'Review', href: '/admin/testimonials' },
  { label: 'Published FAQs', value: '—', icon: HelpCircle, trend: 'Manage', href: '/admin/faqs' },
  { label: 'Active Pages', value: '—', icon: FileText, trend: 'Edit', href: '/admin/content' },
];

export default function AdminDashboard() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-3xl font-serif font-bold text-foreground"
        >
          Admin Dashboard
        </motion.h1>
        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-muted-foreground mt-2"
        >
          Welcome back! Manage your website content and leads from here.
        </motion.p>
      </div>

      {/* Stats Grid */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {stats.map((stat, index) => (
          <Card key={stat.label} className="bg-card/80 backdrop-blur-sm border-border/50 hover:border-secondary/30 transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="p-2 rounded-lg bg-secondary/10">
                  <stat.icon className="w-5 h-5 text-secondary" />
                </div>
                <Link 
                  href={stat.href}
                  className="text-xs text-muted-foreground hover:text-secondary transition-colors flex items-center gap-1"
                >
                  {stat.trend}
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
              <div className="mt-4">
                <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </motion.div>

      {/* Quick Links */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <h2 className="text-xl font-serif font-bold text-foreground mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {quickLinks.map((link, index) => (
            <Link key={link.name} href={link.href}>
              <Card className="h-full bg-card/80 backdrop-blur-sm border-border/50 hover:border-secondary/30 hover:shadow-lg hover:shadow-secondary/5 transition-all duration-300 group cursor-pointer">
                <CardContent className="p-6">
                  <div className={`w-12 h-12 rounded-xl ${link.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                    <link.icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground group-hover:text-secondary transition-colors">
                    {link.name}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {link.description}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </motion.div>

      {/* Recent Activity Placeholder */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <Card className="bg-card/80 backdrop-blur-sm border-border/50">
          <CardHeader>
            <CardTitle className="font-serif flex items-center gap-2">
              <Clock className="w-5 h-5 text-secondary" />
              Recent Activity
            </CardTitle>
            <CardDescription>
              Latest updates and submissions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              <TrendingUp className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Activity tracking will appear here once the backend is connected.</p>
              <Button asChild variant="outline" className="mt-4">
                <Link href="/admin/leads">View All Leads</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
