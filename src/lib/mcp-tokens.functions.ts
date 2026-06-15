import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function genToken() {
  // 32 random bytes hex = 64 chars
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return "pages_" + Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

export const listMcpTokens = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("mcp_tokens")
      .select("id, label, token, created_at, last_used_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { tokens: data ?? [] };
  });

export const createMcpToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { label?: string }) =>
    z.object({ label: z.string().min(1).max(80).optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const token = genToken();
    const { error } = await context.supabase
      .from("mcp_tokens")
      .insert({ user_id: context.userId, token, label: data.label ?? null });
    if (error) throw new Error(error.message);
    return { token };
  });

export const deleteMcpToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) =>
    z.object({ id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("mcp_tokens")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
