'use client';

import * as React from 'react';
import { Edit3, Library, Plus, RefreshCw, Search, Power } from 'lucide-react';
import { toast } from 'sonner';
import { AdminPageHeader } from '@/components/workspace/AdminPageHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

interface LibraryRow {
  id: string;
  name: string;
  description: string | null;
  methodology: string;
  target_recipient: string;
  round: number | null;
  item_types: string[] | null;
  bureau: string | null;
  reason_codes: string[] | null;
  variables: string[] | null;
  content: string;
  prompt_context: string | null;
  legal_citations: string[] | null;
  times_used: number;
  success_count: number;
  effectiveness_rating: number | null;
  is_active: boolean;
}

interface Draft {
  id?: string;
  name: string;
  description: string;
  methodology: string;
  target_recipient: string;
  round: string;
  item_types: string;
  bureau: string;
  reason_codes: string;
  variables: string;
  content: string;
  prompt_context: string;
  legal_citations: string;
  is_active: boolean;
}

const emptyDraft: Draft = {
  name: '',
  description: '',
  methodology: 'factual',
  target_recipient: 'bureau',
  round: '1',
  item_types: '',
  bureau: '',
  reason_codes: '',
  variables: '',
  content: '',
  prompt_context: '',
  legal_citations: '',
  is_active: true,
};

function listValue(value: string): string[] | undefined {
  const values = value.split(',').map(item => item.trim()).filter(Boolean);
  return values.length > 0 ? values : undefined;
}

function draftToPayload(draft: Draft, isActive = draft.is_active) {
  return {
    name: draft.name,
    description: draft.description,
    methodology: draft.methodology,
    target_recipient: draft.target_recipient,
    round: Number(draft.round),
    item_types: listValue(draft.item_types),
    bureau: draft.bureau || null,
    reason_codes: listValue(draft.reason_codes),
    variables: listValue(draft.variables),
    content: draft.content,
    prompt_context: draft.prompt_context || null,
    legal_citations: listValue(draft.legal_citations),
    is_active: isActive,
  };
}

function rowToDraft(row: LibraryRow): Draft {
  return {
    id: row.id,
    name: row.name,
    description: row.description || '',
    methodology: row.methodology,
    target_recipient: row.target_recipient,
    round: String(row.round || 1),
    item_types: row.item_types?.join(', ') || '',
    bureau: row.bureau || '',
    reason_codes: row.reason_codes?.join(', ') || '',
    variables: row.variables?.join(', ') || '',
    content: row.content,
    prompt_context: row.prompt_context || '',
    legal_citations: row.legal_citations?.join(', ') || '',
    is_active: row.is_active,
  };
}

