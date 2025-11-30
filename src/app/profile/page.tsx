'use client';

import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { Loader2 } from 'lucide-react';

export default function ProfilePage() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-8 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-secondary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-2xl mx-auto">
          <p className="text-lg">Not signed in. Go to <Link href="/sign-up" className="text-primary hover:underline">/sign-up</Link> to create an account.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold">Profile</h1>
        
        <div className="bg-card rounded-lg p-6 shadow">
          <h2 className="text-xl font-semibold mb-4">User Information</h2>
          <dl className="space-y-3">
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Name</dt>
              <dd className="text-foreground">{user.name || 'Not set'}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Email</dt>
              <dd className="text-foreground">{user.email}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Auth Status</dt>
              <dd className="text-foreground">Signed in</dd>
            </div>
          </dl>
        </div>

        <div className="bg-card rounded-lg p-6 shadow">
          <h2 className="text-xl font-semibold mb-4">Links</h2>
          <ul className="space-y-2">
            <li>
              <Link
                href="/portal"
                className="text-primary hover:underline"
              >
                Client Portal
              </Link>
            </li>
            <li>
              <Link
                href="/settings"
                className="text-primary hover:underline"
              >
                Account Settings
              </Link>
            </li>
            <li>
              <Link href="/" className="text-primary hover:underline">
                Home
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
