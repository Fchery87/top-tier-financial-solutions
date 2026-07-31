'use client';

import * as React from 'react';
import { can as canCapability, type Capability, type TeamRole } from '@/lib/capabilities';

type AdminRole = TeamRole | null;

interface AdminContextValue {
  role: AdminRole;
  can: (capability: Capability) => boolean;
  userId: string | null;
  userEmail: string | null;
}

const AdminContext = React.createContext<AdminContextValue>({
  role: null,
  can: () => false,
  userId: null,
  userEmail: null,
});

export function useAdminRole() {
  const context = React.useContext(AdminContext);
  if (!context) {
    throw new Error('useAdminRole must be used within AdminProvider');
  }
  return context;
}

interface AdminProviderProps {
  children: React.ReactNode;
  role: AdminRole;
  userId: string | null;
  userEmail: string | null;
}

export function AdminProvider({ children, role, userId, userEmail }: AdminProviderProps) {
  const value: AdminContextValue = {
    role,
    can: (capability: Capability) => canCapability(role, capability),
    userId,
    userEmail,
  };

  return (
    <AdminContext.Provider value={value}>
      {children}
    </AdminContext.Provider>
  );
}
