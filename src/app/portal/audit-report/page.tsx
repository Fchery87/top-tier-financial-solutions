'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { ArrowLeft, Download, Printer, FileText, Loader2, RefreshCw, Shield } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export default function PortalAuditReportPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasReport, setHasReport] = useState(false);
  const [clientName, setClientName] = useState('');
  const [reportType, setReportType] = useState<'comprehensive' | 'simple'>('simple');

  useEffect(() => {
    let isMounted = true;

    const checkReportStatus = async () => {
      try {
        const res = await fetch('/api/portal/audit-report');
        if (res.ok) {
          const data = await res.json();
          if (!isMounted) return;
          setHasReport(data.has_report);
          setClientName(data.client_name || '');
          if (!data.has_report) {
            setError(data.message || 'Your credit analysis report is not yet available.');
          }
        } else if (isMounted) {
          setError('Unable to load report status');
        }
      } catch (err) {
        console.error('Error checking report:', err);
        if (isMounted) {
          setError('Unable to connect to server');
        }
      }
    };

    if (!authLoading && user) {
      void checkReportStatus();
    }

    return () => {
      isMounted = false;
    };
  }, [authLoading, user]);

  const handleIframeLoad = () => {
    setLoading(false);
  };

  const handleIframeError = () => {
    setLoading(false);
    setError('Failed to load the report. Please try again.');
  };

  const handlePrint = () => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.print();
    }
  };

  const handleRefresh = () => {
    setLoading(true);
    setError(null);
    if (iframeRef.current) {
      iframeRef.current.src = `/api/portal/audit-report/view?type=${reportType}&t=${Date.now()}`;
    }
  };

  const toggleReportType = () => {
    const newType = reportType === 'comprehensive' ? 'simple' : 'comprehensive';
    setReportType(newType);
    setLoading(true);
    if (iframeRef.current) {
      iframeRef.current.src = `/api/portal/audit-report/view?type=${newType}`;
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-secondary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-background">
        <div className="max-w-md w-full text-center">
          <Shield className="w-16 h-16 text-secondary mx-auto mb-6" />
          <h1 className="text-2xl font-serif font-bold mb-4 text-foreground">Sign In Required</h1>
          <p className="text-muted-foreground mb-6">Please sign in to view your credit analysis report.</p>
          <Button asChild className="bg-secondary text-secondary-foreground hover:bg-secondary/90">
            <Link href="/sign-in">Sign In</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-card border-b border-border shadow-sm">
        <div className="max-w-[1600px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/portal')}
                className="p-2 hover:bg-muted rounded-lg transition-colors"
                title="Back to Portal"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-xl font-semibold text-foreground font-serif">
                  Credit Analysis Report
                </h1>
                {clientName && (
                  <p className="text-sm text-muted-foreground">
                    Prepared for {clientName}
                  </p>
                )}
              </div>
            </div>
            
            {hasReport && (
              <div className="flex items-center gap-3">
                {/* Report Type Toggle */}
                <div className="flex items-center gap-2 mr-4">
                  <span className="text-sm text-muted-foreground">Type:</span>
                  <button
                    onClick={toggleReportType}
                    className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                      reportType === 'comprehensive'
                        ? 'bg-secondary text-secondary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    {reportType === 'comprehensive' ? 'Comprehensive' : 'Simple'}
                  </button>
                </div>
                
                <Button
                  onClick={handleRefresh}
                  disabled={loading}
                  variant="outline"
                  size="sm"
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
                
                <Button
                  onClick={handlePrint}
                  disabled={loading}
                  variant="outline"
                  size="sm"
                >
                  <Printer className="w-4 h-4 mr-2" />
                  Print
                </Button>
                
                <Button
                  onClick={handlePrint}
                  disabled={loading}
                  className="bg-secondary text-secondary-foreground hover:bg-secondary/90"
                  size="sm"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download PDF
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Report Content */}
      <div className="max-w-[1600px] mx-auto px-6 py-6">
        {!hasReport ? (
          <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
            <div className="flex flex-col items-center justify-center py-20">
              <FileText className="w-16 h-16 text-muted-foreground mb-6" />
              <h2 className="text-2xl font-serif font-bold text-foreground mb-4">Report Not Yet Available</h2>
              <p className="text-muted-foreground text-center max-w-md mb-6">
                {error || 'Your credit analysis report is being prepared. We will notify you once it is ready for review.'}
              </p>
              <Button asChild variant="outline">
                <Link href="/portal">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Portal
                </Link>
              </Button>
            </div>
          </div>
        ) : (
          <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
            {/* Loading State */}
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-secondary" />
                  <p className="text-sm text-muted-foreground">Loading report...</p>
                </div>
              </div>
            )}

            {/* Error State */}
            {error && !loading && (
              <div className="flex flex-col items-center justify-center py-20">
                <FileText className="w-12 h-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium text-foreground mb-2">Failed to Load Report</p>
                <p className="text-sm text-muted-foreground mb-4">{error}</p>
                <Button onClick={handleRefresh} className="bg-secondary text-secondary-foreground hover:bg-secondary/90">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Try Again
                </Button>
              </div>
            )}

            {/* Report iframe */}
            <div className="relative" style={{ minHeight: '800px' }}>
              <iframe
                ref={iframeRef}
                src={`/api/portal/audit-report/view?type=${reportType}`}
                className="w-full border-0"
                style={{ height: 'calc(100vh - 180px)', minHeight: '800px' }}
                onLoad={handleIframeLoad}
                onError={handleIframeError}
                title="Credit Analysis Report"
              />
            </div>
          </div>
        )}

        {/* Footer Info */}
        {hasReport && (
          <div className="mt-6 text-center text-sm text-muted-foreground">
            <p>
              Use the <strong>Print</strong> button to print directly or save as PDF using your browser&apos;s print dialog.
            </p>
            <p className="mt-1">
              The comprehensive report includes educational content and detailed analysis.
              The simple report focuses on data and actionable items.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
