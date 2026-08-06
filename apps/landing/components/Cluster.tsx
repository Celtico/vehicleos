"use client";

/**
 * Cuadro de instrumentos vivo de la portada.
 *
 * Reproduce el ritual de cualquier cuadro real: al dar contacto las agujas
 * hacen el barrido de autodiagnóstico, vuelven a cero y arranca la marcha.
 * Después aparece la avería en la rueda delantera izquierda, que es la
 * promesa del producto contada en movimiento.
 *
 * Se anima mutando atributos por refs, sin re-render por fotograma, igual
 * que la instrumentación real de la aplicación.
 */
import { useEffect, useRef } from "react";

/** Longitud del arco: radio 60 y barrido de 270°. */
const LEN = (270 / 360) * 2 * Math.PI * 60;
const BARRIDO_MS = 1500;
const ESPERA_MS = 700;
const ACELERACION_MS = 2600;

/** Valores de crucero a los que converge la animación. */
const SPEED_FIN = 97;
const RPM_FIN = 2140;
const RALENTI = 720;

function suavizar(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function Cluster() {
  const arcSpeed = useRef<SVGPathElement>(null);
  const arcRpm = useRef<SVGPathElement>(null);
  const valSpeed = useRef<SVGTextElement>(null);
  const valRpm = useRef<SVGTextElement>(null);
  const rueda = useRef<SVGRectElement>(null);
  const lectura = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const pintar = (speed: number, rpm: number) => {
      arcSpeed.current?.setAttribute("stroke-dasharray", `${LEN * (speed / 240)} 999`);
      arcRpm.current?.setAttribute("stroke-dasharray", `${LEN * (rpm / 5000)} 999`);
      if (valSpeed.current) valSpeed.current.textContent = String(Math.round(speed));
      if (valRpm.current) valRpm.current.textContent = String(Math.round(rpm));
    };

    const encenderAveria = () => {
      const r = rueda.current;
      if (r) {
        r.setAttribute("fill", "var(--danger)");
        r.style.filter = "drop-shadow(0 0 9px var(--danger))";
      }
      if (lectura.current) {
        lectura.current.innerHTML = "<b>C0035</b> — SENSOR DE RUEDA DELANTERA IZQUIERDA";
      }
    };

    // Sin animación: se muestra directamente el estado final.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      pintar(SPEED_FIN, RPM_FIN);
      encenderAveria();
      return;
    }

    const inicio = performance.now();
    let raf = 0;
    let averiaLanzada = false;
    let temporizador: ReturnType<typeof setTimeout> | undefined;

    const marco = (ahora: number) => {
      const t = ahora - inicio;

      if (t < BARRIDO_MS) {
        // Autodiagnóstico: las agujas suben a fondo y vuelven.
        const p = t / BARRIDO_MS;
        const f = p < 0.5 ? suavizar(p * 2) : 1 - suavizar((p - 0.5) * 2);
        pintar(240 * f, 5000 * f);
      } else if (t < BARRIDO_MS + ESPERA_MS) {
        pintar(0, RALENTI);
      } else {
        const p = Math.min((t - BARRIDO_MS - ESPERA_MS) / ACELERACION_MS, 1);
        const e = suavizar(p);
        pintar(SPEED_FIN * e, RALENTI + (RPM_FIN - RALENTI) * e);
        if (p >= 1 && !averiaLanzada) {
          averiaLanzada = true;
          temporizador = setTimeout(encenderAveria, 620);
        }
      }
      raf = requestAnimationFrame(marco);
    };
    raf = requestAnimationFrame(marco);

    return () => {
      cancelAnimationFrame(raf);
      if (temporizador) clearTimeout(temporizador);
    };
  }, []);

  return (
    <div>
      <svg
        className="cluster"
        viewBox="0 0 460 300"
        role="img"
        aria-label="Cuadro de instrumentos animado: las agujas hacen el barrido de arranque y después se enciende una avería en la rueda delantera izquierda."
      >
        <defs>
          <linearGradient id="arcg" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--accent)" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.55" />
          </linearGradient>
        </defs>

        {/* Velocímetro */}
        <g transform="translate(74,132)">
          <path
            d="M -52 30 A 60 60 0 1 1 52 30"
            fill="none"
            stroke="var(--line)"
            strokeWidth="7"
            strokeLinecap="round"
          />
          <path
            ref={arcSpeed}
            d="M -52 30 A 60 60 0 1 1 52 30"
            fill="none"
            stroke="url(#arcg)"
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray="0 999"
          />
          <text
            ref={valSpeed}
            x="0"
            y="8"
            textAnchor="middle"
            fill="var(--text)"
            fontFamily="var(--font-cluster)"
            fontSize="42"
          >
            0
          </text>
          <text
            x="0"
            y="26"
            textAnchor="middle"
            fill="var(--muted)"
            fontFamily="var(--font-data)"
            fontSize="9"
            letterSpacing="1.6"
          >
            KM/H
          </text>
        </g>

        {/* Régimen */}
        <g transform="translate(386,132)">
          <path
            d="M -52 30 A 60 60 0 1 1 52 30"
            fill="none"
            stroke="var(--line)"
            strokeWidth="7"
            strokeLinecap="round"
          />
          <path
            ref={arcRpm}
            d="M -52 30 A 60 60 0 1 1 52 30"
            fill="none"
            stroke="url(#arcg)"
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray="0 999"
          />
          <text
            ref={valRpm}
            x="0"
            y="8"
            textAnchor="middle"
            fill="var(--text)"
            fontFamily="var(--font-cluster)"
            fontSize="42"
          >
            0
          </text>
          <text
            x="0"
            y="26"
            textAnchor="middle"
            fill="var(--muted)"
            fontFamily="var(--font-data)"
            fontSize="9"
            letterSpacing="1.6"
          >
            RPM
          </text>
        </g>

        {/* Coche visto desde arriba */}
        <g transform="translate(230,150)">
          <path
            d="M 0 -84 C 15 -84 28 -73 31 -55 C 34 -37 36 -6 36 26 C 36 61 34 89 29 100 C 24 109 12 112 0 112
               C -12 112 -24 109 -29 100 C -34 89 -36 61 -36 26 C -36 -6 -34 -37 -31 -55 C -28 -73 -15 -84 0 -84 Z"
            fill="var(--surface)"
            stroke="var(--accent)"
            strokeOpacity="0.34"
            strokeWidth="1.3"
          />
          <path
            d="M -22 -62 Q 0 -66 22 -62 L 27 -26 Q 0 -30 -27 -26 Z"
            fill="var(--raised)"
            stroke="var(--line)"
            strokeWidth="1"
          />
          <rect
            x="-19"
            y="-16"
            width="38"
            height="42"
            rx="4"
            fill="var(--raised)"
            stroke="var(--line)"
            strokeWidth="1"
          />
          {/* La rueda delantera izquierda es la que se enciende. */}
          <rect
            ref={rueda}
            x="-45"
            y="-56"
            width="13"
            height="32"
            rx="4.5"
            fill="var(--line)"
          />
          <rect x="32" y="-56" width="13" height="32" rx="4.5" fill="var(--line)" />
          <rect x="-45" y="56" width="13" height="32" rx="4.5" fill="var(--line)" />
          <rect x="32" y="56" width="13" height="32" rx="4.5" fill="var(--line)" />
        </g>
      </svg>
      <p className="readout" ref={lectura} aria-live="polite" />
    </div>
  );
}
