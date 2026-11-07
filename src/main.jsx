import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { isSupabaseConfigured } from "./lib/supabase.js";
import { applyInitialTheme } from "./lib/theme.js";
import { AuthProvider } from "./auth/AuthProvider.jsx";
import { App } from "./App.jsx";
import "./index.css";

applyInitialTheme();

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: true } },
});

function MissingConfig() {
  return (
    <div className="mx-auto max-w-md p-8">
      <h1 className="text-lg font-semibold">Supabase isn't configured</h1>
      <p className="mt-2 text-muted">
        Copy <code>.env.example</code> to <code>.env.local</code> and set <code>VITE_SUPABASE_URL</code> and{" "}
        <code>VITE_SUPABASE_ANON_KEY</code>, then restart the dev server.
      </p>
    </div>
  );
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    {isSupabaseConfigured ? (
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </QueryClientProvider>
    ) : (
      <MissingConfig />
    )}
  </StrictMode>,
);
