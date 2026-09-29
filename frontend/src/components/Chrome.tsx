import { useIncidentIQ } from "@/lib/incidentiq-store";
import type { ReactNode } from "react";

const connLabel = {
  unknown: "○ Service —",
  checking: "◌ Checking",
  online: "● Service online",
  offline: "○ Service offline",
} as const;

/** Top status bar: service reachability + global memory switch. */
export function StatusBar() {
  const { memoryEnabled, setMemoryEnabled, connection, checkConnection } = useIncidentIQ();

  return (
    <header className="rule-b sticky top-0 z-40 bg-background/95 backdrop-blur-[2px]">
      <div className="mx-auto flex max-w-[1180px] items-center justify-between px-6 py-3 sm:px-10">
        <div className="flex items-baseline gap-3">
          <span className="label-tech">IncidentIQ</span>
          <span className="label-tech text-muted-foreground hidden sm:inline">
            SRE Incident Response
          </span>
        </div>
        <div className="flex items-center gap-5">
          <button
            type="button"
            onClick={() => void checkConnection()}
            title="Check the incident service again"
            className={`label-tech transition-colors hover:text-accent ${
              connection === "online"
                ? "text-verified"
                : connection === "offline"
                  ? "text-failed"
                  : "text-muted-foreground"
            }`}
          >
            {connLabel[connection]}
          </button>
          <button
            type="button"
            onClick={() => setMemoryEnabled(!memoryEnabled)}
            aria-pressed={memoryEnabled}
            title={memoryEnabled ? "Recall is on for every request" : "Requests are sent without recall"}
            className="label-tech group flex items-center gap-2 transition-colors hover:text-accent"
          >
            <span className="text-muted-foreground">Memory</span>
            <span className={memoryEnabled ? "text-memory" : "text-muted-foreground"}>
              {memoryEnabled ? "● Active" : "○ Bypassed"}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
}

export function PageHead({
  kicker,
  title,
  intro,
}: {
  kicker: string;
  title: string;
  intro?: string;
}) {
  return (
    <div className="rule-b pt-14 pb-10 sm:pt-20">
      <p className="label-tech text-accent">{kicker}</p>
      <h1 className="editorial mt-5 text-5xl sm:text-[4.25rem]">{title}</h1>
      {intro && <p className="measure mt-6 text-[15px] leading-relaxed text-muted-foreground">{intro}</p>}
    </div>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto max-w-[1180px] px-6 pb-40 sm:px-10">{children}</main>
  );
}

const outcomeClass: Record<string, string> = {
  VERIFIED: "border-verified bg-verified-tint text-verified",
  WORKED: "border-verified bg-verified-tint text-verified",
  TEMPORARY: "border-warning bg-warning-tint text-warning",
  "TEMPORARY MITIGATION": "border-warning bg-warning-tint text-warning",
  FAILED: "border-failed bg-failed-tint text-failed",
};

export function OutcomeTag({ value }: { value: string }) {
  const key = value?.toUpperCase?.() ?? "";
  return (
    <span
      className={`label-tech border px-2 py-[3px] ${
        outcomeClass[key] ?? "border-border bg-secondary text-muted-foreground"
      }`}
    >
      {value}
    </span>
  );
}

/** Shared connection-aware error panel with a retry action. */
export function RequestError({
  title,
  message,
  kind,
  onRetry,
}: {
  title: string;
  message: string;
  kind?: "network" | "http" | "parse" | undefined;
  onRetry?: () => void;
}) {
  return (
    <section className="mt-10 border border-failed bg-failed-tint p-6" role="alert">
      <p className="label-tech text-failed">{title}</p>
      <p className="measure mt-3 text-[15px] leading-relaxed">{message}</p>
      <p className="mt-3 text-[13px] text-muted-foreground">
        {kind === "network"
          ? "Start the service, or set its address in Settings. A local address only works in a browser on the same machine."
          : "The service is reachable but could not complete this request. Nothing was recorded."}
      </p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="label-tech mt-5 border-b border-foreground pb-1 hover:text-accent">
          Try again
        </button>
      )}
    </section>
  );
}
