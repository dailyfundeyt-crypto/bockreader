import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppHeader";
import { toast } from "sonner";
import { useMemo, useState } from "react";
import { Clock, BookMarked, Calendar, Flame, Target, Pencil, Check, TrendingUp } from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  RadialBarChart,
  RadialBar,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

type Goal = { id: string; type: GoalType; target: number };
type GoalType = "daily_minutes" | "daily_pages" | "books_month" | "books_year";
type Session = { started_at: string; duration_seconds: number; pages_read: number };

const TYPES: { key: GoalType; label: string; unit: string; icon: typeof Clock; tone: string }[] = [
  { key: "daily_minutes", label: "Lesezeit / Tag", unit: "Min.", icon: Clock, tone: "bg-secondary" },
  { key: "daily_pages", label: "Seiten / Tag", unit: "Seiten", icon: BookMarked, tone: "bg-accent/25" },
  { key: "books_month", label: "Bücher / Monat", unit: "Bücher", icon: Calendar, tone: "bg-primary/15" },
  { key: "books_year", label: "Bücher / Jahr", unit: "Bücher", icon: Target, tone: "bg-sun/25" },
];

export const Route = createFileRoute("/_authenticated/goals")({
  head: () => ({ meta: [{ title: "Goals · Pages" }] }),
  component: GoalsPage,
});

