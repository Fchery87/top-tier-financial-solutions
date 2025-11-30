'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { RefreshCw, Home, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Application error:', error);
  }, [error]);

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="text-center max-w-lg">
        <div className="relative mb-8">
          <div className="w-24 h-24 mx-auto rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="w-12 h-12 text-destructive" />
          </div>
        </div>
        
        <h1 className="text-3xl md:text-4xl font-serif font-bold text-foreground mb-4">
          Something Went Wrong
        </h1>
        
        <p className="text-muted-foreground text-lg mb-8">
          We encountered an unexpected error. Please try again or contact support if the problem persists.
        </p>
        
        {error.digest && (
          <p className="text-xs text-muted-foreground mb-6 font-mono">
            Error ID: {error.digest}
          </p>
        )}
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button onClick={reset} variant="outline" className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Try Again
          </Button>
          <Button asChild className="gap-2 bg-secondary text-secondary-foreground hover:bg-secondary/90">
            <Link href="/">
              <Home className="w-4 h-4" />
              Back to Home
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
