import { useEffect, useRef, useState } from "react";
import { getStroke } from "perfect-freehand";

export type InkStroke = { points: number[][]; color: string; size: number };

export type Tool = "pen" | "highlight" | "none";

export function PenLayer({
  width,
  height,
  tool,
  color = "#ef4444",
  strokes,
  onCommit,
}: {
  width: number;
  height: number;
  tool: Tool;
  color?: string;
  strokes: InkStroke[];
  onCommit: (stroke: InkStroke) => void;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const [current, setCurrent] = useState<number[][] | null>(null);

  function pt(e: React.PointerEvent) {
    const r = ref.current!.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top, e.pressure || 0.5];
  }

  function down(e: React.PointerEvent) {
    if (tool === "none") return;
    (e.target as Element).setPointerCapture(e.pointerId);
    setCurrent([pt(e)]);
  }
  function move(e: React.PointerEvent) {
    if (!current) return;
    setCurrent([...current, pt(e)]);
  }
  function up() {
    if (!current || current.length < 2) { setCurrent(null); return; }
    onCommit({
      points: current,
      color: tool === "highlight" ? "#fde047" : color,
      size: tool === "highlight" ? 18 : 3,
    });
    setCurrent(null);
  }

  return (
    <svg
      ref={ref}
      width={width}
      height={height}
      className="absolute inset-0"
      style={{ pointerEvents: tool === "none" ? "none" : "auto", touchAction: "none" }}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
    >
      {strokes.map((s, i) => (
        <path key={i} d={pathFromStroke(getStroke(s.points, { size: s.size, thinning: 0.5, smoothing: 0.5 }))} fill={s.color} opacity={s.size > 10 ? 0.35 : 1} />
      ))}
      {current && (
        <path d={pathFromStroke(getStroke(current, { size: tool === "highlight" ? 18 : 3, thinning: 0.5 }))} fill={tool === "highlight" ? "#fde047" : color} opacity={tool === "highlight" ? 0.35 : 1} />
      )}
    </svg>
  );
}

function pathFromStroke(stroke: number[][]) {
  if (!stroke.length) return "";
  const d = stroke.reduce(
    (acc, [x0, y0], i, arr) => {
      const [x1, y1] = arr[(i + 1) % arr.length];
      acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
      return acc;
    },
    ["M", ...stroke[0], "Q"] as Array<string | number>,
  );
  d.push("Z");
  return d.join(" ");
}

export function useEffectClient(fn: () => void | (() => void), deps: unknown[]) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(fn, deps);
}
