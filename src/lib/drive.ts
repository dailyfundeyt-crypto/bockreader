// Google Drive helper. Uses the provider_token stored in the Supabase session.
// Only `drive.file` scope is required: Pages can only read/write files it created itself.
import { supabase } from "@/integrations/supabase/client";

const DRIVE_API = "https://www.googleapis.com/drive/v3";
const UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";

async function token(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const t = data.session?.provider_token;
  if (!t) throw new Error("Kein Google-Drive-Token. Bitte erneut anmelden.");
  return t;
}

async function gfetch(url: string, init: RequestInit = {}): Promise<Response> {
  const t = await token();
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${t}`, ...(init.headers || {}) },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Drive ${res.status}: ${text || res.statusText}`);
  }
  return res;
}

export async function ensureFolder(name: string, parentId?: string): Promise<string> {
  const q = encodeURIComponent(
    `name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false${parentId ? ` and '${parentId}' in parents` : ""}`,
  );
  const r = await gfetch(`${DRIVE_API}/files?q=${q}&fields=files(id,name)&spaces=drive`);
  const j = await r.json();
  if (j.files?.length) return j.files[0].id as string;
  const create = await gfetch(`${DRIVE_API}/files?fields=id`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      mimeType: "application/vnd.google-apps.folder",
      ...(parentId ? { parents: [parentId] } : {}),
    }),
  });
  const cj = await create.json();
  return cj.id as string;
}

export async function ensurePagesFolders() {
  const root = await ensureFolder("Pages");
  const books = await ensureFolder("Books", root);
  const notes = await ensureFolder("Notes", root);
  return { root, books, notes };
}

export async function uploadFile(opts: {
  name: string;
  mimeType: string;
  parentId: string;
  blob: Blob;
}): Promise<{ id: string }> {
  const metadata = { name: opts.name, mimeType: opts.mimeType, parents: [opts.parentId] };
  const boundary = "pages-" + Math.random().toString(36).slice(2);
  const delim = `\r\n--${boundary}\r\n`;
  const close = `\r\n--${boundary}--`;
  const meta = `${delim}Content-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}`;
  const arrayBuf = await opts.blob.arrayBuffer();
  const body = new Blob([
    meta,
    `${delim}Content-Type: ${opts.mimeType}\r\n\r\n`,
    new Uint8Array(arrayBuf),
    close,
  ]);
  const r = await gfetch(`${UPLOAD_API}/files?uploadType=multipart&fields=id`, {
    method: "POST",
    headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
    body,
  });
  return (await r.json()) as { id: string };
}

export async function listBooks(parentId: string) {
  const q = encodeURIComponent(`'${parentId}' in parents and trashed=false`);
  const r = await gfetch(`${DRIVE_API}/files?q=${q}&fields=files(id,name,mimeType,size,modifiedTime)`);
  const j = await r.json();
  return (j.files ?? []) as Array<{ id: string; name: string; mimeType: string; size?: string; modifiedTime?: string }>;
}

export async function downloadFile(fileId: string): Promise<Blob> {
  const r = await gfetch(`${DRIVE_API}/files/${fileId}?alt=media`);
  return await r.blob();
}

export async function uploadTextFile(opts: { name: string; parentId: string; content: string; mimeType?: string }): Promise<{ id: string }> {
  return uploadFile({
    name: opts.name,
    parentId: opts.parentId,
    mimeType: opts.mimeType ?? "text/markdown",
    blob: new Blob([opts.content], { type: opts.mimeType ?? "text/markdown" }),
  });
}
