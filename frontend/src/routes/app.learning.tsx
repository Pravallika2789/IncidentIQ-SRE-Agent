import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHead, Shell, OutcomeTag } from "@/components/Chrome";
import { Reveal, SuccessBar } from "@/components/viz";
import { useIncidentIQ } from "@/lib/incidentiq-store";

export const Route = createFileRoute("/app/learning")({
  head: () => ({
    meta: [
      { title: "IncidentIQ — Learning" },
      {
        name: "description",
        content: "Fix effectiveness, fix drift and a chronological record of what IncidentIQ has learned from outcomes.",
      },
      { property: "og:title", content: "IncidentIQ — Learning" },
      { property: "og:description", content: "What IncidentIQ has learned, in order." },
    ],
  }),
  component: LearningPage,
});

const good = (o: string) => /^(VERIFIED|WORKED)$/i.test(o);

interface Point {
  id: string;
  label: string;
  outcome: string;
  at?: number | undefined;
}

function LearningPage() {
  const { activity, recalled } = useIncidentIQ();
  const recorded = activity.filter((e) => e.outcome);

  const points: Point[] = useMemo(
    () => [
      ...recalled.map((m) => ({
        id: m.incident_id,
        label: m.action,
        outcome: m.outcome,
        at: m.timestamp ? Date.parse(m.timestamp) : undefined,
      })),
      ...recorded.map((e) => ({ id: e.incidentId, label: e.headline, outcome: e.outcome!, at: Date.parse(e.at) })),
    ],
    [recalled, recorded],
  );

  const effectiveness = useMemo(() => {
    const map = new Map<string, { ok: number; n: number }>();
    for (const p of points) {
      const r = map.get(p.label) ?? { ok: 0, n: 0 };
      r.n++;
      if (good(p.outcome)) r.ok++;
      map.set(p.label, r);
    }
    return [...map.entries()].map(([label, r]) => ({ label, ...r, rate: r.ok / r.n })).sort((a, b) => b.rate - a.rate);
  }, [points]);

  const drift = useMemo(() => {
    const by = new Map<string, Point[]>();
    for (const p of points) if (p.at !== undefined && !Number.isNaN(p.at)) by.set(p.label, [...(by.get(p.label) ?? []), p]);
    const out: { label: string; earlier: Point[]; recent: Point[]; e: number; r: number }[] = [];
    for (const [label, ps] of by) {
      if (ps.length < 3) continue;
      ps.sort((a, b) => a.at! - b.at!);
      const k = Math.max(1, Math.floor(ps.length / 3));
      const earlier = ps.slice(0, -k);
      const recent = ps.slice(-k);
      const rate = (xs: Point[]) => xs.filter((x) => good(x.outcome)).length / xs.length;
      const e = rate(earlier);
      const r = rate(recent);
      if (earlier.length >= 2 && e - r >= 0.5) out.push({ label, earlier, recent, e, r });
    }
    return out;
  }, [points]);

  const actions = useMemo(() => {
    const by = new Map<string, Point[]>();
    for (const p of points) by.set(p.label, [...(by.get(p.label) ?? []), p]);
    return [...by.entries()].filter(([, ps]) => ps.length >= 2).map(([label, ps]) => ({
      label,
      ps: [...ps].sort((a, b) => (a.at ?? 0) - (b.at ?? 0)),
    }));
  }, [points]);
  const [pick, setPick] = useState<string | null>(null);
  const picked = actions.find((a) => a.label === (pick ?? actions[0]?.label));

  return (
    <Shell>
      <PageHead
        kicker="Learning"
        title="What IncidentIQ has learned."
        intro="Built only from memories recalled during analyses and outcomes recorded from this workstation. Nothing here is estimated."
      />

      {/* Fix effectiveness */}
      <section className="mt-12">
        <div className="flex items-baseline justify-between">
          <h2 className="label-tech">Fix effectiveness</h2>
          <span className="label-tech text-muted-foreground">{points.length} outcomes</span>
        </div>
        {points.length < 2 ? (
          <p className="mt-6 border-t border-foreground pt-6 text-[15px] text-muted-foreground">
            Not enough recorded outcomes to calculate fix effectiveness.
          </p>
        ) : (
          <ol className="mt-6 border-t border-foreground">
            {effectiveness.map((f, i) => (
              <Reveal as="li" key={f.label} delay={i * 60} className="hairline-b grid gap-3 py-4 sm:grid-cols-[16rem_1fr_7rem] sm:items-center sm:gap-6">
                <span className="font-mono text-[13px]">{f.label}</span>
                <SuccessBar value={f.rate} tone={f.rate >= 0.6 ? "accent" : f.rate > 0 ? "warning" : "failed"} />
                <span className="label-tech text-right text-muted-foreground">
                  {Math.round(f.rate * 100)}% · {f.ok}/{f.n}
                </span>
              </Reveal>
            ))}
          </ol>
        )}
      </section>

      {/* Fix drift */}
      <section className="mt-20">
        <h2 className="label-tech">Fix drift</h2>
        <p className="measure mt-3 text-[14px] text-muted-foreground">
          A fix that worked previously can become less effective as the system changes.
        </p>
        {drift.length === 0 ? (
          <p className="mt-6 border-t border-foreground pt-6 text-[15px] text-muted-foreground">
            Not enough recorded outcomes to detect fix drift.
          </p>
        ) : (
          <div className="mt-6 grid gap-12 border-t border-foreground pt-8">
            {drift.map((d) => (
              <Reveal key={d.label} className="grid gap-8 lg:grid-cols-[58%_42%] lg:gap-16">
                <div>
                  <p className="font-mono text-[15px]">{d.label}</p>
                  <div className="mt-6 space-y-5">
                    <div>
                      <div className="flex justify-between"><span className="label-tech text-muted-foreground">Historical effectiveness</span><span className="label-tech">{Math.round(d.e * 100)}% · {d.earlier.length}</span></div>
                      <div className="mt-2"><SuccessBar value={d.e} /></div>
                    </div>
                    <div>
                      <div className="flex justify-between"><span className="label-tech text-muted-foreground">Recent effectiveness</span><span className="label-tech">{Math.round(d.r * 100)}% · {d.recent.length}</span></div>
                      <div className="mt-2"><SuccessBar value={d.r} tone={d.r > 0 ? "warning" : "failed"} /></div>
                    </div>
                  </div>
                  <p className="label-tech mt-6 inline-block border border-accent px-2 py-1 text-accent">↓ Drift detected</p>
                </div>
                <div className="grid grid-cols-2 gap-6 border-t border-foreground pt-4">
                  {([["Earlier", d.earlier], ["Recent", d.recent]] as const).map(([h, xs]) => (
                    <div key={h}>
                      <p className="label-tech text-muted-foreground">{h}</p>
                      <ul className="mt-3 space-y-2">
                        {xs.map((x, i) => (
                          <li key={x.id + i} className="flex flex-wrap items-center gap-2 font-mono text-[12px]">{x.id} → <OutcomeTag value={x.outcome} /></li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </Reveal>
            ))}
          </div>
        )}
      </section>

      {/* Action history */}
      {picked && (
        <section className="mt-20">
          <h2 className="label-tech">Action history</h2>
          <div className="mt-6 flex flex-wrap gap-2 border-t border-foreground pt-6">
            {actions.map((a) => (
              <button key={a.label} type="button" onClick={() => setPick(a.label)}
                className={`label-tech border px-3 py-1 transition-colors ${a.label === picked.label ? "border-foreground bg-foreground text-primary-foreground" : "border-input text-muted-foreground hover:border-foreground hover:text-foreground"}`}>
                {a.label}
              </button>
            ))}
          </div>
          <ol className="mt-6 border-t border-foreground">
            {picked.ps.map((p, i) => (
              <li key={p.id + i} className="hairline-b grid grid-cols-[6rem_1fr_auto] items-center gap-4 py-3">
                <span className="label-tech text-muted-foreground">{p.at ? new Date(p.at).toLocaleDateString() : "—"}</span>
                <span className="font-mono text-[13px] text-accent">{p.id}</span>
                <OutcomeTag value={p.outcome} />
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* Timeline */}
      <section className="mt-20">
        <h2 className="label-tech">Timeline</h2>
        {recorded.length === 0 ? (
          <p className="measure mt-6 border-t border-foreground pt-6 text-[15px] leading-relaxed text-muted-foreground">
            Nothing recorded yet. Mark a recommendation as worked or failed during an investigation and
            it appears here.
          </p>
        ) : (
          <ol className="mt-6 border-t border-foreground pt-6">
            {[...recorded].reverse().map((e) => (
              <Reveal as="li" key={e.at + e.headline} className="relative grid grid-cols-[4.5rem_1.5rem_1fr] pb-10">
                <span className="label-tech pt-1 text-muted-foreground">
                  {new Date(e.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
                <span className="relative flex justify-center">
                  <span className="absolute top-3 bottom-[-2.5rem] w-px bg-foreground" />
                  <span className="relative mt-1 size-2 bg-accent" />
                </span>
                <div>
                  <p className="label-tech text-accent">
                    {e.incidentId}
                  </p>
                  <p className="mt-1 font-mono text-[12px] text-muted-foreground">{e.service}</p>
                  <p aria-hidden className="text-muted-foreground">↓</p>
                  <p className="font-mono text-[14px]">{e.headline}</p>
                  <p aria-hidden className="text-muted-foreground">↓</p>
                  <div><OutcomeTag value={e.outcome!} /></div>
                  <p aria-hidden className="text-muted-foreground">↓</p>
                  <p className="label-tech text-memory">Lesson retained</p>
                  <p className="mt-1 text-[14px] text-muted-foreground">
                    {e.headline} recorded as {e.outcome} for {e.service}.
                  </p>
                </div>
              </Reveal>
            ))}
          </ol>
        )}
      </section>
    </Shell>
  );
}
