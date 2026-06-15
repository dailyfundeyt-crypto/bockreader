import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppHeader";
import { ensurePagesFolders } from "@/lib/drive";
import { toast } from "sonner";
import { User, Palette, HardDrive, FolderTree, Camera, Loader2, Plug, Plus, Copy, Trash2 } from "lucide-react";
import { listMcpTokens, createMcpToken, deleteMcpToken } from "@/lib/mcp-tokens.functions";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings · Pages" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const [email, setEmail] = useState<string>("");
  const [userId, setUserId] = useState<string>("");
  const [displayName, setDisplayName] = useState<string>("");
  const [avatarPath, setAvatarPath] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [theme, setTheme] = useState<"dark" | "light">(typeof document !== "undefined" && document.documentElement.classList.contains("dark") ? "dark" : "light");
  const [driveOk, setDriveOk] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const u = data.user;
      if (!u) return;
      setEmail(u.email ?? "");
      setUserId(u.id);
      const { data: prof } = await supabase.from("profiles").select("display_name, avatar_url").eq("id", u.id).maybeSingle();
      if (prof) {
        setDisplayName(prof.display_name ?? "");
        setAvatarPath(prof.avatar_url ?? null);
      }
    })();
  }, []);

  useEffect(() => {
    if (!avatarPath) { setAvatarUrl(null); return; }
    if (avatarPath.startsWith("http")) { setAvatarUrl(avatarPath); return; }
    supabase.storage.from("avatars").createSignedUrl(avatarPath, 3600).then(({ data }) => {
      if (data?.signedUrl) setAvatarUrl(data.signedUrl);
    });
  }, [avatarPath]);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.classList.toggle("dark", next === "dark");
  }

  async function testDrive() {
    try { await ensurePagesFolders(); setDriveOk(true); toast.success("Drive verbunden."); }
    catch (e) { setDriveOk(false); toast.error((e as Error).message); }
  }

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !userId) return;
    if (!file.type.startsWith("image/")) { toast.error("Bitte ein Bild wählen."); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Max. 5 MB."); return; }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${userId}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { error: dbErr } = await supabase.from("profiles").update({ avatar_url: path }).eq("id", userId);
      if (dbErr) throw dbErr;
      // best-effort cleanup of previous avatar
      if (avatarPath && !avatarPath.startsWith("http") && avatarPath !== path) {
        await supabase.storage.from("avatars").remove([avatarPath]).catch(() => {});
      }
      setAvatarPath(path);
      toast.success("Profilbild aktualisiert.");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function saveName() {
    if (!userId) return;
    const { error } = await supabase.from("profiles").update({ display_name: displayName }).eq("id", userId);
    if (error) toast.error(error.message); else toast.success("Name gespeichert.");
  }

  const initials = (displayName || email || "?").trim().slice(0, 2).toUpperCase();

  return (
    <div>
      <PageHeader kicker="SETTINGS" title="Konto & Drive" />
      <div className="p-8 max-w-2xl space-y-4">
        <Card icon={<User className="h-5 w-5" />} tone="cream">
          <div className="flex items-start gap-5">
            <div className="relative shrink-0">
              <div className="h-20 w-20 rounded-full overflow-hidden bg-secondary border hairline flex items-center justify-center font-serif text-2xl text-foreground/70">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                ) : (
                  <span>{initials}</span>
                )}
              </div>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full bg-primary text-primary-foreground shadow-sm hover:bg-sage-deep transition-colors flex items-center justify-center disabled:opacity-60"
                aria-label="Profilbild ändern"
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickFile} />
            </div>
            <div className="flex-1 min-w-0 space-y-3">
              <div>
                <div className="font-serif text-lg">Account</div>
                <div className="text-sm text-muted-foreground mt-0.5 truncate">{email || "—"}</div>
              </div>
              <div className="flex gap-2">
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Anzeigename"
                  className="flex-1 rounded-full border hairline bg-background px-4 py-2 text-sm font-sans focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <button onClick={saveName} className="label-mono rounded-full bg-primary text-primary-foreground px-4 py-2 hover:bg-sage-deep transition-colors shadow-sm">
                  Speichern
                </button>
              </div>
            </div>
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

        <McpCard />
      </div>
    </div>
  );
}

