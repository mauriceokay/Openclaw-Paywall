import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

interface User {
  name: string;
  email: string;
}

interface AuthContextValue {
  user: User | null;
  signUp: (name: string, email: string) => void;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const STORAGE_KEY = "oc_user";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  const signUp = (name: string, email: string) => {
    const u = { name, email };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
    setUser(u);
  };

  const signOut = () => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem("oc_mode");
    localStorage.removeItem("oc_api_key");
    localStorage.removeItem("oc_api_provider");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
