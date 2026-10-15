'use client';

import * as React from 'react';
import { Check, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

interface HeldFinding {
  negative_item_id: string;
  creditor_name: string | null;
  bureau: string;
  text: string;
  review: 'approved' | 'dropped' | null;
}

const BUREAU_NAMES: Record<string, string> = { transunion: 'TransUnion', experian: 'Experian', equifax: 'Equifax' };

/** Interpretive Findings wait here until staff approve them into letters or drop them. */
export function HeldFindingsPanel({ clientId }: { clientId: string }) {
  const [findings, setFindings] = React.useState<HeldFinding[] | null>(null);
  const [saving, setSaving] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    try {
      const response = await fetch(`/api/workspace/clients/${clientId}/held-findings`);
      if (!response.ok) throw new Error('load failed');
      const data = await response.json() as { findings: HeldFinding[] };
      setFindings(data.findings);
    } catch {
      setFindings([]);
      toast.error('Could not load held findings');
    }
  }, [clientId]);

  React.useEffect(() => { void load(); }, [load]);

  const decide = async (finding: HeldFinding, decision: 'approved' | 'dropped') => {
    const key = `${finding.negative_item_id}|${finding.text}`;
    setSaving(key);
    try {
      const response = await fetch(`/api/workspace/clients/${clientId}/held-findings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ negative_item_id: finding.negative_item_id, finding_text: finding.text, decision }),
      });
      if (!response.ok) throw new Error('save failed');
      setFindings(current => (current ?? []).map(item =>
        item.negative_item_id === finding.negative_item_id && item.text === finding.text ? { ...item, review: decision } : item));
      toast.success(decision === 'approved' ? 'Finding approved for letters' : 'Finding dropped');
    } catch {
      toast.error('Could not save the decision');
    } finally {
      setSaving(null);
    }
  };

  if (findings === null) {
    return (
      <Card className="bg-card border border-border">
        <CardContent className="py-6 text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Loading held findings…
        </CardContent>
      </Card>
    );
  }
  if (findings.length === 0) return null;

  const pending = findings.filter(finding => finding.review === null).length;

  return (
    <Card className="bg-card border border-border" data-testid="held-findings">
      <CardHeader>
        <CardTitle className="text-sm font-semibold">Held Findings</CardTitle>
        <CardDescription>
          {pending} awaiting review. These depend on how a reporting guideline is read, so they stay out of letters until approved.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3">
          {findings.map(finding => {
            const key = `${finding.negative_item_id}|${finding.text}`;
            return (
              <li key={`${key}|${finding.bureau}`} className="p-3 rounded-lg bg-muted/50 border border-border/50">
                <p className="text-xs text-muted-foreground mb-1">
                  {finding.creditor_name ?? 'Unknown creditor'} • {BUREAU_NAMES[finding.bureau] ?? finding.bureau}
                </p>
                <p className="text-sm">{finding.text}</p>
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  {finding.review ? (
                    <span className={`text-xs font-medium ${finding.review === 'approved' ? 'text-success' : 'text-muted-foreground'}`}>
                      {finding.review === 'approved' ? 'Approved for letters' : 'Dropped'}
                    </span>
                  ) : null}
                  <Button size="sm" variant={finding.review === 'approved' ? 'secondary' : 'outline'} disabled={saving === key} onClick={() => decide(finding, 'approved')}>
                    <Check className="w-4 h-4 mr-1" aria-hidden="true" /> Approve
                  </Button>
                  <Button size="sm" variant="outline" disabled={saving === key} onClick={() => decide(finding, 'dropped')}>
                    <X className="w-4 h-4 mr-1" aria-hidden="true" /> Drop
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
