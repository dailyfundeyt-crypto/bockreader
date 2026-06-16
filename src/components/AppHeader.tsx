import type { ReactNode } from "react";

export function PageHeader({ kicker, title, actions }: { kicker: string; title: string; actions?: ReactNode }) {
  return (
    <div className="px-4 sm:px-8 py-5 sm:py-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between border-b hairline bg-card/40 backdrop-blur-sm">
      <div className="min-w-0">
        <div className="label-mono text-primary">{kicker}</div>
        <h1 className="mt-2 font-serif text-2xl sm:text-4xl font-semibold tracking-tight truncate">{title}</h1>
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  );
}
