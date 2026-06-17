import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { downloadFile, ensurePagesFolders, listBooks, uploadFile } from "@/lib/drive";
import { PageHeader } from "@/components/AppHeader";
import { toast } from "sonner";
import { Upload, RefreshCw, BookOpen, Library as LibraryIcon, FileText, CheckCircle2, Download, CheckCircle, WifiOff, Trash2 } from "lucide-react";
import { useMemo } from "react";
import { getMeta, saveMeta, hasBookCached, saveBookBlob, removeBookBlob, listCachedBookIds } from "@/lib/offline-books";
import { useOnline } from "@/hooks/use-online";

export const Route = createFileRoute("/_authenticated/library")({
  head: () => ({ meta: [{ title: "Library · Pages" }] }),
  component: LibraryPage,
});

type Book = {
  id: string;
  title: string;
  author: string | null;
  format: "pdf" | "epub";
  drive_file_id: string | null;
  storage_path: string | null;
  cover_url: string | null;
  pages: number | null;
  current_page: number;
  added_at: string;
};

function LibraryPage() {
  const qc = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [syncing, setSyncing] = useState(false);
  const online = useOnline();
  const [cachedIds, setCachedIds] = useState<Set<string>>(new Set());

  async function refreshCached() {
    const ids = await listCachedBookIds();
    setCachedIds(new Set(ids));
  }
  useEffect(() => { refreshCached(); }, []);

  const booksQ = useQuery({
    queryKey: ["books"],
    queryFn: async () => {
      try {
        const { data, error } = await supabase.from("books").select("*").order("added_at", { ascending: false });
        if (error) throw error;
        await saveMeta("library", data);
        return data as Book[];
      } catch (e) {
        const cached = await getMeta<Book[]>("library");
        if (cached?.length) {
          toast.message("Offline-Modus: zeige gespeicherte Bibliothek.");
          return cached;
        }
        throw e;
      }
    },
  });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const isPdf = file.name.toLowerCase().endsWith(".pdf");
      const isEpub = file.name.toLowerCase().endsWith(".epub");
      if (!isPdf && !isEpub) throw new Error("Nur PDF und EPUB.");
      if (file.size > 100 * 1024 * 1024) throw new Error("Max. 100 MB.");
      const mimeType = isPdf ? "application/pdf" : "application/epub+zip";
      const { data: user } = await supabase.auth.getUser();
      const userId = user.user!.id;
      const safe = file.name.replace(/[^\w.\-]+/g, "_");
      const path = `${userId}/${Date.now()}-${safe}`;
      const { error: upErr } = await supabase.storage.from("books").upload(path, file, { contentType: mimeType, upsert: false });
      if (upErr) throw upErr;
      const title = file.name.replace(/\.(pdf|epub)$/i, "");
      const { error } = await supabase.from("books").insert({
        user_id: userId,
        title,
        format: isPdf ? "pdf" : "epub",
        storage_path: path,
      });
      if (error) {
        await supabase.storage.from("books").remove([path]).catch(() => {});
        throw error;
      }
    },
    onSuccess: () => {
      toast.success("Hochgeladen.");
      qc.invalidateQueries({ queryKey: ["books"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });


  async function syncDrive() {
    setSyncing(true);
    try {
      const { books } = await ensurePagesFolders();
      const driveFiles = await listBooks(books);
      const { data: user } = await supabase.auth.getUser();
      const userId = user.user!.id;
      const { data: existing } = await supabase.from("books").select("drive_file_id");
      const known = new Set((existing ?? []).map((b) => b.drive_file_id));
      const toAdd = driveFiles.filter((f) => !known.has(f.id));
      if (toAdd.length) {
        await supabase.from("books").insert(
          toAdd.map((f) => ({
            user_id: userId,
            title: f.name.replace(/\.(pdf|epub)$/i, ""),
            format: f.mimeType.includes("pdf") ? "pdf" : "epub",
            drive_file_id: f.id,
          })),
        );
      }
      toast.success(`Sync: ${toAdd.length} neu`);
      qc.invalidateQueries({ queryKey: ["books"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div>
      <PageHeader
        kicker="LIBRARY"
        title="Deine Bücher"
        actions={
          <>
            <button onClick={syncDrive} disabled={syncing} className="label-mono rounded-full border hairline bg-card px-4 py-2 hover:bg-secondary flex items-center gap-2 transition-colors">
              <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} /> Sync
            </button>
            <button onClick={() => fileInput.current?.click()} className="label-mono rounded-full bg-primary text-primary-foreground px-4 py-2 flex items-center gap-2 hover:bg-sage-deep transition-colors shadow-sm">
              <Upload className="h-3.5 w-3.5" /> Upload
            </button>
            <input
              ref={fileInput}
              type="file"
              accept=".pdf,.epub"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.currentTarget.value = "";
                if (!f) return;
                const ok = window.confirm(
                  "Copyright-Hinweis\n\n" +
                  "Bitte lade nur Dateien hoch, an denen du die Rechte hast " +
                  "(eigene Werke, gekaufte/lizenzierte Bücher zum Privatgebrauch, " +
                  "gemeinfreie oder offen lizenzierte Titel).\n\n" +
                  "Das Hochladen urheberrechtlich geschützter Inhalte ohne Erlaubnis " +
                  "kann gegen geltendes Recht verstoßen — die Verantwortung dafür liegt bei dir.\n\n" +
                  'Mit "OK" bestätigst du, dass du die Datei rechtmäßig nutzt.'
                );
                if (ok) upload.mutate(f);
              }}
            />
          </>
        }
      />
      <div className="p-4 sm:p-8 space-y-6">
        {!online && (
          <div className="flex items-center gap-2 rounded-2xl border hairline bg-muted/60 px-4 py-3 label-mono">
            <WifiOff className="h-4 w-4" />
            Offline-Modus — nur heruntergeladene Bücher sind lesbar.
          </div>
        )}
        <LibStats books={booksQ.data ?? []} />
        {booksQ.isLoading ? (
          <p className="label-mono text-muted-foreground">Lade…</p>
        ) : !booksQ.data?.length ? (
          <EmptyState />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-6">
            {booksQ.data.map((b, i) => (
              <BookTile
                key={b.id}
                book={b}
                idx={i}
                cached={cachedIds.has(b.id)}
                online={online}
                onChanged={refreshCached}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const TILE_TONES = [
  "bg-secondary",
  "bg-accent/30",
  "bg-primary/20",
  "bg-sun/30",
  "bg-card",
] as const;

function BookTile({ book, idx, cached, online, onChanged }: { book: Book; idx: number; cached: boolean; online: boolean; onChanged: () => void }) {
  const tone = TILE_TONES[idx % TILE_TONES.length];
  const [busy, setBusy] = useState(false);

  async function downloadForOffline(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setBusy(true);
    try {
      let b: Blob;
      if (book.storage_path) {
        const { data: dl, error } = await supabase.storage.from("books").download(book.storage_path);
        if (error || !dl) throw error ?? new Error("Download fehlgeschlagen.");
        b = dl;
      } else if (book.drive_file_id) {
        b = await downloadFile(book.drive_file_id);
      } else {
        throw new Error("Keine Datei verknüpft.");
      }
      await saveBookBlob(book.id, b, { title: book.title, format: book.format });
      toast.success("Offline gespeichert.");
      onChanged();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function removeOffline(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    await removeBookBlob(book.id);
    toast.success("Offline-Kopie entfernt.");
    onChanged();
  }

  const disabledLink = !online && !cached;

  return (
    <Link
      to="/read/$bookId"
      params={{ bookId: book.id }}
      onClick={(e) => { if (disabledLink) { e.preventDefault(); toast.error("Offline: zuerst herunterladen."); } }}
      className={`group block ${disabledLink ? "opacity-50" : ""}`}
    >
      <div className={`aspect-[2/3] rounded-2xl border hairline ${tone} relative overflow-hidden transition-transform group-hover:-translate-y-1 shadow-sm`}>
        <div className="absolute inset-0 flex items-center justify-center p-5 text-center">
          <span className="font-serif text-lg leading-tight">{book.title}</span>
        </div>
        <div className="absolute top-2.5 left-2.5 label-mono bg-background/80 rounded-full px-2 py-0.5">{book.format.toUpperCase()}</div>
        <button
          type="button"
          onClick={cached ? removeOffline : downloadForOffline}
          disabled={busy || (!cached && !online)}
          title={cached ? "Offline-Kopie entfernen" : "Für Offline herunterladen"}
          className="absolute top-2.5 right-2.5 inline-flex items-center gap-1 label-mono bg-background/85 hover:bg-background rounded-full px-2 py-0.5 disabled:opacity-50"
        >
          {busy ? (
            <RefreshCw className="h-3 w-3 animate-spin" />
          ) : cached ? (
            <><CheckCircle className="h-3 w-3 text-primary" /> OFFLINE</>
          ) : (
            <Download className="h-3 w-3" />
          )}
        </button>
      </div>
      <div className="mt-3 px-1">
        <div className="font-serif text-base truncate">{book.title}</div>
        <div className="label-mono text-muted-foreground mt-1">
          {book.pages ? `${book.current_page} / ${book.pages}` : "—"}
        </div>
      </div>
    </Link>
  );
}

function EmptyState() {
  return (
    <div className="rounded-3xl border hairline bg-card/60 py-20 text-center">
      <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary/20 text-primary">
        <BookOpen className="h-6 w-6" />
      </div>
      <p className="mt-5 font-serif text-2xl">Noch keine Bücher.</p>
      <p className="mt-2 text-sm text-muted-foreground">Lade ein PDF oder EPUB hoch, oder synce dein Drive.</p>
    </div>
  );
}

function LibStats({ books }: { books: Book[] }) {
  const stats = useMemo(() => {
    const total = books.length;
    const reading = books.filter((b) => b.current_page > 0 && (!b.pages || b.current_page < b.pages)).length;
    const finished = books.filter((b) => b.pages && b.current_page >= b.pages).length;
    const pagesRead = books.reduce((a, b) => a + (b.current_page || 0), 0);
    return { total, reading, finished, pagesRead };
  }, [books]);
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Kpi tone="bg-secondary" icon={<LibraryIcon className="h-4 w-4" />} label="BIBLIOTHEK" value={String(stats.total)} hint="Bücher" />
      <Kpi tone="bg-accent/30" icon={<BookOpen className="h-4 w-4" />} label="LESE GERADE" value={String(stats.reading)} hint="aktiv" />
      <Kpi tone="bg-primary/15" icon={<CheckCircle2 className="h-4 w-4" />} label="FERTIG" value={String(stats.finished)} hint="durchgelesen" />
      <Kpi tone="bg-sun/30" icon={<FileText className="h-4 w-4" />} label="SEITEN" value={stats.pagesRead.toLocaleString("de-DE")} hint="gesamt" />
    </div>
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
