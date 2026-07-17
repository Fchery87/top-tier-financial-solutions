'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { Sparkles, CheckCircle, Loader2, Copy, Download, Paperclip, Upload, Zap, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useWizardContext } from './WizardContext';
import { calculateLetterStrength } from '@/lib/letter-strength-calculator';
import { type DisputeItemPayload, formatPersonalInfoType } from './types';
import { formatCurrency, formatItemType } from '@/lib/format';

export function StepReview() {
  const ctx = useWizardContext();
  const {
    generationMethod, aiAnalysisResults, aiAnalysisSummary, confidenceThreshold,
    generatedLetters,
    bulkTrackingNumber, setBulkTrackingNumber, bulkSendDate, setBulkSendDate,
    markingAsSent, bulkSentSuccess, handleBulkMarkAsSent,
    selectedEvidenceIds, evidenceDocuments,
    setShowEvidenceUploadModal,
    handleRemoveEvidence, copyToClipboard, downloadLetter,
    renderValidationMessages,
  } = ctx;

  return (
    <div className="space-y-4">
      {renderValidationMessages()}

      {/* AI Analysis Summary */}
      {generationMethod === 'ai' && aiAnalysisSummary && (
        <Card className="bg-card border border-border border-t-4 border-t-success">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Sparkles className="h-4 w-4 text-success" />AI Analysis Summary
            </CardTitle>
            <CardDescription>
              <div className="flex items-center justify-between flex-wrap gap-2 mt-1">
                <span>Metro 2 compliance analysis complete</span>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-success"></div>
                    <span className="text-xs">{Math.round(aiAnalysisSummary.averageConfidence * 100)}% avg</span>
                  </div>
                  {aiAnalysisResults.length > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {aiAnalysisResults.filter(r => r.confidence >= confidenceThreshold).length}/{aiAnalysisResults.length} meet threshold
                    </span>
                  )}
                </div>
              </div>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div className="p-2 rounded bg-muted/50"><p className="text-muted-foreground">Items Analyzed</p><p className="font-semibold">{aiAnalysisSummary.itemCount}</p></div>
              <div className="p-2 rounded bg-muted/50"><p className="text-muted-foreground">Methodology</p><p className="font-semibold capitalize">{aiAnalysisSummary.recommendedMethodology.replace(/_/g, ' ')}</p></div>
              <div className="p-2 rounded bg-muted/50"><p className="text-muted-foreground">Reason Codes</p><p className="font-semibold">{aiAnalysisSummary.allReasonCodes.length}</p></div>
              <div className="p-2 rounded bg-muted/50"><p className="text-muted-foreground">Violations Found</p><p className="font-semibold">{aiAnalysisSummary.allMetro2Violations.length}</p></div>
            </div>

            {aiAnalysisResults.length > 0 && (
              <div className="p-3 rounded-lg bg-muted/30 space-y-2">
                <p className="text-xs font-medium text-muted-foreground mb-2">Confidence Breakdown</p>
                <div className="space-y-1">
                  {[
                    { range: [0.8, 1.0], label: 'Very High', color: 'text-success', bg: 'bg-success/10' },
                    { range: [0.6, 0.8], label: 'High', color: 'text-secondary', bg: 'bg-secondary/10' },
                    { range: [0.4, 0.6], label: 'Medium', color: 'text-warning', bg: 'bg-warning/10' },
                    { range: [0, 0.4], label: 'Low', color: 'text-destructive', bg: 'bg-destructive/10' },
                  ].map(({ range, label, color, bg }) => {
                    const count = aiAnalysisResults.filter(r => r.confidence >= range[0] && r.confidence < range[1]).length;
                    return (
                      <div key={label} className="flex items-center justify-between text-xs">
                        <span className={`inline-flex items-center px-2 py-1 rounded ${bg}`}><span className={`w-2 h-2 rounded-full ${color} mr-1`}></span><span>{label}: {count} item{count !== 1 ? 's' : ''}</span></span>
                        <span className={`${color} font-medium`}>{Math.round((count / aiAnalysisResults.length) * 100)}%</span>
                      </div>
                    );
                  })}
                </div>
                {aiAnalysisResults.filter(r => r.confidence < confidenceThreshold).length > 0 && (
                  <p className="text-xs text-muted-foreground mt-2 italic">{aiAnalysisResults.filter(r => r.confidence < confidenceThreshold).length} item(s) below current threshold ({Math.round(confidenceThreshold * 100)}%)</p>
                )}
              </div>
            )}
            {aiAnalysisSummary.allMetro2Violations.length > 0 && (
              <div className="text-xs text-muted-foreground">
                <p className="font-medium mb-1">Metro 2 Violations Identified:</p>
                <ul className="list-disc list-inside space-y-0.5">
                  {aiAnalysisSummary.allMetro2Violations.slice(0, 3).map((v, i) => <li key={i}>{v}</li>)}
                  {aiAnalysisSummary.allMetro2Violations.length > 3 && <li>+{aiAnalysisSummary.allMetro2Violations.length - 3} more violations</li>}
                </ul>
              </div>
            )}
            <div className="pt-3 border-t border-border/50 flex gap-2">
              <Button variant="outline" size="sm" onClick={() => { ctx.setCurrentStep(3); setTimeout(() => { const el = document.querySelector('[data-analysis-settings]'); if (el) el.scrollIntoView({ behavior: 'smooth' }); }, 100); }} className="flex-1">
                <Zap className="w-4 h-4 mr-2" />Re-analyze with Different Settings
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Letter Strength Score */}
      {generationMethod === 'ai' && aiAnalysisResults.length > 0 && (() => {
        const strength = calculateLetterStrength(aiAnalysisResults, selectedEvidenceIds.length > 0, selectedEvidenceIds.length, ctx.disputeRound, aiAnalysisSummary?.recommendedMethodology || 'factual');
        return strength && <LetterStrengthCard strength={strength} />;
      })()}

      {/* Bulk Actions */}
      <Card className="bg-card border border-border border-t-4 border-t-secondary">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Mark Disputes as Sent</CardTitle>
          <CardDescription>After mailing your letters, enter tracking info to start the 30-day response deadline</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Tracking Number (Optional)</label>
              <Input placeholder="e.g., 9400111899223100034012" value={bulkTrackingNumber} onChange={(e) => setBulkTrackingNumber(e.target.value)} />
              <p className="text-xs text-muted-foreground mt-1">USPS Certified Mail tracking number</p>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Send Date</label>
              <Input type="date" value={bulkSendDate} onChange={(e) => setBulkSendDate(e.target.value)} />
              <p className="text-xs text-muted-foreground mt-1">Defaults to today if not set</p>
            </div>
          </div>
          <Button className="w-full" onClick={handleBulkMarkAsSent} disabled={markingAsSent || generatedLetters.length === 0}>
            {markingAsSent ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving Disputes...</> : <><CheckCircle className="w-4 h-4 mr-2" />Mark All {generatedLetters.length} Disputes as Sent</>}
          </Button>
          {bulkSentSuccess && (
            <div className="p-3 rounded-lg bg-success/10 border border-success/30 text-success text-sm flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />Successfully saved {generatedLetters.length} disputes. Response deadline set for 30 days.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Generated Letters */}
      <Card className="bg-card border border-border">
        <CardHeader>
          <CardTitle>Generated Letters</CardTitle>
          <CardDescription>{generatedLetters.length} letters generated for review</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {generatedLetters.map((letter, index) => {
            const payloadItems = letter.items && letter.items.length > 0 ? letter.items : [];
            const primaryItem = payloadItems[0];

            const formatPayloadLabel = (payload: DisputeItemPayload) => {
              if (payload.kind === 'personal') { const type = payload.itemType?.replace('personal_info_', '') || 'personal info'; return `${formatPersonalInfoType(type)} - ${payload.value || ''}`; }
              if (payload.kind === 'inquiry') { const date = payload.inquiryDate ? new Date(payload.inquiryDate).toLocaleDateString() : ''; return `${payload.creditorName || 'Inquiry'}${date ? ` (${date})` : ''}`; }
              return `${payload.creditorName || 'Tradeline'}${payload.amount ? ` • ${formatCurrency(payload.amount)}` : ''}`;
            };

            return (
              <div key={index} className="border border-border rounded-lg overflow-hidden">
                <div className="bg-muted/50 px-4 py-3 flex items-center justify-between">
                  <div>
                    {letter.combined ? (
                      <>
                        <p className="font-medium flex items-center gap-2">
                          <span className="px-2 py-0.5 text-xs bg-secondary/20 text-secondary rounded">Combined</span>
                          {letter.bureau.charAt(0).toUpperCase() + letter.bureau.slice(1)} - {payloadItems.length} Item(s)
                        </p>
                        <p className="text-sm text-muted-foreground">{payloadItems.map((p) => formatPayloadLabel(p)).join(', ')}</p>
                      </>
                    ) : (
                      <>
                        <p className="font-medium flex items-center gap-2">
                          {primaryItem?.kind === 'tradeline' && (
                            <span className={`text-xs px-2 py-0.5 rounded-full ${primaryItem?.riskSeverity === 'severe' || primaryItem?.riskSeverity === 'high' ? 'bg-destructive/15 text-destructive' : primaryItem?.riskSeverity === 'medium' ? 'bg-warning/15 text-warning' : 'bg-success/15 text-success'}`}>{primaryItem?.riskSeverity || 'unknown'}</span>
                          )}
                          {formatPayloadLabel(primaryItem || { id: '', kind: 'tradeline' })}
                          <span className="text-xs text-muted-foreground">({letter.bureau.charAt(0).toUpperCase() + letter.bureau.slice(1)})</span>
                        </p>
                        <p className="text-sm text-muted-foreground">{primaryItem?.itemType ? formatItemType(primaryItem.itemType) : ''}</p>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => copyToClipboard(letter.content)}><Copy className="w-4 h-4 mr-1" />Copy</Button>
                    <Button variant="ghost" size="sm" onClick={() => downloadLetter(letter.content, letter.combined ? `dispute-${letter.bureau}-combined-${payloadItems.length}-items.txt` : `dispute-${letter.bureau}-${primaryItem?.creditorName || 'item'}.txt`)}><Download className="w-4 h-4 mr-1" />Download</Button>
                  </div>
                </div>
                <div className="p-4 max-h-[400px] overflow-y-auto">
                  <pre className="whitespace-pre-wrap text-sm font-mono">{letter.content}</pre>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Evidence Preview */}
      <Card className="bg-card border border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Paperclip className="w-5 h-5" />Evidence Documentation</CardTitle>
          <CardDescription>{selectedEvidenceIds.length === 0 ? 'No evidence attached to this dispute' : `${selectedEvidenceIds.length} document(s) attached`}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {selectedEvidenceIds.length === 0 ? (
            <div className="p-4 rounded-lg bg-muted/50 text-center text-sm text-muted-foreground">
              <Paperclip className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No evidence documents selected for this dispute.</p>
              <p className="text-xs mt-2">Evidence significantly strengthens disputes, especially for high-risk claims.</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => setShowEvidenceUploadModal(true)}><Upload className="w-3 h-3 mr-1" />Add Evidence</Button>
            </div>
          ) : (
            <div className="space-y-2">
              {evidenceDocuments.filter((doc) => selectedEvidenceIds.includes(doc.id)).map((doc) => (
                <motion.div key={doc.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="flex items-center justify-between p-3 bg-success/10 border border-success/20 rounded-lg">
                  <div className="flex items-center gap-3 flex-1">
                    <CheckCircle className="w-5 h-5 text-success flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{doc.file_name}</p>
                      <p className="text-xs text-muted-foreground">Attached on {new Date(doc.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => handleRemoveEvidence(doc.id)} className="text-muted-foreground hover:text-destructive"><X className="w-4 h-4" /></Button>
                </motion.div>
              ))}
              {selectedEvidenceIds.length < evidenceDocuments.length && (
                <div className="p-3 rounded-lg bg-secondary/10 border border-secondary/20">
                  <p className="text-xs text-foreground"><strong>{evidenceDocuments.length - selectedEvidenceIds.length} more document(s)</strong> available. Go back to Step 3 to add additional evidence.</p>
                </div>
              )}
              <Button variant="outline" className="w-full" onClick={() => setShowEvidenceUploadModal(true)}><Upload className="w-4 h-4 mr-2" />Upload Additional Evidence</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function LetterStrengthCard({ strength }: { strength: import('@/lib/letter-strength-calculator').LetterStrengthScore }) {
  return (
    <Card className="bg-card border border-border border-t-4 border-t-secondary">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="h-4 w-4 text-secondary" />Letter Strength Score</CardTitle>
        <CardDescription>Overall quality assessment of the dispute letters</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="text-center">
            <div className="font-display text-5xl font-light tabular-nums text-secondary">{strength.overallScore}</div>
            <p className="text-sm text-muted-foreground">/10</p>
          </div>
          <div className="flex-1">
            <div className="w-full bg-muted rounded-full h-3">
              <div className="bg-secondary h-full rounded-full transition-all duration-300" style={{ width: `${(strength.overallScore / 10) * 100}%` }} />
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              {strength.overallScore >= 8 ? 'Excellent - Strong dispute' : strength.overallScore >= 6 ? 'Good - Solid dispute' : 'Fair - Consider improvements'}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
          <div className="p-2 rounded bg-muted/50"><p className="text-muted-foreground text-xs">Violations</p><p className="font-semibold">{strength.violationScore.toFixed(1)}/3</p></div>
          <div className="p-2 rounded bg-muted/50"><p className="text-muted-foreground text-xs">Citations</p><p className="font-semibold">{strength.citationScore.toFixed(1)}/2</p></div>
          <div className="p-2 rounded bg-muted/50"><p className="text-muted-foreground text-xs">Evidence</p><p className="font-semibold">{strength.evidenceScore.toFixed(1)}/1.5</p></div>
          <div className="p-2 rounded bg-muted/50"><p className="text-muted-foreground text-xs">Confidence</p><p className="font-semibold">{strength.confidenceScore.toFixed(1)}/1.5</p></div>
          <div className="p-2 rounded bg-muted/50"><p className="text-muted-foreground text-xs">Escalation</p><p className="font-semibold">{strength.escalationScore.toFixed(1)}/1</p></div>
          <div className="p-2 rounded bg-muted/50"><p className="text-muted-foreground text-xs">Methodology</p><p className="font-semibold">{strength.methodologyScore.toFixed(1)}/1</p></div>
        </div>
        {strength.suggestions.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-border/50">
            <p className="text-sm font-medium text-muted-foreground">Improvement Suggestions:</p>
            <ul className="space-y-1">
              {strength.suggestions.map((suggestion, idx) => <li key={idx} className="text-sm text-muted-foreground flex gap-2"><span className="text-secondary">•</span><span>{suggestion}</span></li>)}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
