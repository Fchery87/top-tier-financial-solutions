'use client';

import * as React from 'react';
import { AlertTriangle, Check, Loader2, Save, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { LetterCompliancePanel, type LetterFinding } from './LetterCompliancePanel';
import { LetterDiffView } from './LetterDiffView';
import { LetterRevisionHistory, type LetterRevisionSummary } from './LetterRevisionHistory';

type RewriteMode = 'rewrite' | 'tone' | 'custom';
type LetterTone = 'professional' | 'concerned' | 'annoyed' | 'disappointed' | 'demanding';

interface LetterLibraryInfo {
  name: string;
  methodology: string;
  rationale: string[];
}

interface LetterAggregate {
  content: string;
  currentRevision: number;
  immutableReason: string | null;
  findings: LetterFinding[];
  revisions: LetterRevisionSummary[];
  library: LetterLibraryInfo | null;
}

interface LetterStudioProps {
  disputeId: string;
  initialLetter: string | null;
  readOnly?: boolean;
  onSaved?: (content: string, revision: number) => void;
}

export function LetterStudio({ disputeId, initialLetter, readOnly = false, onSaved }: LetterStudioProps) {
  const rootRef = React.useRef<HTMLDivElement>(null);
  const lintRequestRef = React.useRef(0);
  const autosaveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [letter, setLetter] = React.useState(initialLetter || '');
  const [savedLetter, setSavedLetter] = React.useState(initialLetter || '');
  const [mode, setMode] = React.useState<RewriteMode>('rewrite');
  const [tone, setTone] = React.useState<LetterTone>('professional');
  const [instruction, setInstruction] = React.useState('');
  const [selectionStart, setSelectionStart] = React.useState<number | null>(null);
  const [selectionEnd, setSelectionEnd] = React.useState<number | null>(null);
  const [selectedText, setSelectedText] = React.useState('');
  const [findings, setFindings] = React.useState<LetterFinding[]>([]);
  const [acknowledgeWarnings, setAcknowledgeWarnings] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [linting, setLinting] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [error, setError] = React.useState('');
  const [loaded, setLoaded] = React.useState(false);
  const [revision, setRevision] = React.useState(0);
  const [immutableReason, setImmutableReason] = React.useState<string | null>(null);
  const [revisions, setRevisions] = React.useState<LetterRevisionSummary[]>([]);
  const [selectedRevision, setSelectedRevision] = React.useState<LetterRevisionSummary | null>(null);
  const [library, setLibrary] = React.useState<LetterLibraryInfo | null>(null);

  const refreshState = React.useCallback(async () => {
    const response = await fetch(`/api/admin/disputes/${disputeId}/letter`);
    const value: unknown = await response.json().catch(() => ({}));
    const aggregate = response.ok ? parseAggregate(value) : null;
    if (!aggregate) throw new Error(readError(value, 'The letter state could not be loaded.'));
    setLetter(aggregate.content);
    setSavedLetter(aggregate.content);
    setRevision(aggregate.currentRevision);
    setImmutableReason(aggregate.immutableReason);
    setFindings(aggregate.findings);
    setRevisions(aggregate.revisions);
    setLibrary(aggregate.library);
    setLoaded(true);
  }, [disputeId]);

  React.useEffect(() => {
    let active = true;
    void refreshState().catch(errorValue => {
      if (active) setError(errorValue instanceof Error ? errorValue.message : 'The letter state could not be loaded.');
    });
    return () => { active = false; };
  }, [refreshState]);

  const previewLint = React.useCallback(async (content: string) => {
    if (!content.trim() || readOnly || immutableReason) return;
    const requestId = lintRequestRef.current + 1;
    lintRequestRef.current = requestId;
    setLinting(true);
    try {
      const response = await fetch(`/api/admin/disputes/${disputeId}/letter/lint`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      const value: unknown = await response.json().catch(() => ({}));
      if (requestId === lintRequestRef.current && response.ok && isLintResult(value)) setFindings(value.findings);
    } finally {
      if (requestId === lintRequestRef.current) setLinting(false);
    }
  }, [disputeId, immutableReason, readOnly]);

  React.useEffect(() => {
    if (!loaded || letter === savedLetter || readOnly || immutableReason) return;
    const timer = setTimeout(() => { void previewLint(letter); }, 450);
    return () => clearTimeout(timer);
  }, [immutableReason, letter, previewLint, readOnly, savedLetter, loaded]);

  const applySavedState = React.useCallback((content: string, nextRevision: number) => {
    setLetter(content);
    setSavedLetter(content);
    setRevision(nextRevision);
    setSaved(true);
    setAcknowledgeWarnings(false);
    setFindings([]);
    onSaved?.(content, nextRevision);
    void refreshState().catch(() => undefined);
  }, [onSaved, refreshState]);

  const saveManual = React.useCallback(async (acknowledge = false) => {
    if (saving || !letter.trim() || findings.some(finding => finding.severity === 'block')) return;
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const response = await fetch(`/api/admin/disputes/${disputeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          letterContent: letter,
          acknowledgeWarnings: acknowledge,
          expectedRevision: revision,
        }),
      });
      const value: unknown = await response.json().catch(() => ({}));
      if (isResponseWithFindings(value)) setFindings(value.findings);
      if (response.status === 409 && isResponseWithFindings(value)) return;
      if (!response.ok) {
        setError(readError(value, 'The letter could not be saved.'));
        return;
      }
      const nextRevision = isRecord(value) && typeof value.revision === 'number' ? value.revision : revision + 1;
      applySavedState(letter, nextRevision);
    } catch {
      setError('The letter could not be saved.');
    } finally {
      setSaving(false);
    }
  }, [applySavedState, disputeId, findings, letter, revision, saving]);

  const rewrite = React.useCallback(async (acknowledge = false) => {
    if (saving || !letter.trim()) return;
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const response = await fetch(`/api/admin/disputes/${disputeId}/letter/rewrite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          tone: mode === 'tone' ? tone : undefined,
          instruction: mode === 'custom' ? instruction : undefined,
          selectionStart: selectionStart ?? undefined,
          selectionEnd: selectionEnd ?? undefined,
          expectedSelectedText: selectedText || undefined,
          expectedRevision: revision,
          acknowledgeWarnings: acknowledge,
        }),
      });
      const value: unknown = await response.json().catch(() => ({}));
      if (isResponseWithLetter(value)) setLetter(value.letter);
      if (isResponseWithFindings(value)) setFindings(value.findings);
      if (response.status === 409 && isResponseWithFindings(value)) return;
      if (!response.ok) {
        setError(readError(value, 'The letter could not be rewritten.'));
        return;
      }
      const nextContent = isResponseWithLetter(value) ? value.letter : letter;
      const nextRevision = isRecord(value) && typeof value.revision === 'number' ? value.revision : revision + 1;
      setSelectionStart(null);
      setSelectionEnd(null);
      setSelectedText('');
      applySavedState(nextContent, nextRevision);
    } catch {
      setError('The letter could not be rewritten.');
    } finally {
      setSaving(false);
    }
  }, [applySavedState, disputeId, instruction, letter, mode, revision, saving, selectedText, selectionEnd, selectionStart, tone]);

  const revert = React.useCallback(async (selected: LetterRevisionSummary, acknowledge = false) => {
    setSaving(true);
    setError('');
    try {
      const response = await fetch(`/api/admin/disputes/${disputeId}/letter/revisions/${selected.id}/revert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expectedRevision: revision, acknowledgeWarnings: acknowledge }),
      });
      const value: unknown = await response.json().catch(() => ({}));
      if (isResponseWithFindings(value)) setFindings(value.findings);
      if (response.status === 409 && isResponseWithFindings(value)) return;
      if (!response.ok) {
        setError(readError(value, 'The letter could not be reverted.'));
        return;
      }
      const nextRevision = isRecord(value) && typeof value.revision === 'number' ? value.revision : revision + 1;
      applySavedState(selected.content, nextRevision);
      setSelectedRevision(null);
    } catch {
      setError('The letter could not be reverted.');
    } finally {
      setSaving(false);
    }
  }, [applySavedState, disputeId, revision]);

  const handleBlur = () => {
    if (!letter.trim() || letter === savedLetter || saving || readOnly || immutableReason) return;
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => {
      const activeElement = document.activeElement;
      if (activeElement && rootRef.current?.contains(activeElement)) return;
      void saveManual(false);
    }, 0);
  };

  const blocked = findings.some(finding => finding.severity === 'block');
  const warning = findings.some(finding => finding.severity === 'warn');
  const immutable = Boolean(immutableReason) || readOnly;

  return (
    <section ref={rootRef} data-letter-studio className="space-y-4 border-b border-border pb-5">
      {immutableReason && <div className="rounded-md border border-warning/40 bg-warning/5 p-3 text-xs text-warning"><AlertTriangle className="mr-2 inline h-4 w-4" />{immutableReason}</div>}
      <div className="flex items-start justify-between gap-3">
        <div><h3 className="text-sm font-semibold">Letter Studio</h3><p className="text-xs text-muted-foreground">Edit the saved letter or rewrite it with a deliberate voice.</p></div>
        {saved && <span className="inline-flex items-center gap-1 text-xs text-success"><Check className="h-3.5 w-3.5" />Saved as revision {revision}</span>}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div>
          <Textarea
            value={letter}
            onChange={event => { setLetter(event.target.value); setSaved(false); }}
            onSelect={event => {
              setSelectionStart(event.currentTarget.selectionStart);
              setSelectionEnd(event.currentTarget.selectionEnd);
              setSelectedText(event.currentTarget.value.slice(event.currentTarget.selectionStart, event.currentTarget.selectionEnd));
            }}
            onBlur={handleBlur}
            disabled={immutable || saving}
            className="min-h-[280px] resize-y font-mono text-xs leading-6"
            placeholder="Generate a letter first, or enter the letter text here."
            aria-label="Dispute letter content"
          />
          {!immutable && <div className="mt-3 grid gap-2 sm:grid-cols-[9rem_1fr_auto]">
            <select value={mode} onChange={event => setMode(parseMode(event.target.value))} className="h-10 rounded-md border border-input bg-background px-3 text-sm" aria-label="Rewrite mode">
              <option value="rewrite">Rewrite</option><option value="tone">Shift tone</option><option value="custom">Custom instruction</option>
            </select>
            {mode === 'tone' ? <select value={tone} onChange={event => setTone(parseTone(event.target.value))} className="h-10 rounded-md border border-input bg-background px-3 text-sm" aria-label="Letter tone">
              <option value="professional">Professional</option><option value="concerned">Concerned</option><option value="annoyed">Annoyed</option><option value="disappointed">Disappointed</option><option value="demanding">Demanding</option>
            </select> : mode === 'custom' ? <input value={instruction} onChange={event => setInstruction(event.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm" placeholder="Make the request more specific" aria-label="Rewrite instruction" /> : <p className="flex items-center px-1 text-xs text-muted-foreground">Select text to rewrite only that passage.</p>}
            <Button variant="outline" onClick={() => void rewrite(false)} disabled={saving || blocked || !letter.trim()}><Wand2 className="mr-2 h-4 w-4" />Rewrite</Button>
          </div>}
          {!immutable && <div className="mt-3 flex justify-end gap-2"><Button onClick={() => void saveManual(acknowledgeWarnings)} disabled={saving || blocked || !letter.trim()}><Save className="mr-2 h-4 w-4" />Save letter</Button>{warning && acknowledgeWarnings && <Button variant="outline" onClick={() => void saveManual(true)} disabled={saving}>Apply with warnings</Button>}</div>}
        </div>

        <aside className="space-y-4">
          <LetterCompliancePanel findings={findings} loading={linting} acknowledged={acknowledgeWarnings} onAcknowledge={setAcknowledgeWarnings} />
          {library && <div className="rounded-lg border border-border p-3 text-xs"><h4 className="font-semibold">Attributed strategy</h4><p className="mt-1 font-medium">{library.name}</p><p className="text-muted-foreground">{library.methodology}</p>{library.rationale.length > 0 && <ul className="mt-2 list-disc space-y-1 pl-4 text-muted-foreground">{library.rationale.map(item => <li key={item}>{item}</li>)}</ul>}</div>}
          <LetterRevisionHistory revisions={revisions} selectedRevisionId={selectedRevision?.id || null} immutable={immutable} onSelect={setSelectedRevision} onRevert={selected => void revert(selected)} />
          {selectedRevision && <div className="space-y-2"><h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Diff against revision {selectedRevision.revision}</h4><LetterDiffView before={selectedRevision.content} after={letter} /></div>}
        </aside>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      {saving && <p className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />Updating revision history…</p>}
    </section>
  );
}

function parseMode(value: string): RewriteMode { return value === 'tone' || value === 'custom' ? value : 'rewrite'; }
function parseTone(value: string): LetterTone { return value === 'concerned' || value === 'annoyed' || value === 'disappointed' || value === 'demanding' ? value : 'professional'; }

function parseAggregate(value: unknown): LetterAggregate | null {
  if (!isRecord(value) || typeof value.content !== 'string' || typeof value.current_revision !== 'number') return null;
  const revisions = Array.isArray(value.revisions)
    ? value.revisions.map(parseRevision).filter((item): item is LetterRevisionSummary => item !== null)
    : [];
  const library = isRecord(value.library) && typeof value.library.name === 'string' && typeof value.library.methodology === 'string'
    ? { name: value.library.name, methodology: value.library.methodology, rationale: isRecord(value.library.rationale) && Array.isArray(value.library.rationale.rationale) ? value.library.rationale.rationale.filter((item): item is string => typeof item === 'string') : [] }
    : null;
  return { content: value.content, currentRevision: value.current_revision, immutableReason: typeof value.immutable_reason === 'string' ? value.immutable_reason : null, findings: isLintResult(value.lint) ? value.lint.findings : [], revisions, library };
}

function parseRevision(value: unknown): LetterRevisionSummary | null {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.revision !== 'number' || typeof value.source !== 'string' || typeof value.content !== 'string') return null;
  if (value.tone_label !== null && typeof value.tone_label !== 'string') return null;
  if (value.warnings_acknowledged !== null && typeof value.warnings_acknowledged !== 'boolean') return null;
  if (value.created_by !== null && typeof value.created_by !== 'string') return null;
  if (value.created_at !== null && typeof value.created_at !== 'string') return null;
  return {
    id: value.id,
    revision: value.revision,
    source: value.source,
    toneLabel: value.tone_label,
    warningsAcknowledged: value.warnings_acknowledged === true,
    createdBy: value.created_by,
    createdAt: value.created_at,
    content: value.content,
  };
}

function isLintResult(value: unknown): value is { findings: LetterFinding[] } {
  return isRecord(value) && Array.isArray(value.findings) && value.findings.every(item => isRecord(item) && typeof item.code === 'string' && (item.severity === 'warn' || item.severity === 'block') && typeof item.message === 'string');
}

function isResponseWithFindings(value: unknown): value is { findings: LetterFinding[] } { return isLintResult(value); }
function isResponseWithLetter(value: unknown): value is { letter: string } { return isRecord(value) && typeof value.letter === 'string'; }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
function readError(value: unknown, fallback: string): string { return isRecord(value) && typeof value.error === 'string' ? value.error : fallback; }