function McpCard() {
  const qc = useQueryClient();
  const list = useServerFn(listMcpTokens);
  const create = useServerFn(createMcpToken);
  const del = useServerFn(deleteMcpToken);
  const [label, setLabel] = useState("");
  const [justCreated, setJustCreated] = useState<string | null>(null);
  const mcpUrl = typeof window !== "undefined" ? `${window.location.origin}/api/mcp` : "/api/mcp";

  const tokensQ = useQuery({
    queryKey: ["mcp-tokens"],
    queryFn: () => list(),
  });

  const createM = useMutation({
    mutationFn: (l: string) => create({ data: l ? { label: l } : {} }),
    onSuccess: (res) => {
      setJustCreated(res.token);
      setLabel("");
      qc.invalidateQueries({ queryKey: ["mcp-tokens"] });
      toast.success("Token erstellt — jetzt kopieren!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delM = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mcp-tokens"] });
      toast.success("Token entfernt.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function copy(text: string) {
    navigator.clipboard.writeText(text).then(
      () => toast.success("Kopiert."),
      () => toast.error("Kopieren fehlgeschlagen."),
    );
  }

  return (
    <Card icon={<Plug className="h-5 w-5" />} tone="sage">
      <div className="font-serif text-lg">MCP-Server</div>
      <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
        Verbinde Claude, Cursor oder andere MCP-Clients und lade Bücher über die Tools
        <span className="font-mono text-xs"> list_books</span>,
        <span className="font-mono text-xs"> upload_book</span>,
        <span className="font-mono text-xs"> delete_book</span> hoch.
      </p>

      <div className="mt-4 space-y-2">
        <div className="label-mono text-muted-foreground">SERVER URL</div>
        <div className="flex items-center gap-2">
          <code className="flex-1 truncate rounded-full border hairline bg-background px-3 py-2 text-xs">{mcpUrl}</code>
          <button onClick={() => copy(mcpUrl)} className="rounded-full border hairline bg-background p-2 hover:bg-secondary" aria-label="URL kopieren">
            <Copy className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {justCreated && (
        <div className="mt-4 rounded-xl border hairline bg-background p-3">
          <div className="label-mono text-muted-foreground mb-1">DEIN NEUER TOKEN — nur einmal sichtbar</div>
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate font-mono text-xs">{justCreated}</code>
            <button onClick={() => copy(justCreated)} className="rounded-full border hairline bg-card p-2 hover:bg-secondary" aria-label="Token kopieren">
              <Copy className="h-3.5 w-3.5" />
            </button>
          </div>
          <button onClick={() => setJustCreated(null)} className="mt-2 label-mono text-muted-foreground hover:text-foreground">
            verstanden — schließen
          </button>
        </div>
      )}

      <div className="mt-4 flex gap-2">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Name (z. B. Claude Desktop)"
          className="flex-1 rounded-full border hairline bg-background px-4 py-2 text-sm font-sans focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        <button
          onClick={() => createM.mutate(label.trim())}
          disabled={createM.isPending}
          className="label-mono rounded-full bg-primary text-primary-foreground px-4 py-2 hover:bg-sage-deep transition-colors shadow-sm flex items-center gap-2 disabled:opacity-60"
        >
          {createM.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          Neuer Token
        </button>
      </div>

      <div className="mt-4 space-y-2">
        {tokensQ.isLoading ? (
          <p className="label-mono text-muted-foreground">Lade…</p>
        ) : !tokensQ.data?.tokens.length ? (
          <p className="label-mono text-muted-foreground">Noch keine Tokens.</p>
        ) : (
          tokensQ.data.tokens.map((t) => (
            <div key={t.id} className="flex items-center gap-3 rounded-xl border hairline bg-background px-3 py-2">
              <div className="flex-1 min-w-0">
                <div className="text-sm truncate">{t.label || "ohne Name"}</div>
                <div className="label-mono text-muted-foreground">
                  {t.token.slice(0, 12)}…{t.token.slice(-4)} · {new Date(t.created_at).toLocaleDateString("de-DE")}
                </div>
              </div>
              <button
                onClick={() => delM.mutate(t.id)}
                disabled={delM.isPending}
                className="rounded-full border hairline bg-card p-2 hover:bg-destructive/10 hover:text-destructive transition-colors"
                aria-label="Token löschen"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))
        )}
      </div>
    </Card>
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
