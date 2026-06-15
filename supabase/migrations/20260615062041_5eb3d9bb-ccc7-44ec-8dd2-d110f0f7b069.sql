CREATE TABLE public.mcp_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);

CREATE INDEX mcp_tokens_token_idx ON public.mcp_tokens(token);
CREATE INDEX mcp_tokens_user_idx ON public.mcp_tokens(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mcp_tokens TO authenticated;
GRANT ALL ON public.mcp_tokens TO service_role;

ALTER TABLE public.mcp_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own mcp tokens" ON public.mcp_tokens
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);