import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import type { ReactNode } from "react";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Upload from "./pages/Upload";
import Review from "./pages/Review";
import Monthly from "./pages/Monthly";
import SettingsPage from "./pages/Settings";
import AppShell from "./components/AppShell";
import LockScreen from "./components/LockScreen";
import { AppProvider } from "./store/AppContext";
import { LockProvider, useLock } from "./store/LockContext";

const queryClient = new QueryClient();

/** Renders the lock screen instead of the app whenever the vault is sealed. */
function LockGate({ children }: { children: ReactNode }) {
  const { locked } = useLock();
  return <>{locked ? <LockScreen /> : children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AppProvider>
        <LockProvider>
          <LockGate>
            <BrowserRouter>
              <Routes>
                <Route element={<AppShell />}>
                  <Route path="/" element={<Index />} />
                  <Route path="/upload" element={<Upload />} />
                  <Route path="/review/:reportId" element={<Review />} />
                  <Route path="/monthly" element={<Monthly />} />
                  <Route path="/settings" element={<SettingsPage />} />
                </Route>
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </LockGate>
        </LockProvider>
      </AppProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;