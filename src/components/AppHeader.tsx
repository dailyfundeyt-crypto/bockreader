import type { ReactNode } from "react";

export function PageHeader({ kicker, title, actions }: { kicker: string; title: string; actions?: ReactNode }) {
  return (
    <div className="border-b hairline px-8 py-6 flex items-end justify-between gap-4">
      <div>
        <div className="label-mono text-muted-foreground">{kicker}</div>
        <h1 className="mt-1 font-mono text-3xl">{title}</h1>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
