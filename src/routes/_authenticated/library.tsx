import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { downloadFile, ensurePagesFolders, listBooks, uploadFile } from "@/lib/drive";
import { PageHeader } from "@/components/AppHeader";
import { toast } from "sonner";
import { Upload, RefreshCw, BookOpen } from "lucide-react";

export const Route = createFileRoute("/_authenticated/library")({
  head: () => ({ meta: [{ title: "Library · Pages" }] }),
  component: LibraryPage,
});

type Book = {
  id: string;
  title: string;
  author: string | null;
  format: "pdf" | "epub";
  drive_file_id: string;
  cover_url: string | null;
  pages: number | null;
  current_page: number;
  added_at: string;
};

function LibraryPage() {
  const qc = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [syncing, setSyncing] = useState(false);

  const booksQ = useQuery({
    queryKey: ["books"],
    queryFn: async () => {
      const { data, error } = await supabase.from("books").select("*").order("added_at", { ascending: false });
      if (error) throw error;
      return data as Book[];
    },
  });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const { books } = await ensurePagesFolders();
      const isPdf = file.name.toLowerCase().endsWith(".pdf");
      const isEpub = file.name.toLowerCase().endsWith(".epub");
      if (!isPdf && !isEpub) throw new Error("Nur PDF und EPUB.");
      const mimeType = isPdf ? "application/pdf" : "application/epub+zip";
      const { id: driveId } = await uploadFile({ name: file.name, mimeType, parentId: books, blob: file });
      const title = file.name.replace(/\.(pdf|epub)$/i, "");
      const { data: user } = await supabase.auth.getUser();
      const { error } = await supabase.from("books").insert({
        user_id: user.user!.id,
        title,
        format: isPdf ? "pdf" : "epub",
        drive_file_id: driveId,
      });
      if (error) throw error;
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
            <button onClick={syncDrive} disabled={syncing} className="label-mono border hairline px-3 py-2 hover:bg-secondary flex items-center gap-2">
              <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} /> Sync
            </button>
            <button onClick={() => fileInput.current?.click()} className="label-mono bg-foreground text-background px-3 py-2 flex items-center gap-2 hover:bg-accent">
              <Upload className="h-3.5 w-3.5" /> Upload
            </button>
            <input
              ref={fileInput}
              type="file"
              accept=".pdf,.epub"
              hidden
              onChange={(e) => { const f = e.target.files?.[0]; if (f) upload.mutate(f); e.currentTarget.value = ""; }}
            />
          </>
        }
      />
      <div className="p-8">
        {booksQ.isLoading ? (
          <p className="label-mono text-muted-foreground">Lade…</p>
        ) : !booksQ.data?.length ? (
          <EmptyState />
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
            {booksQ.data.map((b) => <BookTile key={b.id} book={b} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function BookTile({ book }: { book: Book }) {
  return (
    <Link to="/read/$bookId" params={{ bookId: book.id }} className="group block">
      <div className="aspect-[2/3] border hairline bg-secondary relative overflow-hidden">
        <div className="absolute inset-0 dot-matrix opacity-40" />
        <div className="absolute inset-0 flex items-center justify-center p-4 text-center">
          <span className="font-mono text-sm leading-tight">{book.title}</span>
        </div>
        <div className="absolute top-2 left-2 label-mono bg-background/80 px-1.5 py-0.5">{book.format.toUpperCase()}</div>
      </div>
      <div className="mt-3">
        <div className="font-mono text-sm truncate">{book.title}</div>
        <div className="label-mono text-muted-foreground mt-1">
          {book.pages ? `${book.current_page}/${book.pages}` : "—"}
        </div>
      </div>
    </Link>
  );
}

function EmptyState() {
  return (
    <div className="border hairline dot-matrix py-20 text-center">
      <BookOpen className="mx-auto h-8 w-8 text-muted-foreground" />
      <p className="mt-4 font-mono text-lg">Noch keine Bücher.</p>
      <p className="mt-2 label-mono text-muted-foreground">Lade ein PDF oder EPUB hoch, oder synce dein Drive.</p>
    </div>
  );
}
