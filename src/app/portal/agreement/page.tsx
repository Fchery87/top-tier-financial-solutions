'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { 
  Loader2, FileSignature, CheckCircle, AlertTriangle, 
  ArrowLeft, Download, Printer, Clock, Shield
} from 'lucide-react';
import { motion } from 'framer-motion';
import { GradientOrbs, AnimatedGrid, NoiseOverlay } from '@/components/ui/AnimatedBackground';

interface DisclosureItem {
  id: string;
  disclosure_type: string;
  disclosure_text: string;
  acknowledged: boolean;
}

interface Agreement {
  id: string;
  status: string;
  content: string;
  sent_at: string;
  expires_at: string | null;
  signed_at: string | null;
  cancellation_deadline: string | null;
  disclosures: DisclosureItem[];
}

interface InitialFields {
  [key: string]: string;
}

export default function AgreementPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [agreement, setAgreement] = React.useState<Agreement | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [signing, setSigning] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);
  
  // Form state
  const [initials, setInitials] = React.useState<InitialFields>({});
  const [acknowledgedDisclosures, setAcknowledgedDisclosures] = React.useState<Set<string>>(new Set());
  const [signatureType, setSignatureType] = React.useState<'typed' | 'drawn'>('typed');
  const [typedSignature, setTypedSignature] = React.useState('');
  const [agreedToTerms, setAgreedToTerms] = React.useState(false);
  
  // Canvas ref for drawn signature
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = React.useState(false);
  const [hasDrawnSignature, setHasDrawnSignature] = React.useState(false);

  React.useEffect(() => {
    if (user) {
      fetchAgreement();
    }
  }, [user]);

  const fetchAgreement = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/portal/agreement');
      if (response.ok) {
        const data = await response.json();
        if (data.agreement) {
          setAgreement(data.agreement);
          // Pre-populate acknowledged disclosures
          const acknowledged = new Set<string>();
          data.agreement.disclosures?.forEach((d: DisclosureItem) => {
            if (d.acknowledged) acknowledged.add(d.id);
          });
          setAcknowledgedDisclosures(acknowledged);
        }
      } else {
        const errData = await response.json();
        setError(errData.error || 'Failed to load agreement');
      }
    } catch (err) {
      console.error('Error fetching agreement:', err);
      setError('Failed to load agreement');
    } finally {
      setLoading(false);
    }
  };

  // Canvas drawing handlers
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    setIsDrawing(true);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasDrawnSignature(true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawnSignature(false);
  };

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.strokeStyle = '#1a365d';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, [signatureType]);

  const handleInitialChange = (field: string, value: string) => {
    setInitials(prev => ({ ...prev, [field]: value.toUpperCase().slice(0, 3) }));
  };

  const toggleDisclosure = (id: string) => {
    setAcknowledgedDisclosures(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const initialFields = [
    'initial_documents',
    'initial_credit_reports', 
    'initial_payments',
    'initial_contact',
    'initial_referral',
    'initial_fee_terms',
    'initial_warranty',
    'initial_refund',
    'initial_binding',
    'initial_results',
    'initial_term',
    'initial_cancel',
    'initial_login',
    'initial_payment_auth',
  ];

  const allInitialsComplete = initialFields.every(field => initials[field]?.length >= 2);
  const allDisclosuresAcknowledged = agreement?.disclosures?.every(d => acknowledgedDisclosures.has(d.id));
  const hasValidSignature = signatureType === 'typed' ? typedSignature.trim().length >= 3 : hasDrawnSignature;
  const canSign = allInitialsComplete && allDisclosuresAcknowledged && hasValidSignature && agreedToTerms;

  const handleSign = async () => {
    if (!agreement || !canSign) return;
    
    setSigning(true);
    setError(null);
    
    try {
      let signatureData = typedSignature;
      
      if (signatureType === 'drawn' && canvasRef.current) {
        signatureData = canvasRef.current.toDataURL('image/png');
      }

      const response = await fetch('/api/portal/agreement/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agreementId: agreement.id,
          signatureData,
          signatureType,
          initials,
          disclosureAcknowledgments: agreement.disclosures?.map(d => ({
            id: d.id,
            acknowledged: acknowledgedDisclosures.has(d.id),
          })),
        }),
      });

      if (response.ok) {
        setSuccess(true);
        setTimeout(() => {
          router.push('/portal');
        }, 3000);
      } else {
        const errData = await response.json();
        setError(errData.error || 'Failed to sign agreement');
      }
    } catch (err) {
      console.error('Error signing agreement:', err);
      setError('Failed to sign agreement');
    } finally {
      setSigning(false);
    }
  };

  const renderAgreementContent = () => {
    if (!agreement) return null;
    
    let content = agreement.content;
    
    // Replace initial placeholders with input fields or values
    initialFields.forEach(field => {
      const placeholder = `{{${field}}}`;
      const value = initials[field] || '';
      content = content.replace(
        new RegExp(placeholder, 'g'),
        `<span class="initial-value" style="display: inline-block; min-width: 50px; padding: 2px 8px; background: ${value ? '#d4edda' : '#fff3cd'}; border: 1px solid ${value ? '#28a745' : '#ffc107'}; border-radius: 3px; font-weight: bold; text-align: center;">${value || '___'}</span>`
      );
    });

    // Replace signature placeholder
    if (agreement.status === 'signed' && agreement.signed_at) {
      content = content.replace(
        '{{client_signature}}',
        `<em style="font-family: 'Brush Script MT', cursive; font-size: 24px;">Signed Electronically</em>`
      );
    } else {
      content = content.replace('{{client_signature}}', '<em style="color: #999;">Sign below</em>');
    }

    return content;
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-secondary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8">
        <Card className="max-w-md w-full bg-card/80 backdrop-blur-sm border-border/50">
          <CardHeader className="text-center">
            <CardTitle className="font-serif text-2xl">Sign In Required</CardTitle>
            <CardDescription>Please sign in to view your service agreement.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Button asChild className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90">
              <Link href="/sign-in">Sign In</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center"
        >
          <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-green-500" />
          </div>
          <h1 className="text-3xl font-serif font-bold mb-4">Agreement Signed Successfully!</h1>
          <p className="text-muted-foreground mb-2">Thank you for signing your service agreement.</p>
          <p className="text-sm text-muted-foreground mb-6">
            You have 3 business days to cancel if you change your mind.
          </p>
          <p className="text-sm text-muted-foreground">Redirecting to your portal...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="relative pt-32 pb-8 md:pt-40 md:pb-12 overflow-hidden">
        <GradientOrbs className="opacity-50" />
        <AnimatedGrid className="opacity-20" />
        <NoiseOverlay opacity={0.02} />
        <div className="absolute inset-0 bg-gradient-to-b from-background/70 via-background/50 to-background z-[1]" />

        <div className="container relative z-10 mx-auto px-4 md:px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Button asChild variant="ghost" className="mb-4">
              <Link href="/portal">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Portal
              </Link>
            </Button>
            <div className="flex items-center gap-3 mb-4">
              <div className="relative inline-flex">
                <div className="absolute -inset-1 bg-secondary/20 rounded-full blur-md" />
                <div className="relative inline-flex items-center gap-2 px-4 py-2 rounded-full bg-background/80 backdrop-blur-sm border border-secondary/30">
                  <FileSignature className="w-4 h-4 text-secondary" />
                  Service Agreement
                </div>
              </div>
            </div>
            <h1 className="text-3xl md:text-4xl font-serif font-bold mb-2">
              Credit Services Agreement
            </h1>
            <p className="text-muted-foreground">
              Please review and sign your service agreement below.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-8 bg-background relative flex-1">
        <div className="container mx-auto px-4 md:px-6">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-secondary" />
            </div>
          ) : error && !agreement ? (
            <Card className="bg-card/80 backdrop-blur-sm border-border/50 p-8 text-center">
              <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">No Agreement Found</h2>
              <p className="text-muted-foreground mb-4">{error}</p>
              <Button asChild>
                <Link href="/portal">Return to Portal</Link>
              </Button>
            </Card>
          ) : agreement?.status === 'signed' ? (
            <div className="space-y-6">
              <Card className="bg-green-500/10 border-green-500/30">
                <CardContent className="p-6 flex items-center gap-4">
                  <CheckCircle className="w-8 h-8 text-green-500 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold text-green-700 dark:text-green-400">Agreement Signed</h3>
                    <p className="text-sm text-muted-foreground">
                      Signed on {new Date(agreement.signed_at!).toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </p>
                    {agreement.cancellation_deadline && new Date(agreement.cancellation_deadline) > new Date() && (
                      <p className="text-sm text-yellow-600 dark:text-yellow-400 mt-1">
                        <Clock className="w-3 h-3 inline mr-1" />
                        Cancellation deadline: {new Date(agreement.cancellation_deadline).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-card/80 backdrop-blur-sm border-border/50">
                <CardContent className="p-6">
                  <div 
                    className="prose prose-sm max-w-none dark:prose-invert"
                    dangerouslySetInnerHTML={{ __html: agreement.content }}
                  />
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Agreement Content */}
              <div className="lg:col-span-2 space-y-6">
                {agreement?.expires_at && new Date(agreement.expires_at) < new Date() ? (
                  <Card className="bg-red-500/10 border-red-500/30">
                    <CardContent className="p-4 flex items-center gap-3">
                      <AlertTriangle className="w-5 h-5 text-red-500" />
                      <p className="text-sm text-red-700 dark:text-red-400">
                        This agreement has expired. Please contact us for a new agreement.
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="bg-yellow-500/10 border-yellow-500/30">
                    <CardContent className="p-4 flex items-center gap-3">
                      <Clock className="w-5 h-5 text-yellow-500" />
                      <p className="text-sm text-yellow-700 dark:text-yellow-400">
                        Please review and sign by {agreement?.expires_at ? new Date(agreement.expires_at).toLocaleDateString() : 'the deadline'}.
                      </p>
                    </CardContent>
                  </Card>
                )}

                <Card className="bg-white dark:bg-card border-border">
                  <CardContent className="p-6 md:p-8">
                    <div 
                      className="prose prose-sm max-w-none"
                      style={{ color: '#000' }}
                      dangerouslySetInnerHTML={{ __html: renderAgreementContent() || '' }}
                    />
                  </CardContent>
                </Card>
              </div>

              {/* Signing Panel */}
              <div className="space-y-4">
                <div className="sticky top-24">
                  {/* Initials Section */}
                  <Card className="bg-card/80 backdrop-blur-sm border-border/50 mb-4">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Shield className="w-5 h-5 text-secondary" />
                        Initial Each Section
                      </CardTitle>
                      <CardDescription>
                        Enter your initials (2-3 letters) for each acknowledgment
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3 max-h-[300px] overflow-y-auto">
                      {initialFields.map((field, idx) => (
                        <div key={field} className="flex items-center gap-3">
                          <span className="text-xs text-muted-foreground w-6">{String.fromCharCode(65 + idx)}.</span>
                          <input
                            type="text"
                            value={initials[field] || ''}
                            onChange={(e) => handleInitialChange(field, e.target.value)}
                            className="w-16 px-2 py-1 text-center text-sm font-bold uppercase border rounded bg-background"
                            placeholder="___"
                            maxLength={3}
                          />
                          <span className={`text-xs ${initials[field]?.length >= 2 ? 'text-green-500' : 'text-muted-foreground'}`}>
                            {initials[field]?.length >= 2 ? <CheckCircle className="w-4 h-4" /> : 'Required'}
                          </span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  {/* Disclosures Section */}
                  <Card className="bg-card/80 backdrop-blur-sm border-border/50 mb-4">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg">Required Disclosures</CardTitle>
                      <CardDescription>
                        Acknowledge each disclosure to proceed
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3 max-h-[250px] overflow-y-auto">
                      {agreement?.disclosures?.map((disclosure) => (
                        <label 
                          key={disclosure.id}
                          className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                            acknowledgedDisclosures.has(disclosure.id) 
                              ? 'bg-green-500/10 border-green-500/30' 
                              : 'bg-muted/30 border-border hover:bg-muted/50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={acknowledgedDisclosures.has(disclosure.id)}
                            onChange={() => toggleDisclosure(disclosure.id)}
                            className="mt-1"
                          />
                          <span className="text-xs">{disclosure.disclosure_text}</span>
                        </label>
                      ))}
                    </CardContent>
                  </Card>

                  {/* Signature Section */}
                  <Card className="bg-card/80 backdrop-blur-sm border-border/50 mb-4">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <FileSignature className="w-5 h-5 text-secondary" />
                        Your Signature
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant={signatureType === 'typed' ? 'secondary' : 'outline'}
                          size="sm"
                          onClick={() => setSignatureType('typed')}
                          className="flex-1"
                        >
                          Type
                        </Button>
                        <Button
                          type="button"
                          variant={signatureType === 'drawn' ? 'secondary' : 'outline'}
                          size="sm"
                          onClick={() => setSignatureType('drawn')}
                          className="flex-1"
                        >
                          Draw
                        </Button>
                      </div>

                      {signatureType === 'typed' ? (
                        <div>
                          <input
                            type="text"
                            value={typedSignature}
                            onChange={(e) => setTypedSignature(e.target.value)}
                            placeholder="Type your full legal name"
                            className="w-full px-3 py-2 border rounded-lg bg-background text-lg"
                            style={{ fontFamily: "'Brush Script MT', cursive" }}
                          />
                          {typedSignature && (
                            <p className="mt-2 text-center text-2xl" style={{ fontFamily: "'Brush Script MT', cursive" }}>
                              {typedSignature}
                            </p>
                          )}
                        </div>
                      ) : (
                        <div>
                          <canvas
                            ref={canvasRef}
                            width={280}
                            height={100}
                            className="w-full border rounded-lg bg-white cursor-crosshair touch-none"
                            onMouseDown={startDrawing}
                            onMouseMove={draw}
                            onMouseUp={stopDrawing}
                            onMouseLeave={stopDrawing}
                            onTouchStart={startDrawing}
                            onTouchMove={draw}
                            onTouchEnd={stopDrawing}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={clearSignature}
                            className="mt-2"
                          >
                            Clear
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Final Agreement */}
                  <Card className="bg-card/80 backdrop-blur-sm border-border/50">
                    <CardContent className="p-4 space-y-4">
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={agreedToTerms}
                          onChange={(e) => setAgreedToTerms(e.target.checked)}
                          className="mt-1"
                        />
                        <span className="text-sm">
                          I have read, understand, and agree to all terms and conditions of this Credit Services Agreement. I understand I have 3 business days to cancel.
                        </span>
                      </label>

                      {error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                        </div>
                      )}

                      <Button
                        onClick={handleSign}
                        disabled={!canSign || signing}
                        className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90"
                        size="lg"
                      >
                        {signing ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Signing...
                          </>
                        ) : (
                          <>
                            <FileSignature className="w-4 h-4 mr-2" />
                            Sign Agreement
                          </>
                        )}
                      </Button>

                      {!canSign && (
                        <div className="text-xs text-muted-foreground space-y-1">
                          {!allInitialsComplete && <p>- Complete all initials</p>}
                          {!allDisclosuresAcknowledged && <p>- Acknowledge all disclosures</p>}
                          {!hasValidSignature && <p>- Provide your signature</p>}
                          {!agreedToTerms && <p>- Agree to terms</p>}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
