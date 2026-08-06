/**
 * Notifications — avisos tipo "toast" del cockpit.
 *
 * Pila en la esquina superior derecha con entrada y salida animadas por CSS
 * (deslizamiento + fundido), icono e halo por severidad y cierre accesible.
 * Los avisos críticos laten suavemente y nunca se autocierran: los descarta
 * el conductor.
 *
 * El estado vive fuera (lista controlada + `onDismiss`); aquí sólo se
 * conservan temporalmente los avisos que están saliendo para poder animar su
 * desaparición antes de quitarlos del DOM.
 */
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { MBUX } from "./theme";

export type NotificationSeverity = "info" | "warning" | "critical";

export interface CockpitNotification {
  id: string;
  severity: NotificationSeverity;
  title: string;
  detail?: string;
  /** ms; si se omite, 6000. Las "critical" no se autocierran. */
  timeoutMs?: number;
}

export interface NotificationStackProps {
  notifications: CockpitNotification[];
  onDismiss: (id: string) => void;
  /** Máximo visible a la vez (por defecto 3). */
  max?: number;
}

/** Duración de la animación de salida (debe coincidir con el CSS). */
const SALIDA_MS = 240;
/** Autocierre por defecto de info/warning. */
const TIMEOUT_MS = 6000;

/** Color de acento por severidad. */
function colorSeveridad(s: NotificationSeverity): string {
  switch (s) {
    case "info":
      return MBUX.accent;
    case "warning":
      return MBUX.warning;
    case "critical":
      return MBUX.danger;
  }
}

/** Icono SVG inline (viewBox 0 0 24 24) según severidad. */
function Icono({ severity, color }: { severity: NotificationSeverity; color: string }) {
  const trazo = {
    stroke: color,
    fill: "none",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {severity === "info" ? (
        <g {...trazo}>
          <circle cx="12" cy="12" r="9" />
          <line x1="12" y1="11" x2="12" y2="16.5" />
          <line x1="12" y1="7.6" x2="12" y2="7.7" />
        </g>
      ) : severity === "warning" ? (
        <g {...trazo}>
          <path d="M12 3.8 21 19.5 H3 Z" />
          <line x1="12" y1="9.5" x2="12" y2="14" />
          <line x1="12" y1="16.6" x2="12" y2="16.7" />
        </g>
      ) : (
        <g {...trazo}>
          <circle cx="12" cy="12" r="9" />
          <line x1="12" y1="7.2" x2="12" y2="12.8" />
          <line x1="12" y1="16.2" x2="12" y2="16.3" />
          <path d="M4.6 4.6 19.4 19.4" opacity={0.35} />
        </g>
      )}
    </svg>
  );
}

/**
 * Hoja de estilos del sistema de avisos. Se inyecta una sola vez con el
 * primer render de la pila (el paquete no lleva bundler de CSS).
 */
const CSS = `
@keyframes vos-notif-entrada {
  from { opacity: 0; transform: translateX(28px) scale(0.97); }
  to   { opacity: 1; transform: translateX(0) scale(1); }
}
@keyframes vos-notif-salida {
  from { opacity: 1; transform: translateX(0) scale(1); max-height: 200px; }
  to   { opacity: 0; transform: translateX(28px) scale(0.97); max-height: 0; }
}
@keyframes vos-notif-latido {
  0%, 100% { box-shadow: 0 8px 30px rgba(0,0,0,0.5), 0 0 0 1px var(--vos-notif-color), 0 0 26px -4px var(--vos-notif-color); }
  50%      { box-shadow: 0 8px 30px rgba(0,0,0,0.5), 0 0 0 1px var(--vos-notif-color), 0 0 46px 2px var(--vos-notif-color); }
}
.vos-notif {
  animation: vos-notif-entrada 220ms cubic-bezier(0.16, 1, 0.3, 1) both;
  will-change: transform, opacity;
}
.vos-notif--saliendo {
  animation: vos-notif-salida ${SALIDA_MS}ms ease-in both;
  pointer-events: none;
}
.vos-notif--critical {
  animation:
    vos-notif-entrada 220ms cubic-bezier(0.16, 1, 0.3, 1) both,
    vos-notif-latido 1900ms ease-in-out 220ms infinite;
}
.vos-notif__cerrar {
  background: transparent;
  border: 0;
  cursor: pointer;
  padding: 4px;
  margin: -4px -4px 0 0;
  border-radius: 8px;
  line-height: 0;
  color: ${MBUX.muted};
  transition: color 140ms ease, background 140ms ease;
}
.vos-notif__cerrar:hover { color: ${MBUX.text}; background: rgba(255,255,255,0.06); }
.vos-notif__cerrar:focus-visible { outline: 2px solid ${MBUX.accent}; outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) {
  .vos-notif, .vos-notif--critical, .vos-notif--saliendo { animation-duration: 1ms; animation-iteration-count: 1; }
}
`;

