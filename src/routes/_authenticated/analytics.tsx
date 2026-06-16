import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppHeader";
import { useMemo } from "react";
import { Clock, Flame, BookOpen, TrendingUp } from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";

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
    const totalPages = s.reduce((a, x) => a + (x.pages_read || 0), 0);
    const today = new Date().toDateString();
    const todaySec = s.filter((x) => new Date(x.started_at).toDateString() === today).reduce((a, x) => a + x.duration_seconds, 0);

    // 30-day area
    const days: { date: string; label: string; minutes: number; pages: number }[] = [];
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now); d.setDate(now.getDate() - i);
      days.push({ date: d.toDateString(), label: `${d.getDate()}.${d.getMonth() + 1}.`, minutes: 0, pages: 0 });
    }
    for (const x of s) {
      const k = new Date(x.started_at).toDateString();
      const d = days.find((d) => d.date === k);
      if (d) { d.minutes += Math.round(x.duration_seconds / 60); d.pages += x.pages_read || 0; }
    }

    // by hour of day
    const hours = Array.from({ length: 24 }, (_, h) => ({ h: `${h}h`, minutes: 0 }));
    for (const x of s) {
      const h = new Date(x.started_at).getHours();
      hours[h].minutes += Math.round(x.duration_seconds / 60);
    }

    // by weekday
    const wd = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((label) => ({ label, minutes: 0 }));
    for (const x of s) {
      const d = new Date(x.started_at).getDay(); // 0=Sun
      const idx = d === 0 ? 6 : d - 1;
      wd[idx].minutes += Math.round(x.duration_seconds / 60);
    }

    // by book
    const byBook = new Map<string, number>();
    for (const x of s) byBook.set(x.book_id, (byBook.get(x.book_id) || 0) + x.duration_seconds);

    // streak
    const dayHas = new Set(s.map((x) => new Date(x.started_at).toDateString()));
    let streak = 0;
    for (let i = 0; ; i++) {
      const d = new Date(); d.setDate(d.getDate() - i);
      if (dayHas.has(d.toDateString())) streak++; else break;
    }

    // heatmap 12 weeks
    const heat: { date: string; sec: number }[] = [];
    for (let i = 83; i >= 0; i--) {
      const d = new Date(now); d.setDate(now.getDate() - i);
      heat.push({ date: d.toDateString(), sec: 0 });
    }
    for (const x of s) {
      const k = new Date(x.started_at).toDateString();
      const d = heat.find((d) => d.date === k); if (d) d.sec += x.duration_seconds;
    }

    return { totalSec, totalPages, todaySec, days, hours, wd, byBook, streak, heat };
  }, [sessQ.data]);

  const topBooks = useMemo(() => {
    const arr = [...stats.byBook.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, sec]) => ({
        name: booksQ.data?.find((b) => b.id === id)?.title ?? "Unbekannt",
        minutes: Math.round(sec / 60),
      }));
    return arr;
  }, [stats.byBook, booksQ.data]);

  const PIE_TONES = ["var(--primary)", "var(--accent)", "var(--sun)", "var(--sage-deep)", "color-mix(in oklab, var(--primary) 50%, var(--accent))"];

  return (
    <div>
      <PageHeader kicker="ANALYTICS" title="Deine Zahlen." />
      <div className="p-4 sm:p-8 space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Kpi tone="bg-secondary" icon={<Clock className="h-4 w-4" />} label="HEUTE" value={fmtTime(stats.todaySec)} hint="Lesezeit" />
          <Kpi tone="bg-accent/30" icon={<TrendingUp className="h-4 w-4" />} label="GESAMT" value={fmtTime(stats.totalSec)} hint={`${sessQ.data?.length ?? 0} Sessions`} />
          <Kpi tone="bg-primary/15" icon={<BookOpen className="h-4 w-4" />} label="SEITEN" value={String(stats.totalPages)} hint="insgesamt" />
          <Kpi tone="bg-sun/30" icon={<Flame className="h-4 w-4" />} label="STREAK" value={`${stats.streak} Tage`} hint="in Folge" />
        </div>

        {/* 30-day area */}
        <div className="rounded-2xl border hairline bg-card/70 p-6 shadow-sm">
          <div className="label-mono text-primary">30 TAGE</div>
          <div className="font-serif text-2xl mt-1">Lesezeit im Verlauf</div>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={stats.days} margin={{ left: -10, right: 8, top: 16, bottom: 0 }}>
              <defs>
                <linearGradient id="a-min" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--hairline)" vertical={false} />
              <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} interval={4} />
              <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} width={32} />
              <Tooltip content={<Tt suffix=" min" />} />
              <Area type="monotone" dataKey="minutes" stroke="var(--primary)" strokeWidth={2} fill="url(#a-min)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Hour + Weekday */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 rounded-2xl border hairline bg-secondary p-6 shadow-sm">
            <div className="label-mono text-primary">UHRZEIT</div>
            <div className="font-serif text-2xl mt-1">Wann liest du?</div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={stats.hours} margin={{ left: -10, right: 8, top: 16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--hairline)" vertical={false} />
                <XAxis dataKey="h" stroke="var(--muted-foreground)" fontSize={10} tickLine={false} axisLine={false} interval={2} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} width={32} />
                <Tooltip content={<Tt suffix=" min" />} />
                <Bar dataKey="minutes" fill="var(--accent)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="rounded-2xl border hairline bg-accent/25 p-6 shadow-sm">
            <div className="label-mono text-primary">WOCHENTAG</div>
            <div className="font-serif text-2xl mt-1">Rhythmus</div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={stats.wd} margin={{ left: -10, right: 8, top: 16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--hairline)" vertical={false} />
                <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} width={32} />
                <Tooltip content={<Tt suffix=" min" />} />
                <Bar dataKey="minutes" fill="var(--primary)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top books + pages line */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="rounded-2xl border hairline bg-primary/10 p-6 shadow-sm">
            <div className="label-mono text-primary">TOP BÜCHER</div>
            <div className="font-serif text-2xl mt-1">Wo deine Zeit hingeht</div>
            {topBooks.length ? (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={topBooks} dataKey="minutes" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={2}>
                    {topBooks.map((_, i) => <Cell key={i} fill={PIE_TONES[i % PIE_TONES.length]} />)}
                  </Pie>
                  <Tooltip content={<Tt suffix=" min" />} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="py-16 text-center label-mono text-muted-foreground">Noch keine Daten.</div>
            )}
            <div className="mt-3 space-y-1.5">
              {topBooks.map((b, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: PIE_TONES[i % PIE_TONES.length] }} />
                    <span className="font-sans truncate">{b.name}</span>
                  </span>
                  <span className="label-mono text-muted-foreground shrink-0 ml-2">{b.minutes} min</span>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-2 rounded-2xl border hairline bg-card/70 p-6 shadow-sm">
            <div className="label-mono text-primary">SEITEN</div>
            <div className="font-serif text-2xl mt-1">Gelesene Seiten (30 Tage)</div>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={stats.days} margin={{ left: -10, right: 8, top: 16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--hairline)" vertical={false} />
                <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} interval={4} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} width={32} />
                <Tooltip content={<Tt suffix=" Seiten" />} />
                <Line type="monotone" dataKey="pages" stroke="var(--accent)" strokeWidth={2.5} dot={{ r: 3, fill: "var(--accent)" }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Heatmap */}
        <div className="rounded-2xl border hairline bg-sun/20 p-6 shadow-sm">
          <div className="label-mono text-primary">12 WOCHEN</div>
          <div className="font-serif text-2xl mt-1">Heatmap</div>
          <div className="mt-5 grid grid-flow-col grid-rows-7 gap-1.5 w-fit">
            {stats.heat.map((d) => {
              const intensity = Math.min(1, d.sec / 1800);
              return (
                <div
                  key={d.date}
                  title={`${d.date}: ${fmtTime(d.sec)}`}
                  className="w-3.5 h-3.5 rounded-[4px] border hairline"
                  style={{ background: intensity ? `color-mix(in oklab, var(--primary) ${Math.round(intensity * 90 + 10)}%, transparent)` : "color-mix(in oklab, var(--card) 60%, transparent)" }}
                />
              );
            })}
          </div>
        </div>
      </div>
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

function Tt({ active, payload, label, suffix = "" }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border hairline bg-card px-3 py-2 shadow-md">
      <div className="label-mono text-muted-foreground">{label ?? payload[0].name}</div>
      <div className="font-serif text-base">{payload[0].value}{suffix}</div>
    </div>
  );
}

function fmtTime(sec: number) {
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)} min`;
  const h = Math.floor(sec / 3600); const m = Math.floor((sec % 3600) / 60);
  return `${h}h ${m}m`;
}
