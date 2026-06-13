import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const Input = z.object({ bookId: z.string().uuid() });

export const generateLearningUnit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data, context }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const { supabase, userId } = context;
    const { data: book, error: be } = await supabase
      .from("books")
      .select("id, title, author")
      .eq("id", data.bookId)
      .single();
    if (be || !book) throw new Error("Buch nicht gefunden.");

    const { data: anns, error: ae } = await supabase
      .from("annotations")
      .select("page, type, data, created_at")
      .eq("book_id", data.bookId)
      .order("page", { ascending: true });
    if (ae) throw new Error(ae.message);

    if (!anns?.length) throw new Error("Keine Annotationen — markiere zuerst etwas im Buch.");

    const lines: string[] = [];
    for (const a of anns) {
      const d = a.data as { text?: string; strokes?: unknown[] };
      if (a.type === "note" && d.text) lines.push(`- [S. ${a.page}] Notiz: ${d.text}`);
      else if (a.type === "highlight") lines.push(`- [S. ${a.page}] Highlight (Marker)`);
      else if (a.type === "ink") lines.push(`- [S. ${a.page}] Stift-Markierung`);
    }

    const prompt = `Du bist ein Lerncoach. Aus folgenden Annotationen zu einem Buch sollst du eine kompakte Lerneinheit als Markdown erstellen. Schreibe auf Deutsch.

Buch: ${book.title}${book.author ? ` — ${book.author}` : ""}

Annotationen:
${lines.join("\n")}

Erstelle:
1. ein H1 mit Buchtitel + Datum
2. einen kurzen Abschnitt "Was ich gelernt habe" (3-6 Bulletpoints, inhaltlich plausibel basierend auf Notizen, ohne erfinden)
3. einen Abschnitt "Schlüsselstellen" mit den Seitenzahlen
4. einen Abschnitt "Eigene Notizen" (zitiere die User-Notizen)
5. optional 2-3 Reflexionsfragen

Gib NUR den Markdown zurück.`;

    const { createLovableAiGatewayProvider } = await import("./ai-gateway.server");
    const { generateText } = await import("ai");
    const gateway = createLovableAiGatewayProvider(key);
    const result = await generateText({
      model: gateway("google/gemini-3-flash-preview"),
      prompt,
    });

    const title = `${book.title} — Lerneinheit ${new Date().toLocaleDateString("de-DE")}`;
    const { data: lu, error: le } = await supabase
      .from("learning_units")
      .insert({ user_id: userId, book_id: book.id, title, content_md: result.text })
      .select("id")
      .single();
    if (le) throw new Error(le.message);

    return { id: lu.id, title, content_md: result.text };
  });
