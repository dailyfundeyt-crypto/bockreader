import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { downloadFile } from "@/lib/drive";
import { PenLayer, type InkStroke, type Tool } from "@/components/PenLayer";
import { toast } from "sonner";
import { ArrowLeft, ChevronLeft, ChevronRight, Pen, Highlighter, MousePointer2, StickyNote, Sparkles } from "lucide-react";
import { generateLearningUnit } from "@/lib/ai.functions";
import { useServerFn } from "@tanstack/react-start";

export const Route = createFileRoute("/_authenticated/read/$bookId")({
  head: () => ({ meta: [{ title: "Reader · Pages" }] }),
  component: ReaderPage,
});

type Book = {
  id: string;
  title: string;
  format: "pdf" | "epub";
  drive_file_id: string;
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
        const b = await downloadFile((data as Book).drive_file_id);
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

  return (
    <div className="flex flex-col h-screen bg-background">
      <div className="border-b hairline px-4 py-2 flex items-center gap-3">
        <button onClick={() => navigate({ to: "/library" })} className="p-2 hover:bg-secondary"><ArrowLeft className="h-4 w-4" /></button>
        <div className="flex-1 min-w-0">
          <div className="font-mono text-sm truncate">{book.title}</div>
          <div className="label-mono text-muted-foreground">{book.format.toUpperCase()} · {page}{numPages ? `/${numPages}` : ""}</div>
        </div>
        <div className="flex items-center gap-1 border hairline">
          <ToolBtn active={tool === "none"} onClick={() => setTool("none")}><MousePointer2 className="h-4 w-4" /></ToolBtn>
          <ToolBtn active={tool === "pen"} onClick={() => setTool("pen")}><Pen className="h-4 w-4" /></ToolBtn>
          <ToolBtn active={tool === "highlight"} onClick={() => setTool("highlight")}><Highlighter className="h-4 w-4" /></ToolBtn>
          <ToolBtn onClick={addNote}><StickyNote className="h-4 w-4" /></ToolBtn>
        </div>
        <button onClick={generate} disabled={generating} className="label-mono bg-foreground text-background px-3 py-2 hover:bg-accent flex items-center gap-2 disabled:opacity-60">
          <Sparkles className="h-3.5 w-3.5" /> {generating ? "..." : "Lerneinheit"}
        </button>
      </div>

      <div className="flex-1 overflow-auto flex items-start justify-center py-6">
        {blob && book.format === "pdf" && (
          <PdfView
            blob={blob}
            page={page}
            onNumPages={setNumPages}
            tool={tool}
            strokes={inkStrokes}
            onStroke={commitStroke}
            notes={pageAnns.filter((a) => a.type === "note")}
          />
        )}
        {blob && book.format === "epub" && (
          <EpubView blob={blob} page={page} onPage={setPage} onNumPages={setNumPages} />
        )}
      </div>

      <div className="border-t hairline px-4 py-2 flex items-center justify-center gap-4">
        <button onClick={() => setPage((p) => Math.max(1, p - 1))} className="p-2 hover:bg-secondary"><ChevronLeft className="h-4 w-4" /></button>
        <span className="font-mono text-sm">{page}{numPages ? ` / ${numPages}` : ""}</span>
        <button onClick={() => setPage((p) => (numPages ? Math.min(numPages, p + 1) : p + 1))} className="p-2 hover:bg-secondary"><ChevronRight className="h-4 w-4" /></button>
      </div>
    </div>
  );
}

function ToolBtn({ children, active, onClick }: { children: React.ReactNode; active?: boolean; onClick?: () => void }) {
  return (
    <button onClick={onClick} className={`p-2 ${active ? "bg-foreground text-background" : "hover:bg-secondary"}`}>{children}</button>
  );
}

// ============= PDF =============
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

function PdfView({
  blob, page, onNumPages, tool, strokes, onStroke, notes,
}: {
  blob: Blob; page: number; onNumPages: (n: number) => void; tool: Tool;
  strokes: InkStroke[]; onStroke: (s: InkStroke) => void;
  notes: Annotation[];
}) {
  const [size, setSize] = useState({ w: 800, h: 1000 });
  const [buf, setBuf] = useState<Uint8Array | null>(null);
  useEffect(() => { let c = false; blob.arrayBuffer().then((a) => { if (!c) setBuf(new Uint8Array(a)); }); return () => { c = true; }; }, [blob]);
  const fileMemo = useMemo(() => (buf ? { data: buf } : null), [buf]);
  return (
    <div className="relative shadow-lg" style={{ width: size.w }}>
      {fileMemo && (
        <Document file={fileMemo} onLoadSuccess={({ numPages }) => onNumPages(numPages)} loading={<div className="p-12 label-mono">Lade PDF…</div>}>
          <Page
            pageNumber={page}
            width={800}
            onRenderSuccess={(p) => setSize({ w: p.width, h: p.height })}
          />
        </Document>
      )}
      <PenLayer width={size.w} height={size.h} tool={tool} strokes={strokes} onCommit={onStroke} />
      {notes.map((n) => (
        <div key={n.id} className="absolute bg-yellow-200 text-black text-xs p-2 max-w-[160px] shadow" style={{ left: n.data.x, top: n.data.y }}>
          {n.data.text}
        </div>
      ))}
    </div>
  );
}

// ============= EPUB =============
function EpubView({ blob, page, onPage, onNumPages }: { blob: Blob; page: number; onPage: (n: number) => void; onNumPages: (n: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const renditionRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ePub = (await import("epubjs")).default;
      if (cancelled || !ref.current) return;
      const buf = await blob.arrayBuffer();
      const book = ePub(buf as any);
      const rendition = book.renderTo(ref.current, { width: 800, height: 1000, spread: "none" });
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
    if (!renditionRef.current) return;
    const cfi = renditionRef.current.book?.locations?.cfiFromLocation(page);
    if (cfi) renditionRef.current.display(cfi);
  }, [page]);

  return <div ref={ref} className="border hairline bg-white" style={{ width: 800, height: 1000 }} />;
}
