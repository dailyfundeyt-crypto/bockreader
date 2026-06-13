
-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  pages_folder_id TEXT,
  books_folder_id TEXT,
  notes_folder_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile" ON public.profiles FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'avatar_url')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Books
CREATE TABLE public.books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  title TEXT NOT NULL,
  author TEXT,
  format TEXT NOT NULL CHECK (format IN ('pdf','epub')),
  drive_file_id TEXT NOT NULL,
  cover_url TEXT,
  pages INTEGER,
  current_page INTEGER NOT NULL DEFAULT 0,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, drive_file_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.books TO authenticated;
GRANT ALL ON public.books TO service_role;
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own books" ON public.books FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Annotations
CREATE TABLE public.annotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES public.books ON DELETE CASCADE,
  page INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('ink','highlight','note')),
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.annotations TO authenticated;
GRANT ALL ON public.annotations TO service_role;
ALTER TABLE public.annotations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own annotations" ON public.annotations FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX annotations_book_page_idx ON public.annotations (book_id, page);

-- Reading sessions
CREATE TABLE public.reading_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES public.books ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  pages_read INTEGER NOT NULL DEFAULT 0
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reading_sessions TO authenticated;
GRANT ALL ON public.reading_sessions TO service_role;
ALTER TABLE public.reading_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own sessions" ON public.reading_sessions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX sessions_user_started_idx ON public.reading_sessions (user_id, started_at DESC);

-- Goals
CREATE TABLE public.goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('daily_minutes','daily_pages','books_month','books_year')),
  target INTEGER NOT NULL CHECK (target > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, type)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.goals TO authenticated;
GRANT ALL ON public.goals TO service_role;
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own goals" ON public.goals FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Learning units (AI-generated MD summaries)
CREATE TABLE public.learning_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES public.books ON DELETE CASCADE,
  title TEXT NOT NULL,
  content_md TEXT NOT NULL,
  drive_file_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.learning_units TO authenticated;
GRANT ALL ON public.learning_units TO service_role;
ALTER TABLE public.learning_units ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own units" ON public.learning_units FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
