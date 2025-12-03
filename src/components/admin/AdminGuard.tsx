'use client';

import { useAuth } from '@/components/AuthProvider';
import { signOut } from '@/lib/auth-client';
import { useEffect, useState } from 'react';
import { ShieldX, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AdminProvider } from '@/contexts/AdminContext';

type AdminRole = 'super_admin' | 'admin' | 'staff' | null;

interface AdminGuardProps {
  children: React.ReactNode;
}

export function AdminGuard({ children }: AdminGuardProps) {
  const { user, isLoading: authLoading } = useAuth();
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [userRole, setUserRole] = useState<AdminRole>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function checkAccess() {
      // Still loading auth
      if (authLoading) {
        return;
      }

      // Not logged in
      if (!user) {
        setIsAuthorized(false);
        setIsLoading(false);
        return;
      }

      try {
        // Check if user has admin/super_admin role
        const response = await fetch('/api/admin/check-access', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: user.email }),
        });

        if (response.ok) {
          const data = await response.json();
          setIsAuthorized(data.authorized);
          setUserRole(data.role || (data.authorized ? 'super_admin' : null));
        } else {
          setIsAuthorized(false);
          setUserRole(null);
        }
      } catch (error) {
        console.error('Error checking admin access:', error);
        setIsAuthorized(false);
        setUserRole(null);
      } finally {
        setIsLoading(false);
      }
    }

    checkAccess();
  }, [user, authLoading]);

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
    router.refresh();
  };

  // Loading state
  if (isLoading || authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 text-secondary animate-spin mx-auto" />
          <p className="text-muted-foreground">Verifying access...</p>
        </div>
      </div>
    );
  }

  // Not logged in
  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="w-20 h-20 rounded-full bg-secondary/10 flex items-center justify-center mx-auto">
            <ShieldX className="w-10 h-10 text-secondary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Authentication Required</h1>
          <p className="text-muted-foreground">
            You need to sign in to access the admin panel.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button asChild>
              <Link href="/sign-in">Sign In</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/">Back to Home</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Not authorized (not super_admin)
  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center mx-auto">
            <ShieldX className="w-10 h-10 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Access Denied</h1>
          <p className="text-muted-foreground">
            You don&apos;t have permission to access the admin panel. 
            Only users with <span className="font-semibold text-secondary">super_admin</span> access can view this area.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button variant="outline" asChild>
              <Link href="/">Back to Home</Link>
            </Button>
            <Button variant="outline" onClick={handleSignOut}>
              Sign Out
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Authorized - render children with admin context
  return (
    <AdminProvider 
      role={userRole} 
      userId={user?.id || null}
      userEmail={user?.email || null}
    >
      {children}
    </AdminProvider>
  );
}
