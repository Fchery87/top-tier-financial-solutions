'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { getSafeFullName, getSafeInitials } from '@/lib/client-utils';

interface Lead {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone_number: string | null;
  message: string | null;
  status: string;
  requested_at: string;
}

interface EditClientModalProps {
  open: boolean;
  onClose: () => void;
  onConverted: () => void;
}

export function EditClientModal({ open, onClose, onConverted }: EditClientModalProps) {
  const [leads, setLeads] = React.useState<Lead[]>([]);
  const [saving, setSaving] = React.useState(false);
  const [_selectedLead, setSelectedLead] = React.useState<Lead | null>(null);

  const fetchLeads = React.useCallback(async () => {
    try {
      const response = await fetch('/api/admin/leads?page=1&limit=100&status=qualified');
      if (response.ok) {
        const data = await response.json();
        setLeads(data.items.filter((l: Lead) => l.status !== 'archived'));
      }
    } catch (error) {
      console.error('Error fetching leads:', error);
    }
  }, []);

  React.useEffect(() => {
    if (open) {
      fetchLeads();
    }
  }, [open, fetchLeads]);

  const handleConvertLead = async (lead: Lead) => {
    setSaving(true);
    try {
      const response = await fetch('/api/admin/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: lead.first_name,
          last_name: lead.last_name,
          email: lead.email,
          phone: lead.phone_number,
          lead_id: lead.id,
          notes: lead.message,
        }),
      });

      if (response.ok) {
        onClose();
        setSelectedLead(null);
        onConverted();
      }
    } catch (error) {
      console.error('Error converting lead:', error);
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg"
      >
        <Card className="bg-card border-border shadow-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <CardHeader>
            <CardTitle>Convert Lead to Client</CardTitle>
            <CardDescription>Select a qualified lead to convert into an active client.</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto space-y-3">
            {leads.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No qualified leads available for conversion.
              </p>
            ) : (
              leads.map((lead) => (
                <div
                  key={lead.id}
                  className="p-4 rounded-lg border border-border hover:border-secondary/50 cursor-pointer transition-colors"
                  onClick={() => setSelectedLead(lead)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-secondary to-secondary/70 flex items-center justify-center text-primary font-bold">
                        {getSafeInitials(lead.first_name, lead.last_name)}
                      </div>
                      <div>
                        <p className="font-medium">{getSafeFullName(lead.first_name, lead.last_name)}</p>
                        <p className="text-xs text-muted-foreground">{lead.email || '—'}</p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleConvertLead(lead);
                      }}
                      disabled={saving}
                    >
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Convert'}
                    </Button>
                  </div>
                  {lead.message && (
                    <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{lead.message}</p>
                  )}
                </div>
              ))
            )}
            <div className="flex gap-2 pt-4 border-t border-border">
              <Button variant="outline" className="flex-1" onClick={onClose}>
                Close
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