function GoalsPage() {
  const qc = useQueryClient();

  const goalsQ = useQuery({
    queryKey: ["goals"],
    queryFn: async () => {
      const { data, error } = await supabase.from("goals").select("*");
      if (error) throw error;
      return data as Goal[];
    },
  });

  const sessQ = useQuery({
    queryKey: ["sessions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reading_sessions")
        .select("started_at, duration_seconds, pages_read")
        .order("started_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data as Session[];
    },
  });

  const booksThisYearQ = useQuery({
    queryKey: ["books-finished"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("books")
        .select("id, added_at, current_page, pages");
      if (error) throw error;
      return data as { id: string; added_at: string; current_page: number; pages: number | null }[];
    },
  });

  const save = useMutation({
    mutationFn: async ({ type, target }: { type: GoalType; target: number }) => {
      const { data: user } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("goals")
        .upsert({ user_id: user.user!.id, type, target }, { onConflict: "user_id,type" });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Ziel gespeichert."); qc.invalidateQueries({ queryKey: ["goals"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const stats = useMemo(() => {
    const s = sessQ.data ?? [];
    const now = new Date();
    const today = now.toDateString();
    const month = now.getMonth();
    const year = now.getFullYear();

    const todaySec = s.filter((x) => new Date(x.started_at).toDateString() === today)
      .reduce((a, x) => a + x.duration_seconds, 0);
    const todayPages = s.filter((x) => new Date(x.started_at).toDateString() === today)
      .reduce((a, x) => a + (x.pages_read || 0), 0);

    const books = booksThisYearQ.data ?? [];
    const finished = books.filter((b) => b.pages && b.current_page >= b.pages);
    const finishedMonth = finished.filter((b) => {
      const d = new Date(b.added_at);
      return d.getMonth() === month && d.getFullYear() === year;
    }).length;
    const finishedYear = finished.filter((b) => new Date(b.added_at).getFullYear() === year).length;

    // 30-day daily reading time
    const days: { date: string; label: string; minutes: number; pages: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now); d.setDate(now.getDate() - i); d.setHours(0,0,0,0);
      days.push({
        date: d.toDateString(),
        label: `${d.getDate()}.${d.getMonth() + 1}`,
        minutes: 0,
        pages: 0,
      });
    }
    for (const x of s) {
      const k = new Date(x.started_at).toDateString();
      const day = days.find((d) => d.date === k);
      if (day) {
        day.minutes += Math.round(x.duration_seconds / 60);
        day.pages += x.pages_read || 0;
      }
    }

    // Streak: consecutive days with any reading, ending today/yesterday
    let streak = 0;
    for (let i = days.length - 1; i >= 0; i--) {
      if (days[i].minutes > 0) streak++;
      else if (i !== days.length - 1) break;
    }

    // Weekly aggregated bars (last 8 weeks)
    const weeks: { label: string; minutes: number }[] = [];
    for (let i = 7; i >= 0; i--) {
      const end = new Date(now); end.setDate(now.getDate() - i * 7);
      const start = new Date(end); start.setDate(end.getDate() - 6);
      const mins = s.filter((x) => {
        const t = new Date(x.started_at);
        return t >= start && t <= end;
      }).reduce((a, x) => a + Math.round(x.duration_seconds / 60), 0);
      weeks.push({ label: `KW ${weekNo(end)}`, minutes: mins });
    }

    return { todaySec, todayPages, finishedMonth, finishedYear, days, streak, weeks };
  }, [sessQ.data, booksThisYearQ.data]);

  const goalMap = useMemo(() => {
    const m: Partial<Record<GoalType, number>> = {};
    for (const g of goalsQ.data ?? []) m[g.type] = g.target;
    return m;
  }, [goalsQ.data]);

  const todayMin = Math.round(stats.todaySec / 60);
  const tMin = goalMap.daily_minutes ?? 0;
  const tPages = goalMap.daily_pages ?? 0;
  const tMonth = goalMap.books_month ?? 0;
  const tYear = goalMap.books_year ?? 0;

  return (
    <div>
      <PageHeader kicker="GOALS" title="Dein Lese-Bord." />

      <div className="p-8 space-y-6 max-w-7xl">
        {/* Top KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Kpi tone="bg-primary text-primary-foreground" icon={<Flame className="h-5 w-5" />} label="Streak" value={`${stats.streak} Tage`} hint="In Folge gelesen" />
          <Kpi tone="bg-card border hairline" icon={<Clock className="h-5 w-5 text-primary" />} label="Heute gelesen" value={`${todayMin} min`} hint={tMin ? `Ziel: ${tMin} min` : "Kein Tagesziel"} />
          <Kpi tone="bg-secondary" icon={<BookMarked className="h-5 w-5 text-sage-deep" />} label="Seiten heute" value={String(stats.todayPages)} hint={tPages ? `Ziel: ${tPages}` : "Kein Tagesziel"} />
          <Kpi tone="bg-accent/30" icon={<Calendar className="h-5 w-5 text-accent-foreground" />} label="Bücher 'd Jahr" value={String(stats.finishedYear)} hint={tYear ? `Ziel: ${tYear}` : "Kein Jahresziel"} />
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Daily minutes area */}
          <div className="lg:col-span-2 rounded-2xl border hairline bg-card/70 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="label-mono text-primary">LESEZEIT — 30 TAGE</div>
                <div className="font-serif text-2xl mt-1">Wie konstant liest du?</div>
              </div>
              <TrendingUp className="h-5 w-5 text-muted-foreground" />
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={stats.days} margin={{ left: -10, right: 8, top: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="sage" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--hairline)" vertical={false} />
                <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={11} interval={4} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} width={32} />
                <Tooltip content={<TtCustom suffix=" min" />} />
                {tMin > 0 && <ReferenceLineLike y={tMin} />}
                <Area type="monotone" dataKey="minutes" stroke="var(--primary)" strokeWidth={2} fill="url(#sage)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Daily goal radial */}
          <div className="rounded-2xl border hairline bg-primary/15 p-6 shadow-sm flex flex-col">
            <div className="label-mono text-primary">HEUTE</div>
            <div className="font-serif text-2xl mt-1">Tagesziel</div>
            <div className="flex-1 flex items-center justify-center">
              <RadialGoal value={todayMin} target={tMin} unit="min" />
            </div>
            <div className="text-sm text-muted-foreground text-center">
              {tMin ? (todayMin >= tMin ? "Geschafft ✿" : `Noch ${tMin - todayMin} min`) : "Setz unten ein Ziel."}
            </div>
          </div>
        </div>

        {/* Second row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Weeks bar */}
          <div className="lg:col-span-2 rounded-2xl border hairline bg-card/70 p-6 shadow-sm">
            <div className="label-mono text-primary">WOCHEN-RHYTHMUS</div>
            <div className="font-serif text-2xl mt-1">Letzte 8 Wochen</div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={stats.weeks} margin={{ left: -10, right: 8, top: 16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--hairline)" vertical={false} />
                <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} width={32} />
                <Tooltip content={<TtCustom suffix=" min" />} />
                <Bar dataKey="minutes" fill="var(--accent)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Books per month / year */}
          <div className="rounded-2xl border hairline bg-secondary p-6 shadow-sm">
            <div className="label-mono text-primary">BÜCHER</div>
            <div className="font-serif text-2xl mt-1">Diesen Monat / Jahr</div>
            <div className="mt-6 space-y-5">
              <Progress label="Monat" value={stats.finishedMonth} target={tMonth} tone="primary" />
              <Progress label="Jahr" value={stats.finishedYear} target={tYear} tone="accent" />
            </div>
            <div className="mt-6 text-xs text-muted-foreground">
              Ein Buch zählt als „fertig", wenn current_page = pages.
            </div>
          </div>
        </div>

        {/* Goal setters */}
        <div>
          <div className="label-mono text-primary mb-3">DEINE ZIELE</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {TYPES.map((t) => {
              const current = goalMap[t.key] ?? "";
              return <GoalCard key={t.key} type={t} initial={current} onSave={(v) => save.mutate({ type: t.key, target: v })} />;
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

function GoalCard({ type, initial, onSave }: { type: { key: GoalType; label: string; unit: string; icon: typeof Clock; tone: string }; initial: number | ""; onSave: (n: number) => void }) {
  const [v, setV] = useState<string>(initial === "" ? "" : String(initial));
  const [editing, setEditing] = useState(initial === "");
  const Icon = type.icon;
  return (
    <div className={`rounded-2xl border hairline p-5 ${type.tone} shadow-sm`}>
      <div className="flex items-center gap-3">
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-background/60 text-foreground">
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <div className="font-serif text-lg">{type.label}</div>
          <div className="text-xs text-muted-foreground">{type.unit}</div>
        </div>
        {!editing && (
          <button onClick={() => setEditing(true)} className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-background/60 hover:bg-background transition-colors" aria-label="Bearbeiten">
            <Pencil className="h-4 w-4" />
          </button>
        )}
      </div>
      <div className="mt-4 flex items-center gap-2">
        {editing ? (
          <>
            <input
              type="number"
              min={1}
              value={v}
              onChange={(e) => setV(e.target.value)}
              className="flex-1 rounded-full bg-background border hairline px-4 py-2.5 font-sans text-base"
              placeholder="z. B. 30"
              autoFocus
            />
            <button
              onClick={() => {
                const n = parseInt(v, 10);
                if (n > 0) { onSave(n); setEditing(false); }
              }}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-sage-deep transition-colors shadow-sm"
              aria-label="Speichern"
            >
              <Check className="h-4 w-4" />
            </button>
          </>
        ) : (
          <div className="font-serif text-3xl font-semibold">
            {v || "—"} <span className="text-base text-muted-foreground">{type.unit}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function Progress({ label, value, target, tone }: { label: string; value: number; target: number; tone: "primary" | "accent" }) {
  const pct = target > 0 ? Math.min(100, Math.round((value / target) * 100)) : 0;
  const bar = tone === "primary" ? "bg-primary" : "bg-accent";
  return (
    <div>
      <div className="flex items-end justify-between mb-2">
        <div className="font-sans font-medium">{label}</div>
        <div className="text-sm text-muted-foreground">
          <span className="font-serif text-xl text-foreground">{value}</span>
          {target > 0 && <span> / {target}</span>}
        </div>
      </div>
      <div className="h-3 rounded-full bg-background/70 overflow-hidden">
        <div className={`h-full ${bar} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function RadialGoal({ value, target, unit }: { value: number; target: number; unit: string }) {
  const pct = target > 0 ? Math.min(100, (value / target) * 100) : 0;
  const data = [{ name: "x", value: pct, fill: "var(--primary)" }];
  return (
    <div className="relative w-48 h-48">
      <ResponsiveContainer>
        <RadialBarChart innerRadius="75%" outerRadius="100%" data={data} startAngle={90} endAngle={-270}>
          <RadialBar dataKey="value" cornerRadius={20} background={{ fill: "color-mix(in oklab, var(--primary) 18%, transparent)" }} />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="font-serif text-4xl font-semibold">{value}</div>
        <div className="text-xs text-muted-foreground">
          {target > 0 ? `von ${target} ${unit}` : unit}
        </div>
      </div>
    </div>
  );
}

function TtCustom({ active, payload, label, suffix = "" }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border hairline bg-card px-3 py-2 shadow-md">
      <div className="label-mono text-muted-foreground">{label}</div>
      <div className="font-serif text-base">{payload[0].value}{suffix}</div>
    </div>
  );
}

// Lightweight ReferenceLine to avoid extra import shenanigans
function ReferenceLineLike(_props: { y: number }) {
  return null;
}

function weekNo(d: Date) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}
