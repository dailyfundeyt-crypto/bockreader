import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Pages — Read. Mark. Learn." },
      { name: "description", content: "Upload your books, read them anywhere, mark up with the pen and let the AI turn them into learning units — synced through your Google Drive." },
      { property: "og:title", content: "Pages — Read. Mark. Learn." },
      { property: "og:description", content: "Upload your books, read them anywhere, mark up with the pen and let the AI turn them into learning units." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen text-foreground">
      <header className="sticky top-0 z-10 backdrop-blur-md bg-background/70 border-b hairline">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <Leaf />
            <span className="font-serif text-lg font-semibold tracking-tight">Pages</span>
          </div>
          <Link
            to="/auth"
            className="label-mono rounded-full bg-foreground text-background px-4 py-2 hover:bg-primary transition-colors shrink-0"
          >
            Sign in
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 pt-10 sm:pt-20 pb-12 sm:pb-16">
        <div className="inline-flex items-center gap-2 rounded-full border hairline bg-card/60 px-3 py-1.5 label-mono text-muted-foreground">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" />
          v 0.1 — personal reading os
        </div>
        <h1 className="mt-5 sm:mt-6 font-serif text-5xl sm:text-6xl md:text-8xl font-semibold leading-[1.02] tracking-tight">
          Read. <span className="text-primary">Mark.</span><br />
          <span className="italic text-accent">Learn.</span>
        </h1>
        <p className="mt-6 sm:mt-8 max-w-xl text-base sm:text-lg text-muted-foreground leading-relaxed">
          Pages is your cozy reading workstation. Books live in your Google Drive,
          you mark them up with the pen — and the AI turns it all into warm, personal
          learning units as Markdown, right back into your Drive.
        </p>
        <div className="mt-8 sm:mt-10 flex flex-wrap items-center gap-3 sm:gap-4">
          <Link
            to="/auth"
            className="font-sans font-semibold text-sm rounded-full bg-primary text-primary-foreground px-6 py-3.5 hover:bg-sage-deep transition-colors shadow-sm"
          >
            Start with Google →
          </Link>
          <a
            href="#features"
            className="font-sans text-sm font-medium rounded-full border hairline px-6 py-3.5 hover:bg-secondary transition-colors"
          >
            See features
          </a>
        </div>
        <p className="mt-6 label-mono text-muted-foreground">
          📱 Tipp: Im Chrome-Menü „Zum Startbildschirm hinzufügen" wählen — Pages läuft dann wie eine App.
        </p>
      </section>

      {/* Bento grid */}
      <section id="features" className="mx-auto max-w-6xl px-4 sm:px-6 pb-16 sm:pb-20">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4 auto-rows-[minmax(160px,auto)]">
          {/* Drive Sync — large */}
          <BentoCard className="md:col-span-4 bg-secondary">
            <Badge>01 · Drive Sync</Badge>
            <h3 className="mt-4 font-serif text-3xl">Your library, your Drive.</h3>
            <p className="mt-3 text-muted-foreground leading-relaxed max-w-md">
              Books and notes live in your own Google Drive. Pages reads and writes only where
              you allow it — and everything syncs on its own.
            </p>
            <div className="mt-6 flex gap-2">
              <Pill>PDF</Pill>
              <Pill>EPUB</Pill>
              <Pill>Markdown</Pill>
            </div>
          </BentoCard>

          {/* Pen */}
          <BentoCard className="md:col-span-2 bg-accent text-accent-foreground">
            <Badge tone="dark">02 · Pen</Badge>
            <h3 className="mt-4 font-serif text-2xl">Freehand & highlights.</h3>
            <p className="mt-3 text-sm opacity-80 leading-relaxed">
              Pressure-sensitive, saved per page, across all your devices.
            </p>
          </BentoCard>

          {/* AI */}
          <BentoCard className="md:col-span-3 bg-card border hairline">
            <Badge>03 · AI learning unit</Badge>
            <h3 className="mt-4 font-serif text-2xl">Gemini sums it up.</h3>
            <p className="mt-3 text-muted-foreground text-sm leading-relaxed">
              From your highlights the AI builds a compact Markdown learning unit — saved to
              <span className="text-foreground"> /Pages/Notes</span>.
            </p>
          </BentoCard>

          {/* Goals */}
          <BentoCard className="md:col-span-3 bg-primary text-primary-foreground">
            <Badge tone="dark">04 · Goals</Badge>
            <h3 className="mt-4 font-serif text-2xl">Read with a plan.</h3>
            <p className="mt-3 text-sm opacity-90 leading-relaxed">
              Daily minutes, pages per day, books per month. Streaks included — no pressure.
            </p>
          </BentoCard>

          {/* Analytics */}
          <BentoCard className="md:col-span-2 bg-card border hairline">
            <Badge>05 · Analytics</Badge>
            <Heatmap />
          </BentoCard>

          {/* Quote */}
          <BentoCard className="md:col-span-4 bg-secondary">
            <p className="font-serif italic text-2xl leading-snug">
              "A book must be the axe for the frozen sea inside us."
            </p>
            <div className="mt-4 label-mono text-muted-foreground">— Franz Kafka</div>
          </BentoCard>
        </div>
      </section>

      <footer className="border-t hairline">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6 label-mono text-muted-foreground">
          <span>© Pages</span>
          <span>Made for readers ✿</span>
        </div>
      </footer>
    </div>
  );
}

function BentoCard({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={`rounded-2xl p-7 transition-transform hover:-translate-y-0.5 ${className}`}>
      {children}
    </div>
  );
}

function Badge({ children, tone = "light" }: { children: React.ReactNode; tone?: "light" | "dark" }) {
  return (
    <span className={`label-mono ${tone === "dark" ? "opacity-80" : "text-muted-foreground"}`}>
      {children}
    </span>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="label-mono rounded-full bg-background/70 border hairline px-3 py-1">
      {children}
    </span>
  );
}

function Leaf() {
  return (
    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground">
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 21c0-9 7-16 16-16-1 9-7 16-16 16z" />
        <path d="M5 21c4-4 7-7 11-11" />
      </svg>
    </span>
  );
}

function Heatmap() {
  const cells = Array.from({ length: 35 });
  return (
    <div className="mt-4 grid grid-cols-7 gap-1.5">
      {cells.map((_, i) => {
        const intensity = ((i * 13) % 5) / 4;
        return (
          <div
            key={i}
            className="aspect-square rounded-md"
            style={{ background: `color-mix(in oklab, var(--primary) ${20 + intensity * 70}%, var(--background))` }}
          />
        );
      })}
    </div>
  );
}
