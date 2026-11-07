import { useState } from "react";
import { useAuth } from "../auth/AuthProvider.jsx";
import { Card, PageHeader } from "../components/ui.jsx";
import { CopyIcon } from "../components/icons.jsx";

// Step 1 only exposes the join code so the team can start joining.
// Team management, profile and alert preferences are built in step 6.
export function Settings() {
  const { workspace, isAdmin } = useAuth();
  const [copied, setCopied] = useState(false);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(workspace.join_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }

  return (
    <>
      <PageHeader title="Settings" subtitle={workspace?.name} />
      <Card className="max-w-lg p-5">
        <h2 className="font-semibold">Invite your team</h2>
        <p className="mt-1 text-muted">
          Teammates sign up, choose “Join a team”, and enter this code.
          {!isAdmin && " Only admins can manage members."}
        </p>
        <div className="mt-4 flex items-center gap-2">
          <code className="rounded-lg bg-surface-2 px-4 py-2 font-mono text-base tracking-[0.3em]">{workspace?.join_code}</code>
          <button onClick={copyCode} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-muted hover:bg-surface-2 hover:text-ink">
            <CopyIcon className="size-4" />
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </Card>
    </>
  );
}
