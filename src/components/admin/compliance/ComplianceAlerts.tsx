'use client';

import { motion } from 'framer-motion';
import { AlertTriangle, CheckCircle, Clock, XCircle, ExternalLink } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';

interface ComplianceAlert {
  type: 'warning' | 'error' | 'info';
  title: string;
  description: string;
  action?: {
    label: string;
    href: string;
  };
}

interface ComplianceAlertsProps {
  alerts: ComplianceAlert[];
}

function getAlertIcon(type: string) {
  switch (type) {
    case 'error': return <XCircle className="w-5 h-5 text-red-500" />;
    case 'warning': return <AlertTriangle className="w-5 h-5 text-amber-500" />;
    case 'info': return <Clock className="w-5 h-5 text-blue-500" />;
    default: return <CheckCircle className="w-5 h-5 text-green-500" />;
  }
}

function getAlertBg(type: string) {
  switch (type) {
    case 'error': return 'bg-red-500/5 border-red-500/20';
    case 'warning': return 'bg-amber-500/5 border-amber-500/20';
    case 'info': return 'bg-blue-500/5 border-blue-500/20';
    default: return 'bg-green-500/5 border-green-500/20';
  }
}

export function ComplianceAlerts({ alerts }: ComplianceAlertsProps) {
  if (alerts.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
      >
        <Card className="bg-green-500/5 border-green-500/20">
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-500" />
            <p className="text-sm">No compliance issues detected. Keep up the good work!</p>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25 }}
      className="space-y-3"
    >
      <h2 className="text-lg font-semibold">Alerts & Actions</h2>
      {alerts.map((alert, index) => (
        <Card key={index} className={getAlertBg(alert.type)}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                {getAlertIcon(alert.type)}
                <div>
                  <p className="font-medium">{alert.title}</p>
                  <p className="text-sm text-muted-foreground">{alert.description}</p>
                </div>
              </div>
              {alert.action && (
                <Link href={alert.action.href}>
                  <Button variant="outline" size="sm">
                    {alert.action.label}
                    <ExternalLink className="w-3 h-3 ml-2" />
                  </Button>
                </Link>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </motion.div>
  );
}
