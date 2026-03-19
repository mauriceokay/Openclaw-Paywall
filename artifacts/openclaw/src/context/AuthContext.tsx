import { createContext, useContext, type ReactNode } from "react";
import { ClerkProvider, useClerk, useUser } from "@clerk/clerk-react";

interface User {
  name: string;
  email: string;
}

interface AuthContextValue {
  user: User | null;
  signUp: (name: string, email: string) => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined;

function ClerkBackedAuthProvider({ children }: { children: ReactNode }) {
  const { user: clerkUser } = useUser();
  const clerk = useClerk();

  const user: User | null = clerkUser?.primaryEmailAddress?.emailAddress
    ? {
        name:
          clerkUser.fullName ||
          clerkUser.firstName ||
          clerkUser.username ||
          clerkUser.primaryEmailAddress.emailAddress,
        email: clerkUser.primaryEmailAddress.emailAddress,
      }
    : null;

  const signUp = () => {
    // Kept for compatibility with existing callers; Clerk handles sign-up UI/routes.
  };

  const signOut = async () => {
    localStorage.removeItem("oc_mode");
    localStorage.removeItem("oc_api_key");
    localStorage.removeItem("oc_api_provider");
    localStorage.removeItem("oc_checkout_session_id");
    await clerk.signOut();
  };

  return <AuthContext.Provider value={{ user, signUp, signOut }}>{children}</AuthContext.Provider>;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  if (!PUBLISHABLE_KEY) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-6 text-center">
        <div>
          <h2 className="text-2xl font-bold mb-2">Clerk is not configured</h2>
          <p className="text-muted-foreground">
            Set <code>VITE_CLERK_PUBLISHABLE_KEY</code> and restart the app.
          </p>
        </div>
      </div>
    );
  }

  return (
    <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
      <ClerkBackedAuthProvider>{children}</ClerkBackedAuthProvider>
    </ClerkProvider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
