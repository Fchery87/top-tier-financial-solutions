'use client';

import { AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react';

export interface LetterFinding {
  code: string;
  severity: 'block' | 'warn';
  message: string;
}

interface LetterCompliancePanelProps {
  findings: LetterFinding[];
  loading?: boolean;
  acknowledged: boolean;
  onAcknowledge: (value: boolean) => void;
}

export function LetterCompliancePanel({ findings, loading = false, acknowledged, onAcknowledge }: LetterCompliancePanelProps) {
  const blocked = findings.some(finding => finding.severity === 'block');
  const warnings = findings.some(finding => finding.severity === 'warn');

  return (
    <div className={`rounded-lg border p-3 ${blocked ? 'border-destructive/40 bg-destructive/5' : warnings ? 'border-warning/40 bg-warning/5' : 'border-success/30 bg-success/5'}`}>
      <div className="flex items-center gap-2 text-sm font-medium">
        {blocked ? <ShieldAlert className="h-4 w-4 text-destructive" /> : warnings ? <AlertTriangle className="h-4 w-4 text-warning" /> : <CheckCircle2 className="h-4 w-4 text-success" />}
        {loading ? 'Checking compliance…' : blocked ? 'Blocked until corrected' : warnings ? 'Review warnings before saving' : 'Compliance check is clean'}
      </div>
      {findings.length > 0 && <ul className="mt-2 space-y-1 text-xs text-muted-foreground">{findings.map(finding => <li key={`${finding.code}-${finding.message}`}>{finding.message}</li>)}</ul>}
      {warnings && !blocked && (
        <label className="mt-3 flex items-start gap-2 text-xs">
          <input type="checkbox" checked={acknowledged} onChange={event => onAcknowledge(event.target.checked)} />
          <span>I reviewed these warnings and want to save this letter.</span>
        </label>
      )}
    </div>
  );
}
