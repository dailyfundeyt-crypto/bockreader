import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppHeader";
import { ensurePagesFolders } from "@/lib/drive";
import { toast } from "sonner";
import { User, Palette, HardDrive, FolderTree } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings · Pages" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const [email, setEmail] = useState<string>("");
  const [theme, setTheme] = useState<"dark" | "light">(typeof document !== "undefined" && document.documentElement.classList.contains("dark") ? "dark" : "light");
  const [driveOk, setDriveOk] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ""));
  }, []);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.classList.toggle("dark", next === "dark");
  }

  async function testDrive() {
    try { await ensurePagesFolders(); setDriveOk(true); toast.success("Drive verbunden."); }
    catch (e) { setDriveOk(false); toast.error((e as Error).message); }
  }

  return (
    <div>
      <PageHeader kicker="SETTINGS" title="Konto & Drive" />
      <div className="p-8 max-w-2xl space-y-4">
        <Card icon={<User className="h-5 w-5" />} tone="cream">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-serif text-lg">Account</div>
              <div className="text-sm text-muted-foreground mt-0.5">Eingeloggt als</div>
            </div>
            <div className="font-sans text-sm text-foreground/80">{email || "—"}</div>
          </div>
        </Card>

        <Card icon={<Palette className="h-5 w-5" />} tone="sage">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-serif text-lg">Erscheinungsbild</div>
              <div className="text-sm text-muted-foreground mt-0.5">Hell oder dunkel — wechsle, wie es sich richtig anfühlt.</div>
            </div>
            <button onClick={toggleTheme} className="label-mono rounded-full bg-primary text-primary-foreground px-4 py-2 hover:bg-sage-deep transition-colors shadow-sm">
              {theme === "dark" ? "Dunkel" : "Hell"}
            </button>
          </div>
        </Card>

        <Card icon={<HardDrive className="h-5 w-5" />} tone="clay">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-serif text-lg">Google Drive</div>
              <div className="text-sm text-muted-foreground mt-0.5">
                {driveOk === null ? "Verbindung noch nicht geprüft." : driveOk ? "Verbunden ✿" : "Nicht verbunden."}
              </div>
            </div>
            <button onClick={testDrive} className="label-mono rounded-full border hairline bg-background px-4 py-2 hover:bg-secondary transition-colors">
              Test
            </button>
          </div>
        </Card>

        <Card icon={<FolderTree className="h-5 w-5" />} tone="cream">
          <div className="font-serif text-lg">Wo deine Sachen liegen</div>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
            Pages legt zwei Ordner in deiner Drive an: <span className="text-foreground font-medium">/Pages/Books</span> für deine Bibliothek
            und <span className="text-foreground font-medium">/Pages/Notes</span> für KI-Lerneinheiten. Zugriff nur auf eigene Dateien (drive.file scope).
          </p>
        </Card>
      </div>
    </div>
  );
}

function Card({ children, icon, tone }: { children: React.ReactNode; icon: React.ReactNode; tone: "cream" | "sage" | "clay" }) {
  const bg = tone === "sage" ? "bg-secondary" : tone === "clay" ? "bg-accent/25" : "bg-card";
  const iconBg = tone === "sage" ? "bg-primary text-primary-foreground" : tone === "clay" ? "bg-accent text-accent-foreground" : "bg-primary/20 text-primary";
  return (
    <div className={`rounded-2xl border hairline ${bg} p-6 shadow-sm`}>
      <div className="flex items-start gap-4">
        <div className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${iconBg}`}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </div>
  );
}
