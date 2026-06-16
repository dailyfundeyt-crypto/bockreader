import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppHeader";
import { ensurePagesFolders, uploadTextFile } from "@/lib/drive";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Cloud, FileText, Sparkles, Search, BookOpen } from "lucide-react";

type Unit = { id: string; title: string; content_md: string; drive_file_id: string | null; created_at: string };

export const Route = createFileRoute("/_authenticated/notes")({
  head: () => ({ meta: [{ title: "Notes · Pages" }] }),
  component: NotesPage,
});

const TONES = ["bg-secondary", "bg-accent/25", "bg-primary/15", "bg-sun/25", "bg-card"] as const;

function NotesPage() {
  const [open, setOpen] = useState<Unit | null>(null);
  const [search, setSearch] = useState("");
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["learning_units"],
    queryFn: async () => {
      const { data, error } = await supabase.from("learning_units").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Unit[];
    },
  });

  const exportToDrive = useMutation({
    mutationFn: async (u: Unit) => {
      const { notes } = await ensurePagesFolders();
      const { id } = await uploadTextFile({ name: `${u.title}.md`, parentId: notes, content: u.content_md });
      const { error } = await supabase.from("learning_units").update({ drive_file_id: id }).eq("id", u.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("In Drive gespeichert."); qc.invalidateQueries({ queryKey: ["learning_units"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const stats = useMemo(() => {
    const units = q.data ?? [];
    const total = units.length;
    const inDrive = units.filter((u) => u.drive_file_id).length;
    const words = units.reduce((a, u) => a + (u.content_md?.split(/\s+/).filter(Boolean).length ?? 0), 0);
    const since = new Date(); since.setDate(since.getDate() - 7);
    const recent = units.filter((u) => new Date(u.created_at) >= since).length;
    return { total, inDrive, words, recent };
  }, [q.data]);

  const filtered = useMemo(() => {
    const list = q.data ?? [];
    if (!search.trim()) return list;
    const s = search.toLowerCase();
    return list.filter((u) => u.title.toLowerCase().includes(s) || u.content_md?.toLowerCase().includes(s));
  }, [q.data, search]);

  return (
    <div>
      <PageHeader kicker="NOTES" title="KI-Lerneinheiten" />
      <div className="p-4 sm:p-8 space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Kpi tone="bg-secondary" icon={<FileText className="h-4 w-4" />} label="EINHEITEN" value={String(stats.total)} hint="insgesamt" />
          <Kpi tone="bg-accent/30" icon={<Sparkles className="h-4 w-4" />} label="DIESE WOCHE" value={String(stats.recent)} hint="neu erstellt" />
          <Kpi tone="bg-primary/15" icon={<BookOpen className="h-4 w-4" />} label="WÖRTER" value={stats.words.toLocaleString("de-DE")} hint="zusammen" />
          <Kpi tone="bg-sun/30" icon={<Cloud className="h-4 w-4" />} label="IN DRIVE" value={`${stats.inDrive} / ${stats.total || 0}`} hint="gesichert" />
        </div>

        {/* Search */}
        <div className="rounded-2xl border hairline bg-card/70 px-5 py-3 shadow-sm flex items-center gap-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Suche in deinen Lerneinheiten…"
            className="flex-1 bg-transparent outline-none font-sans text-base placeholder:text-muted-foreground"
          />
        </div>

        {/* Bento grid */}
        {q.isLoading ? (
          <p className="label-mono text-muted-foreground">Lade…</p>
        ) : !filtered.length ? (
          <EmptyState hasUnits={!!q.data?.length} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((u, i) => (
              <NoteCard
                key={u.id}
                unit={u}
                tone={TONES[i % TONES.length]}
                active={open?.id === u.id}
                onOpen={() => setOpen(u)}
              />
            ))}
          </div>
        )}

        {/* Reader */}
        {open && (
          <div className="rounded-2xl border hairline bg-card shadow-sm">
            <div className="flex items-center justify-between border-b hairline px-6 py-4">
              <div>
                <div className="label-mono text-primary">EINHEIT</div>
                <div className="font-serif text-xl mt-0.5">{open.title}</div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => exportToDrive.mutate(open)}
                  disabled={exportToDrive.isPending || !!open.drive_file_id}
                  className="label-mono rounded-full border hairline bg-background px-4 py-2 hover:bg-secondary disabled:opacity-60 flex items-center gap-2 transition-colors"
                >
                  <Cloud className="h-3.5 w-3.5" /> {open.drive_file_id ? "In Drive ✿" : "In Drive speichern"}
                </button>
                <button onClick={() => setOpen(null)} className="label-mono rounded-full px-3 py-2 hover:bg-secondary transition-colors">
                  Schließen
                </button>
              </div>
            </div>
            <pre className="p-6 whitespace-pre-wrap font-sans text-[15px] leading-relaxed text-foreground/90">{open.content_md}</pre>
          </div>
        )}
      </div>
    </div>
  );
}

function NoteCard({ unit, tone, active, onOpen }: { unit: Unit; tone: string; active: boolean; onOpen: () => void }) {
  const preview = (unit.content_md ?? "").replace(/[#>*_`-]/g, "").trim().slice(0, 180);
  const words = unit.content_md?.split(/\s+/).filter(Boolean).length ?? 0;
  return (
    <button
      onClick={onOpen}
      className={`text-left rounded-2xl border hairline ${tone} p-5 shadow-sm transition-transform hover:-translate-y-1 ${active ? "ring-2 ring-primary" : ""}`}
    >
      <div className="flex items-center justify-between">
        <div className="label-mono text-primary">
          {new Date(unit.created_at).toLocaleDateString("de-DE", { day: "2-digit", month: "short" })}
        </div>
        {unit.drive_file_id && <Cloud className="h-3.5 w-3.5 text-primary" />}
      </div>
      <div className="mt-2 font-serif text-xl leading-tight line-clamp-2">{unit.title}</div>
      <p className="mt-3 text-sm text-foreground/70 line-clamp-4 font-sans">{preview || "—"}</p>
      <div className="mt-4 label-mono text-muted-foreground">{words} Wörter</div>
    </button>
  );
}

function Kpi({ tone, icon, label, value, hint }: { tone: string; icon: React.ReactNode; label: string; value: string; hint: string }) {
  return (
    <div className={`rounded-2xl p-5 shadow-sm ${tone}`}>
      <div className="flex items-center justify-between">
        <div className="label-mono opacity-80">{label}</div>
        <div className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-background/40">{icon}</div>
      </div>
      <div className="mt-3 font-serif text-3xl font-semibold">{value}</div>
      <div className="mt-1 text-xs opacity-75">{hint}</div>
    </div>
  );
}

function EmptyState({ hasUnits }: { hasUnits: boolean }) {
  return (
    <div className="rounded-3xl border hairline bg-card/60 py-20 text-center">
      <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary/20 text-primary">
        <Sparkles className="h-6 w-6" />
      </div>
      <p className="mt-5 font-serif text-2xl">{hasUnits ? "Nichts gefunden." : "Noch keine Einheiten."}</p>
      <p className="mt-2 text-sm text-muted-foreground">
        {hasUnits ? "Andere Suche versuchen." : "Erstelle eine Lerneinheit im Reader."}
      </p>
    </div>
  );
}
