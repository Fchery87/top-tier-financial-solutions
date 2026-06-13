'use client';

import * as React from 'react';
import { Calendar, ExternalLink, Settings, Clock, Users, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';

export default function BookingsPage() {
  const calUsername = process.env.NEXT_PUBLIC_CAL_USERNAME;
  const calDashboardUrl = `https://app.cal.com/${calUsername || ''}`;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Operations"
        title="Consultation Bookings"
        description="Manage your consultation bookings via Cal.com."
      />

      {/* Cal.com Integration Card */}
      <div>
        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-border bg-muted">
                <Calendar className="h-6 w-6 text-secondary" strokeWidth={1.75} />
              </div>
              <div>
                <CardTitle className="text-xl font-semibold tracking-tight">Cal.com Dashboard</CardTitle>
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
                <Card key={index}>
                  <CardContent className="flex items-start gap-3 p-4">
                    <item.icon className="mt-0.5 h-5 w-5 shrink-0 text-secondary" strokeWidth={1.75} />
                    <div>
                      <p className="text-sm font-medium">{item.title}</p>
                      <p className="text-xs text-muted-foreground">{item.description}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <Button asChild>
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
      </div>

      {/* Setup Instructions */}
      <div>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-success" />
              Integration Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${calUsername ? 'bg-success/100' : 'bg-warning/100'}`} />
                <span className="text-sm">
                  Cal.com Username: {calUsername ? (
                    <span className="font-medium text-foreground">{calUsername}</span>
                  ) : (
                    <span className="text-warning">Not configured</span>
                  )}
                </span>
              </div>
            </div>

            {!calUsername && (
              <div className="p-4 rounded-lg bg-warning/10 border border-warning/20">
                <p className="text-sm text-warning dark:text-warning">
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
      </div>
    </div>
  );
}
