import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { downloadFile } from "@/lib/drive";
import { type InkStroke, type Tool } from "@/components/PenLayer";
import { toast } from "sonner";
import { ArrowLeft, ChevronLeft, ChevronRight, Pen, Highlighter, MousePointer2, StickyNote, Sparkles } from "lucide-react";
import { generateLearningUnit } from "@/lib/ai.functions";
import { useServerFn } from "@tanstack/react-start";

const PdfView = lazy(() => import("@/components/PdfView"));

export const Route = createFileRoute("/_authenticated/read/$bookId")({
  head: () => ({ meta: [{ title: "Reader · Pages" }] }),
  component: ReaderPage,
});

type Book = {
  id: string;
  title: string;
  format: "pdf" | "epub";
  drive_file_id: string | null;
  storage_path: string | null;
  pages: number | null;
  current_page: number;
};


type Annotation = {
  id: string;
  page: number;
  type: "ink" | "highlight" | "note";
  data: { strokes?: InkStroke[]; text?: string; x?: number; y?: number };
};

function ReaderPage() {
  const { bookId } = Route.useParams();
  const navigate = useNavigate();
  const [book, setBook] = useState<Book | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [page, setPage] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [tool, setTool] = useState<Tool>("none");
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const sessionStart = useRef<number>(Date.now());
  const sessionId = useRef<string | null>(null);

  // Load book + start session
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from("books").select("*").eq("id", bookId).single();
      if (error) { toast.error(error.message); return; }
      setBook(data as Book);
      setPage((data as Book).current_page || 1);
      try {
        const bk = data as Book;
        let b: Blob;
        if (bk.storage_path) {
          const { data: dl, error: dlErr } = await supabase.storage.from("books").download(bk.storage_path);
          if (dlErr || !dl) throw dlErr ?? new Error("Download fehlgeschlagen.");
          b = dl;
        } else if (bk.drive_file_id) {
          b = await downloadFile(bk.drive_file_id);
        } else {
          throw new Error("Keine Datei verknüpft.");
        }
        setBlob(b);
      } catch (e) { toast.error((e as Error).message); }


      // load annotations
      const { data: anns } = await supabase.from("annotations").select("*").eq("book_id", bookId);
      setAnnotations((anns ?? []) as Annotation[]);

      // start reading session
      const { data: user } = await supabase.auth.getUser();
      const { data: sess } = await supabase
        .from("reading_sessions")
        .insert({ user_id: user.user!.id, book_id: bookId })
        .select("id")
        .single();
      sessionId.current = sess?.id ?? null;
    })();

    return () => {
      const seconds = Math.floor((Date.now() - sessionStart.current) / 1000);
      if (sessionId.current && seconds > 5) {
        supabase
          .from("reading_sessions")
          .update({ ended_at: new Date().toISOString(), duration_seconds: seconds })
          .eq("id", sessionId.current);
      }
    };
  }, [bookId]);

  // Persist current page
  useEffect(() => {
    if (!book) return;
    const t = setTimeout(() => {
      supabase.from("books").update({ current_page: page, pages: numPages || book.pages }).eq("id", book.id);
    }, 600);
    return () => clearTimeout(t);
  }, [page, numPages, book]);

  const pageAnns = useMemo(() => annotations.filter((a) => a.page === page), [annotations, page]);
  const inkStrokes = useMemo<InkStroke[]>(() => {
    const out: InkStroke[] = [];
    for (const a of pageAnns) if (a.type === "ink" || a.type === "highlight") {
      if (a.data.strokes) out.push(...a.data.strokes);
    }
    return out;
  }, [pageAnns]);

  async function commitStroke(stroke: InkStroke) {
    const { data: user } = await supabase.auth.getUser();
    const type = tool === "highlight" ? "highlight" : "ink";
    const { data, error } = await supabase
      .from("annotations")
      .insert({ user_id: user.user!.id, book_id: bookId, page, type, data: { strokes: [stroke] } })
      .select("*")
      .single();
    if (error) { toast.error(error.message); return; }
    setAnnotations((a) => [...a, data as Annotation]);
  }

  async function addNote() {
    const text = window.prompt("Notiz:");
    if (!text) return;
    const { data: user } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("annotations")
      .insert({ user_id: user.user!.id, book_id: bookId, page, type: "note", data: { text, x: 20, y: 20 } })
      .select("*")
      .single();
    if (error) { toast.error(error.message); return; }
    setAnnotations((a) => [...a, data as Annotation]);
  }

  const generateFn = useServerFn(generateLearningUnit);
  const [generating, setGenerating] = useState(false);
  async function generate() {
    if (!book) return;
    setGenerating(true);
    try {
      const res = await generateFn({ data: { bookId: book.id } });
      toast.success("Lerneinheit erstellt: " + res.title);
      navigate({ to: "/notes" });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setGenerating(false);
    }
  }

  if (!book) return <div className="p-8 label-mono">Lade Buch…</div>;

  const goPrev = () => setPage((p) => Math.max(1, p - 1));
  const goNext = () => setPage((p) => (numPages ? Math.min(numPages, p + 1) : p + 1));

  // swipe nav
  const touchX = useRef<number | null>(null);
  function onTouchStart(e: React.TouchEvent) {
    if (tool !== "none") return;
    touchX.current = e.touches[0].clientX;
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    touchX.current = null;
    if (Math.abs(dx) < 50) return;
    if (dx < 0) goNext(); else goPrev();
  }

  return (
    <div className="flex flex-col h-[100dvh] bg-background">
      <div className="border-b hairline px-3 py-2 flex flex-wrap items-center gap-2">
        <button onClick={() => navigate({ to: "/library" })} className="p-2 rounded-md hover:bg-secondary"><ArrowLeft className="h-4 w-4" /></button>
        <div className="flex-1 min-w-0">
          <div className="font-mono text-sm truncate">{book.title}</div>
          <div className="label-mono text-muted-foreground">{book.format.toUpperCase()} · {page}{numPages ? `/${numPages}` : ""}</div>
        </div>
        <div className="flex items-center gap-1 border hairline rounded-md">
          <ToolBtn active={tool === "none"} onClick={() => setTool("none")}><MousePointer2 className="h-4 w-4" /></ToolBtn>
          <ToolBtn active={tool === "pen"} onClick={() => setTool("pen")}><Pen className="h-4 w-4" /></ToolBtn>
          <ToolBtn active={tool === "highlight"} onClick={() => setTool("highlight")}><Highlighter className="h-4 w-4" /></ToolBtn>
          <ToolBtn onClick={addNote}><StickyNote className="h-4 w-4" /></ToolBtn>
        </div>
        <button onClick={generate} disabled={generating} className="label-mono bg-foreground text-background px-3 py-2 rounded-md hover:bg-accent flex items-center gap-2 disabled:opacity-60">
          <Sparkles className="h-3.5 w-3.5" /> {generating ? "..." : "Lerneinheit"}
        </button>
      </div>

      <div
        className="flex-1 overflow-auto flex items-start justify-center py-6 px-2"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {blob && book.format === "pdf" && (
          <Suspense fallback={<div className="p-12 label-mono">Lade PDF…</div>}>
            <PdfView
              blob={blob}
              page={page}
              onNumPages={setNumPages}
              tool={tool}
              strokes={inkStrokes}
              onStroke={commitStroke}
              notes={pageAnns.filter((a) => a.type === "note")}
            />
          </Suspense>
        )}
        {blob && book.format === "epub" && (
          <EpubView blob={blob} page={page} onPage={setPage} onNumPages={setNumPages} />
        )}
      </div>

      <div className="border-t hairline px-4 py-3 flex items-center justify-between gap-3 bg-card/80 backdrop-blur sticky bottom-0" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.75rem)" }}>
        <button onClick={goPrev} disabled={page <= 1} className="flex-1 max-w-[160px] flex items-center justify-center gap-2 rounded-full border hairline bg-background px-4 py-2.5 disabled:opacity-40 active:scale-[0.98] transition">
          <ChevronLeft className="h-4 w-4" /> <span className="label-mono">Zurück</span>
        </button>
        <span className="font-mono text-sm whitespace-nowrap">{page}{numPages ? ` / ${numPages}` : ""}</span>
        <button onClick={goNext} disabled={numPages > 0 && page >= numPages} className="flex-1 max-w-[160px] flex items-center justify-center gap-2 rounded-full bg-primary text-primary-foreground px-4 py-2.5 disabled:opacity-40 active:scale-[0.98] transition shadow-sm">
          <span className="label-mono">Weiter</span> <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function ToolBtn({ children, active, onClick }: { children: React.ReactNode; active?: boolean; onClick?: () => void }) {
  return (
    <button onClick={onClick} className={`p-2 ${active ? "bg-foreground text-background" : "hover:bg-secondary"}`}>{children}</button>
  );
}

