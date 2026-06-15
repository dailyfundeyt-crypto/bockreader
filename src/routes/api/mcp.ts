import { createFileRoute } from "@tanstack/react-router";
import { createMcpServer, defineTool, withMcpAuth, type AuthInfo } from "mcp-tanstack-start";
import { z } from "zod";

// All tools use the service-role admin client, scoped to the authenticated user_id.
async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

function userIdFrom(auth?: AuthInfo): string {
  const id = auth?.claims?.userId as string | undefined;
  if (!id) throw new Error("Unauthorized");
  return id;
}

const listBooksTool = defineTool({
  name: "list_books",
  description: "List all books in the user's library.",
  parameters: z.object({}),
  execute: async (_p, ctx) => {
    const userId = userIdFrom(ctx.auth);
    const sb = await admin();
    const { data, error } = await sb
      .from("books")
      .select("id, title, author, format, pages, current_page, added_at")
      .eq("user_id", userId)
      .order("added_at", { ascending: false });
    if (error) throw new Error(error.message);
    return JSON.stringify({ books: data ?? [] }, null, 2);
  },
});

const uploadBookTool = defineTool({
  name: "upload_book",
  description:
    "Upload a book (PDF or EPUB) to the user's library. Provide the file as base64. The user must own the rights to the file.",
  parameters: z.object({
    title: z.string().min(1).max(300),
    author: z.string().max(200).optional(),
    format: z.enum(["pdf", "epub"]),
    filename: z.string().min(1).max(300).optional(),
    content_base64: z
      .string()
      .min(1)
      .describe("Raw file bytes encoded as base64 (no data: prefix)."),
  }),
  execute: async (p, ctx) => {
    const userId = userIdFrom(ctx.auth);
    const sb = await admin();

    // Decode base64 → bytes
    const clean = p.content_base64.replace(/^data:[^;]+;base64,/, "").replace(/\s+/g, "");
    let bytes: Uint8Array;
    try {
      const bin = atob(clean);
      bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    } catch {
      throw new Error("Invalid base64 content.");
    }
    if (bytes.byteLength === 0) throw new Error("Empty file.");
    if (bytes.byteLength > 100 * 1024 * 1024) throw new Error("File too large (max 100 MB).");

    const mime = p.format === "pdf" ? "application/pdf" : "application/epub+zip";
    const safe = (p.filename ?? `${p.title}.${p.format}`).replace(/[^\w.\-]+/g, "_");
    const path = `${userId}/${Date.now()}-${safe}`;

    const { error: upErr } = await sb.storage
      .from("books")
      .upload(path, bytes, { contentType: mime, upsert: false });
    if (upErr) throw new Error(upErr.message);

    const { data: row, error: insErr } = await sb
      .from("books")
      .insert({
        user_id: userId,
        title: p.title,
        author: p.author ?? null,
        format: p.format,
        storage_path: path,
      })
      .select("id, title, format")
      .single();
    if (insErr) {
      await sb.storage.from("books").remove([path]).catch(() => {});
      throw new Error(insErr.message);
    }

    return JSON.stringify({ ok: true, book: row }, null, 2);
  },
});

const deleteBookTool = defineTool({
  name: "delete_book",
  description: "Delete a book from the user's library by its id.",
  parameters: z.object({ id: z.string().uuid() }),
  execute: async (p, ctx) => {
    const userId = userIdFrom(ctx.auth);
    const sb = await admin();
    const { data: book, error: selErr } = await sb
      .from("books")
      .select("id, storage_path, user_id")
      .eq("id", p.id)
      .eq("user_id", userId)
      .maybeSingle();
    if (selErr) throw new Error(selErr.message);
    if (!book) throw new Error("Book not found.");
    if (book.storage_path) {
      await sb.storage.from("books").remove([book.storage_path]).catch(() => {});
    }
    const { error: delErr } = await sb
      .from("books")
      .delete()
      .eq("id", p.id)
      .eq("user_id", userId);
    if (delErr) throw new Error(delErr.message);
    return JSON.stringify({ ok: true });
  },
});

const mcp = createMcpServer({
  name: "pages-mcp",
  version: "1.0.0",
  instructions:
    "Manage the user's Pages reading library. Use list_books to inspect, upload_book to add a PDF or EPUB (base64), and delete_book to remove one.",
  tools: [listBooksTool, uploadBookTool, deleteBookTool],
  transport: {
    enableJsonResponse: true,
    maxBodySize: 150 * 1024 * 1024,
    allowedOrigins: ["*"],
  },
});

const verifyToken = async (request: Request): Promise<AuthInfo | null> => {
  const auth = request.headers.get("authorization") ?? request.headers.get("Authorization");
  const token = auth?.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : null;
  if (!token) return null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("mcp_tokens")
    .select("user_id")
    .eq("token", token)
    .maybeSingle();
  if (error || !data) return null;
  // best-effort last_used update
  supabaseAdmin
    .from("mcp_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("token", token)
    .then(() => {}, () => {});
  return { token, claims: { userId: data.user_id } };
};

const authenticatedHandler = withMcpAuth(
  async (request, auth) => mcp.handleRequest(request, { auth }),
  verifyToken,
);

const methodNotAllowed = () =>
  new Response(
    JSON.stringify({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Method not allowed." },
      id: null,
    }),
    {
      status: 405,
      headers: { "Content-Type": "application/json", Allow: "POST, OPTIONS" },
    },
  );

export const Route = createFileRoute("/api/mcp")({
  server: {
    handlers: {
      POST: async ({ request }) => authenticatedHandler(request),
      GET: async () => methodNotAllowed(),
      DELETE: async () => methodNotAllowed(),
    },
  },
});
