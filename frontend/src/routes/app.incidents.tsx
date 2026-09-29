import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHead, RequestError, Shell } from "@/components/Chrome";
import { useIncidentIQ } from "@/lib/incidentiq-store";
import { ApiError, submitOutcome, triage } from "@/lib/incidentiq-api";
import { EvidenceGraph } from "@/components/EvidenceGraph";
import { Reveal, SuccessBar, norm } from "@/components/viz";
import type { Recommendation, TriageResult } from "@/lib/incidentiq-types";

export const Route = createFileRoute("/app/incidents")({
  head: () => ({
    meta: [
      { title: "IncidentIQ — Incident triage" },
      {
        name: "description",
        content:
          "Investigation workspace: describe the incident, recall comparable history, and act on evidence-backed recommendations.",
      },
      { property: "og:title", content: "IncidentIQ — Incident triage" },
      {
        property: "og:description",
        content: "Describe the incident, recall comparable history, act on the evidence.",
      },
    ],
  }),
  component: Incidents,
});

const SEVERITIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const;

const PRESETS = [
  {
    name: "DB connection pool",
    service: "payments-api",
    severity: "CRITICAL",
    alert: "HTTP 503 surge",
    logs: "connection pool exhausted; timeout acquiring connection from pool (size=50)",
  },
  {
    name: "Redis failure",
    service: "session-api",
    severity: "HIGH",
    alert: "Cache unavailable",
    logs: "redis: connection refused; falling back to database reads; p99 latency 2.4s",
  },
  {
    name: "Auth failure",
    service: "auth-gateway",
    severity: "CRITICAL",
    alert: "HTTP 401 spike",
    logs: "token validation failed: signing key mismatch after key rotation",
  },
  {
    name: "Certificate expiry",
    service: "edge-proxy",
    severity: "HIGH",
    alert: "TLS handshake failures",
    logs: "x509: certificate has expired or is not yet valid",
  },
] as const;

const STAGES = [
  "Recalling memory",
  "Analysing incident",
  "Connecting evidence",
  "Recommendation ready",
] as const;

const pct = (v?: number) =>
  v === undefined || v === null ? "—" : `${Math.round(v <= 1 ? v * 100 : v)}%`;

