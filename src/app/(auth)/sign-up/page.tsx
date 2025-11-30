'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { signUp } from '@/lib/auth-client';
import { Button } from '@/components/ui/Button';
import { Logo } from '@/components/Logo';
import { Loader2, Mail, Lock, User, ArrowLeft } from 'lucide-react';

export default function SignUpPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setIsLoading(true);

    try {
      const result = await signUp.email({
        email,
        password,
        name,
      });

      if (result.error) {
        setError(result.error.message || 'Failed to create account');
      } else {
        router.push('/');
        router.refresh();
      }
    } catch {
      setError('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="flex justify-center mb-6">
            <Logo size="lg" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Create an account</h1>
          <p className="text-muted-foreground mt-2">Get started with Top Tier Financial</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-500 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-foreground mb-2">
                Full Name
              </label>
              <div className="relative flex items-center">
                <span className="absolute left-3 flex items-center pointer-events-none">
                  <User className="w-5 h-5 text-muted-foreground" />
                </span>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full h-12 pl-11 pr-4 bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent transition-all text-foreground placeholder:text-muted-foreground"
                  placeholder="John Doe"
                />
              </div>
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-foreground mb-2">
                Email
              </label>
              <div className="relative flex items-center">
                <span className="absolute left-3 flex items-center pointer-events-none">
                  <Mail className="w-5 h-5 text-muted-foreground" />
                </span>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full h-12 pl-11 pr-4 bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent transition-all text-foreground placeholder:text-muted-foreground"
                  placeholder="you@example.com"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-foreground mb-2">
                Password
              </label>
              <div className="relative flex items-center">
                <span className="absolute left-3 flex items-center pointer-events-none">
                  <Lock className="w-5 h-5 text-muted-foreground" />
                </span>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full h-12 pl-11 pr-4 bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent transition-all text-foreground placeholder:text-muted-foreground"
                  placeholder="Min. 8 characters"
                />
              </div>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-foreground mb-2">
                Confirm Password
              </label>
              <div className="relative flex items-center">
                <span className="absolute left-3 flex items-center pointer-events-none">
                  <Lock className="w-5 h-5 text-muted-foreground" />
                </span>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="w-full h-12 pl-11 pr-4 bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent transition-all text-foreground placeholder:text-muted-foreground"
                  placeholder="Confirm your password"
                />
              </div>
            </div>
          </div>

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full h-12 bg-secondary text-secondary-foreground hover:bg-secondary/90"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                Creating account...
              </>
            ) : (
              'Create Account'
            )}
          </Button>
        </form>

        <div className="text-center space-y-4">
          <p className="text-muted-foreground">
            Already have an account?{' '}
            <Link href="/sign-in" className="text-secondary hover:underline font-medium">
              Sign in
            </Link>
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
