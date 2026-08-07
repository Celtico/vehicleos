/**
 * InfoList — lista compacta de dato y valor, con icono.
 *
 * Se usa para la información del viaje en el cuadro. Los valores llevan
 * cifras tabulares para que no bailen al actualizarse, que es molesto de
 * leer conduciendo.
 */
export interface InfoRow {
  /** Icono SVG inline. */
  icon?: React.ReactNode;
  label: string;
  value: string;
}

export interface InfoListProps {
  title: string;
  rows: InfoRow[];
}

export function InfoList({ title, rows }: InfoListProps) {
  return (
    <div className="flex h-full flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-3">
      <span className="mb-2 block text-[10px] uppercase tracking-[0.22em] text-accent">
        {title}
      </span>
      <ul className="flex flex-1 flex-col justify-around">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-2">
              {r.icon ? <span className="shrink-0 text-muted">{r.icon}</span> : null}
              <span className="truncate text-[11px] text-muted">{r.label}</span>
            </span>
            <span className="shrink-0 text-xs tabular-nums text-silver">{r.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
