"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { isLikelyValidClerkPublishableKey } from "@/auth/clerkKey";
import {
  clearLocalAuthToken,
  getLocalAuthToken,
  isLocalAuthMode,
} from "@/auth/localAuth";
import { isProxyAuthMode, getProxyUser } from "@/auth/proxyAuth";
import { LocalAuthLogin } from "@/components/organisms/LocalAuthLogin";

function ProxyAuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const user = getProxyUser();

  useEffect(() => {
    if (!user) {
      // No main-app session found — redirect back to the main app sign-up
      router.replace("/signup");
    }
  }, [user, router]);

  if (!user) return null;
  return <>{children}</>;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const proxyMode = isProxyAuthMode();
  const localMode = isLocalAuthMode();

  useEffect(() => {
    if (!localMode) {
      clearLocalAuthToken();
    }
  }, [localMode]);

  if (proxyMode) {
    return <ProxyAuthGuard>{children}</ProxyAuthGuard>;
  }

  if (localMode) {
    if (!getLocalAuthToken()) {
      return <LocalAuthLogin />;
    }
    return <>{children}</>;
  }

  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const afterSignOutUrl =
    process.env.NEXT_PUBLIC_CLERK_AFTER_SIGN_OUT_URL ?? "/";

  if (!isLikelyValidClerkPublishableKey(publishableKey)) {
    return <>{children}</>;
  }

  return (
    <ClerkProvider
      publishableKey={publishableKey}
      afterSignOutUrl={afterSignOutUrl}
    >
      {children}
    </ClerkProvider>
  );
}
