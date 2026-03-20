import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HelmetProvider } from "react-helmet-async";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/context/AuthContext";
import { LanguageProvider } from "@/context/LanguageContext";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Home } from "@/pages/Home";
import { Pricing } from "@/pages/Pricing";
import { Dashboard } from "@/pages/Dashboard";
import { Setup } from "@/pages/Setup";
import { SignUp } from "@/pages/SignUp";
import { SignIn } from "@/pages/SignIn";
import { OpenClawApp } from "@/pages/OpenClawApp";
import { MissionControlApp } from "@/pages/MissionControlApp";
import { Blog } from "@/pages/Blog";
import { BlogPost } from "@/pages/BlogPost";
import { Usage } from "@/pages/Usage";
import { ManageSubscription } from "@/pages/ManageSubscription";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const hideNavbar = location.startsWith("/dashboard");

  return (
    <div className="flex flex-col min-h-screen selection:bg-primary/30 selection:text-white">
      {!hideNavbar && <Navbar />}
      <main className="flex-1">
        {children}
      </main>
      <Footer />
    </div>
  );
}

function Router() {
  return (
    <Switch>
      {/* Full-screen route — no navbar/footer */}
      <Route path="/openclaw" component={OpenClawApp} />
      <Route path="/mission-control-app" component={MissionControlApp} />

      {/* Standard layout routes */}
      <Route>
        <Layout>
          <Switch>
            <Route path="/" component={Home} />
            <Route path="/signup" component={SignUp} />
            <Route path="/sign-in" component={SignIn} />
            <Route path="/pricing" component={Pricing} />
            <Route path="/dashboard" component={Dashboard} />
            <Route path="/dashboard/:workspaceId" component={Dashboard} />
            <Route path="/setup" component={Setup} />
            <Route path="/blog" component={Blog} />
            <Route path="/blog/:slug" component={BlogPost} />
            <Route path="/usage" component={Usage} />
            <Route path="/subscription" component={ManageSubscription} />
            <Route component={NotFound} />
          </Switch>
        </Layout>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <LanguageProvider>
            <AuthProvider>
              <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
                <Router />
              </WouterRouter>
            </AuthProvider>
            <Toaster />
          </LanguageProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </HelmetProvider>
  );
}

export default App;
