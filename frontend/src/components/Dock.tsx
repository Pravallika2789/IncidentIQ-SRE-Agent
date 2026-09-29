import { Link, useRouterState } from "@tanstack/react-router";
import { Activity, BookOpen, Database, GitPullRequest, Radio, Settings } from "lucide-react";
import { useState } from "react";

const items = [
  { to: "/", label: "Overview", Icon: Radio },
  { to: "/app/incidents", label: "Incidents", Icon: Activity },
  { to: "/app/predeploy", label: "Pre-Deploy", Icon: GitPullRequest },
  { to: "/app/memory", label: "Memory", Icon: Database },
  { to: "/app/learning", label: "Learning", Icon: BookOpen },
  { to: "/app/settings", label: "Settings", Icon: Settings },
] as const;

export function Dock() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <nav
      aria-label="Primary"
      className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2"
      onMouseLeave={() => setHovered(null)}
    >
      <ul className="flex items-end gap-1 border border-foreground bg-card px-2 py-2 shadow-[4px_4px_0_0_var(--color-foreground)]">
        {items.map(({ to, label, Icon }) => {
          const active = pathname === to;
          const isHovered = hovered === to;
          return (
            <li key={to} className="relative">
              {isHovered && (
                <span className="label-tech pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap border border-foreground bg-foreground px-2 py-1 text-primary-foreground">
                  {label}
                </span>
              )}
              <Link
                to={to}
                aria-label={label}
                onMouseEnter={() => setHovered(to)}
                aria-current={active ? "page" : undefined}
                className={`flex items-center focus-visible:outline-2 focus-visible:outline-accent justify-center transition-all duration-200 ease-out ${
                  isHovered ? "size-13" : "size-11"
                } ${
                  active ? "text-accent" : "text-foreground hover:bg-secondary"
                }`}
              >
                <Icon strokeWidth={1.5} className="size-[18px]" />
              </Link>
              {active && (
                <span className="absolute bottom-0.5 left-1/2 h-[2px] w-4 -translate-x-1/2 bg-accent" />
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