// ============= EPUB =============
function EpubView({ blob, page, onPage, onNumPages }: { blob: Blob; page: number; onPage: (n: number) => void; onNumPages: (n: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const renditionRef = useRef<any>(null);
  const [dims, setDims] = useState({ w: 800, h: 1000 });

  useEffect(() => {
    function measure() {
      const w = Math.min(900, Math.max(280, (ref.current?.parentElement?.clientWidth ?? 800) - 16));
      const h = Math.max(420, window.innerHeight - 180);
      setDims({ w, h });
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ePub = (await import("epubjs")).default;
      if (cancelled || !ref.current) return;
      const buf = await blob.arrayBuffer();
      const book = ePub(buf as any);
      const rendition = book.renderTo(ref.current, { width: dims.w, height: dims.h, spread: "none" });
      renditionRef.current = rendition;
      await rendition.display();
      await book.locations.generate(1500);
      onNumPages(book.locations.length());
      rendition.on("relocated", (location: any) => {
        onPage(location.start.location || 1);
      });
    })();
    return () => { cancelled = true; renditionRef.current?.destroy?.(); };
  }, [blob, onNumPages, onPage]);

  useEffect(() => {
    renditionRef.current?.resize?.(dims.w, dims.h);
  }, [dims]);

  useEffect(() => {
    if (!renditionRef.current) return;
    const cfi = renditionRef.current.book?.locations?.cfiFromLocation(page);
    if (cfi) renditionRef.current.display(cfi);
  }, [page]);

  return <div ref={ref} className="border hairline bg-white" style={{ width: dims.w, height: dims.h }} />;
}
