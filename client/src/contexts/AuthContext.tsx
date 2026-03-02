import React, { createContext, useContext, useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";

interface User {
  id: number;
  username?: string;
  email?: string;
  phone?: string;
  name?: string;
  role: "user" | "admin" | "agent";
  referralCode?: string | null;
  points?: number;
  isSuperAdmin?: boolean;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  loginSuccess: (user: User) => void;
  logout: () => Promise<void>;
  /** עדכון יתרת נקודות בזמן אמת (מסוקט) – מעדכן רק אם userId תואם למשתמש המחובר */
  updatePointsFromSocket: (userId: number, balance: number) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Check if user is authenticated on mount
  const { data: currentUser, isLoading } = trpc.auth.me.useQuery();
  const logoutMutation = trpc.auth.logout.useMutation();

  useEffect(() => {
    setLoading(isLoading);
    if (currentUser) {
      setUser(currentUser as User);
    } else {
      setUser(null);
    }
  }, [currentUser, isLoading]);

  const loginSuccess = (userData: User) => {
    setUser(userData);
  };

  const logout = async () => {
    await logoutMutation.mutateAsync();
    setUser(null);
    window.location.href = "/";
  };

  const updatePointsFromSocket = (userId: number, balance: number) => {
    setUser((prev) => (prev && prev.id === userId ? { ...prev, points: balance } : prev));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated: !!user,
        loginSuccess,
        logout,
        updatePointsFromSocket,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