function Incidents() {
  const { backendUrl, memoryEnabled, logActivity, logRecalled, activity } = useIncidentIQ();

  const [service, setService] = useState("payments-api");
  const [severity, setSeverity] = useState<string>("CRITICAL");
  const [alert, setAlert] = useState("HTTP 503 surge");
  const [logs, setLogs] = useState("Database connection pool exhausted.");

  const [stage, setStage] = useState(-1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [result, setResult] = useState<TriageResult | null>(null);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [sentMemory, setSentMemory] = useState(memoryEnabled);

  const [outcomeBusy, setOutcomeBusy] = useState<string | null>(null);
  const [outcomeError, setOutcomeError] = useState<ApiError | null>(null);
  const [retained, setRetained] = useState<{ recommendation: string; result: string } | null>(null);
  const [phase, setPhase] = useState<{ title: string; verdict: string; step: number } | null>(null);

  async function analyse() {
    setBusy(true);
    setError(null);
    setResult(null);
    setRetained(null);
    setOutcomeError(null);
    setStage(0);
    setStartedAt(new Date().toISOString());
    setSentMemory(memoryEnabled);

    const advance = [
      setTimeout(() => setStage(1), 450),
      setTimeout(() => setStage(2), 900),
    ];

    try {
      const body = { service, severity, alert, logs, memory_enabled: memoryEnabled };
      const data = await triage(backendUrl, body);
      setStage(3);
      setResult(data);
      if (data.evidence?.length) {
        const now = new Date().toISOString();
        logRecalled(
          data.evidence.map((m) => ({ ...m, recalledBy: data.incident_id, recalledAt: now })),
        );
      }
      logActivity({
        at: new Date().toISOString(),
        incidentId: data.incident_id,
        service: data.service,
        severity: data.severity,
        headline: data.root_cause || data.summary,
      });
    } catch (e) {
      setStage(-1);
      setError(e instanceof ApiError ? e : new ApiError("Analysis failed. The incident was not recorded.", "parse"));
    } finally {
      advance.forEach(clearTimeout);
      setBusy(false);
    }
  }

  async function record(
  rec: Recommendation,
  verdict: "WORKED" | "FAILED",
) {
  if (!result) return;

  const title = rec.title;

  setOutcomeBusy(`${title}:${verdict}`);
  setOutcomeError(null);
  setRetained(null);

  setPhase({
    title,
    verdict,
    step: 0,
  });

  try {
    await submitOutcome(backendUrl, {
      incident_id: result.incident_id,
      service: result.service,
      action: title,
      outcome: verdict,
      notes: `Engineer marked the recommendation as ${verdict}.`,
    });

    setPhase({
      title,
      verdict,
      step: 1,
    });

    await new Promise((resolve) =>
      setTimeout(resolve, 450),
    );

    setPhase({
      title,
      verdict,
      step: 2,
    });

    setRetained({
      recommendation: title,
      result: verdict,
    });

    /*
     * Keep the local Learning dashboard in sync
     * immediately after the backend successfully
     * records the outcome.
     */
    logActivity({
      at: new Date().toISOString(),
      incidentId: result.incident_id,
      service: result.service,
      severity: result.severity,
      headline: title,
      outcome: verdict,
    });
  } catch (e) {
    setPhase(null);

    setOutcomeError(
      e instanceof ApiError
        ? e
        : new ApiError(
            "The outcome could not be recorded. Memory unchanged.",
            "parse",
          ),
    );
  } finally {
    setOutcomeBusy(null);
  }
}

  return (
    <Shell>
      <PageHead
        kicker="Incident / Triage"
        title="Investigation workspace."
        intro="Describe what is happening now. IncidentIQ recalls comparable incidents your team has already resolved and grounds every recommendation in that record."
      />

      {/* ---------- Input ---------- */}
      <section className="grid gap-12 pt-12 lg:grid-cols-[58%_42%] lg:gap-16">
        <div>
          <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
            <Field label="Service">
              <input
                value={service}
                onChange={(e) => setService(e.target.value)}
                spellCheck={false}
                className="w-full border-b border-input bg-transparent pb-2 font-mono text-[15px] outline-none focus:border-accent"
              />
            </Field>
            <Field label="Severity">
              <div className="flex flex-wrap gap-2">
                {SEVERITIES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSeverity(s)}
                    className={`label-tech border px-2 py-1 transition-colors ${
                      severity === s
                        ? "border-foreground bg-foreground text-primary-foreground"
                        : "border-input text-muted-foreground hover:border-foreground hover:text-foreground"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </Field>
            <div className="sm:col-span-2">
              <Field label="Alert">
                <input
                  value={alert}
                  onChange={(e) => setAlert(e.target.value)}
                  className="w-full border-b border-input bg-transparent pb-2 text-[15px] outline-none focus:border-accent"
                />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Logs / Observations">
                <textarea
                  value={logs}
                  onChange={(e) => setLogs(e.target.value)}
                  rows={5}
                  spellCheck={false}
                  className="w-full border border-input bg-card p-3 font-mono text-[13px] leading-relaxed outline-none focus:border-accent"
                />
              </Field>
            </div>
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-6">
            <button
              type="button"
              onClick={analyse}
              disabled={busy || !service.trim() || !alert.trim()}
              className="btn-primary"
            >
              {busy ? "Analysing…" : "Analyze incident"}
            </button>
            <span className="label-tech text-muted-foreground">
              Memory {memoryEnabled ? "● active" : "○ bypassed"}
            </span>
          </div>
        </div>

        <aside className="lg:pt-2">
          <p className="label-tech text-muted-foreground">Quick presets</p>
          <ul className="mt-4 border-t border-foreground">
            {PRESETS.map((p) => (
              <li key={p.name}>
                <button
                  type="button"
                  onClick={() => {
                    setService(p.service);
                    setSeverity(p.severity);
                    setAlert(p.alert);
                    setLogs(p.logs);
                  }}
                  className="hairline-b group flex w-full items-baseline justify-between gap-4 py-4 text-left transition-colors hover:text-accent"
                >
                  <span className="text-[15px]">{p.name}</span>
                  <span className="label-tech text-muted-foreground group-hover:text-accent">
                    {p.service}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </aside>
      </section>

      {/* ---------- Sequence ---------- */}
      {stage >= 0 && (
        <section className="rule-t mt-16 pt-6" aria-live="polite">
          <div className="flex items-baseline justify-between">
            <p className="label-tech text-accent">{STAGES[stage]}</p>
            <p className="label-tech text-muted-foreground">
              {String(stage + 1).padStart(2, "0")} / {String(STAGES.length).padStart(2, "0")}
            </p>
          </div>
          <div className="relative mt-3 h-px w-full bg-border">
            <div
              className="absolute inset-y-0 left-0 h-px bg-foreground transition-[width] duration-500 ease-out motion-reduce:transition-none"
              style={{ width: `${((stage + 1) / STAGES.length) * 100}%` }}
            />
          </div>
        </section>
      )}

      {error && (
        <RequestError title="Analysis failed" message={error.message} kind={error.kind} onRetry={analyse} />
      )}

      {/* ---------- Result ---------- */}
      {result && (
        <div className="animate-in fade-in duration-700">
          <section className="rule-t mt-12 pt-10">
            <div className="grid gap-x-8 gap-y-6 sm:grid-cols-3">
              <Meta label="Incident ID" value={result.incident_id} mono />
              <Meta label="Service" value={result.service} mono />
              <Meta label="Severity" value={result.severity} />
            </div>

            <div className="mt-12 grid gap-12 lg:grid-cols-[58%_42%] lg:gap-16">
              <div>
                <p className="label-tech text-muted-foreground">Incident summary</p>
                <p className="mt-4 text-[17px] leading-relaxed">{result.summary}</p>
              </div>
              <div className="border-t border-foreground pt-5">
                <p className="label-tech text-accent">Likely root cause</p>
                <p className="editorial mt-4 text-[1.85rem]">{result.root_cause}</p>
                {startedAt && (
                  <p className="label-tech mt-6 text-muted-foreground">
                    Confidence {pct(result.confidence)} · analysed{" "}
                    {new Date(startedAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                )}
              </div>
            </div>
          </section>

          <ReasoningPath memory={sentMemory} recalled={result.evidence?.length ?? 0} />

          {/* Evidence graph */}
          <section className="mt-16">
            <div className="flex items-baseline justify-between">
              <h2 className="label-tech">Historical evidence</h2>
              <span className="label-tech text-muted-foreground">
                {result.evidence?.length ?? 0} recalled
              </span>
            </div>
            {result.evidence?.length ? (
              <EvidenceGraph result={result} alert={alert} />
            ) : (
              <p className="measure mt-6 border-t border-foreground pt-6 text-[15px] text-muted-foreground">
                {memoryEnabled
                  ? "No comparable incidents were recalled. This appears to be a first occurrence."
                  : "Memory is bypassed, so no history was recalled for this analysis."}
              </p>
            )}
          </section>

          {/* Ranked recommendations */}
          <section className="mt-20">
            <h2 className="label-tech">Recommendations, ranked</h2>
            <ol className="mt-6 border-t border-foreground">
              {result.recommendations?.map((rec, i) => {
                const hs = norm(rec.historical_success);
                const temporary =
                  hs === 0 &&
                  (rec.evidence ?? []).some((id) =>
                    result.evidence?.some((m) => m.incident_id === id && /TEMP/i.test(m.outcome)),
                  );
                const mine = phase?.title === rec.title;
                return (
                  <Reveal as="li" key={rec.title + i} className="hairline-b grid gap-8 py-10 lg:grid-cols-[58%_42%] lg:gap-16">
                    <div>
                      <p className="label-tech text-accent">
                        Recommendation / {String(rec.index ?? i + 1).padStart(2, "0")}
                      </p>
                      <h3 className="editorial mt-4 text-[2.1rem]">{rec.title}</h3>
                      {rec.change && (
                        <p className="mt-3 font-mono text-[15px] text-muted-foreground">{rec.change}</p>
                      )}
                      {temporary && (
                        <p className="label-tech mt-4 inline-block border border-warning bg-warning-tint px-2 py-[3px] text-warning">
                          Temporary mitigation
                        </p>
                      )}
                      {rec.why && <p className="measure mt-6 text-[15px] leading-relaxed">{rec.why}</p>}

                      <div className="mt-8 flex flex-wrap items-center gap-3">
                        {(["WORKED", "FAILED"] as const).map((v) => (
                          <button
                            key={v}
                            type="button"
                            onClick={() => record(rec, v)}
                            disabled={outcomeBusy !== null}
                            className={`label-tech border px-4 py-2 transition-all hover:-translate-y-[2px] active:translate-y-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:translate-y-0 disabled:opacity-40 ${
                              v === "WORKED"
                                ? "border-verified text-verified hover:bg-verified hover:text-primary-foreground"
                                : "border-failed text-failed hover:bg-failed hover:text-primary-foreground"
                            }`}
                          >
                            {outcomeBusy === `${rec.title}:${v}` ? "Recording…" : v}
                          </button>
                        ))}
                      </div>

                      {mine && phase && (
                        <ol className="label-tech mt-5 flex flex-wrap items-center gap-x-3 gap-y-2" aria-live="polite">
                          {[phase.verdict, "Outcome recorded", "Lesson retained"].map((s, k) => (
                            <li
                              key={s}
                              className={`flex items-center gap-3 transition-opacity duration-300 ${
                                k <= phase.step ? "opacity-100" : "opacity-25"
                              } ${k === 2 && phase.step >= 2 ? "text-memory" : ""}`}
                            >
                              {k > 0 && <span className="text-muted-foreground">→</span>}
                              {s}
                            </li>
                          ))}
                        </ol>
                      )}
                    </div>

                    <dl className="border-t border-foreground">
                      {(() => {
                        const ids = new Set(rec.evidence ?? []);
                        const outs = [
                          ...(result.evidence ?? []).filter((m) => ids.has(m.incident_id)).map((m) => m.outcome),
                          ...activity.filter((a) => a.outcome && a.headline === rec.title).map((a) => a.outcome!),
                        ];
                        const n = outs.length;
                        const ok = outs.filter((o) => /^(VERIFIED|WORKED)$/i.test(o)).length;
                        const rate = n ? ok / n : 0;
                        return (
                          <div className="hairline-b py-4">
                            <div className="flex items-baseline justify-between">
                              <dt className="label-tech text-muted-foreground">Historical effectiveness</dt>
                              <dd className="editorial text-[1.75rem]">{n >= 2 ? `${Math.round(rate * 100)}%` : "—"}</dd>
                            </div>
                            {n >= 2 && (
                              <div className="mt-3">
                                <SuccessBar value={rate} tone={rate >= 0.6 ? "accent" : rate > 0 ? "warning" : "failed"} />
                              </div>
                            )}
                            <p className="label-tech mt-3 text-muted-foreground">
                              {n === 0
                                ? "No recorded outcomes"
                                : `${ok} successful / ${n} recorded${n < 2 ? " · insufficient evidence" : ""}`}
                            </p>
                            {hs !== undefined && (
                              <p className="label-tech mt-1 text-muted-foreground">Service-reported success {pct(rec.historical_success)}</p>
                            )}
                          </div>
                        );
                      })()}
                      {rec.confidence !== undefined && <Stat label="Confidence" value={pct(rec.confidence)} />}
                      <div className="hairline-b py-4">
                        <dt className="label-tech text-muted-foreground">Evidence</dt>
                        <dd className="label-tech mt-2 flex flex-wrap gap-2 text-accent">
                          {rec.evidence?.length
                            ? rec.evidence.map((id) => (
                                <span key={id} className="border border-border px-2 py-1">{id}</span>
                              ))
                            : "None recalled"}
                        </dd>
                      </div>
                    </dl>
                  </Reveal>
                );
              })}
            </ol>
          </section>

          {outcomeError && (
            <RequestError title="Outcome not recorded" message={`${outcomeError.message} Memory was not updated.`} kind={outcomeError.kind} />
          )}

          {retained && (
            <section className="animate-in fade-in slide-in-from-bottom-2 mt-14 border border-memory bg-memory-tint p-8 duration-700">
              <p className="label-tech text-memory">Lesson retained</p>
              <p className="editorial mt-4 text-[2rem]">Memory updated.</p>
              <p className="measure mt-4 text-[15px] leading-relaxed">
                <span className="font-mono text-[14px]">{retained.recommendation}</span> was recorded
                as <span className="font-mono text-[14px]">{retained.result}</span> for{" "}
                <span className="font-mono text-[14px]">{result.incident_id}</span>. Future
                investigations of this pattern will carry that result.
              </p>
            </section>
          )}
        </div>
      )}
    </Shell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label-tech text-muted-foreground">{label}</span>
      <span className="mt-3 block">{children}</span>
    </label>
  );
}

function Meta({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="border-t border-foreground pt-3">
      <p className="label-tech text-muted-foreground">{label}</p>
      <p className={`mt-2 text-[15px] ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="hairline-b flex items-baseline justify-between py-4">
      <dt className="label-tech text-muted-foreground">{label}</dt>
      <dd className="editorial text-[1.75rem]">{value}</dd>
    </div>
  );
}

/** Reflects the memory_enabled value actually sent with this analysis. */
function ReasoningPath({ memory, recalled }: { memory: boolean; recalled: number }) {
  const steps = memory
    ? [
        { l: "Current incident", on: true, mem: false },
        { l: "Hindsight recall", on: true, mem: true },
        { l: `Historical evidence · ${recalled}`, on: true, mem: true },
        { l: "Recommendation", on: true, mem: false },
      ]
    : [
        { l: "Current incident", on: true, mem: false },
        { l: "No historical recall", on: false, mem: false },
        { l: "Current analysis", on: true, mem: false },
        { l: "Recommendation", on: true, mem: false },
      ];
  return (
    <section className="mt-16" aria-label="Reasoning path">
      <div className="flex items-baseline justify-between">
        <h2 className="label-tech">Reasoning path</h2>
        <span className={`label-tech ${memory ? "text-memory" : "text-muted-foreground"}`}>
          memory_enabled = {String(memory)}
        </span>
      </div>
      <ol className="mt-6 flex flex-col gap-2 border-t border-foreground pt-6 sm:flex-row sm:items-center sm:gap-0">
        {steps.map((s, i) => (
          <li key={s.l} className="iq-rise flex items-center gap-3 sm:flex-1" style={{ animationDelay: `${i * 140}ms` }}>
            <span
              className={`label-tech border px-3 py-2 ${
                !s.on
                  ? "border-dashed border-border text-muted-foreground line-through"
                  : s.mem
                    ? "border-memory bg-memory-tint text-memory"
                    : "border-foreground"
              }`}
            >
              {s.l}
            </span>
            {i < steps.length - 1 && (
              <span aria-hidden className={`hidden h-px flex-1 sm:block ${steps[i + 1]!.on ? "bg-foreground" : "border-t border-dashed border-border"}`} />
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
