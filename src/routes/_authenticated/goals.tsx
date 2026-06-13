import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppHeader";
import { toast } from "sonner";
import { useState } from "react";

type Goal = { id: string; type: GoalType; target: number };
type GoalType = "daily_minutes" | "daily_pages" | "books_month" | "books_year";

const TYPES: { key: GoalType; label: string; unit: string }[] = [
  { key: "daily_minutes", label: "Lesezeit pro Tag", unit: "Min." },
  { key: "daily_pages", label: "Seiten pro Tag", unit: "Seiten" },
  { key: "books_month", label: "Bücher pro Monat", unit: "Bücher" },
  { key: "books_year", label: "Bücher pro Jahr", unit: "Bücher" },
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

  const save = useMutation({
    mutationFn: async ({ type, target }: { type: GoalType; target: number }) => {
      const { data: user } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("goals")
        .upsert({ user_id: user.user!.id, type, target }, { onConflict: "user_id,type" });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Gespeichert."); qc.invalidateQueries({ queryKey: ["goals"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader kicker="GOALS" title="Setz dir Ziele." />
      <div className="p-8 max-w-2xl space-y-4">
        {TYPES.map((t) => {
          const current = goalsQ.data?.find((g) => g.type === t.key)?.target ?? "";
          return <GoalRow key={t.key} type={t} initial={current} onSave={(v) => save.mutate({ type: t.key, target: v })} />;
        })}
      </div>
    </div>
  );
}

function GoalRow({ type, initial, onSave }: { type: { key: GoalType; label: string; unit: string }; initial: number | ""; onSave: (n: number) => void }) {
  const [v, setV] = useState<string>(initial === "" ? "" : String(initial));
  return (
    <div className="border hairline p-5 flex items-center justify-between gap-4">
      <div>
        <div className="font-mono text-sm">{type.label}</div>
        <div className="label-mono text-muted-foreground mt-1">{type.unit}</div>
      </div>
      <div className="flex items-center gap-2">
        <input type="number" min={1} value={v} onChange={(e) => setV(e.target.value)} className="w-24 bg-secondary border hairline px-3 py-2 font-mono text-sm text-right" />
        <button onClick={() => { const n = parseInt(v, 10); if (n > 0) onSave(n); }} className="label-mono bg-foreground text-background px-3 py-2 hover:bg-accent">Speichern</button>
      </div>
    </div>
  );
}
