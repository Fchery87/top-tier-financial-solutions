'use client';

import Link from 'next/link';
import { Suspense } from 'react';
import { useUser } from '@stackframe/stack';

function ProfileContent() {
  const user = useUser();

  if (!user) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-2xl mx-auto">
          <p className="text-lg">Not signed in. Go to <Link href="/handler/sign-up" className="text-primary hover:underline">/handler/sign-up</Link> to create an account.</p>
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
              <dd className="text-foreground">{user.displayName || 'Not set'}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">ID</dt>
              <dd className="text-foreground text-sm">{user.id}</dd>
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
                href="/handler/account-settings"
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

export default function ProfilePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background p-8"><div className="max-w-2xl mx-auto">Loading...</div></div>}>
      <ProfileContent />
    </Suspense>
  );
}
