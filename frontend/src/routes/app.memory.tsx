import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { OutcomeTag, PageHead, Shell } from "@/components/Chrome";
import { Reveal } from "@/components/viz";
import { useIncidentIQ, type RecalledMemory } from "@/lib/incidentiq-store";

export const Route = createFileRoute("/app/memory")({
  head: () => ({
    meta: [
      { title: "IncidentIQ — Memory explorer" },
      {
        name: "description",
        content: "Browse the memories IncidentIQ recalled during your investigations and how they connect.",
      },
      { property: "og:title", content: "IncidentIQ — Memory explorer" },
      { property: "og:description", content: "Explore what IncidentIQ remembers." },
    ],
  }),
  component: MemoryPage,
});

const keyOf = (m: RecalledMemory) => `${m.incident_id}|${m.action}`;

function MemoryPage() {
  const { recalled } = useIncidentIQ();
  const [selected, setSelected] = useState<string | null>(null);
  const sel = recalled.find((m) => keyOf(m) === selected) ?? null;

  const related = useMemo(
    () =>
      sel
        ? recalled.filter(
            (m) => keyOf(m) !== keyOf(sel) && (m.service === sel.service || m.action === sel.action),
          )
        : [],
    [sel, recalled],
  );

  return (
    <Shell>
      <PageHead
        kicker="Memory"
        title="Explore what IncidentIQ remembers."
        intro="The backend exposes memory through incident analysis and pre-deploy retrieval. Every memory recalled during an analysis on this workstation is archived here, exactly as it was returned."
      />

      {recalled.length === 0 ? (
        <section className="mt-12 border-t border-foreground pt-8">
          <p className="label-tech text-accent">Memory explorer</p>
          <p className="measure mt-4 text-[15px] leading-relaxed">
            Direct memory browsing is not available yet. Run an incident analysis and the memories it
            recalls will be archived here.
          </p>
          <Link to="/app/incidents" className="btn-primary mt-8 inline-block">
            Go to incident triage
          </Link>
        </section>
      ) : (
        <>
          {sel && (
            <section className="mt-12 grid gap-8 border-t border-foreground pt-8 lg:grid-cols-[42%_58%]">
              <div>
                <p className="label-tech text-accent">Connected memory</p>
                <p className="editorial mt-3 text-[2rem]">{sel.incident_id}</p>
                <p className="mt-2 font-mono text-[14px] text-muted-foreground">
                  {sel.service} · {sel.action}
                </p>
                <p className="mt-4 text-[13px] text-muted-foreground">
                  {related.length
                    ? `${related.length} related by shared service or action.`
                    : "No other archived memory shares this service or action."}
                </p>
                <button type="button" onClick={() => setSelected(null)} className="label-tech mt-6 border-b border-foreground pb-1">
                  Clear selection
                </button>
              </div>
              <MemoryGraph key={selected} sel={sel} related={related} onPick={(m) => setSelected(keyOf(m))} />
            </section>
          )}

          <section className="mt-12">
            <div className="flex items-baseline justify-between">
              <h2 className="label-tech">Archive</h2>
              <span className="label-tech text-muted-foreground">{recalled.length} memories</span>
            </div>
            <div className="mt-6 columns-1 gap-4 sm:columns-2 lg:columns-3">
              {recalled.map((m, i) => {
                const active = keyOf(m) === selected;
                return (
                  <Reveal key={keyOf(m)} delay={(i % 6) * 50} className="mb-4 break-inside-avoid">
                    <button
                      type="button"
                      onClick={() => setSelected(active ? null : keyOf(m))}
                      aria-pressed={active}
                      className={`block w-full border bg-card p-5 text-left transition-all hover:-translate-y-[2px] focus-visible:outline-2 focus-visible:outline-accent ${
                        active ? "border-accent" : "border-border hover:border-foreground"
                      }`}
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <span className={`label-tech ${active ? "text-accent" : ""}`}>{m.incident_id}</span>
                        <span className="label-tech text-muted-foreground">{m.type ?? "Memory"}</span>
                      </div>
                      <p className="mt-3 font-mono text-[12px] text-muted-foreground">{m.service}</p>
                      {(m.summary || m.detail) && (
                        <p className="mt-3 text-[14px] leading-relaxed">{m.summary ?? m.detail}</p>
                      )}
                      <p className="mt-4 font-mono text-[14px]">{m.action}</p>
                      <div className="mt-4 flex items-center justify-between gap-3">
                        <OutcomeTag value={m.outcome} />
                        <span className="font-mono text-[11px] text-muted-foreground">
                          {m.timestamp
                            ? new Date(m.timestamp).toLocaleString()
                            : `recalled by ${m.recalledBy}`}
                        </span>
                      </div>
                    </button>
                  </Reveal>
                );
              })}
            </div>
          </section>
        </>
      )}
    </Shell>
  );
}

function MemoryGraph({
  sel,
  related,
  onPick,
}: {
  sel: RecalledMemory;
  related: RecalledMemory[];
  onPick: (m: RecalledMemory) => void;
}) {
  const W = 520;
  const H = 280;
  const cx = W / 2;
  const cy = H / 2;
  const nodes = [sel, ...related].slice(0, 8);
  const r = 110;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`${sel.incident_id} and related memories`}>
      {nodes.map((m, i) => {
        const a = (i / nodes.length) * Math.PI * 2 - Math.PI / 2;
        const x = cx + Math.cos(a) * r * 1.7;
        const y = cy + Math.sin(a) * r;
        const isSel = i === 0;
        return (
          <g key={keyOf(m)}>
            <line
              x1={cx} y1={cy} x2={x} y2={y} pathLength={1} strokeWidth="1"
              className={`iq-draw ${isSel ? "stroke-accent" : "stroke-muted-foreground"}`}
              style={{ animationDelay: `${i * 70}ms` }}
            />
            <g
              className="iq-rise cursor-pointer"
              style={{ animationDelay: `${200 + i * 70}ms` }}
              onClick={() => !isSel && onPick(m)}
            >
              <rect x={x - 40} y={y - 12} width="80" height="24" className={isSel ? "fill-accent" : "fill-card stroke-foreground"} strokeWidth="1" />
              <text x={x} y={y + 4} textAnchor="middle" className={`font-mono text-[10px] ${isSel ? "fill-accent-foreground" : "fill-foreground"}`}>
                {m.incident_id}
              </text>
            </g>
          </g>
        );
      })}
      <rect x={cx - 58} y={cy - 13} width="116" height="26" className="fill-background stroke-foreground" strokeWidth="1" />
      <text x={cx} y={cy + 4} textAnchor="middle" className="fill-foreground font-mono text-[11px]">
        {sel.service}
      </text>
    </svg>
  );
}
