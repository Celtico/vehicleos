/**
 * FaultPanel — averías activas, siempre a la vista.
 *
 * En una pantalla de coche el diagnóstico no debe estar escondido detrás de
 * un menú: si hay algo mal, tiene que verse desde el cuadro. Cada avería
 * muestra su código y qué significa en lenguaje llano, y lleva al detalle
 * completo al tocarla.
 */
import { alfa, MBUX } from "./theme";

export interface FaultItem {
  /** Código tal cual, p. ej. "P0401". */
  code: string;
  /** Qué significa, en una línea. */
  title: string;
  /** Confirmada o pendiente. */
  severity: "error" | "warning";
}

export interface FaultPanelProps {
  faults: FaultItem[];
  /** Al tocar una avería concreta. */
  onSelect?: (code: string) => void;
  /** Al tocar "ver todas". */
  onSeeAll?: () => void;
  /** Máximo de averías listadas antes de resumir (por defecto 3). */
  max?: number;
  /** Sin recuadro ni marcos internos: solo el contenido sobre el fondo. */
  plain?: boolean;
}

export function FaultPanel({
  faults,
  onSelect,
  onSeeAll,
  max = 3,
  plain = false,
}: FaultPanelProps) {
  const visibles = faults.slice(0, max);
  const restantes = faults.length - visibles.length;

  return (
    <div
      className={
        plain
          ? "flex h-full flex-col px-2 py-1"
          : "panel-cockpit flex h-full flex-col rounded-2xl p-3"
      }
    >
      <div className={`flex items-center justify-between ${plain ? "mb-4" : "mb-2"}`}>
        <span
          className="truncate text-[11px] font-semibold uppercase tracking-[0.1em]"
          style={{ color: faults.length > 0 ? MBUX.danger : MBUX.muted }}
        >
          Averías activas
        </span>
        <span
          className="flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full px-1.5 text-[11px] tabular-nums"
          style={{
            background: faults.length > 0 ? alfa("danger", 0.15) : "rgb(var(--c-panel) / 0.08)",
            color: faults.length > 0 ? MBUX.danger : MBUX.muted,
          }}
        >
          {faults.length}
        </span>
      </div>

      {faults.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-1.5">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="9" stroke={MBUX.ok} strokeWidth="1.4" />
            <path
              d="M8 12.2l2.6 2.6L16 9.4"
              stroke={MBUX.ok}
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="text-xs" style={{ color: MBUX.ok }}>
            Sin averías
          </span>
        </div>
      ) : (
        <ul className={`flex flex-col gap-1.5 ${plain ? "" : "flex-1"}`}>
          {visibles.map((f) => {
            const token = f.severity === "error" ? "danger" : "warning";
            const color = f.severity === "error" ? MBUX.danger : MBUX.warning;
            return (
              <li key={f.code}>
                <button
                  onClick={() => onSelect?.(f.code)}
                  className={`flex w-full items-center gap-2 text-left transition-colors hover:brightness-110 ${
                    plain ? "py-1.5" : "rounded-xl border px-2.5 py-2"
                  }`}
                  style={plain ? undefined : { borderColor: alfa(token, 0.25) }}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    className="shrink-0"
                    aria-hidden="true"
                  >
                    <path
                      d="M12 3.5 2.8 19.5h18.4L12 3.5Z"
                      stroke={color}
                      strokeWidth="1.5"
                      strokeLinejoin="round"
                    />
                    <path d="M12 10v4" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
                    <circle cx="12" cy="16.6" r="0.9" fill={color} />
                  </svg>
                  <span className="min-w-0 flex-1">
                    <span className="block font-mono text-sm font-semibold" style={{ color }}>
                      {f.code}
                    </span>
                    <span className="block truncate text-[13px] font-medium text-muted">
                      {f.title}
                    </span>
                  </span>
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    className="shrink-0 text-muted"
                    aria-hidden="true"
                  >
                    <path
                      d="m9.5 5.5 7 6.5-7 6.5"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {faults.length > 0 && onSeeAll ? (
        <button
          onClick={onSeeAll}
          className={`text-[11px] font-semibold uppercase tracking-[0.1em] text-muted transition-colors hover:text-accent ${
            plain
              ? "mt-2 flex items-center gap-2 self-start"
              : "mt-auto w-full rounded-xl border border-linea/20 py-1.5"
          }`}
        >
          <span>{restantes > 0 ? `Ver las ${faults.length}` : "Ver diagnóstico"}</span>
          {plain ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M4.5 12h14m-5.5-5.5L18.5 12 13 17.5"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : null}
        </button>
      ) : null}
    </div>
  );
}
