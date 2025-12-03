'use client';

import * as React from 'react';

type AdminRole = 'super_admin' | 'admin' | 'staff' | null;

interface AdminContextValue {
  role: AdminRole;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isStaff: boolean;
  userId: string | null;
  userEmail: string | null;
}

const AdminContext = React.createContext<AdminContextValue>({
  role: null,
  isSuperAdmin: false,
  isAdmin: false,
  isStaff: false,
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
    isSuperAdmin: role === 'super_admin',
    isAdmin: role === 'super_admin' || role === 'admin',
    isStaff: role === 'staff',
    userId,
    userEmail,
  };

  return (
    <AdminContext.Provider value={value}>
      {children}
    </AdminContext.Provider>
  );
}
