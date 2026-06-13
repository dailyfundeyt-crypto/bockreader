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
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b hairline">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <Dot />
            <span className="font-mono text-sm font-bold">PAGES</span>
          </div>
          <Link to="/auth" className="label-mono border border-foreground px-3 py-1.5 hover:bg-foreground hover:text-background transition-colors">
            Sign in
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 pt-20 pb-24">
        <div className="label-mono text-muted-foreground">v 0.1 — personal reading os</div>
        <h1 className="mt-6 font-mono text-5xl md:text-7xl font-bold leading-[0.95] tracking-tight">
          Lies.<br />Markier.<br />Lern.
        </h1>
        <p className="mt-8 max-w-xl text-base text-muted-foreground leading-relaxed">
          Pages ist deine persönliche Lese-Workstation. Bücher liegen in deinem Google Drive,
          du markierst sie mit dem Stift, und die KI macht daraus Lerneinheiten — als Markdown
          zurück in dein Drive.
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-4">
          <Link to="/auth" className="font-mono text-sm bg-foreground text-background px-5 py-3 hover:bg-accent transition-colors">
            Mit Google starten →
          </Link>
          <a href="#features" className="label-mono text-muted-foreground hover:text-foreground transition-colors">
            Features ansehen
          </a>
        </div>
      </section>

      <section className="border-y hairline dot-matrix">
        <div className="mx-auto grid max-w-6xl grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x hairline">
          {[
            { k: "01", t: "Drive Sync", d: "Bücher und Notizen liegen in deinem Google Drive. Pages liest und schreibt nur dort, wo du es erlaubst." },
            { k: "02", t: "Stift-Markierung", d: "Freihand, Highlights, Notizen mit Druckempfindlichkeit. Pro Seite gespeichert, geräteübergreifend." },
            { k: "03", t: "KI-Lerneinheit", d: "Aus deinen Markierungen baut Gemini eine kompakte Markdown-Lerneinheit, abgelegt in Drive." },
          ].map((f) => (
            <div key={f.k} className="bg-background p-8">
              <div className="label-mono text-accent">{f.k}</div>
              <h3 className="mt-4 font-mono text-xl">{f.t}</h3>
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="features" className="mx-auto max-w-6xl px-6 py-24">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          <div>
            <div className="label-mono text-muted-foreground">ZIELE</div>
            <h2 className="mt-3 font-mono text-3xl">Lies mit Plan.</h2>
            <p className="mt-4 text-muted-foreground">Tägliche Minuten, Seiten pro Tag, Bücher pro Monat oder Jahr. Streak inklusive.</p>
          </div>
          <div>
            <div className="label-mono text-muted-foreground">ANALYSE</div>
            <h2 className="mt-3 font-mono text-3xl">Sieh dein Lesen.</h2>
            <p className="mt-4 text-muted-foreground">Heatmap, Lesezeit pro Buch, Durchschnitte. Keine Buzzwords — nur Zahlen.</p>
          </div>
        </div>
      </section>

      <footer className="border-t hairline">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6 label-mono text-muted-foreground">
          <span>© Pages</span>
          <span>Made for readers</span>
        </div>
      </footer>
    </div>
  );
}

function Dot() {
  return <span className="inline-block h-2 w-2 rounded-full bg-accent" />;
}
