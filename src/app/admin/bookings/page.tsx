'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { Calendar, ExternalLink, Settings, Clock, Users, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

export default function BookingsPage() {
  const calUsername = process.env.NEXT_PUBLIC_CAL_USERNAME;
  const calDashboardUrl = `https://app.cal.com/${calUsername || ''}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl font-serif font-bold text-foreground"
          >
            Consultation Bookings
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-muted-foreground mt-1"
          >
            Manage your consultation bookings via Cal.com
          </motion.p>
        </div>
      </div>

      {/* Cal.com Integration Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card className="bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border-cyan-500/20">
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="p-4 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-500 text-white shadow-lg shadow-cyan-500/30">
                <Calendar className="w-8 h-8" />
              </div>
              <div>
                <CardTitle className="text-2xl">Cal.com Dashboard</CardTitle>
                <CardDescription className="text-base">
                  Manage all your consultation bookings, availability, and settings
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-muted-foreground">
              Your consultation scheduling is powered by Cal.com. Access your dashboard to:
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { icon: Clock, title: 'View Bookings', description: 'See upcoming and past consultations' },
                { icon: Users, title: 'Manage Clients', description: 'View client information and history' },
                { icon: Settings, title: 'Configure Settings', description: 'Set availability and preferences' },
              ].map((item, index) => (
                <Card key={index} className="bg-card/50 border-border/50">
                  <CardContent className="p-4 flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-secondary/10">
                      <item.icon className="w-5 h-5 text-secondary" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{item.title}</p>
                      <p className="text-xs text-muted-foreground">{item.description}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <Button 
                asChild
                className="bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:from-cyan-600 hover:to-blue-600 shadow-lg shadow-cyan-500/30"
              >
                <a href={calDashboardUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Open Cal.com Dashboard
                  <ExternalLink className="w-4 h-4" />
                </a>
              </Button>
              <Button 
                variant="outline" 
                asChild
              >
                <a href="https://cal.com/settings" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                  <Settings className="w-4 h-4" />
                  Cal.com Settings
                  <ExternalLink className="w-4 h-4" />
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Setup Instructions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card className="bg-card/80 backdrop-blur-sm border-border/50">
          <CardHeader>
            <CardTitle className="font-serif flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              Integration Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${calUsername ? 'bg-green-500' : 'bg-yellow-500'}`} />
                <span className="text-sm">
                  Cal.com Username: {calUsername ? (
                    <span className="font-medium text-foreground">{calUsername}</span>
                  ) : (
                    <span className="text-yellow-500">Not configured</span>
                  )}
                </span>
              </div>
            </div>

            {!calUsername && (
              <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                <p className="text-sm text-yellow-600 dark:text-yellow-400">
                  <strong>Setup Required:</strong> To enable booking management, add your Cal.com credentials to the environment variables:
                </p>
                <pre className="mt-2 p-2 rounded bg-muted text-xs overflow-x-auto">
{`NEXT_PUBLIC_CAL_USERNAME=your-username
NEXT_PUBLIC_CAL_EVENT_TYPE=consultation`}
                </pre>
              </div>
            )}

            <div className="pt-4 border-t border-border">
              <h4 className="font-medium text-sm mb-2">Helpful Links</h4>
              <div className="space-y-2">
                <a 
                  href="https://cal.com/docs" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sm text-muted-foreground hover:text-secondary flex items-center gap-1"
                >
                  Cal.com Documentation <ExternalLink className="w-3 h-3" />
                </a>
                <a 
                  href="https://cal.com/event-types" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sm text-muted-foreground hover:text-secondary flex items-center gap-1"
                >
                  Manage Event Types <ExternalLink className="w-3 h-3" />
                </a>
                <a 
                  href="https://cal.com/availability" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sm text-muted-foreground hover:text-secondary flex items-center gap-1"
                >
                  Set Availability <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
