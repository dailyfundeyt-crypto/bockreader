import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppHeader";
import { ensurePagesFolders, uploadTextFile } from "@/lib/drive";
import { useState } from "react";
import { toast } from "sonner";
import { Cloud } from "lucide-react";

type Unit = { id: string; title: string; content_md: string; drive_file_id: string | null; created_at: string };

export const Route = createFileRoute("/_authenticated/notes")({
  head: () => ({ meta: [{ title: "Notes · Pages" }] }),
  component: NotesPage,
});

function NotesPage() {
  const [open, setOpen] = useState<Unit | null>(null);
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["learning_units"],
    queryFn: async () => {
      const { data, error } = await supabase.from("learning_units").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Unit[];
    },
  });

  const exportToDrive = useMutation({
    mutationFn: async (u: Unit) => {
      const { notes } = await ensurePagesFolders();
      const { id } = await uploadTextFile({ name: `${u.title}.md`, parentId: notes, content: u.content_md });
      const { error } = await supabase.from("learning_units").update({ drive_file_id: id }).eq("id", u.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("In Drive gespeichert."); qc.invalidateQueries({ queryKey: ["learning_units"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader kicker="NOTES" title="KI-Lerneinheiten" />
      <div className="p-8 grid grid-cols-1 md:grid-cols-12 gap-6">
        <div className="md:col-span-4 space-y-2">
          {q.isLoading && <p className="label-mono text-muted-foreground">Lade…</p>}
          {!q.data?.length && !q.isLoading && <p className="label-mono text-muted-foreground">Noch keine Einheiten. Erstelle eine im Reader.</p>}
          {q.data?.map((u) => (
            <button
              key={u.id}
              onClick={() => setOpen(u)}
              className={`w-full text-left border hairline p-3 hover:bg-secondary ${open?.id === u.id ? "bg-secondary" : ""}`}
            >
              <div className="font-mono text-sm truncate">{u.title}</div>
              <div className="label-mono text-muted-foreground mt-1 flex items-center gap-2">
                {new Date(u.created_at).toLocaleDateString("de-DE")}
                {u.drive_file_id && <Cloud className="h-3 w-3" />}
              </div>
            </button>
          ))}
        </div>
        <div className="md:col-span-8">
          {open ? (
            <div className="border hairline">
              <div className="flex items-center justify-between border-b hairline px-5 py-3">
                <div className="font-mono text-sm">{open.title}</div>
                <button
                  onClick={() => exportToDrive.mutate(open)}
                  disabled={exportToDrive.isPending || !!open.drive_file_id}
                  className="label-mono border hairline px-3 py-1.5 hover:bg-secondary disabled:opacity-60 flex items-center gap-2"
                >
                  <Cloud className="h-3.5 w-3.5" /> {open.drive_file_id ? "In Drive" : "In Drive speichern"}
                </button>
              </div>
              <pre className="p-6 whitespace-pre-wrap font-mono text-sm leading-relaxed">{open.content_md}</pre>
            </div>
          ) : (
            <div className="border hairline dot-matrix py-20 text-center label-mono text-muted-foreground">Wähle eine Lerneinheit links.</div>
          )}
        </div>
      </div>
    </div>
  );
}
