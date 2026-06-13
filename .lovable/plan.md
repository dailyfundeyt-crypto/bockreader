
# Pages — Personal Reading App (Nothing-style)

## Was die App kann

- Bücher hochladen (PDF + EPUB) und in der eigenen Google-Drive-Bibliothek speichern
- Geräteübergreifend lesen — Drive ist die Single Source of Truth
- Lesen mit Stift: Freihand, Highlights, angeheftete Notizen
- KI-Analyse der Annotationen → kompakte „Lerneinheit" als Markdown
- Lerneinheiten werden automatisch zurück nach Google Drive (`/Pages/Notes/<Buch>/<Datum>.md`) gespeichert
- Ziele (tägliche Lesezeit/Seiten, Bücher pro Monat/Jahr) + Streak
- Analyse: Lesezeit pro Buch, Heatmap, Durchschnitt, Fortschritt

## Design (Nothing-inspiriert)

- Reines Schwarz/Weiß-Farbsystem, ein roter Akzent (Nothing red ~ #D81E1E)
- Typo: `Space Mono` (Monospace, Headlines/Labels) + `Inter` (Body)
- Dot-Matrix-Ornamente, dünne Hairlines, viel Negative Space
- Subtile Motion (fade/slide), keine bunten Gradients
- Dark- + Light-Mode, Toggle in Settings

## Routen / Screens

```text
/                       Landing (öffentlich, Marketing + Sign in with Google)
/auth                   Sign in (Google OAuth via Supabase)
/_authenticated/
  library               Bibliothek (Grid mit Covern, Upload + Drive-Sync)
  read/$bookId          Reader (PDF/EPUB) mit Stift-Layer
  goals                 Ziele setzen + Streak
  analytics             Statistiken & Heatmap
  notes                 Alle KI-Lerneinheiten
  settings              Konto, Drive, Theme
```

## Technischer Aufbau

- Lovable Cloud (Supabase) — Auth + DB für Metadaten/Annotations/Sessions
- Google OAuth über Supabase (Provider „Google", scope `drive.file`) → per-User-Token, jeder sieht nur seine Drive
- Drive-Zugriff direkt vom Client mit dem `provider_token` aus Supabase-Session
- PDF: `react-pdf` (pdf.js), EPUB: `epubjs` mit React-Wrapper
- Stift-Layer: HTML-Canvas (`perfect-freehand`) pro Seite, Pointer-Events mit Pressure
- KI-Lerneinheit: TanStack serverFn → Lovable AI Gateway (`google/gemini-3-flash-preview`), Output = Markdown, dann Upload nach Drive

### DB-Tabellen (public, RLS auf `auth.uid()`)

- `books` — id, user_id, title, author, drive_file_id, cover_url, format, pages, added_at
- `annotations` — id, book_id, user_id, page, type (`ink`|`highlight`|`note`), data (jsonb), created_at
- `reading_sessions` — id, book_id, user_id, started_at, ended_at, pages_read
- `goals` — id, user_id, type (`daily_minutes`|`daily_pages`|`books_month`|`books_year`), target, period
- `learning_units` — id, book_id, user_id, drive_file_id, summary, created_at

Buch-Binaries selbst liegen ausschließlich in der User-Drive — nicht in Supabase Storage.

### Server Functions

- `syncDriveLibrary` — listet `/Pages/Books/` in Drive, gleicht mit `books`-Tabelle ab
- `uploadBookToDrive` — Multipart-Upload in `/Pages/Books/`
- `generateLearningUnit({ bookId })` — sammelt Annotations + Buchtext-Snippets, ruft Gemini, lädt MD nach Drive, speichert Eintrag

### Sicherheit

- Roles-Tabelle nur falls Admin nötig — hier nicht
- RLS: jede Tabelle scoped auf `user_id = auth.uid()`
- `provider_token` bleibt clientseitig in der Supabase-Session, keine Service-Account-Schlüssel

## Was du einmalig einrichten musst

1. Google Cloud Projekt → OAuth Client + Drive API aktivieren
2. Client ID / Secret im Supabase-Dashboard unter Auth → Google eintragen, Scope `https://www.googleapis.com/auth/drive.file` ergänzen

Den Link dazu zeige ich dir nach dem Build.

## Build-Reihenfolge

1. Cloud aktivieren, DB-Schema + RLS anlegen
2. Auth (Google), `_authenticated` Layout
3. Library + Drive-Sync (Upload, List, Cover-Extract)
4. PDF/EPUB Reader mit Reading-Session-Tracking
5. Stift-Layer + Annotations-Persistenz
6. KI-Lerneinheit + Drive-MD-Export
7. Ziele + Analytics-Dashboard
8. Nothing-Polish (Typo, Dot-Matrix, Motion, Dark/Light)

## Bewusst nicht enthalten (kannst du danach ergänzen)

- Teilen / Multi-User-Bibliotheken
- DRM-geschützte Bücher (Adobe DRM / Kindle)
- Offline-Modus / PWA-Install (kann später nachgerüstet werden)
- Audiobücher
