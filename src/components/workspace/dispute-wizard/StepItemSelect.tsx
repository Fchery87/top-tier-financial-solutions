'use client';

import * as React from 'react';
import { Check, Loader2, AlertCircle, Sparkles, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useWizardContext } from './WizardContext';
import {
  PRESET_DISPUTE_INSTRUCTIONS,
  itemAppearsOnBureau,
  formatPersonalInfoType,
} from './types';
import { formatCurrency, formatItemType } from '@/lib/format';

export function StepItemSelect() {
  const ctx = useWizardContext();
  const {
    selectedClient, negativeItems, selectedItems,
    personalInfoItems, selectedPersonalItems,
    inquiryItems, selectedInquiryItems,
    activeTab, setActiveTab, generationMethod,
    renderValidationMessages,
  } = ctx;

  return (
    <Card className="bg-card border border-border">
      <CardHeader>
        <CardTitle>
          Select Dispute Items
          <span className="text-destructive ml-1">*</span>
          {selectedItems.length === 0 && selectedPersonalItems.length === 0 && selectedInquiryItems.length === 0 && (
            <span className="text-xs text-destructive ml-3 font-normal">(Select at least one)</span>
          )}
        </CardTitle>
        <CardDescription>
          Choose tradelines, personal info, or inquiries to dispute for {selectedClient?.first_name} {selectedClient?.last_name}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {renderValidationMessages()}

        {generationMethod === 'template' && (
          <div className="p-3 rounded-lg bg-secondary/10 border border-secondary/20">
            <p className="text-sm text-foreground">
              <strong>Template Mode:</strong> Select items below and set a dispute instruction for each one.
              You can choose from pre-built reasons or enter a custom instruction.
            </p>
          </div>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          {[
            { key: 'tradelines' as const, label: `Tradelines (${negativeItems.length})` },
            { key: 'personal' as const, label: `Personal Info (${personalInfoItems.length})` },
            { key: 'inquiries' as const, label: `Inquiries (${inquiryItems.length})` },
          ].map(tab => (
            <Button key={tab.key} variant={activeTab === tab.key ? 'secondary' : 'outline'} size="sm" onClick={() => setActiveTab(tab.key)}>
              {tab.label}
            </Button>
          ))}
          <span className="text-sm text-muted-foreground ml-auto">
            Selected: {selectedItems.length + selectedPersonalItems.length + selectedInquiryItems.length}
          </span>
        </div>

        {generationMethod === 'ai' && (
          <div className="p-3 rounded-lg bg-success/10 border border-success/20">
            <p className="text-sm text-success">
              <strong>AI Mode:</strong> Simply select items to dispute. The AI will automatically analyze
              each item for Metro 2 compliance violations and FCRA issues.
            </p>
          </div>
        )}

        {activeTab === 'tradelines' && <TradelinesTab ctx={ctx} />}
        {activeTab === 'personal' && <PersonalInfoTab ctx={ctx} />}
        {activeTab === 'inquiries' && <InquiriesTab ctx={ctx} />}
      </CardContent>
    </Card>
  );
}

function TradelinesTab({ ctx }: { ctx: ReturnType<typeof useWizardContext> }) {
  const {
    negativeItems, selectedItems, setSelectedItems, loadingItems,
    generationMethod, itemDisputeInstructions, setItemDisputeInstructions,
    triageQuickActions, autoSelecting, autoSelectSummary,
    autoSelectDisputableItems, handleToggleItem, updateItemInstruction,
  } = ctx;

  return (
    <>
      {triageQuickActions.length > 0 && (
        <div className="p-3 rounded-lg bg-secondary/10 border border-secondary/20">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-4 h-4 text-secondary" />
            <span className="text-sm font-medium text-secondary">Quick Actions</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {triageQuickActions.map((action) => (
              <Button
                key={action.id} variant="outline" size="sm"
                className="text-xs border-secondary/30 hover:bg-secondary/10"
                onClick={() => {
                  setSelectedItems(prev => [...new Set([...prev, ...action.itemIds])]);
                  if (generationMethod === 'template') {
                    setItemDisputeInstructions(prev => {
                      const newMap = new Map(prev);
                      action.itemIds.forEach(id => { if (!newMap.has(id)) newMap.set(id, { itemId: id, instructionType: 'preset', presetCode: '' }); });
                      return newMap;
                    });
                  }
                }}
              >
                <Check className="w-3 h-3 mr-1" />
                {action.label} ({action.count})
              </Button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2">Click to quickly select items by category</p>
        </div>
      )}

      {loadingItems ? (
        <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-secondary" /></div>
      ) : negativeItems.length === 0 ? (
        <div className="text-center py-8">
          <AlertCircle className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No negative items found for this client.</p>
          <p className="text-sm text-muted-foreground mt-1">Upload and analyze a credit report first.</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-[400px] overflow-y-auto">
          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
            <span className="text-sm text-muted-foreground">{selectedItems.length} of {negativeItems.length} items selected</span>
            <div className="flex items-center gap-2 flex-wrap">
              {['transunion', 'experian', 'equifax'].map((bureau) => {
                const bureauItems = negativeItems.filter(i => itemAppearsOnBureau(i, bureau));
                if (bureauItems.length === 0) return null;
                const allSelected = bureauItems.every(i => selectedItems.includes(i.id));
                return (
                  <Button
                    key={bureau} variant={allSelected ? 'secondary' : 'outline'} size="sm"
                    onClick={() => {
                      if (allSelected) {
                        const idsToRemove = bureauItems.map(i => i.id);
                        setSelectedItems(prev => prev.filter(id => !idsToRemove.includes(id)));
                        if (generationMethod === 'template') setItemDisputeInstructions(prev => { const m = new Map(prev); idsToRemove.forEach(id => m.delete(id)); return m; });
                      } else {
                        const newIds = bureauItems.map(i => i.id);
                        setSelectedItems(prev => [...new Set([...prev, ...newIds])]);
                        if (generationMethod === 'template') setItemDisputeInstructions(prev => { const m = new Map(prev); newIds.forEach(id => { if (!m.has(id)) m.set(id, { itemId: id, instructionType: 'preset', presetCode: '' }); }); return m; });
                      }
                    }}
                  >
                    {bureau.charAt(0).toUpperCase() + bureau.slice(1)}
                    <span className="ml-1 text-xs opacity-70">({bureauItems.length})</span>
                  </Button>
                );
              })}
              <Button variant="secondary" size="sm" onClick={autoSelectDisputableItems} disabled={!ctx.selectedClient || autoSelecting}>
                {autoSelecting ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Sparkles className="w-3 h-3 mr-1" />}
                Select All Disputable
              </Button>
              <Button
                variant="ghost" size="sm"
                onClick={() => {
                  if (selectedItems.length === negativeItems.length) { setSelectedItems([]); setItemDisputeInstructions(new Map()); }
                  else {
                    const allIds = negativeItems.map(i => i.id);
                    setSelectedItems(allIds);
                    if (generationMethod === 'template') setItemDisputeInstructions(prev => { const m = new Map(prev); allIds.forEach(id => { if (!m.has(id)) m.set(id, { itemId: id, instructionType: 'preset', presetCode: '' }); }); return m; });
                  }
                }}
              >
                {selectedItems.length === negativeItems.length ? 'Deselect All' : 'Select All'}
              </Button>
            </div>
          </div>

          {autoSelectSummary && <p className="text-xs text-muted-foreground">{autoSelectSummary}</p>}

          {negativeItems.map((item) => {
            const isSelected = selectedItems.includes(item.id);
            const instruction = itemDisputeInstructions.get(item.id);
            const showInstructionUI = isSelected && generationMethod === 'template';
            return (
              <div key={item.id} className={`rounded-lg border transition-all ${isSelected ? 'border-secondary bg-secondary/10' : 'border-border hover:border-secondary/50'}`}>
                <div className="p-4 cursor-pointer" onClick={() => handleToggleItem(item.id)}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium">{item.creditor_name}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${item.risk_severity === 'severe' || item.risk_severity === 'high' ? 'bg-destructive/15 text-destructive' : item.risk_severity === 'medium' ? 'bg-warning/15 text-warning' : 'bg-success/15 text-success'}`}>{item.risk_severity}</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{formatItemType(item.item_type)} • {formatCurrency(item.amount)}</p>
                      <div className="flex items-center gap-1.5 mt-2">
                        <span className="text-xs text-muted-foreground mr-1">Bureaus:</span>
                        {['transunion', 'experian', 'equifax'].map((bureau) => {
                          const appearsOn = itemAppearsOnBureau(item, bureau);
                          const bureauDate = bureau === 'transunion' ? item.transunion_date : bureau === 'experian' ? item.experian_date : item.equifax_date;
                          const dateStr = bureauDate ? new Date(bureauDate).toLocaleDateString() : '';
                          const bureauStatus = bureau === 'transunion' ? item.transunion_status : bureau === 'experian' ? item.experian_status : item.equifax_status;
                          return (
                            <span
                              key={bureau}
                              className={`text-xs px-1.5 py-0.5 rounded font-medium ${appearsOn ? 'bg-secondary/15 text-secondary' : 'bg-muted/50 text-muted-foreground/50 line-through'}`}
                              title={appearsOn ? `${bureau}${dateStr ? ` - ${dateStr}` : ''}${bureauStatus ? ` - ${bureauStatus}` : ''}` : `Not reported on ${bureau}`}
                            >
                              {bureau === 'transunion' ? 'TU' : bureau === 'experian' ? 'EXP' : 'EQ'}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${isSelected ? 'border-secondary bg-secondary' : 'border-muted-foreground/30'}`}>
                      {isSelected && <Check className="w-3 h-3 text-primary" />}
                    </div>
                  </div>
                </div>

                {showInstructionUI && (
                  <div className="px-4 pb-4 pt-2 border-t border-border/50 space-y-3" onClick={(e) => e.stopPropagation()}>
                    <label className="text-xs font-medium text-muted-foreground">Dispute Instruction</label>
                    <select className="w-full p-2 rounded-md border border-border bg-background text-sm" value={instruction?.presetCode || ''} onChange={(e) => updateItemInstruction(item.id, 'preset', e.target.value)}>
                      <option value="">Select dispute reason...</option>
                      {PRESET_DISPUTE_INSTRUCTIONS.map((preset) => (<option key={preset.code} value={preset.code}>{preset.label}</option>))}
                    </select>
                    {instruction?.presetCode === 'custom' && (
                      <textarea className="w-full p-2 rounded-md border border-border bg-background text-sm min-h-[80px]" placeholder="Enter your custom dispute instruction for this account..." value={instruction?.customText || ''} onChange={(e) => updateItemInstruction(item.id, 'custom', e.target.value)} />
                    )}
                    {instruction?.presetCode && instruction.presetCode !== 'custom' && (
                      <p className="text-xs text-muted-foreground italic">{PRESET_DISPUTE_INSTRUCTIONS.find(p => p.code === instruction.presetCode)?.description}</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

function PersonalInfoTab({ ctx }: { ctx: ReturnType<typeof useWizardContext> }) {
  const { personalInfoItems, selectedPersonalItems, setSelectedPersonalItems, loadingItems } = ctx;

  return (
    <>
      {loadingItems ? (
        <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-secondary" /></div>
      ) : personalInfoItems.length === 0 ? (
        <div className="text-center py-8">
          <AlertCircle className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No personal information discrepancies found.</p>
          <p className="text-sm text-muted-foreground mt-1">Upload and parse a report to pull PII items.</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-[400px] overflow-y-auto">
          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
            <span className="text-sm text-muted-foreground">{selectedPersonalItems.length} of {personalInfoItems.length} items selected</span>
            <div className="flex items-center gap-2 flex-wrap">
              {['transunion', 'experian', 'equifax'].map((bureau) => {
                const bureauItems = personalInfoItems.filter(p => p.bureau === bureau);
                if (bureauItems.length === 0) return null;
                const allSelected = bureauItems.every(p => selectedPersonalItems.includes(p.id));
                return (
                  <Button key={bureau} variant={allSelected ? 'secondary' : 'outline'} size="sm" onClick={() => {
                    if (allSelected) { const idsToRemove = bureauItems.map(p => p.id); setSelectedPersonalItems(prev => prev.filter(id => !idsToRemove.includes(id))); }
                    else { const newIds = bureauItems.map(p => p.id); setSelectedPersonalItems(prev => [...new Set([...prev, ...newIds])]); }
                  }}>
                    {bureau.charAt(0).toUpperCase() + bureau.slice(1)}<span className="ml-1 text-xs opacity-70">({bureauItems.length})</span>
                  </Button>
                );
              })}
              <Button variant="ghost" size="sm" onClick={() => {
                if (selectedPersonalItems.length === personalInfoItems.length) setSelectedPersonalItems([]);
                else setSelectedPersonalItems(personalInfoItems.map(p => p.id));
              }}>
                {selectedPersonalItems.length === personalInfoItems.length ? 'Deselect All' : 'Select All'}
              </Button>
            </div>
          </div>

          {personalInfoItems.map(item => {
            const isSelected = selectedPersonalItems.includes(item.id);
            return (
              <div key={item.id} className={`rounded-lg border p-4 cursor-pointer transition ${isSelected ? 'border-secondary bg-secondary/10' : 'border-border hover:border-secondary/50'}`} onClick={() => setSelectedPersonalItems(prev => prev.includes(item.id) ? prev.filter(id => id !== item.id) : [...prev, item.id])}>
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{formatPersonalInfoType(item.type)}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                        {item.bureau === 'transunion' ? 'TransUnion' : item.bureau === 'experian' ? 'Experian' : 'Equifax'}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words">{item.value}</p>
                  </div>
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${isSelected ? 'border-secondary bg-secondary' : 'border-muted-foreground/30'}`}>
                    {isSelected && <Check className="w-3 h-3 text-primary" />}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

function InquiriesTab({ ctx }: { ctx: ReturnType<typeof useWizardContext> }) {
  const { inquiryItems, selectedInquiryItems, setSelectedInquiryItems, loadingItems } = ctx;

  return (
    <>
      {loadingItems ? (
        <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-secondary" /></div>
      ) : inquiryItems.length === 0 ? (
        <div className="text-center py-8">
          <AlertCircle className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No inquiries available for dispute.</p>
          <p className="text-sm text-muted-foreground mt-1">Upload and parse a report to pull inquiry history.</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-[400px] overflow-y-auto">
          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
            <span className="text-sm text-muted-foreground">{selectedInquiryItems.length} of {inquiryItems.length} inquiries selected</span>
            <div className="flex items-center gap-2 flex-wrap">
              {['transunion', 'experian', 'equifax'].map((bureau) => {
                const bureauItems = inquiryItems.filter(i => i.bureau === bureau);
                if (bureauItems.length === 0) return null;
                const allSelected = bureauItems.every(i => selectedInquiryItems.includes(i.id));
                return (
                  <Button key={bureau} variant={allSelected ? 'secondary' : 'outline'} size="sm" onClick={() => {
                    if (allSelected) { const idsToRemove = bureauItems.map(i => i.id); setSelectedInquiryItems(prev => prev.filter(id => !idsToRemove.includes(id))); }
                    else { const newIds = bureauItems.map(i => i.id); setSelectedInquiryItems(prev => [...new Set([...prev, ...newIds])]); }
                  }}>
                    {bureau.charAt(0).toUpperCase() + bureau.slice(1)}<span className="ml-1 text-xs opacity-70">({bureauItems.length})</span>
                  </Button>
                );
              })}
              <Button variant="ghost" size="sm" onClick={() => {
                if (selectedInquiryItems.length === inquiryItems.length) setSelectedInquiryItems([]);
                else setSelectedInquiryItems(inquiryItems.map(i => i.id));
              }}>
                {selectedInquiryItems.length === inquiryItems.length ? 'Deselect All' : 'Select All'}
              </Button>
            </div>
          </div>

          {inquiryItems.map(item => {
            const isSelected = selectedInquiryItems.includes(item.id);
            const bureauLabel = item.bureau ? item.bureau.charAt(0).toUpperCase() + item.bureau.slice(1) : 'All Bureaus';
            const inquiryDate = item.inquiry_date ? new Date(item.inquiry_date).toLocaleDateString() : 'Unknown date';
            return (
              <div key={item.id} className={`rounded-lg border p-4 cursor-pointer transition ${isSelected ? 'border-secondary bg-secondary/10' : 'border-border hover:border-secondary/50'}`} onClick={() => setSelectedInquiryItems(prev => prev.includes(item.id) ? prev.filter(id => id !== item.id) : [...prev, item.id])}>
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium">{item.creditor_name}</p>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                        {item.bureau ? bureauLabel : 'All bureaus'}
                      </span>
                      {item.is_past_fcra_limit && <span className="text-xs px-2 py-0.5 rounded-full bg-destructive/15 text-destructive">FCRA violation</span>}
                    </div>
                    <p className="text-sm text-muted-foreground">{inquiryDate} {item.inquiry_type ? `• ${item.inquiry_type}` : ''}</p>
                    {item.days_since_inquiry !== undefined && item.days_since_inquiry !== null && <p className="text-xs text-muted-foreground">{item.days_since_inquiry} days old</p>}
                  </div>
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${isSelected ? 'border-secondary bg-secondary' : 'border-muted-foreground/30'}`}>
                    {isSelected && <Check className="w-3 h-3 text-primary" />}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
