import { useMemo, useState } from "react";
import { OutcomeTag } from "@/components/Chrome";
import { delay } from "@/components/viz";
import type { MemoryEvidence, TriageResult } from "@/lib/incidentiq-types";

const good = (o: string) => /^(VERIFIED|WORKED)$/i.test(o);

type Sel =
  | { kind: "current" }
  | { kind: "incident"; i: number }
  | { kind: "action"; action: string }
  | { kind: "outcome"; i: number }
  | { kind: "rec" };

/**
 * Current incident → recalled incidents → actions → outcomes → pattern → recommendation.
 * Rendered strictly from the triage response; a link is drawn only where the response supports it.
 */
export function EvidenceGraph({ result, alert }: { result: TriageResult; alert: string }) {
  const mem = (result.evidence ?? []).slice(0, 8);
  const top = result.recommendations?.[0];
  const [sel, setSel] = useState<Sel | null>(null);

  // A pattern exists only when the same action appears in at least two recalled memories.
  const pattern = useMemo(() => {
    const m = new Map<string, MemoryEvidence[]>();
    for (const e of mem) m.set(e.action, [...(m.get(e.action) ?? []), e]);
    let best: { action: string; items: MemoryEvidence[] } | null = null;
    for (const [action, items] of m) if (items.length >= 2 && (!best || items.length > best.items.length)) best = { action, items };
    return best;
  }, [mem]);

  const supports = (id: string) => top?.evidence?.includes(id) ?? false;
  const isSel = (s: Sel) => JSON.stringify(s) === JSON.stringify(sel);
  const node = (s: Sel, extra = "") =>
    `iq-rise block w-full border px-3 py-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
      isSel(s) ? "border-accent bg-accent/10" : "border-foreground bg-card hover:border-accent"
    } ${extra}`;
  const toggle = (s: Sel) => setSel(isSel(s) ? null : s);
  const cols = Math.min(mem.length, 4);

  return (
    <div className="mt-6 border-t border-foreground pt-8">
      <div className="flex justify-center">
        <button type="button" onClick={() => toggle({ kind: "current" })} className={node({ kind: "current" }, "max-w-md text-center")} style={delay(0)}>
          <span className="label-tech text-muted-foreground">Current incident</span>
          <span className="mt-1 block font-mono text-[14px]">{result.service} / {alert}</span>
        </button>
      </div>

      <div className="mx-auto h-6 w-px bg-foreground" aria-hidden />
      <div
        className="grid gap-x-4 gap-y-8 border-t border-foreground"
        style={{ gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, ${cols > 2 ? 11 : 14}rem), 1fr))` }}
      >
        {mem.map((m, i) => {
          const d = 200 + i * 160;
          const tone = good(m.outcome) ? "bg-verified" : /TEMP/i.test(m.outcome) ? "bg-warning" : "bg-failed";
          return (
            <div key={m.incident_id + m.action + i} className="flex flex-col items-stretch">
              <div className="mx-auto h-5 w-px bg-foreground" aria-hidden />
              <button type="button" onClick={() => toggle({ kind: "incident", i })} className={node({ kind: "incident", i })} style={delay(d)}>
                <span className="label-tech text-accent">{m.incident_id}</span>
                <span className="block font-mono text-[12px] text-muted-foreground">{m.service}</span>
              </button>
              <div className="mx-auto h-4 w-px bg-foreground" aria-hidden />
              <button type="button" onClick={() => toggle({ kind: "action", action: m.action })} className={node({ kind: "action", action: m.action })} style={delay(d + 100)}>
                <span className="label-tech text-muted-foreground">Action</span>
                <span className="block font-mono text-[13px]">{m.action}</span>
              </button>
              <div className="mx-auto h-4 w-px bg-foreground" aria-hidden />
              <button type="button" onClick={() => toggle({ kind: "outcome", i })} className={node({ kind: "outcome", i }, "flex items-center gap-2")} style={delay(d + 200)}>
                <span className={`size-2 ${tone}`} aria-hidden />
                <OutcomeTag value={m.outcome} />
              </button>
              {supports(m.incident_id) && <div className="mx-auto h-5 w-px bg-accent" aria-hidden />}
            </div>
          );
        })}
      </div>

      {(pattern || top) && (
        <div className="mt-2 border-t border-accent pt-0">
          <div className="mx-auto h-6 w-px bg-accent" aria-hidden />
          {pattern && (
            <>
              <p className="iq-rise label-tech text-center text-accent" style={delay(300 + mem.length * 160)}>
                Pattern detected · {pattern.action} × {pattern.items.length}
              </p>
              <div className="mx-auto h-6 w-px bg-accent" aria-hidden />
            </>
          )}
          {top && (
            <div className="flex justify-center">
              <button type="button" onClick={() => toggle({ kind: "rec" })} className={node({ kind: "rec" }, "max-w-xl border-l-2 !border-l-accent text-center")} style={delay(450 + mem.length * 160)}>
                <span className="label-tech text-accent">Current recommendation</span>
                <span className="editorial mt-2 block text-[1.6rem]">{top.title}</span>
                {top.change && <span className="block font-mono text-[13px] text-muted-foreground">{top.change}</span>}
              </button>
            </div>
          )}
        </div>
      )}

      {sel && <Detail sel={sel} result={result} mem={mem} alert={alert} onClose={() => setSel(null)} />}
      {!sel && <p className="label-tech mt-6 text-center text-muted-foreground">Select a node to inspect its evidence</p>}
    </div>
  );
}

function Row({ k, v, mono }: { k: string; v?: React.ReactNode; mono?: boolean }) {
  if (v === undefined || v === null || v === "") return null;
  return (
    <div className="hairline-b grid grid-cols-[8rem_1fr] gap-4 py-2">
      <dt className="label-tech text-muted-foreground">{k}</dt>
      <dd className={`text-[14px] ${mono ? "font-mono" : ""}`}>{v}</dd>
    </div>
  );
}

function Detail({ sel, result, mem, alert, onClose }: { sel: Sel; result: TriageResult; mem: MemoryEvidence[]; alert: string; onClose: () => void }) {
  let title = "";
  let body: React.ReactNode = null;
  if (sel.kind === "current") {
    title = result.incident_id;
    body = (
      <>
        <Row k="Service" v={result.service} mono />
        <Row k="Severity" v={result.severity} />
        <Row k="Alert" v={alert} />
        <Row k="Root cause" v={result.root_cause} />
      </>
    );
  } else if (sel.kind === "incident" || sel.kind === "outcome") {
    const m = mem[sel.i]!;
    title = m.incident_id;
    body = (
      <>
        <Row k="Service" v={m.service} mono />
        <Row k="Recorded" v={m.timestamp && new Date(m.timestamp).toLocaleString()} />
        <Row k="Type" v={m.type} />
        <Row k="Content" v={m.summary ?? m.detail} />
        <Row k="Action" v={m.action} mono />
        <Row k="Outcome" v={<OutcomeTag value={m.outcome} />} />
        <Row k="Supports" v={result.recommendations?.filter((r) => r.evidence?.includes(m.incident_id)).map((r) => r.title).join(", ")} />
      </>
    );
  } else if (sel.kind === "action") {
    const items = mem.filter((m) => m.action === sel.action);
    const ok = items.filter((m) => good(m.outcome)).length;
    title = sel.action;
    body = (
      <>
        <Row k="Recalled uses" v={`${ok} successful / ${items.length} recalled`} />
        <Row k="Incidents" v={items.map((m) => `${m.incident_id} → ${m.outcome}`).join(" · ")} mono />
      </>
    );
  } else {
    const r = result.recommendations[0]!;
    title = r.title;
    body = (
      <>
        <Row k="Change" v={r.change} mono />
        <Row k="Why" v={r.why} />
        <Row k="Evidence" v={r.evidence?.join(" · ") || "None recalled"} mono />
      </>
    );
  }
  return (
    <div className="iq-rise mt-8 border border-foreground bg-card p-5" aria-live="polite">
      <div className="flex items-baseline justify-between gap-4">
        <p className="label-tech text-accent">{sel.kind === "rec" ? "Recommendation" : sel.kind}</p>
        <button type="button" onClick={onClose} className="label-tech text-muted-foreground hover:text-foreground">Close ×</button>
      </div>
      <p className="mt-2 font-mono text-[15px]">{title}</p>
      <dl className="mt-4 border-t border-foreground">{body}</dl>
    </div>
  );
}
