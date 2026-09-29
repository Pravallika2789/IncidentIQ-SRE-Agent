import { createFileRoute } from "@tanstack/react-router";
import { PageHead, Shell } from "@/components/Chrome";
import { DEFAULT_BACKEND, useIncidentIQ } from "@/lib/incidentiq-store";
import { useState } from "react";

export const Route = createFileRoute("/app/settings")({
  head: () => ({
    meta: [
      { title: "IncidentIQ — Settings" },
      {
        name: "description",
        content: "Service address, connection and memory state for IncidentIQ.",
      },
      { property: "og:title", content: "IncidentIQ — Settings" },
      { property: "og:description", content: "Service address, connection and memory state." },
    ],
  }),
  component: SettingsPage,
});

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="hairline-b grid gap-3 py-5 sm:grid-cols-[12rem_1fr] sm:items-center sm:gap-8">
      <span className="label-tech text-muted-foreground">{label}</span>
      <div>{children}</div>
    </div>
  );
}

function SettingsPage() {
  const {
    backendUrl,
    setBackendUrl,
    memoryEnabled,
    setMemoryEnabled,
    connection,
    connectionMessage,
    checkConnection,
    clearActivity,
  } = useIncidentIQ();
  const [draft, setDraft] = useState(backendUrl);

  return (
    <Shell>
      <PageHead
        kicker="Settings"
        title="Configuration."
        intro="Minimal by design. Credentials are held by the backend and never exposed here."
      />

      <section className="mt-12 border-t border-foreground">
        <Row label="Backend">
          <div className="flex flex-wrap items-center gap-3">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              spellCheck={false}
              className="w-full max-w-md border border-input bg-card px-3 py-2 font-mono text-[13px] outline-none focus:border-accent sm:w-auto sm:min-w-[22rem]"
            />
            <button
              type="button"
              onClick={() => setBackendUrl(draft.trim() || DEFAULT_BACKEND)}
              disabled={draft.trim() === backendUrl}
              className="label-tech border border-foreground px-3 py-2 transition-colors hover:bg-foreground hover:text-primary-foreground disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-foreground"
            >
              Save
            </button>
          </div>
          <p className="mt-2 text-[13px] text-muted-foreground">
            Currently <span className="font-mono">{backendUrl}</span>. A local address only works in
            a browser on the same machine as the service.
          </p>
        </Row>

        <Row label="Memory state">
          <button
            type="button"
            onClick={() => setMemoryEnabled(!memoryEnabled)}
            className="label-tech border border-foreground px-3 py-2 transition-colors hover:bg-foreground hover:text-primary-foreground"
          >
            {memoryEnabled ? "● Active — recall enabled" : "○ Bypassed — no recall"}
          </button>
          <p className="mt-2 text-[13px] text-muted-foreground">
            Sent with every request as <span className="font-mono">memory_enabled</span>.
          </p>
        </Row>

        <Row label="Connection">
          <div className="flex flex-wrap items-center gap-4">
            <span
              className={`label-tech ${
                connection === "online" ? "text-verified" : connection === "offline" ? "text-failed" : "text-muted-foreground"
              }`}
            >
              {connection === "online" ? "● Reachable" : connection === "offline" ? "○ Unreachable" : "◌ Checking"}
            </span>
            <button
              type="button"
              onClick={() => void checkConnection()}
              disabled={connection === "checking"}
              className="label-tech border border-foreground px-3 py-2 transition-colors hover:bg-foreground hover:text-primary-foreground disabled:opacity-35"
            >
              Test connection
            </button>
          </div>
          <p className="mt-2 text-[13px] text-muted-foreground">
            {connectionMessage ?? "Checked on load, on address change, and with every request."}
          </p>
        </Row>

        <Row label="Memory bank">
          <p className="text-[15px]">
            Managed by the backend. Recall and writes are performed server-side.
          </p>
        </Row>

        <Row label="Model">
          <p className="text-[15px]">
            Selected by the backend. The interface does not choose or call a model.
          </p>
        </Row>

        <Row label="Credentials">
          <p className="text-[15px]">Held server-side. Never sent to or stored by this interface.</p>
        </Row>

        <Row label="Local history">
          <button
            type="button"
            onClick={clearActivity}
            className="label-tech border border-foreground px-3 py-2 transition-colors hover:bg-destructive hover:text-destructive-foreground"
          >
            Clear investigation list
          </button>
        </Row>
      </section>
    </Shell>
  );
}
