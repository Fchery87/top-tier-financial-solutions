'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import {
  Users,
  FileText,
  Target,
  Sparkles,
  CheckCircle,
  ArrowLeft,
  ArrowRight,
  Search,
  Check,
  Loader2,
  Copy,
  Download,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

interface Client {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  status: string;
}

interface NegativeItem {
  id: string;
  creditor_name: string;
  original_creditor: string | null;
  item_type: string;
  amount: number | null;
  date_reported: string | null;
  bureau: string | null;
  risk_severity: string;
  recommended_action: string | null;
}

interface ReasonCode {
  code: string;
  label: string;
  description: string;
}

interface DisputeType {
  code: string;
  label: string;
}

const WIZARD_STEPS = [
  { id: 1, name: 'Client', icon: Users },
  { id: 2, name: 'Items', icon: FileText },
  { id: 3, name: 'Round', icon: Target },
  { id: 4, name: 'Generate', icon: Sparkles },
  { id: 5, name: 'Review', icon: CheckCircle },
];

const BUREAUS = [
  { code: 'transunion', label: 'TransUnion' },
  { code: 'experian', label: 'Experian' },
  { code: 'equifax', label: 'Equifax' },
];

export default function DisputeWizardPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = React.useState(1);
  const [loading, setLoading] = React.useState(false);

  // Step 1 - Client Selection
  const [clients, setClients] = React.useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = React.useState<Client | null>(null);
  const [clientSearch, setClientSearch] = React.useState('');
  const [loadingClients, setLoadingClients] = React.useState(false);

  // Step 2 - Item Selection
  const [negativeItems, setNegativeItems] = React.useState<NegativeItem[]>([]);
  const [selectedItems, setSelectedItems] = React.useState<string[]>([]);
  const [loadingItems, setLoadingItems] = React.useState(false);

  // Step 3 - Round & Target
  const [disputeRound, setDisputeRound] = React.useState(1);
  const [targetRecipient, setTargetRecipient] = React.useState<'bureau' | 'creditor' | 'collector'>('bureau');
  const [selectedBureaus, setSelectedBureaus] = React.useState<string[]>(['transunion', 'experian', 'equifax']);
  const [generationMethod, setGenerationMethod] = React.useState<'ai' | 'template'>('ai');

  // Step 4 - Reason Codes
  const [reasonCodes, setReasonCodes] = React.useState<ReasonCode[]>([]);
  const [disputeTypes, setDisputeTypes] = React.useState<DisputeType[]>([]);
  const [selectedReasonCodes, setSelectedReasonCodes] = React.useState<string[]>([]);
  const [selectedDisputeType, setSelectedDisputeType] = React.useState('standard');
  const [customReason, setCustomReason] = React.useState('');

  // Step 5 - Generated Letters
  const [generatedLetters, setGeneratedLetters] = React.useState<Array<{
    bureau: string;
    itemId: string;
    content: string;
  }>>([]);
  const [generating, setGenerating] = React.useState(false);
  const [generationProgress, setGenerationProgress] = React.useState(0);

  // Fetch clients
  const fetchClients = React.useCallback(async () => {
    setLoadingClients(true);
    try {
      const searchParam = clientSearch ? `&search=${encodeURIComponent(clientSearch)}` : '';
      const response = await fetch(`/api/admin/clients?page=1&limit=50&status=active${searchParam}`);
      if (response.ok) {
        const data = await response.json();
        setClients(data.items);
      }
    } catch (error) {
      console.error('Error fetching clients:', error);
    } finally {
      setLoadingClients(false);
    }
  }, [clientSearch]);

  // Fetch negative items for selected client
  const fetchNegativeItems = async (clientId: string) => {
    setLoadingItems(true);
    try {
      const response = await fetch(`/api/admin/clients/${clientId}`);
      if (response.ok) {
        const data = await response.json();
        setNegativeItems(data.negative_items || []);
      }
    } catch (error) {
      console.error('Error fetching negative items:', error);
    } finally {
      setLoadingItems(false);
    }
  };

  // Fetch reason codes and dispute types
  const fetchReasonCodes = async () => {
    try {
      const response = await fetch('/api/admin/disputes/generate-letter');
      if (response.ok) {
        const data = await response.json();
        setReasonCodes(data.reason_codes || []);
        setDisputeTypes(data.dispute_types || []);
      }
    } catch (error) {
      console.error('Error fetching reason codes:', error);
    }
  };

  React.useEffect(() => {
    fetchClients();
    fetchReasonCodes();
  }, [fetchClients]);

  React.useEffect(() => {
    if (selectedClient) {
      fetchNegativeItems(selectedClient.id);
    }
  }, [selectedClient]);

  // Generate letters
  const generateLetters = async () => {
    if (!selectedClient || selectedItems.length === 0 || selectedReasonCodes.length === 0) {
      return;
    }

    setGenerating(true);
    setGenerationProgress(0);
    const letters: typeof generatedLetters = [];

    const bureausToUse = targetRecipient === 'bureau' ? selectedBureaus : ['direct'];
    const totalLetters = selectedItems.length * bureausToUse.length;
    let completed = 0;

    for (const itemId of selectedItems) {
      const item = negativeItems.find(i => i.id === itemId);
      if (!item) continue;

      for (const bureau of bureausToUse) {
        try {
          const response = await fetch('/api/admin/disputes/generate-letter', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              clientId: selectedClient.id,
              negativeItemId: itemId,
              bureau: targetRecipient === 'bureau' ? bureau : item.bureau || 'transunion',
              disputeType: selectedDisputeType,
              round: disputeRound,
              targetRecipient: targetRecipient,
              reasonCodes: selectedReasonCodes,
              customReason: customReason || undefined,
              creditorName: item.creditor_name,
              itemType: item.item_type,
              amount: item.amount,
            }),
          });

          if (response.ok) {
            const data = await response.json();
            letters.push({
              bureau: bureau,
              itemId: itemId,
              content: data.letter_content,
            });
          }
        } catch (error) {
          console.error('Error generating letter:', error);
        }

        completed++;
        setGenerationProgress(Math.round((completed / totalLetters) * 100));
      }
    }

    setGeneratedLetters(letters);
    setGenerating(false);
    setCurrentStep(5);
  };

  const handleSelectClient = (client: Client) => {
    setSelectedClient(client);
    setSelectedItems([]);
    setNegativeItems([]);
  };

  const handleToggleItem = (itemId: string) => {
    setSelectedItems(prev =>
      prev.includes(itemId)
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  const handleToggleBureau = (bureau: string) => {
    setSelectedBureaus(prev =>
      prev.includes(bureau)
        ? prev.filter(b => b !== bureau)
        : [...prev, bureau]
    );
  };

  const handleToggleReasonCode = (code: string) => {
    setSelectedReasonCodes(prev =>
      prev.includes(code)
        ? prev.filter(c => c !== code)
        : [...prev, code]
    );
  };

  const copyToClipboard = (content: string) => {
    navigator.clipboard.writeText(content);
  };

  const downloadLetter = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return selectedClient !== null;
      case 2:
        return selectedItems.length > 0;
      case 3:
        return targetRecipient === 'bureau' ? selectedBureaus.length > 0 : true;
      case 4:
        return selectedReasonCodes.length > 0;
      case 5:
        return generatedLetters.length > 0;
      default:
        return false;
    }
  };

  const formatItemType = (type: string) => {
    return type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  const formatCurrency = (cents: number | null) => {
    if (!cents) return '—';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl font-serif font-bold text-foreground"
          >
            Dispute Wizard
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-muted-foreground mt-1"
          >
            Generate AI-powered dispute letters with FCRA, CRSA, and Metro 2 compliance
          </motion.p>
        </div>
        <Button variant="outline" onClick={() => router.push('/admin/clients')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Clients
        </Button>
      </div>

      {/* Progress Steps */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <Card className="bg-card/80 backdrop-blur-sm border-border/50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              {WIZARD_STEPS.map((step, index) => (
                <React.Fragment key={step.id}>
                  <div
                    className={`flex items-center gap-3 cursor-pointer transition-colors ${
                      currentStep === step.id
                        ? 'text-secondary'
                        : currentStep > step.id
                        ? 'text-green-500'
                        : 'text-muted-foreground'
                    }`}
                    onClick={() => {
                      if (step.id < currentStep) {
                        setCurrentStep(step.id);
                      }
                    }}
                  >
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors ${
                        currentStep === step.id
                          ? 'border-secondary bg-secondary/10'
                          : currentStep > step.id
                          ? 'border-green-500 bg-green-500/10'
                          : 'border-muted-foreground/30'
                      }`}
                    >
                      {currentStep > step.id ? (
                        <Check className="w-5 h-5" />
                      ) : (
                        <step.icon className="w-5 h-5" />
                      )}
                    </div>
                    <span className="hidden sm:block font-medium">{step.name}</span>
                  </div>
                  {index < WIZARD_STEPS.length - 1 && (
                    <div
                      className={`flex-1 h-0.5 mx-4 transition-colors ${
                        currentStep > step.id ? 'bg-green-500' : 'bg-muted-foreground/20'
                      }`}
                    />
                  )}
                </React.Fragment>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Step Content */}
      <motion.div
        key={currentStep}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        transition={{ duration: 0.2 }}
      >
        {/* Step 1: Select Client */}
        {currentStep === 1 && (
          <Card className="bg-card/80 backdrop-blur-sm border-border/50">
            <CardHeader>
              <CardTitle>Select Client</CardTitle>
              <CardDescription>Choose a client to generate dispute letters for</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search clients by name or email..."
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  className="pl-9"
                />
              </div>

              {loadingClients ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-secondary" />
                </div>
              ) : (
                <div className="grid gap-3 max-h-[400px] overflow-y-auto">
                  {clients.map((client) => (
                    <div
                      key={client.id}
                      className={`p-4 rounded-lg border cursor-pointer transition-all ${
                        selectedClient?.id === client.id
                          ? 'border-secondary bg-secondary/10'
                          : 'border-border hover:border-secondary/50'
                      }`}
                      onClick={() => handleSelectClient(client)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-secondary to-secondary/70 flex items-center justify-center text-primary font-bold">
                          {client.first_name.charAt(0)}{client.last_name.charAt(0)}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">{client.first_name} {client.last_name}</p>
                          <p className="text-sm text-muted-foreground">{client.email}</p>
                        </div>
                        {selectedClient?.id === client.id && (
                          <Check className="w-5 h-5 text-secondary" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 2: Select Items */}
        {currentStep === 2 && (
          <Card className="bg-card/80 backdrop-blur-sm border-border/50">
            <CardHeader>
              <CardTitle>Select Negative Items</CardTitle>
              <CardDescription>
                Choose items to dispute for {selectedClient?.first_name} {selectedClient?.last_name}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {loadingItems ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-secondary" />
                </div>
              ) : negativeItems.length === 0 ? (
                <div className="text-center py-8">
                  <AlertCircle className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No negative items found for this client.</p>
                  <p className="text-sm text-muted-foreground mt-1">Upload and analyze a credit report first.</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[400px] overflow-y-auto">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">
                      {selectedItems.length} of {negativeItems.length} items selected
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (selectedItems.length === negativeItems.length) {
                          setSelectedItems([]);
                        } else {
                          setSelectedItems(negativeItems.map(i => i.id));
                        }
                      }}
                    >
                      {selectedItems.length === negativeItems.length ? 'Deselect All' : 'Select All'}
                    </Button>
                  </div>

                  {negativeItems.map((item) => (
                    <div
                      key={item.id}
                      className={`p-4 rounded-lg border cursor-pointer transition-all ${
                        selectedItems.includes(item.id)
                          ? 'border-secondary bg-secondary/10'
                          : 'border-border hover:border-secondary/50'
                      }`}
                      onClick={() => handleToggleItem(item.id)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{item.creditor_name}</p>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              item.risk_severity === 'severe' ? 'bg-red-500/20 text-red-400' :
                              item.risk_severity === 'high' ? 'bg-orange-500/20 text-orange-400' :
                              item.risk_severity === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                              'bg-green-500/20 text-green-400'
                            }`}>
                              {item.risk_severity}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {formatItemType(item.item_type)} • {formatCurrency(item.amount)}
                            {item.bureau && ` • ${item.bureau.charAt(0).toUpperCase() + item.bureau.slice(1)}`}
                          </p>
                        </div>
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                          selectedItems.includes(item.id)
                            ? 'border-secondary bg-secondary'
                            : 'border-muted-foreground/30'
                        }`}>
                          {selectedItems.includes(item.id) && (
                            <Check className="w-3 h-3 text-primary" />
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 3: Round & Target */}
        {currentStep === 3 && (
          <Card className="bg-card/80 backdrop-blur-sm border-border/50">
            <CardHeader>
              <CardTitle>Select Dispute Round & Target</CardTitle>
              <CardDescription>Configure the dispute round and recipients</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Round Selection */}
              <div className="space-y-3">
                <label className="text-sm font-medium">Dispute Round</label>
                <div className="space-y-2">
                  {[
                    { round: 1, label: 'Round 1 - Bureau Disputes', desc: 'Initial dispute sent to credit bureaus' },
                    { round: 2, label: 'Round 2 - Direct to Creditor/Furnisher', desc: 'Escalation after bureau verification' },
                    { round: 3, label: 'Round 3+ - Advanced Escalation', desc: 'Collector / CFPB Complaint / Legal' },
                  ].map(({ round, label, desc }) => (
                    <div
                      key={round}
                      className={`p-4 rounded-lg border cursor-pointer transition-all ${
                        disputeRound === round
                          ? 'border-secondary bg-secondary/10'
                          : 'border-border hover:border-secondary/50'
                      }`}
                      onClick={() => {
                        setDisputeRound(round);
                        if (round === 1) setTargetRecipient('bureau');
                        else if (round === 2) setTargetRecipient('creditor');
                        else setTargetRecipient('collector');
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-4 h-4 rounded-full border-2 ${
                          disputeRound === round
                            ? 'border-secondary bg-secondary'
                            : 'border-muted-foreground/30'
                        }`} />
                        <div>
                          <p className="font-medium">{label}</p>
                          <p className="text-sm text-muted-foreground">{desc}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bureau Selection (for Round 1) */}
              {targetRecipient === 'bureau' && (
                <div className="space-y-3">
                  <label className="text-sm font-medium">Select Credit Bureaus</label>
                  <div className="flex flex-wrap gap-3">
                    {BUREAUS.map((bureau) => (
                      <Button
                        key={bureau.code}
                        variant={selectedBureaus.includes(bureau.code) ? 'secondary' : 'outline'}
                        onClick={() => handleToggleBureau(bureau.code)}
                      >
                        {selectedBureaus.includes(bureau.code) && <Check className="w-4 h-4 mr-2" />}
                        {bureau.label}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {/* Generation Method */}
              <div className="space-y-3">
                <label className="text-sm font-medium">Letter Generation Method</label>
                <div className="flex gap-3">
                  <Button
                    variant={generationMethod === 'ai' ? 'secondary' : 'outline'}
                    className="flex-1"
                    onClick={() => setGenerationMethod('ai')}
                  >
                    <Sparkles className="w-4 h-4 mr-2" />
                    AI-Generated (Unique)
                  </Button>
                  <Button
                    variant={generationMethod === 'template' ? 'secondary' : 'outline'}
                    className="flex-1"
                    onClick={() => setGenerationMethod('template')}
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Template-Based
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 4: Reason Codes */}
        {currentStep === 4 && (
          <Card className="bg-card/80 backdrop-blur-sm border-border/50">
            <CardHeader>
              <CardTitle>Select Dispute Reasons</CardTitle>
              <CardDescription>Choose reason codes and dispute type</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Dispute Type */}
              <div className="space-y-3">
                <label className="text-sm font-medium">Dispute Type</label>
                <div className="flex flex-wrap gap-2">
                  {disputeTypes.map((type) => (
                    <Button
                      key={type.code}
                      variant={selectedDisputeType === type.code ? 'secondary' : 'outline'}
                      size="sm"
                      onClick={() => setSelectedDisputeType(type.code)}
                    >
                      {type.label}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Reason Codes */}
              <div className="space-y-3">
                <label className="text-sm font-medium">
                  Reason Codes ({selectedReasonCodes.length} selected)
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto">
                  {reasonCodes.map((reason) => (
                    <div
                      key={reason.code}
                      className={`p-3 rounded-lg border cursor-pointer transition-all ${
                        selectedReasonCodes.includes(reason.code)
                          ? 'border-secondary bg-secondary/10'
                          : 'border-border hover:border-secondary/50'
                      }`}
                      onClick={() => handleToggleReasonCode(reason.code)}
                    >
                      <div className="flex items-start gap-2">
                        <div className={`w-4 h-4 mt-0.5 rounded border-2 flex-shrink-0 ${
                          selectedReasonCodes.includes(reason.code)
                            ? 'border-secondary bg-secondary'
                            : 'border-muted-foreground/30'
                        }`}>
                          {selectedReasonCodes.includes(reason.code) && (
                            <Check className="w-3 h-3 text-primary" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-sm">{reason.label}</p>
                          <p className="text-xs text-muted-foreground">{reason.description}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Custom Reason */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Additional Context (Optional)</label>
                <textarea
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  placeholder="Add any additional details or context for the dispute..."
                  className="w-full min-h-[100px] px-3 py-2 text-sm rounded-md border border-input bg-background"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 5: Review */}
        {currentStep === 5 && (
          <div className="space-y-4">
            <Card className="bg-card/80 backdrop-blur-sm border-border/50">
              <CardHeader>
                <CardTitle>Generated Letters</CardTitle>
                <CardDescription>
                  {generatedLetters.length} letters generated for review
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {generatedLetters.map((letter, index) => {
                  const item = negativeItems.find(i => i.id === letter.itemId);
                  return (
                    <div key={index} className="border border-border rounded-lg overflow-hidden">
                      <div className="bg-muted/50 px-4 py-3 flex items-center justify-between">
                        <div>
                          <p className="font-medium">
                            {item?.creditor_name || 'Unknown'} - {letter.bureau.charAt(0).toUpperCase() + letter.bureau.slice(1)}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {formatItemType(item?.item_type || '')}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(letter.content)}
                          >
                            <Copy className="w-4 h-4 mr-1" />
                            Copy
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => downloadLetter(
                              letter.content,
                              `dispute-${letter.bureau}-${item?.creditor_name?.replace(/\s+/g, '-')}.txt`
                            )}
                          >
                            <Download className="w-4 h-4 mr-1" />
                            Download
                          </Button>
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
          </div>
        )}
      </motion.div>

      {/* Navigation Buttons */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="flex items-center justify-between"
      >
        <Button
          variant="outline"
          onClick={() => setCurrentStep(prev => Math.max(1, prev - 1))}
          disabled={currentStep === 1}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        {currentStep === 4 ? (
          <Button
            onClick={generateLetters}
            disabled={!canProceed() || generating}
          >
            {generating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating ({generationProgress}%)
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Generate Letters
              </>
            )}
          </Button>
        ) : currentStep === 5 ? (
          <Button onClick={() => router.push('/admin/clients')}>
            <CheckCircle className="w-4 h-4 mr-2" />
            Done
          </Button>
        ) : (
          <Button
            onClick={() => setCurrentStep(prev => Math.min(5, prev + 1))}
            disabled={!canProceed()}
          >
            Next
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        )}
      </motion.div>
    </div>
  );
}
