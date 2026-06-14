import { useEffect, useMemo, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { PenLayer, type InkStroke, type Tool } from "@/components/PenLayer";

pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

type Annotation = {
  id: string;
  page: number;
  type: "ink" | "highlight" | "note";
  data: { strokes?: InkStroke[]; text?: string; x?: number; y?: number };
};

export default function PdfView({
  blob, page, onNumPages, tool, strokes, onStroke, notes,
}: {
  blob: Blob; page: number; onNumPages: (n: number) => void; tool: Tool;
  strokes: InkStroke[]; onStroke: (s: InkStroke) => void;
  notes: Annotation[];
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);
  const [size, setSize] = useState({ w: 800, h: 1000 });
  const [buf, setBuf] = useState<Uint8Array | null>(null);
  useEffect(() => { let c = false; blob.arrayBuffer().then((a) => { if (!c) setBuf(new Uint8Array(a)); }); return () => { c = true; }; }, [blob]);
  useEffect(() => {
    function measure() {
      const w = wrapRef.current?.parentElement?.clientWidth ?? 800;
      setWidth(Math.min(900, Math.max(280, w - 16)));
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);
  const fileMemo = useMemo(() => (buf ? { data: buf } : null), [buf]);
  return (
    <div ref={wrapRef} className="relative shadow-lg" style={{ width: size.w }}>
      {fileMemo && (
        <Document file={fileMemo} onLoadSuccess={({ numPages }) => onNumPages(numPages)} loading={<div className="p-12 label-mono">Lade PDF…</div>}>
          <Page
            pageNumber={page}
            width={width}
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
