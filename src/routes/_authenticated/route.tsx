import { createFileRoute, Outlet, redirect, Link, useLocation } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Library, Target, BarChart3, FileText, Settings as SettingsIcon, LogOut } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthLayout,
});

const NAV = [
  { to: "/library", label: "Library", icon: Library },
  { to: "/goals", label: "Goals", icon: Target },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/notes", label: "Notes", icon: FileText },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
] as const;

function AuthLayout() {
  const loc = useLocation();
  const qc = useQueryClient();
  const isReader = loc.pathname.startsWith("/read/");

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  if (isReader) return <Outlet />;

  return (
    <div className="min-h-screen flex text-foreground">
      <aside className="w-60 border-r hairline flex flex-col bg-card/50 backdrop-blur-sm">
        <div className="px-5 py-5 border-b hairline">
          <Link to="/library" className="flex items-center gap-2.5">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 21c0-9 7-16 16-16-1 9-7 16-16 16z" />
                <path d="M5 21c4-4 7-7 11-11" />
              </svg>
            </span>
            <span className="font-serif text-lg font-semibold tracking-tight">Pages</span>
          </Link>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {NAV.map((n) => {
            const active = loc.pathname === n.to || loc.pathname.startsWith(n.to + "/");
            return (
              <Link
                key={n.to}
                to={n.to}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-full text-sm transition-colors ${
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "hover:bg-secondary text-foreground/80"
                }`}
              >
                <n.icon className="h-4 w-4" />
                <span className="font-sans font-medium">{n.label}</span>
              </Link>
            );
          })}
        </nav>
        <button onClick={signOut} className="m-3 flex items-center gap-3 px-3 py-2.5 rounded-full text-sm hover:bg-secondary text-muted-foreground transition-colors">
          <LogOut className="h-4 w-4" />
          <span className="font-sans font-medium">Sign out</span>
        </button>
      </aside>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
