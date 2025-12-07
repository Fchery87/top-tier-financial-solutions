'use client';

import * as React from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Mail, CheckCircle, Loader2, Sparkles } from 'lucide-react';

interface NewsletterSignupProps {
  title?: string;
  description?: string;
  source?: string;
  variant?: 'default' | 'compact' | 'footer';
  className?: string;
}

export function NewsletterSignup({ 
  title = 'Stay Updated',
  description = 'Subscribe to our newsletter for credit tips, financial insights, and exclusive offers.',
  source = 'website',
  variant = 'default',
  className = '',
}: NewsletterSignupProps) {
  const [email, setEmail] = React.useState('');
  const [firstName, setFirstName] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [isSuccess, setIsSuccess] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          first_name: firstName || undefined,
          source,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to subscribe');
      }

      setIsSuccess(true);
      setEmail('');
      setFirstName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  if (variant === 'footer') {
    return (
      <div className={className}>
        <h4 className="text-secondary font-bold mb-4 font-serif tracking-wide text-lg">{title}</h4>
        <p className="text-sm text-primary-foreground/70 mb-4">{description}</p>
        
        {isSuccess ? (
          <div className="flex items-center gap-2 text-green-400">
            <CheckCircle className="w-5 h-5" />
            <span className="text-sm">Thank you for subscribing!</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3" data-form-type="other" suppressHydrationWarning>
            <Input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="off"
              data-lpignore="true"
              data-form-type="other"
              className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
            />
            {error && <p className="text-sm text-red-400">{error}</p>}
            <Button 
              type="submit" 
              disabled={isLoading}
              className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90"
              suppressHydrationWarning
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                'Subscribe'
              )}
            </Button>
          </form>
        )}
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className={`bg-card/80 backdrop-blur-sm border border-border/50 rounded-2xl p-6 ${className}`}>
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-secondary/20">
            <Mail className="w-5 h-5 text-secondary" />
          </div>
          <h3 className="font-serif font-bold text-foreground">{title}</h3>
        </div>
        
        {isSuccess ? (
          <div className="flex items-center gap-2 text-green-400">
            <CheckCircle className="w-5 h-5" />
            <span>Thank you for subscribing!</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex gap-2" data-form-type="other" suppressHydrationWarning>
            <Input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="off"
              data-lpignore="true"
              data-form-type="other"
              className="flex-1 bg-background/50"
            />
            <Button 
              type="submit" 
              disabled={isLoading}
              className="bg-secondary text-secondary-foreground hover:bg-secondary/90"
              suppressHydrationWarning
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Subscribe'}
            </Button>
          </form>
        )}
        {error && <p className="text-sm text-destructive mt-2">{error}</p>}
      </div>
    );
  }

  return (
    <Card className={`bg-card/80 backdrop-blur-sm border-border/50 overflow-hidden ${className}`}>
      <CardContent className="p-8">
        <div className="flex flex-col md:flex-row md:items-center gap-8">
          <div className="flex-1">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary/20 text-secondary text-sm font-medium mb-4">
              <Sparkles className="w-4 h-4" />
              Newsletter
            </div>
            <h3 className="text-2xl font-serif font-bold text-foreground mb-2">{title}</h3>
            <p className="text-muted-foreground">{description}</p>
          </div>
          
          <div className="flex-1">
            {isSuccess ? (
              <div className="flex items-center justify-center gap-3 p-6 rounded-xl bg-green-500/10 border border-green-500/30">
                <CheckCircle className="w-6 h-6 text-green-400" />
                <div>
                  <p className="font-medium text-green-400">You&apos;re subscribed!</p>
                  <p className="text-sm text-muted-foreground">Check your inbox for updates.</p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4" data-form-type="other" suppressHydrationWarning>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    type="text"
                    placeholder="First name (optional)"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    autoComplete="off"
                    data-lpignore="true"
                    data-form-type="other"
                    className="bg-background/50"
                  />
                  <Input
                    type="email"
                    placeholder="Email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="off"
                    data-lpignore="true"
                    data-form-type="other"
                    className="bg-background/50"
                  />
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button 
                  type="submit" 
                  disabled={isLoading}
                  className="w-full sm:w-auto h-12 px-8 bg-secondary text-secondary-foreground hover:bg-secondary/90 rounded-full"
                  suppressHydrationWarning
                >
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Mail className="w-5 h-5 mr-2" />
                      Subscribe Now
                    </>
                  )}
                </Button>
                <p className="text-xs text-muted-foreground">
                  We respect your privacy. Unsubscribe at any time.
                </p>
              </form>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
