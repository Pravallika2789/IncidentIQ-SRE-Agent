import { createFileRoute, Link } from "@tanstack/react-router";
import { Shell, OutcomeTag } from "@/components/Chrome";
import { useIncidentIQ } from "@/lib/incidentiq-store";
import { Reveal } from "@/components/viz";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "IncidentIQ — Overview" },
      {
        name: "description",
        content:
          "Editorial command centre for incident response: system state, memory state, and the incidents your team has already lived through.",
      },
      { property: "og:title", content: "IncidentIQ — Overview" },
      {
        property: "og:description",
        content: "Incident response informed by your team's previous operational experience.",
      },
    ],
  }),
  component: Overview,
});

function Overview() {
  const { memoryEnabled, connection, backendUrl, activity } = useIncidentIQ();

  const state = [
    {
      label: "Service",
      value: connection === "online" ? "Reachable" : connection === "offline" ? "Unreachable" : "Checking",
      tone: connection === "online" ? "text-verified" : connection === "offline" ? "text-failed" : "text-muted-foreground",
    },
    {
      label: "Memory",
      value: memoryEnabled ? "Active" : "Bypassed",
      tone: memoryEnabled ? "text-memory" : "text-muted-foreground",
    },
    {
      label: "API",
      value: backendUrl.replace(/^https?:\/\//, ""),
      tone: "text-foreground",
    },
  ];

  return (
    <Shell>
      <section className="rule-b grid gap-12 pt-16 pb-16 sm:pt-24 lg:grid-cols-[60%_40%] lg:gap-16">
        <div>
          <p className="label-tech text-accent">Incident response with memory</p>
          <h1 className="editorial mt-6 text-[3.25rem] sm:text-[5.5rem]">
            Remember what
            <br />
            happened before.
          </h1>
          <p className="measure mt-8 text-[15px] leading-relaxed text-muted-foreground">
            Incident response informed by your team's previous operational experience. Root causes,
            fixes that held, fixes that only bought time — recalled at the moment it matters.
          </p>
          <Link
            to="/app/incidents"
            className="btn-primary mt-10 inline-flex items-center gap-3"
          >
            Investigate incident
            <span aria-hidden>→</span>
          </Link>
        </div>

        <div className="lg:pt-6">
          <dl className="divide-y divide-border border-t border-foreground">
            {state.map((s) => (
              <div key={s.label} className="flex items-baseline justify-between py-4">
                <dt className="label-tech text-muted-foreground">{s.label}</dt>
                <dd className={`label-tech ${s.tone}`}>{s.value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-6 text-[13px] leading-relaxed text-muted-foreground">
            The interface never contacts the memory service directly. All recall and analysis runs
            through your incident-response backend.
          </p>
        </div>
      </section>

      <section className="pt-14">
        <div className="flex items-baseline justify-between">
          <h2 className="label-tech">Recent investigations</h2>
          <span className="label-tech text-muted-foreground">This workstation</span>
        </div>

        {activity.length === 0 ? (
          <p className="measure mt-8 text-[15px] leading-relaxed text-muted-foreground">
            Run an investigation to begin building your incident history.
          </p>
        ) : (
          <ol className="mt-8 border-t border-foreground pt-8">
            {activity.map((e, i) => (
              <Reveal as="li" key={e.incidentId + e.at} delay={i * 60}>
                {i > 0 && (
                  <span aria-hidden className="label-tech block py-3 pl-1 text-muted-foreground">↓</span>
                )}
                <div className="grid gap-2 border-l border-foreground pl-5 sm:grid-cols-[7rem_9rem_1fr_auto] sm:items-baseline sm:gap-6">
                  <span className="label-tech text-accent">{e.incidentId}</span>
                  <span className="font-mono text-[13px] text-muted-foreground">{e.service}</span>
                  <span className="text-[15px] leading-snug">
                    {e.headline}
                    <span className="label-tech mt-1 block text-muted-foreground">
                      {new Date(e.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </span>
                  {e.outcome ? <OutcomeTag value={e.outcome} /> : <span className="label-tech text-muted-foreground">Open</span>}
                </div>
              </Reveal>
            ))}
          </ol>
        )}
      </section>
    </Shell>
  );
}
