import type { ReactNode } from "react";

export function PageHeader({ kicker, title, actions }: { kicker: string; title: string; actions?: ReactNode }) {
  return (
    <div className="px-8 py-8 flex items-end justify-between gap-4 border-b hairline bg-card/40 backdrop-blur-sm">
      <div>
        <div className="label-mono text-primary">{kicker}</div>
        <h1 className="mt-2 font-serif text-4xl font-semibold tracking-tight">{title}</h1>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
