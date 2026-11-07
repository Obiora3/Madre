import { useState } from "react";
import { supabase } from "../lib/supabase.js";
import { useAuth } from "../auth/AuthProvider.jsx";
import { Button, ErrorText, Field, Input } from "../components/ui.jsx";
import { AuthShell } from "./SignIn.jsx";

// Shown to a signed-in user who doesn't belong to a workspace yet.
export function Onboarding() {
  const { me, refreshMe, signOut } = useAuth();
  const [mode, setMode] = useState("join");
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = mode === "create"
      ? await supabase.rpc("create_workspace", { p_name: value.trim() })
      : await supabase.rpc("join_workspace", { p_code: value.trim() });
    if (error) {
      setError(error);
      setBusy(false);
    } else {
      await refreshMe();
    }
  }

  return (
    <AuthShell>
      <h1 className="text-lg font-semibold">Welcome{me?.name ? `, ${me.name.split(" ")[0]}` : ""}</h1>
      <p className="mt-1 mb-5 text-muted">
        {mode === "join"
          ? "Enter the workspace code an admin shared with you."
          : "Set up a workspace for your agency. You'll be its admin."}
      </p>

      <div className="mb-5 grid grid-cols-2 rounded-lg bg-surface-2 p-1 text-sm">
        {[["join", "Join a team"], ["create", "Create workspace"]].map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => { setMode(id); setValue(""); setError(null); }}
            className={`rounded-md py-1.5 font-medium ${mode === id ? "bg-surface text-ink shadow-sm" : "text-muted"}`}
          >
            {label}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="space-y-4">
        {mode === "join" ? (
          <Field label="Workspace code">
            <Input value={value} onChange={(e) => setValue(e.target.value.toUpperCase())} placeholder="e.g. 4F9A2C1B" className="font-mono tracking-widest" required />
          </Field>
        ) : (
          <Field label="Agency name">
            <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder="e.g. Madre Creative" required />
          </Field>
        )}
        <ErrorText error={error} />
        <Button type="submit" className="w-full" loading={busy}>
          {mode === "join" ? "Join workspace" : "Create workspace"}
        </Button>
      </form>

      <button onClick={signOut} className="mt-5 block w-full text-center text-sm text-muted hover:text-ink">
        Sign out
      </button>
    </AuthShell>
  );
}
