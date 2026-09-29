import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { OutcomeTag, PageHead, RequestError, Shell } from "@/components/Chrome";
import { Reveal } from "@/components/viz";
import { useIncidentIQ } from "@/lib/incidentiq-store";
import { ApiError, predeploy } from "@/lib/incidentiq-api";
import type { PredeployResult } from "@/lib/incidentiq-types";

export const Route = createFileRoute("/app/predeploy")({
  head: () => ({
    meta: [
      { title: "IncidentIQ — Pre-deploy risk review" },
      {
        name: "description",
        content:
          "Review a proposed change against the incidents, fixes and outcomes your team has already recorded.",
      },
      { property: "og:title", content: "IncidentIQ — Pre-deploy risk review" },
      {
        property: "og:description",
        content: "Weigh a proposed change against recorded operational experience.",
      },
    ],
  }),
  component: Predeploy,
});

const riskTone = (level: string) => {
  const l = level?.toUpperCase?.() ?? "";
  if (l === "LOW") return "text-verified";
  if (l === "HIGH" || l === "CRITICAL") return "text-failed";
  return "text-warning";
};

function Predeploy() {
  const { backendUrl, memoryEnabled, recalled } = useIncidentIQ();
  const knownOutcome = (id: string) => recalled.find((m) => m.incident_id === id)?.outcome;
  const [service, setService] = useState("payments-api");
  const [change, setChange] = useState("Increase connection pool 50 → 100");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [result, setResult] = useState<PredeployResult | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const data = await predeploy(backendUrl, { service, change, memory_enabled: memoryEnabled });
      setResult(data);
    } catch (e) {
      setError(e instanceof ApiError ? e : new ApiError("Risk review failed.", "parse"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell>
      <PageHead
        kicker="Pre-deploy / Risk review"
        title="Weigh the change against what happened before."
        intro="A proposed change is reviewed against previous incidents with the same shape: what was tried, what held, and what only bought time."
      />

      <section className="grid gap-12 pt-12 lg:grid-cols-[58%_42%] lg:gap-16">
        <div className="space-y-8">
          <label className="block">
            <span className="label-tech text-muted-foreground">Service</span>
            <input
              value={service}
              onChange={(e) => setService(e.target.value)}
              spellCheck={false}
              className="mt-3 w-full border-b border-input bg-transparent pb-2 font-mono text-[15px] outline-none focus:border-accent"
            />
          </label>
          <label className="block">
            <span className="label-tech text-muted-foreground">Proposed change</span>
            <textarea
              value={change}
              onChange={(e) => setChange(e.target.value)}
              rows={3}
              className="mt-3 w-full border border-input bg-card p-3 text-[15px] leading-relaxed outline-none focus:border-accent"
            />
          </label>
          <button
            type="button"
            onClick={run}
            disabled={busy || !service.trim() || !change.trim()}
            className="btn-primary"
          >
            {busy ? "Reviewing…" : "Analyze risk"}
          </button>
        </div>

        <aside className="lg:pt-2">
          <p className="measure text-[13px] leading-relaxed text-muted-foreground">
            Memory {memoryEnabled ? "active" : "bypassed"}
. With memory bypassed the review has no precedent to draw
            on and the result reflects that.
          </p>
        </aside>
      </section>

      {error && (
        <RequestError title="Risk review failed" message={error.message} kind={error.kind} onRetry={run} />
      )}

      {result && (
        <div className="animate-in fade-in duration-700">
          <section className="rule-t mt-16 pt-10">
            <p className="label-tech text-muted-foreground">Risk assessment</p>
            <div className="mt-4 flex items-baseline gap-6">
              <p className={`editorial text-[5rem] leading-none ${riskTone(result.risk_level)}`}>
                {result.risk_level}
              </p>
              <p className="font-mono text-[18px] text-muted-foreground">
                {typeof result.risk_score === "number" ? result.risk_score.toFixed(2) : "—"}
              </p>
            </div>
            {typeof result.risk_score === "number" && <RiskScale score={result.risk_score} />}
          </section>

          <section className="mt-16 grid gap-10 lg:grid-cols-[58%_42%] lg:gap-16">
            <div>
              <h2 className="label-tech text-accent">Supported by previous experience</h2>
              {result.supporting_incidents?.length ? (
                <ol className="mt-6 border-t border-foreground">
                  {result.supporting_incidents.map((id, i) => {
                    const o = knownOutcome(id);
                    return (
                      <Reveal as="li" key={id} delay={i * 80} className="hairline-b flex items-baseline justify-between py-4">
                        <span className="label-tech text-accent">{id}</span>
                        {o ? <OutcomeTag value={o} /> : <span className="label-tech text-muted-foreground">Outcome not returned</span>}
                      </Reveal>
                    );
                  })}
                </ol>
              ) : (
                <p className="mt-6 border-t border-foreground pt-6 text-[15px] text-muted-foreground">No precedent recalled.</p>
              )}
            </div>
            {(
              <div>
                <h2 className="label-tech">Related deployments</h2>
                {!result.related_deployments?.length ? (
                  <p className="mt-6 border-t border-foreground pt-6 text-[15px] text-muted-foreground">No matching deployment history found.</p>
                ) : (
                  <ol className="mt-6 border-t border-foreground">
                    {result.related_deployments.map((d, i) => (
                      <li key={(d.id ?? "") + i} className="hairline-b flex items-baseline justify-between gap-4 py-4">
                        <span className="text-[14px]">
                          {d.id && <span className="label-tech mr-3 text-accent">{d.id}</span>}
                          {d.summary}
                        </span>
                        {d.outcome && <OutcomeTag value={d.outcome} />}
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            )}
          </section>

          <section className="mt-16">
            <h2 className="label-tech">Safeguards</h2>
            <ol className="mt-6 border-t border-foreground">
              {(result.safeguards ?? []).map((s, i) => (
                <Reveal
                  as="li"
                  key={s}
                  delay={i * 60}
                  className="hairline-b flex items-baseline gap-6 py-4 text-[15px]"
                >
                  <span className="label-tech text-muted-foreground">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {s}
                </Reveal>
              ))}
            </ol>
          </section>
        </div>
      )}
    </Shell>
  );
}

/** Thin 0–1 scale; the marker travels from 0 to the returned score. */
function RiskScale({ score }: { score: number }) {
  const v = Math.max(0, Math.min(1, score));
  const [pos, setPos] = useState(0);
  useEffect(() => {
    const t = requestAnimationFrame(() => setPos(v));
    return () => cancelAnimationFrame(t);
  }, [v]);
  return (
    <div className="mt-10 max-w-xl" aria-label={`Risk score ${v.toFixed(2)} of 1`}>
      <div className="relative h-8">
        <div className="absolute inset-x-0 top-1/2 h-px bg-foreground" />
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <span key={t} className="absolute top-1/2 h-2 w-px -translate-y-1/2 bg-border" style={{ left: `${t * 100}%` }} />
        ))}
        <span
          className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent transition-[left] duration-1000 ease-out motion-reduce:transition-none"
          style={{ left: `${pos * 100}%` }}
        />
      </div>
      <div className="relative mt-1 h-4 font-mono text-[11px] text-muted-foreground">
        <span className="absolute left-0">0</span>
        <span className="absolute -translate-x-1/2 text-accent transition-[left] duration-1000 ease-out" style={{ left: `${pos * 100}%` }}>
          {v.toFixed(2)}
        </span>
        <span className="absolute right-0">1</span>
      </div>
    </div>
  );
}
