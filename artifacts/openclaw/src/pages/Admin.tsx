import { useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

type AdminUser = {
  name: string;
  email: string;
  createdAt: string | null;
  planName: string | null;
  subscriptionStatus: string | null;
  instanceUrl: string | null;
  agentStatus: string | null;
  lastActivityAt: string | null;
};

type AdminUsersResponse = {
  users: AdminUser[];
  admin?: string;
};

function formatDate(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

export function Admin() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!user) navigate("/sign-in");
  }, [navigate, user]);

  const { data, isLoading, error } = useQuery<AdminUsersResponse>({
    queryKey: ["admin-users", user?.email],
    enabled: !!user?.email,
    queryFn: async () => {
      const establish = await fetch(`${BASE_URL}/api/session/establish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: user?.email }),
      });
      if (!establish.ok) {
        await fetch(`${BASE_URL}/api/users/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ name: user?.name || user?.email, email: user?.email }),
        });
        await fetch(`${BASE_URL}/api/session/establish`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ email: user?.email }),
        });
      }

      const response = await fetch(`${BASE_URL}/api/admin/users`, { credentials: "include" });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error || "Failed to load admin users");
      }
      return (await response.json()) as AdminUsersResponse;
    },
    retry: false,
  });

  if (!user) return null;

  if (isLoading) {
    return (
      <div className="min-h-screen md:pt-32 flex flex-col items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-primary mb-3" />
        <p className="text-muted-foreground">Loading admin dashboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen md:pt-32 px-4 md:px-6 flex items-center justify-center">
        <Card className="max-w-xl w-full border-destructive/30 bg-destructive/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="w-5 h-5" />
              Admin Access Error
            </CardTitle>
            <CardDescription>
              {(error as Error).message || "You don't have permission to view this page."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Button variant="outline" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="w-4 h-4 mr-1.5" />
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen md:pt-24 pb-12 md:pb-20 bg-background">
      <div className="max-w-7xl mx-auto px-4 md:px-6">
        <div className="flex items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-3xl md:text-4xl font-display font-bold">Admin Dashboard</h1>
            <p className="text-muted-foreground">Users, subscriptions, instances and activity</p>
          </div>
          <Button variant="outline" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            Dashboard
          </Button>
        </div>

        <Card className="bg-card/40 border-white/10 backdrop-blur-lg">
          <CardHeader>
            <CardTitle>Users ({data?.users.length ?? 0})</CardTitle>
            <CardDescription>Latest 500 users</CardDescription>
          </CardHeader>
          <CardContent className="overflow-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead>
                <tr className="text-left border-b border-white/10">
                  <th className="py-2 pr-3">Name</th>
                  <th className="py-2 pr-3">Email</th>
                  <th className="py-2 pr-3">Plan</th>
                  <th className="py-2 pr-3">Subscription</th>
                  <th className="py-2 pr-3">Instance</th>
                  <th className="py-2 pr-3">Gateway Status</th>
                  <th className="py-2 pr-3">Last Activity</th>
                  <th className="py-2 pr-3">Created</th>
                </tr>
              </thead>
              <tbody>
                {(data?.users ?? []).map((row) => (
                  <tr key={row.email} className="border-b border-white/5">
                    <td className="py-2 pr-3">{row.name || "-"}</td>
                    <td className="py-2 pr-3">{row.email}</td>
                    <td className="py-2 pr-3">{row.planName || "-"}</td>
                    <td className="py-2 pr-3">{row.subscriptionStatus || "-"}</td>
                    <td className="py-2 pr-3 truncate max-w-[260px]" title={row.instanceUrl || "-"}>
                      {row.instanceUrl || "-"}
                    </td>
                    <td className="py-2 pr-3">{row.agentStatus || "-"}</td>
                    <td className="py-2 pr-3">{formatDate(row.lastActivityAt)}</td>
                    <td className="py-2 pr-3">{formatDate(row.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
