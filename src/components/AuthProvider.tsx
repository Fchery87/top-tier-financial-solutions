"use client";

import { createContext, useContext, ReactNode } from "react";
import { useSession } from "@/lib/auth-client";

type User = {
  id: string;
  name: string;
  email: string;
  image?: string | null;
  role?: string | null;
};

type SessionContextType = {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
};

const SessionContext = createContext<SessionContextType>({
  user: null,
  isLoading: true,
  isAuthenticated: false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data: session, isPending } = useSession();

  const value: SessionContextType = {
    user: session?.user ?? null,
    isLoading: isPending,
    isAuthenticated: !!session?.user,
  };

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
