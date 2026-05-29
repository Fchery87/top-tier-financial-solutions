'use client';

import * as React from 'react';
import {
  MessageSquare,
  Loader2,
  Trash2,
  User,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import type { ClientNote } from './types';

interface NotesTabProps {
  clientId: string;
  notes: ClientNote[];
  onNotesChanged: () => void;
}

export function NotesTab({ clientId, notes, onNotesChanged }: NotesTabProps) {
  const [newNote, setNewNote] = React.useState('');
  const [addingNote, setAddingNote] = React.useState(false);
  const [pendingDeleteNoteId, setPendingDeleteNoteId] = React.useState<string | null>(null);

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    setAddingNote(true);
    try {
      const response = await fetch('/api/admin/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: clientId, content: newNote.trim() }),
      });
      if (response.ok) {
        setNewNote('');
        onNotesChanged();
      }
    } catch (error) {
      console.error('Error adding note:', error);
    } finally {
      setAddingNote(false);
    }
  };

  const confirmDeleteNote = async () => {
    if (!pendingDeleteNoteId) return;
    try {
      await fetch(`/api/admin/notes/${pendingDeleteNoteId}`, { method: 'DELETE' });
      onNotesChanged();
    } catch (error) {
      console.error('Error deleting note:', error);
    } finally {
      setPendingDeleteNoteId(null);
    }
  };

  return (
    <>
      <Card className="bg-card border border-border">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-success" />
            Notes
          </CardTitle>
          <CardDescription>Activity and notes for this client</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Add a note..."
              className="flex-1 min-h-[60px] px-3 py-2 text-sm rounded-md border border-input bg-background resize-none"
            />
            <Button onClick={handleAddNote} disabled={addingNote || !newNote.trim()} className="self-end">
              {addingNote ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add'}
            </Button>
          </div>

          {notes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No notes yet. Add a note above to track client interactions.</p>
          ) : (
            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {notes.map((note) => (
                <div key={note.id} className="p-3 rounded-lg bg-muted/50 group">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                      <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                        <User className="w-3 h-3" />
                        <span>{note.author_name || 'Unknown'}</span>
                        <span>•</span>
                        <span>{new Date(note.created_at).toLocaleString()}</span>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive transition-opacity" onClick={() => setPendingDeleteNoteId(note.id)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={pendingDeleteNoteId !== null}
        onOpenChange={(open) => { if (!open) setPendingDeleteNoteId(null); }}
        title="Delete Note"
        description="Delete this note?"
        confirmLabel="Delete"
        onConfirm={confirmDeleteNote}
        variant="danger"
      />
    </>
  );
}
