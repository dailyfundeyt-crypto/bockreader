import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppHeader";
import { useMemo } from "react";

type Session = { started_at: string; duration_seconds: number; pages_read: number; book_id: string };
type Book = { id: string; title: string };

export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({ meta: [{ title: "Analytics · Pages" }] }),
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const sessQ = useQuery({
    queryKey: ["sessions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reading_sessions")
        .select("started_at, duration_seconds, pages_read, book_id")
        .order("started_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data as Session[];
    },
  });
  const booksQ = useQuery({
    queryKey: ["books-min"],
    queryFn: async () => {
      const { data, error } = await supabase.from("books").select("id, title");
      if (error) throw error;
      return data as Book[];
    },
  });

  const stats = useMemo(() => {
    const s = sessQ.data ?? [];
    const totalSec = s.reduce((a, x) => a + (x.duration_seconds || 0), 0);
    const today = new Date().toDateString();
    const todaySec = s.filter((x) => new Date(x.started_at).toDateString() === today).reduce((a, x) => a + x.duration_seconds, 0);
    const byBook = new Map<string, number>();
    for (const x of s) byBook.set(x.book_id, (byBook.get(x.book_id) || 0) + x.duration_seconds);
    return { totalSec, todaySec, byBook };
  }, [sessQ.data]);

  const heatmap = useMemo(() => {
    const days: { date: string; sec: number }[] = [];
    const now = new Date();
    for (let i = 83; i >= 0; i--) {
      const d = new Date(now); d.setDate(now.getDate() - i);
      days.push({ date: d.toDateString(), sec: 0 });
    }
    for (const x of sessQ.data ?? []) {
      const k = new Date(x.started_at).toDateString();
      const d = days.find((d) => d.date === k); if (d) d.sec += x.duration_seconds;
    }
    return days;
  }, [sessQ.data]);

  return (
    <div>
      <PageHeader kicker="ANALYTICS" title="Deine Zahlen." />
      <div className="p-8 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Stat label="Heute" value={fmtTime(stats.todaySec)} />
          <Stat label="Gesamt" value={fmtTime(stats.totalSec)} />
          <Stat label="Sessions" value={String(sessQ.data?.length ?? 0)} />
        </div>

        <div className="border hairline p-6">
          <div className="label-mono text-muted-foreground mb-4">12-Wochen-Heatmap</div>
          <div className="grid grid-flow-col grid-rows-7 gap-1 w-fit">
            {heatmap.map((d) => {
              const intensity = Math.min(1, d.sec / 1800);
              return (
                <div
                  key={d.date}
                  title={`${d.date}: ${fmtTime(d.sec)}`}
                  className="w-3 h-3 border hairline"
                  style={{ background: intensity ? `color-mix(in oklab, var(--color-accent) ${Math.round(intensity * 100)}%, transparent)` : "transparent" }}
                />
              );
            })}
          </div>
        </div>

        <div className="border hairline">
          <div className="label-mono text-muted-foreground px-6 py-4 border-b hairline">Pro Buch</div>
          <div className="divide-y hairline">
            {[...stats.byBook.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([id, sec]) => {
              const title = booksQ.data?.find((b) => b.id === id)?.title ?? "Unbekannt";
              return (
                <div key={id} className="flex items-center justify-between px-6 py-3">
                  <span className="font-mono text-sm">{title}</span>
                  <span className="label-mono text-muted-foreground">{fmtTime(sec)}</span>
                </div>
              );
            })}
            {!stats.byBook.size && <div className="px-6 py-6 label-mono text-muted-foreground">Noch keine Lese-Sessions.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border hairline p-6">
      <div className="label-mono text-muted-foreground">{label}</div>
      <div className="mt-2 font-mono text-3xl">{value}</div>
    </div>
  );
}

function fmtTime(sec: number) {
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)} min`;
  const h = Math.floor(sec / 3600); const m = Math.floor((sec % 3600) / 60);
  return `${h}h ${m}m`;
}