export default function LetterLibraryPage() {
  const [rows, setRows] = React.useState<LibraryRow[]>([]);
  const [draft, setDraft] = React.useState<Draft>(emptyDraft);
  const [search, setSearch] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  const loadRows = React.useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/workspace/letter-library');
      if (!response.ok) throw new Error('Unable to load letter library');
      const data = await response.json() as { templates?: LibraryRow[] };
      setRows(data.templates || []);
    } catch (error) {
      console.error(error);
      toast.error('Could not load the letter library');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { void loadRows(); }, [loadRows]);

  const updateDraft = (field: keyof Draft, value: string | boolean) => {
    setDraft(current => ({ ...current, [field]: value }));
  };

  const saveDraft = async () => {
    if (!draft.name.trim() || !draft.content.trim()) {
      toast.error('Name and prompt content are required');
      return;
    }
    setSaving(true);
    try {
      const payload = draftToPayload(draft);
      const response = await fetch(
        draft.id ? `/api/workspace/letter-library/${draft.id}` : '/api/workspace/letter-library',
        {
          method: draft.id ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );
      if (!response.ok) throw new Error('Unable to save letter library row');
      toast.success(draft.id ? 'Library row updated' : 'Library row created');
      setDraft(emptyDraft);
      await loadRows();
    } catch (error) {
      console.error(error);
      toast.error('Could not save the library row');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (row: LibraryRow) => {
    try {
      const response = row.is_active
        ? await fetch(`/api/workspace/letter-library/${row.id}`, { method: 'DELETE' })
        : await fetch(`/api/workspace/letter-library/${row.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(draftToPayload(rowToDraft(row), true)),
          });
      if (!response.ok) throw new Error('Unable to change active state');
      toast.success(row.is_active ? 'Library row deactivated' : 'Library row reactivated');
      await loadRows();
    } catch (error) {
      console.error(error);
      toast.error('Could not change the active state');
    }
  };

  const visibleRows = rows.filter(row => {
    const query = search.toLowerCase();
    return !query || `${row.name} ${row.methodology} ${row.target_recipient}`.toLowerCase().includes(query);
  });

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Administration"
        title="Letter Library"
        description="Manage the strategy rows that enrich dispute generation. Deactivate rows instead of deleting them so past attribution remains valid."
        actions={<Button variant="outline" onClick={() => void loadRows()} disabled={loading}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button>}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <section className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex items-center gap-3 border-b border-border p-4">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search methodology or recipient" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                <tr><th className="p-3">Strategy</th><th className="p-3">Target</th><th className="p-3">Round</th><th className="p-3">Effectiveness</th><th className="p-3" /></tr>
              </thead>
              <tbody>
                {visibleRows.map(row => (
                  <tr key={row.id} className="border-b border-border/70 last:border-0">
                    <td className="p-3"><div className="font-medium">{row.name}</div><div className="text-xs text-muted-foreground">{row.methodology}{row.bureau ? ` · ${row.bureau}` : ''}</div></td>
                    <td className="p-3 capitalize">{row.target_recipient}</td>
                    <td className="p-3">{row.round ?? 'Any'}</td>
                    <td className="p-3">{row.effectiveness_rating === null ? 'Collecting data' : `${row.effectiveness_rating}%`}<div className="text-xs text-muted-foreground">{row.times_used} uses</div></td>
                    <td className="p-3"><div className="flex justify-end gap-1"><Button variant="ghost" size="sm" onClick={() => setDraft(rowToDraft(row))}><Edit3 className="h-4 w-4" /></Button><Button variant="ghost" size="sm" onClick={() => void toggleActive(row)}><Power className={row.is_active ? 'h-4 w-4 text-success' : 'h-4 w-4 text-muted-foreground'} /></Button></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!loading && visibleRows.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground">No library rows match this search.</div>}
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center gap-2"><Library className="h-4 w-4 text-primary" /><h2 className="font-medium">{draft.id ? 'Edit strategy' : 'Add strategy'}</h2></div>
          <div className="space-y-3">
            <Input placeholder="Name" value={draft.name} onChange={event => updateDraft('name', event.target.value)} />
            <Input placeholder="Methodology" value={draft.methodology} onChange={event => updateDraft('methodology', event.target.value)} />
            <div className="grid grid-cols-2 gap-3"><Input placeholder="Target recipient" value={draft.target_recipient} onChange={event => updateDraft('target_recipient', event.target.value)} /><Input placeholder="Round" type="number" min="1" value={draft.round} onChange={event => updateDraft('round', event.target.value)} /></div>
            <Input placeholder="Item types, comma separated" value={draft.item_types} onChange={event => updateDraft('item_types', event.target.value)} />
            <Input placeholder="Reason codes, comma separated" value={draft.reason_codes} onChange={event => updateDraft('reason_codes', event.target.value)} />
            <Input placeholder="Variables, comma separated" value={draft.variables} onChange={event => updateDraft('variables', event.target.value)} />
            <Input placeholder="Legal citations, comma separated" value={draft.legal_citations} onChange={event => updateDraft('legal_citations', event.target.value)} />
            <textarea className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder="Prompt context" value={draft.prompt_context} onChange={event => updateDraft('prompt_context', event.target.value)} />
            <textarea className="min-h-48 w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs" placeholder="Template content / strategy notes" value={draft.content} onChange={event => updateDraft('content', event.target.value)} />
            <div className="flex gap-2"><Button onClick={() => void saveDraft()} disabled={saving}>{draft.id ? <Edit3 className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}{saving ? 'Saving…' : draft.id ? 'Update strategy' : 'Create strategy'}</Button>{draft.id && <Button variant="outline" onClick={() => setDraft(emptyDraft)}>Cancel</Button>}</div>
          </div>
        </section>
      </div>
    </div>
  );
}
