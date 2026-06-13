import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppHeader";
import { ensurePagesFolders } from "@/lib/drive";
import { toast } from "sonner";

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
      <div className="p-8 max-w-xl space-y-4">
        <Row label="Account" value={email || "—"} />
        <div className="border hairline p-5 flex items-center justify-between">
          <div>
            <div className="font-mono text-sm">Theme</div>
            <div className="label-mono text-muted-foreground mt-1">Dark oder Light</div>
          </div>
          <button onClick={toggleTheme} className="label-mono border hairline px-3 py-2 hover:bg-secondary">{theme === "dark" ? "Dark" : "Light"}</button>
        </div>
        <div className="border hairline p-5 flex items-center justify-between">
          <div>
            <div className="font-mono text-sm">Google Drive</div>
            <div className="label-mono text-muted-foreground mt-1">
              {driveOk === null ? "Verbindung prüfen" : driveOk ? "Verbunden" : "Nicht verbunden"}
            </div>
          </div>
          <button onClick={testDrive} className="label-mono border hairline px-3 py-2 hover:bg-secondary">Test</button>
        </div>
        <div className="border hairline p-5 label-mono text-muted-foreground">
          Pages legt einen Ordner <span className="text-foreground">/Pages/Books</span> und <span className="text-foreground">/Pages/Notes</span> in deiner Drive an. Zugriff: nur eigene Dateien (drive.file scope).
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="border hairline p-5 flex items-center justify-between">
      <div>
        <div className="font-mono text-sm">{label}</div>
      </div>
      <div className="font-mono text-sm text-muted-foreground">{value}</div>
    </div>
  );
}
