import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <p className="text-typewriter text-[10px] uppercase tracking-[0.4em] text-amber-signal/80">
          Arquivo Perdido
        </p>
        <h1 className="mt-4 text-serif-noir text-6xl font-light text-foreground">404</h1>
        <p className="mt-2 text-typewriter text-sm text-muted-foreground">
          A fita que procura não está neste arquivo.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="text-typewriter inline-flex items-center justify-center border border-amber-signal/50 px-5 py-2 text-xs uppercase tracking-[0.3em] text-amber-signal transition-colors hover:bg-amber-signal hover:text-primary-foreground"
          >
            Voltar ao Menu
          </Link>
        </div>
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
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
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
      { title: "archive weaver" },
      { name: "description", content: "fitinhas: RPG VHS Archive - Creates and distributes fictional VHS tapes for immersive RPG campaigns." },
      { property: "og:title", content: "archive weaver" },
      { property: "og:description", content: "fitinhas: RPG VHS Archive - Creates and distributes fictional VHS tapes for immersive RPG campaigns." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "archive weaver" },
      { name: "twitter:description", content: "fitinhas: RPG VHS Archive - Creates and distributes fictional VHS tapes for immersive RPG campaigns." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/4d099a6a-b02e-471f-b9b5-406f2abd4da3/id-preview-3050e580--aee73d85-4b4d-46d0-9f60-141f6ce09fbe.lovable.app-1782230041503.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/4d099a6a-b02e-471f-b9b5-406f2abd4da3/id-preview-3050e580--aee73d85-4b4d-46d0-9f60-141f6ce09fbe.lovable.app-1782230041503.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;600&family=JetBrains+Mono:wght@400;500;700&family=Special+Elite&display=swap",
      },
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
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
    </QueryClientProvider>
  );
}
