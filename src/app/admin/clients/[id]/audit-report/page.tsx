'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Download, Printer, FileText, Loader2, RefreshCw } from 'lucide-react';

export default function AuditReportPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = params.id as string;
  const iframeRef = useRef<HTMLIFrameElement>(null);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clientName, setClientName] = useState('');
  const [reportType, setReportType] = useState<'comprehensive' | 'simple'>('simple');

  useEffect(() => {
    fetchClientName();
  }, [clientId]);

  const fetchClientName = async () => {
    try {
      const res = await fetch(`/api/admin/clients/${clientId}`);
      if (res.ok) {
        const data = await res.json();
        setClientName(`${data.client.first_name} ${data.client.last_name}`);
      }
    } catch (err) {
      console.error('Error fetching client:', err);
    }
  };

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

  const handleDownloadPDF = async () => {
    // For now, use the browser's print to PDF functionality
    // In the future, we can integrate html2pdf.js or server-side PDF generation
    handlePrint();
  };

  const handleRefresh = () => {
    setLoading(true);
    setError(null);
    if (iframeRef.current) {
      iframeRef.current.src = `/api/admin/clients/${clientId}/audit-report?type=${reportType}&t=${Date.now()}`;
    }
  };

  const toggleReportType = () => {
    const newType = reportType === 'comprehensive' ? 'simple' : 'comprehensive';
    setReportType(newType);
    setLoading(true);
    if (iframeRef.current) {
      iframeRef.current.src = `/api/admin/clients/${clientId}/audit-report?type=${newType}`;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-card border-b border-border shadow-sm">
        <div className="max-w-[1600px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.back()}
                className="p-2 hover:bg-muted rounded-lg transition-colors"
                title="Go back"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-xl font-semibold text-foreground">
                  Credit Analysis Report
                </h1>
                {clientName && (
                  <p className="text-sm text-muted-foreground">
                    Prepared for {clientName}
                  </p>
                )}
              </div>
            </div>
            
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
              
              <button
                onClick={handleRefresh}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              
              <button
                onClick={handlePrint}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors disabled:opacity-50"
              >
                <Printer className="w-4 h-4" />
                Print
              </button>
              
              <button
                onClick={handleDownloadPDF}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-secondary text-secondary-foreground hover:bg-secondary/90 rounded-lg transition-colors disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                Download PDF
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Report Content */}
      <div className="max-w-[1600px] mx-auto px-6 py-6">
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
          {error && (
            <div className="flex flex-col items-center justify-center py-20">
              <FileText className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium text-foreground mb-2">Failed to Load Report</p>
              <p className="text-sm text-muted-foreground mb-4">{error}</p>
              <button
                onClick={handleRefresh}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-secondary text-secondary-foreground hover:bg-secondary/90 rounded-lg transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Try Again
              </button>
            </div>
          )}

          {/* Report iframe */}
          <div className="relative" style={{ minHeight: '800px' }}>
            <iframe
              ref={iframeRef}
              src={`/api/admin/clients/${clientId}/audit-report?type=${reportType}`}
              className="w-full border-0"
              style={{ height: 'calc(100vh - 180px)', minHeight: '800px' }}
              onLoad={handleIframeLoad}
              onError={handleIframeError}
              title="Credit Analysis Report"
            />
          </div>
        </div>

        {/* Footer Info */}
        <div className="mt-6 text-center text-sm text-muted-foreground">
          <p>
            Use the <strong>Print</strong> button to print directly or save as PDF using your browser's print dialog.
          </p>
          <p className="mt-1">
            The comprehensive report includes educational content and detailed analysis.
            The simple report focuses on data and actionable items.
          </p>
        </div>
      </div>
    </div>
  );
}
