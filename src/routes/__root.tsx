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
import { supabase } from "@/integrations/supabase/client";
import { Toaster } from "@/components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <div className="label-mono text-muted-foreground">ERROR / 404</div>
        <h1 className="mt-4 font-mono text-6xl font-bold">404</h1>
        <p className="mt-3 text-sm text-muted-foreground">Diese Seite existiert nicht.</p>
        <Link to="/" className="mt-6 inline-block border border-foreground px-4 py-2 label-mono hover:bg-foreground hover:text-background transition-colors">
          Zur Startseite
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => { reportLovableError(error, { boundary: "tanstack_root_error_component" }); }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <div className="label-mono text-muted-foreground">ERROR</div>
        <h1 className="mt-4 font-mono text-xl">Etwas ist schiefgelaufen</h1>
        <button onClick={() => { router.invalidate(); reset(); }} className="mt-6 border border-foreground px-4 py-2 label-mono hover:bg-foreground hover:text-background transition-colors">
          Erneut versuchen
        </button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Pages — Lesen, markieren, lernen" },
      { name: "description", content: "Bücher hochladen, mit dem Stift markieren, KI-Lerneinheiten erstellen und alles über Google Drive synchronisieren." },
      { name: "theme-color", content: "#f5f0e8" },
      { property: "og:title", content: "Pages — Lesen, markieren, lernen" },
      { name: "twitter:title", content: "Pages — Lesen, markieren, lernen" },
      { property: "og:description", content: "Bücher hochladen, mit dem Stift markieren, KI-Lerneinheiten erstellen und alles über Google Drive synchronisieren." },
      { name: "twitter:description", content: "Bücher hochladen, mit dem Stift markieren, KI-Lerneinheiten erstellen und alles über Google Drive synchronisieren." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/051a7c85-761c-431e-b799-bde7ce8d3088/id-preview-9f708821--4f1ba7ae-35c2-4d0d-81a5-a901b2fe7446.lovable.app-1781504589105.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/051a7c85-761c-431e-b799-bde7ce8d3088/id-preview-9f708821--4f1ba7ae-35c2-4d0d-81a5-a901b2fe7446.lovable.app-1781504589105.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Lora:wght@500;600;700&family=Nunito+Sans:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="de">
      <head><HeadContent /></head>
      <body>{children}<Scripts /></body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
    });
    return () => subscription.unsubscribe();
  }, [queryClient, router]);

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <Toaster />
    </QueryClientProvider>
  );
}
