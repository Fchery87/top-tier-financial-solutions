'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FileText } from 'lucide-react';
import type { AuditReportStatus } from '@/components/portal/types';

interface PortalAuditReportCardProps {
  auditReport: AuditReportStatus;
}

export default function PortalAuditReportCard({ auditReport }: PortalAuditReportCardProps) {
  if (!auditReport.has_report) return null;

  return (
    <Card className="bg-gradient-to-br from-secondary/10 to-secondary/5 backdrop-blur-sm border-secondary/30 hover:border-secondary/50 transition-all">
      <CardHeader>
        <CardTitle className="font-sans text-xl flex items-center gap-2">
          <FileText className="w-5 h-5 text-secondary" />
          Credit Analysis Report
        </CardTitle>
        <CardDescription>Your personalized credit audit is ready</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {auditReport.scores && (
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2 rounded-lg bg-background/50">
              <p className="text-xs text-muted-foreground">TU</p>
              <p className="text-lg font-bold text-foreground">{auditReport.scores.transunion || '---'}</p>
            </div>
            <div className="p-2 rounded-lg bg-background/50">
              <p className="text-xs text-muted-foreground">EX</p>
              <p className="text-lg font-bold text-foreground">{auditReport.scores.experian || '---'}</p>
            </div>
            <div className="p-2 rounded-lg bg-background/50">
              <p className="text-xs text-muted-foreground">EQ</p>
              <p className="text-lg font-bold text-foreground">{auditReport.scores.equifax || '---'}</p>
            </div>
          </div>
        )}
        <Button asChild className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90">
          <Link href="/portal/audit-report">
            <FileText className="w-4 h-4 mr-2" />
            View Full Report
          </Link>
        </Button>
        {auditReport.report_date && (
          <p className="text-xs text-muted-foreground text-center">
            Generated {new Date(auditReport.report_date).toLocaleDateString()}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
