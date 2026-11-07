import { useState } from "react";
import { supabase } from "../lib/supabase.js";
import { Button, Card, ErrorText, Field, Input, Logo } from "../components/ui.jsx";

const copy = {
  signin: { title: "Sign in to Madre", button: "Sign in" },
  signup: { title: "Create your account", button: "Create account" },
  forgot: { title: "Reset your password", button: "Send reset link" },
};

export function AuthShell({ children }) {
  return (
    <div className="flex min-h-full items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <Card className="p-6 shadow-sm">{children}</Card>
      </div>
    </div>
  );
}

export function SignIn() {
  const [mode, setMode] = useState("signin");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const switchMode = (next) => { setMode(next); setError(null); setNotice(null); };

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    const email = form.email.trim();
    let result;
    if (mode === "signin") {
      result = await supabase.auth.signInWithPassword({ email, password: form.password });
    } else if (mode === "signup") {
      result = await supabase.auth.signUp({
        email,
        password: form.password,
        options: { data: { name: form.name.trim() }, emailRedirectTo: window.location.origin },
      });
      if (!result.error && !result.data.session) setNotice("Check your inbox to confirm your email, then sign in.");
    } else {
      result = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
      if (!result.error) setNotice("If that email has an account, a reset link is on its way.");
    }
    setError(result.error);
    setBusy(false);
  }

  return (
    <AuthShell>
      <h1 className="mb-5 text-lg font-semibold">{copy[mode].title}</h1>
      <form onSubmit={submit} className="space-y-4">
        {mode === "signup" && (
          <Field label="Full name">
            <Input value={form.name} onChange={set("name")} autoComplete="name" required />
          </Field>
        )}
        <Field label="Email">
          <Input type="email" value={form.email} onChange={set("email")} autoComplete="email" required />
        </Field>
        {mode !== "forgot" && (
          <Field label="Password" hint={mode === "signup" ? "At least 8 characters." : undefined}>
            <Input
              type="password"
              value={form.password}
              onChange={set("password")}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              minLength={mode === "signup" ? 8 : undefined}
              required
            />
          </Field>
        )}
        <ErrorText error={error} />
        {notice && <p className="rounded-lg bg-accent-soft px-3 py-2 text-sm text-accent">{notice}</p>}
        <Button type="submit" className="w-full" loading={busy}>{copy[mode].button}</Button>
      </form>

      <div className="mt-5 space-y-2 text-center text-sm text-muted">
        {mode === "signin" && (
          <>
            <button className="hover:text-ink" onClick={() => switchMode("forgot")}>Forgot password?</button>
            <p>
              New to Madre?{" "}
              <button className="font-medium text-accent" onClick={() => switchMode("signup")}>Create an account</button>
            </p>
          </>
        )}
        {mode !== "signin" && (
          <button className="font-medium text-accent" onClick={() => switchMode("signin")}>Back to sign in</button>
        )}
      </div>
    </AuthShell>
  );
}

export function ResetPassword({ onDone }) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) setError(error);
    else onDone();
  }

  return (
    <AuthShell>
      <h1 className="mb-5 text-lg font-semibold">Choose a new password</h1>
      <form onSubmit={submit} className="space-y-4">
        <Field label="New password" hint="At least 8 characters.">
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} autoComplete="new-password" required />
        </Field>
        <ErrorText error={error} />
        <Button type="submit" className="w-full" loading={busy}>Save password</Button>
      </form>
    </AuthShell>
  );
}
