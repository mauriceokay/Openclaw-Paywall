import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import { SignIn as ClerkSignIn } from "@clerk/clerk-react";
import { useAuth } from "@/context/AuthContext";

export function SignIn() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (user) navigate("/dashboard");
  }, [navigate, user]);

  if (user) return null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-mesh px-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-5">
          <h1 className="text-3xl font-display font-bold mb-2 text-gradient">Welcome back</h1>
          <p className="text-muted-foreground">Sign in to access your OpenClaw workspace.</p>
        </div>
        <div className="flex justify-center">
          <ClerkSignIn
            path="/sign-in"
            signUpUrl="/signup"
            forceRedirectUrl="/dashboard"
            appearance={{
              elements: {
                card: "shadow-none border border-white/10 bg-card/40 backdrop-blur-xl",
                headerTitle: "text-foreground",
                headerSubtitle: "text-muted-foreground",
                socialButtonsBlockButton: "border-white/15",
                formButtonPrimary: "bg-primary hover:bg-primary/90",
                footerActionText: "text-muted-foreground",
                footerActionLink: "text-primary",
              },
            }}
          />
        </div>
        <p className="text-xs text-muted-foreground text-center mt-4">
          New here? <Link href="/signup" className="text-primary">Create account</Link>
        </p>
      </div>
    </div>
  );
}

