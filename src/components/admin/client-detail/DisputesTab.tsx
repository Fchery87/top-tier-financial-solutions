'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  Scale,
  Loader2,
  Wand2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge, getStatusVariant } from '@/components/admin/StatusBadge';
import { toast } from 'sonner';
import type { NegativeItem, Dispute } from './types';
import { getRiskSeverityColor } from './types';
import { formatCurrency, formatItemType } from '@/lib/format';

interface DisputesTabProps {
  clientId: string;
  negativeItems: NegativeItem[];
  disputes: Dispute[];
  onDataChanged: () => void;
}

export function DisputesTab({
  clientId,
  negativeItems,
  disputes,
  onDataChanged,
}: DisputesTabProps) {
  const router = useRouter();
  const [showDisputeModal, setShowDisputeModal] = React.useState(false);
  const [selectedNegativeItem, setSelectedNegativeItem] = React.useState<NegativeItem | null>(null);
  const [creatingDispute, setCreatingDispute] = React.useState(false);
  const [disputeBureau, setDisputeBureau] = React.useState('transunion');
  const [disputeReason, setDisputeReason] = React.useState('');
  const [disputeType, setDisputeType] = React.useState('standard');

  const handleCreateDispute = (item: NegativeItem) => {
    setSelectedNegativeItem(item);
    setDisputeBureau(item.bureau || 'transunion');
    setDisputeReason(item.dispute_reason || `This ${formatItemType(item.item_type).toLowerCase()} is inaccurate and should be removed.`);
    setDisputeType('standard');
    setShowDisputeModal(true);
  };

  const handleSubmitDispute = async () => {
    if (!selectedNegativeItem) return;
    setCreatingDispute(true);
    try {
      const response = await fetch('/api/admin/disputes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          negativeItemId: selectedNegativeItem.id,
          bureau: disputeBureau,
          disputeReason,
          disputeType,
        }),
      });
      if (response.ok) {
        setShowDisputeModal(false);
        setSelectedNegativeItem(null);
        setDisputeReason('');
        onDataChanged();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to create dispute');
      }
    } catch (error) {
      console.error('Error creating dispute:', error);
      toast.error('Failed to create dispute');
    } finally {
      setCreatingDispute(false);
    }
  };

  return (
    <>
      <div className="space-y-6">
        {negativeItems.length > 0 && (
          <Card className="bg-card border border-border">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                Negative Items
              </CardTitle>
              <CardDescription>{negativeItems.length} item(s) affecting credit</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {negativeItems.map((item) => (
                  <div key={item.id} className="p-4 rounded-lg bg-muted/50 border border-border/50">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${getRiskSeverityColor(item.risk_severity)}`}>
                            {item.risk_severity.toUpperCase()}
                          </span>
                          <span className="text-xs text-muted-foreground">{formatItemType(item.item_type)}</span>
                        </div>
                        <p className="font-medium">{item.creditor_name}</p>
                        {item.original_creditor && <p className="text-xs text-muted-foreground">Original: {item.original_creditor}</p>}
                        <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                          {item.amount && <span>Amount: {formatCurrency(item.amount)}</span>}
                          {item.bureau && <span>{item.bureau.toUpperCase()}</span>}
                        </div>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => handleCreateDispute(item)}>
                        <Scale className="w-4 h-4 mr-1" />
                        Dispute
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="bg-card border border-border">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">Disputes</CardTitle>
              <CardDescription>{disputes.length} dispute(s)</CardDescription>
            </div>
            <Button variant="secondary" size="sm" onClick={() => router.push('/admin/disputes/wizard')}>
              <Wand2 className="w-4 h-4 mr-1" />
              Dispute Wizard
            </Button>
          </CardHeader>
          <CardContent>
            {disputes.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No disputes created yet. Analyze a credit report to identify items to dispute.
              </p>
            ) : (
              <div className="space-y-3">
                {disputes.map((dispute) => (
                  <div key={dispute.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div>
                      <p className="text-sm font-medium">{dispute.dispute_reason}</p>
                      <p className="text-xs text-muted-foreground">
                        {dispute.bureau.toUpperCase()} • Round {dispute.round} • {dispute.dispute_type}
                      </p>
                    </div>
                    <StatusBadge status={dispute.status} variant={getStatusVariant(dispute.status)} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {showDisputeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => { setShowDisputeModal(false); setSelectedNegativeItem(null); }}>
          <div className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <Card className="bg-card border-border shadow-2xl">
              <CardHeader>
                <CardTitle>Create Dispute</CardTitle>
                <CardDescription>Create a dispute for {selectedNegativeItem?.creditor_name}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Bureau</label>
                  <select value={disputeBureau} onChange={(e) => setDisputeBureau(e.target.value)} className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm">
                    <option value="transunion">TransUnion</option>
                    <option value="experian">Experian</option>
                    <option value="equifax">Equifax</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">Dispute Type</label>
                  <select value={disputeType} onChange={(e) => setDisputeType(e.target.value)} className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm">
                    <option value="standard">Standard Dispute</option>
                    <option value="method_of_verification">Method of Verification</option>
                    <option value="direct_creditor">Direct to Creditor</option>
                    <option value="goodwill">Goodwill Letter</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">Dispute Reason</label>
                  <textarea value={disputeReason} onChange={(e) => setDisputeReason(e.target.value)} placeholder="Reason for dispute..." className="w-full min-h-[100px] px-3 py-2 text-sm rounded-md border border-input bg-background" />
                </div>
                <div className="flex gap-2 pt-4">
                  <Button variant="outline" className="flex-1" onClick={() => { setShowDisputeModal(false); setSelectedNegativeItem(null); }}>Cancel</Button>
                  <Button className="flex-1" onClick={handleSubmitDispute} disabled={creatingDispute || !disputeReason.trim()}>
                    {creatingDispute && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                    Create Dispute
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
