import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Pages — Lies. Markier. Lern." },
      { name: "description", content: "Lade deine Bücher hoch, lies sie überall, markiere mit dem Stift und lass die KI Lerneinheiten draus machen — synchronisiert über dein Google Drive." },
      { property: "og:title", content: "Pages — Lies. Markier. Lern." },
      { property: "og:description", content: "Lade deine Bücher hoch, lies sie überall, markiere mit dem Stift und lass die KI Lerneinheiten draus machen." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen text-foreground">
      <header className="sticky top-0 z-10 backdrop-blur-md bg-background/70 border-b hairline">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <Leaf />
            <span className="font-serif text-lg font-semibold tracking-tight">Pages</span>
          </div>
          <Link
            to="/auth"
            className="label-mono rounded-full bg-foreground text-background px-4 py-2 hover:bg-primary transition-colors"
          >
            Sign in
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pt-20 pb-16">
        <div className="inline-flex items-center gap-2 rounded-full border hairline bg-card/60 px-3 py-1.5 label-mono text-muted-foreground">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" />
          v 0.1 — personal reading os
        </div>
        <h1 className="mt-6 font-serif text-6xl md:text-8xl font-semibold leading-[1.02] tracking-tight">
          Lies. <span className="text-primary">Markier.</span><br />
          <span className="italic text-accent">Lern.</span>
        </h1>
        <p className="mt-8 max-w-xl text-lg text-muted-foreground leading-relaxed">
          Pages ist deine gemütliche Lese-Workstation. Bücher liegen in deinem Google Drive,
          du markierst mit dem Stift — und die KI macht daraus warme, persönliche Lerneinheiten
          als Markdown zurück in dein Drive.
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-4">
          <Link
            to="/auth"
            className="font-sans font-semibold text-sm rounded-full bg-primary text-primary-foreground px-6 py-3.5 hover:bg-sage-deep transition-colors shadow-sm"
          >
            Mit Google starten →
          </Link>
          <a
            href="#features"
            className="font-sans text-sm font-medium rounded-full border hairline px-6 py-3.5 hover:bg-secondary transition-colors"
          >
            Features ansehen
          </a>
        </div>
      </section>

      {/* Bento grid */}
      <section id="features" className="mx-auto max-w-6xl px-6 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4 auto-rows-[minmax(180px,auto)]">
          {/* Drive Sync — large */}
          <BentoCard className="md:col-span-4 bg-secondary">
            <Badge>01 · Drive Sync</Badge>
            <h3 className="mt-4 font-serif text-3xl">Deine Bibliothek, dein Drive.</h3>
            <p className="mt-3 text-muted-foreground leading-relaxed max-w-md">
              Bücher und Notizen liegen in deinem eigenen Google Drive. Pages liest und schreibt nur dort,
              wo du es erlaubst — und alles synchronisiert sich von selbst.
            </p>
            <div className="mt-6 flex gap-2">
              <Pill>PDF</Pill>
              <Pill>EPUB</Pill>
              <Pill>Markdown</Pill>
            </div>
          </BentoCard>

          {/* Stift */}
          <BentoCard className="md:col-span-2 bg-accent text-accent-foreground">
            <Badge tone="dark">02 · Stift</Badge>
            <h3 className="mt-4 font-serif text-2xl">Freihand & Highlights.</h3>
            <p className="mt-3 text-sm opacity-80 leading-relaxed">
              Mit Druckempfindlichkeit, pro Seite gespeichert, geräteübergreifend.
            </p>
          </BentoCard>

          {/* AI */}
          <BentoCard className="md:col-span-3 bg-card border hairline">
            <Badge>03 · KI-Lerneinheit</Badge>
            <h3 className="mt-4 font-serif text-2xl">Gemini fasst zusammen.</h3>
            <p className="mt-3 text-muted-foreground text-sm leading-relaxed">
              Aus deinen Markierungen baut die KI eine kompakte Markdown-Lerneinheit — abgelegt in
              <span className="text-foreground"> /Pages/Notes</span>.
            </p>
          </BentoCard>

          {/* Goals */}
          <BentoCard className="md:col-span-3 bg-primary text-primary-foreground">
            <Badge tone="dark">04 · Ziele</Badge>
            <h3 className="mt-4 font-serif text-2xl">Lies mit Plan.</h3>
            <p className="mt-3 text-sm opacity-90 leading-relaxed">
              Tägliche Minuten, Seiten pro Tag, Bücher pro Monat. Streak inklusive — ohne Druck.
            </p>
          </BentoCard>

          {/* Analyse */}
          <BentoCard className="md:col-span-2 bg-card border hairline">
            <Badge>05 · Analyse</Badge>
            <Heatmap />
          </BentoCard>

          {/* Quote */}
          <BentoCard className="md:col-span-4 bg-secondary">
            <p className="font-serif italic text-2xl leading-snug">
              „Ein Buch muss die Axt sein für das gefrorene Meer in uns."
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
