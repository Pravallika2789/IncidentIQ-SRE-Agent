import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { IncidentIQProvider } from "../lib/incidentiq-store";
import { Dock } from "../components/Dock";
import { StatusBar } from "../components/Chrome";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="max-w-md">
        <p className="label-tech text-accent">404 / No such route</p>
        <h1 className="editorial mt-4 text-5xl">Nothing recorded here.</h1>
        <Link to="/" className="label-tech mt-8 inline-block border-b border-foreground pb-1">
          Return to overview
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="max-w-md">
        <p className="label-tech text-accent">Interface error</p>
        <h1 className="editorial mt-4 text-4xl">This page didn't load.</h1>
        <p className="mt-4 text-sm text-muted-foreground">
          The interface hit an unexpected state. Navigation is unaffected.
        </p>
        <div className="mt-8 flex gap-6">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="label-tech border-b border-foreground pb-1"
          >
            Try again
          </button>
          <a href="/" className="label-tech border-b border-foreground pb-1">
            Overview
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "IncidentIQ — Incident response with operational memory" },
      {
        name: "description",
        content:
          "An on-call teammate that remembers your team's scars: incident triage informed by previous root causes, fixes and outcomes.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap",
      },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <IncidentIQProvider>
        <StatusBar />
        {/* Required: nested routes render here. */}
        <PageFade />
        <Dock />
      </IncidentIQProvider>
    </QueryClientProvider>
  );
}

function PageFade() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div key={path} className="iq-page">
      <Outlet />
    </div>
  );
}