/** Identificador de temporizador (portátil entre DOM y Node). */
type Temporizador = ReturnType<typeof setTimeout>;

/** Aviso individual ya resuelto (visible o en salida). */
interface Fila {
  notif: CockpitNotification;
  saliendo: boolean;
}

/**
 * Selecciona los avisos visibles: las críticas tienen prioridad (nunca las
 * desplaza el ruido de info/warning) y dentro de cada grupo se conservan las
 * más recientes, asumiendo `notifications` en orden de llegada.
 */
function seleccionarVisibles(
  notifications: CockpitNotification[],
  max: number,
): CockpitNotification[] {
  if (notifications.length <= max) return notifications;
  const criticas = notifications.filter((n) => n.severity === "critical");
  const resto = notifications.filter((n) => n.severity !== "critical");
  const elegidas = [
    ...criticas.slice(-max),
    ...resto.slice(-Math.max(0, max - criticas.length)),
  ];
  // Se devuelve respetando el orden original de la lista.
  const ids = new Set(elegidas.map((n) => n.id));
  return notifications.filter((n) => ids.has(n.id)).slice(-max);
}

export function NotificationStack({
  notifications,
  onDismiss,
  max = 3,
}: NotificationStackProps) {
  const visibles = seleccionarVisibles(notifications, Math.max(1, max));

  // Avisos retirados de las props que siguen animando su salida.
  const [saliendo, setSaliendo] = useState<CockpitNotification[]>([]);
  const previasRef = useRef<CockpitNotification[]>([]);
  const purgaRef = useRef(new Map<string, Temporizador>());
  const cierreRef = useRef(new Map<string, Temporizador>());
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  // Firma de los avisos visibles: cambia sólo cuando entra o sale alguno.
  const firma = visibles.map((n) => `${n.id}:${n.severity}:${n.timeoutMs ?? ""}`).join("|");

  // Detecta desapariciones y las mantiene en pantalla mientras dure la salida.
  useEffect(() => {
    const idsActuales = new Set(visibles.map((n) => n.id));
    const retiradas = previasRef.current.filter((n) => !idsActuales.has(n.id));
    previasRef.current = visibles;

    // Si un aviso reaparece, se cancela su purga pendiente.
    for (const id of idsActuales) {
      const t = purgaRef.current.get(id);
      if (t !== undefined) {
        clearTimeout(t);
        purgaRef.current.delete(id);
      }
    }
    if (retiradas.length === 0) return;

    setSaliendo((prev) => [
      ...prev.filter((n) => !retiradas.some((r) => r.id === n.id)),
      ...retiradas,
    ]);
    // Un temporizador por aviso: así un cambio de lista posterior no cancela
    // la purga de los que ya estaban saliendo (no se quedarían en el DOM).
    for (const r of retiradas) {
      purgaRef.current.set(
        r.id,
        setTimeout(() => {
          purgaRef.current.delete(r.id);
          setSaliendo((prev) => prev.filter((n) => n.id !== r.id));
        }, SALIDA_MS),
      );
    }
    // `visibles` se recalcula en cada render: la clave estable es `firma`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firma]);

  // Autocierre de info/warning visibles (las críticas no caducan). El
  // temporizador se crea una sola vez por aviso: la llegada de otros no
  // reinicia la cuenta de los que ya estaban en pantalla.
  useEffect(() => {
    const mapa = cierreRef.current;
    const vivos = new Set<string>();
    for (const n of visibles) {
      if (n.severity === "critical") continue;
      vivos.add(n.id);
      if (mapa.has(n.id)) continue;
      mapa.set(
        n.id,
        setTimeout(() => {
          mapa.delete(n.id);
          onDismissRef.current(n.id);
        }, n.timeoutMs ?? TIMEOUT_MS),
      );
    }
    for (const [id, t] of mapa) {
      if (!vivos.has(id)) {
        clearTimeout(t);
        mapa.delete(id);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firma]);

  // Al desmontar se cancelan todos los temporizadores pendientes.
  useEffect(() => {
    const purgas = purgaRef.current;
    const cierres = cierreRef.current;
    return () => {
      purgas.forEach(clearTimeout);
      purgas.clear();
      cierres.forEach(clearTimeout);
      cierres.clear();
    };
  }, []);

  const filas: Fila[] = [
    ...visibles.map((notif) => ({ notif, saliendo: false })),
    ...saliendo
      .filter((n) => !visibles.some((v) => v.id === n.id))
      .map((notif) => ({ notif, saliendo: true })),
  ];

  if (filas.length === 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 18,
        right: 18,
        zIndex: 900,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        width: 340,
        maxWidth: "calc(100vw - 36px)",
        pointerEvents: "none",
        fontFamily: MBUX.font,
      }}
    >
      <style>{CSS}</style>
      {filas.map(({ notif, saliendo: sale }) => {
        const color = colorSeveridad(notif.severity);
        const critica = notif.severity === "critical";
        return (
          <div
            key={notif.id}
            role={critica ? "alert" : "status"}
            aria-live={critica ? "assertive" : "polite"}
            className={`vos-notif${critica ? " vos-notif--critical" : ""}${sale ? " vos-notif--saliendo" : ""}`}
            style={
              {
                "--vos-notif-color": `${color}55`,
                display: "flex",
                gap: 12,
                alignItems: "flex-start",
                padding: "13px 14px",
                borderRadius: 14,
                background: `linear-gradient(160deg, ${color}1f 0%, rgba(255,255,255,0.03) 55%, rgba(0,0,0,0.25) 100%), ${MBUX.bg}`,
                border: `1px solid ${color}66`,
                boxShadow: `0 8px 30px rgba(0,0,0,0.5), 0 0 0 1px ${color}22, 0 0 26px -6px ${color}`,
                color: MBUX.text,
                pointerEvents: "auto",
                overflow: "hidden",
                boxSizing: "border-box",
              } as CSSProperties
            }
          >
            <span style={{ lineHeight: 0, marginTop: 1, flex: "0 0 auto" }}>
              <Icono severity={notif.severity} color={color} />
            </span>

            <div style={{ flex: "1 1 auto", minWidth: 0 }}>
              <div
                style={{
                  fontSize: 17,
                  fontWeight: 300,
                  letterSpacing: 0.2,
                  color: MBUX.text,
                  lineHeight: 1.25,
                }}
              >
                {notif.title}
              </div>
              {notif.detail ? (
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 300,
                    color: MBUX.muted,
                    marginTop: 3,
                    lineHeight: 1.35,
                  }}
                >
                  {notif.detail}
                </div>
              ) : null}
            </div>

            <button
              type="button"
              className="vos-notif__cerrar"
              aria-label={`Cerrar aviso: ${notif.title}`}
              onClick={() => onDismissRef.current(notif.id)}
            >
              <svg
                width={14}
                height={14}
                viewBox="0 0 14 14"
                aria-hidden="true"
                focusable="false"
              >
                <g stroke="currentColor" strokeWidth={1.6} strokeLinecap="round">
                  <line x1="3" y1="3" x2="11" y2="11" />
                  <line x1="11" y1="3" x2="3" y2="11" />
                </g>
              </svg>
            </button>
          </div>
        );
      })}
    </div>
  );
}
