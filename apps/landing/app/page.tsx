/**
 * Página de presentación de VehicleOS.
 *
 * Todas las capturas son del producto real funcionando contra su backend,
 * no maquetas: es lo que sostiene el argumento de venta.
 */
import Image from "next/image";
import { Cluster } from "../components/Cluster";

/** Capturas del producto, con su texto alternativo descriptivo. */
const SHOTS = {
  dash: {
    src: "/img/dash-abs.jpg",
    alt: "Cuadro de VehicleOS: la rueda delantera izquierda aparece resaltada en rojo tras detectarse el código C0035, con un aviso emergente en la esquina superior derecha.",
  },
  diag: {
    src: "/img/diagnostics-fault.jpg",
    alt: "Pantalla de diagnóstico: el código P0217 explicado como sobretemperatura del motor, con causa probable al 75 %, lista de causas, soluciones y la recomendación de detener el vehículo.",
  },
  ai: {
    src: "/img/ai.jpg",
    alt: "Pantalla del asistente con preguntas sugeridas y una respuesta sobre el código activo.",
  },
  panel: {
    src: "/img/panel.jpg",
    alt: "Panel de flota con tres vehículos, mapa de posiciones con marcadores de color según gravedad, y lista de alertas pendientes de reconocer.",
  },
} as const;

export default function Home() {
  return (
    <>
      <nav className="rail" aria-label="Secciones">
        <svg
          className="rail-mark"
          width="30"
          height="30"
          viewBox="0 0 32 32"
          aria-hidden="true"
        >
          <path
            d="M6.6 24.5 a13 13 0 1 1 18.8 0"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            opacity="0.45"
          />
          <path
            d="M10 11.5 L16 22 L22 11.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <div className="rail-links">
          <a href="#averia">Avería</a>
          <a href="#ia">Asistente</a>
          <a href="#flota">Flota</a>
          <a href="#limites">Límites</a>
        </div>
      </nav>

      <main className="shell">
        <div className="wrap">
          {/* ── Portada ──────────────────────────────────── */}
          <section className="hero">
            <div className="hero-grid">
              <div className="stack">
                <span className="eyebrow">Sistema operativo para coches</span>
                <h1>
                  El cuadro que tu coche
                  <br />
                  no traía de fábrica
                </h1>
                <p className="lede">
                  VehicleOS convierte el puerto de diagnóstico de un coche de hace veinte años
                  en una pantalla que entiende lo que le pasa. Se instala como aplicación web:
                  funciona en la pantalla del salpicadero, en una tableta, en el móvil y en el
                  navegador del ordenador.
                </p>
                <a className="cta" href="#averia">
                  Ver cómo funciona
                </a>
              </div>
              <Cluster />
            </div>
          </section>

          {/* ── La idea central ──────────────────────────── */}
          <section id="averia">
            <span className="eyebrow">Diagnóstico</span>
            <h2>
              No te dice P0401.
              <br />
              Te dice qué rueda.
            </h2>
            <div className="split" style={{ marginBlockStart: 26 }}>
              <div className="stack">
                <p className="lede">
                  Un lector de códigos corriente te suelta{" "}
                  <span style={{ fontFamily: "var(--font-data)" }}>C0035</span> y te deja
                  buscando en foros. Ese código ya contiene la respuesta: es el sensor de
                  velocidad de la rueda delantera izquierda.
                </p>
                <p>
                  VehicleOS traduce cada avería a la pieza física que la sufre y la enciende
                  sobre el coche. Si el motor se calienta, el vano motor se tiñe de ámbar y
                  después de rojo, en tiempo real, según sube la aguja.
                </p>
              </div>
              <Shot shot={SHOTS.dash} />
            </div>
          </section>

          {/* ── Asistente ────────────────────────────────── */}
          <section id="ia">
            <span className="eyebrow">Asistente</span>
            <h2>
              Un mecánico que ha leído
              <br />
              los datos de tu coche
            </h2>
            <div className="split" style={{ marginBlockStart: 26 }}>
              <div className="stack">
                <p className="lede">
                  Pregunta en voz normal: ¿por qué está encendido el testigo?, ¿cuánto puedo
                  conducir así?, ¿qué reviso primero? La respuesta llega con la telemetría real
                  del momento, no con generalidades.
                </p>
                <p>
                  Cada código lleva su causa más probable con porcentaje, las causas ordenadas,
                  las soluciones de la más barata a la más cara, y lo que de verdad importa: si
                  puedes seguir circulando o tienes que parar.
                </p>
              </div>
              <Shot shot={SHOTS.diag} />
            </div>
            <Shot shot={SHOTS.ai} />
          </section>

          {/* ── Flota ────────────────────────────────────── */}
          <section id="flota">
            <span className="eyebrow">Panel web</span>
            <h2>
              Todos tus coches,
              <br />
              de un vistazo
            </h2>
            <p className="lede" style={{ marginBlockStart: 22 }}>
              Dónde están, cómo están, qué han recorrido y qué les duele. Las alertas se generan
              solas cuando el refrigerante pasa de 105&nbsp;°C, cuando el alternador deja de
              cargar o cuando aparece una avería nueva.
            </p>
            <Shot shot={SHOTS.panel} />
            <div className="cards">
              <div className="card">
                <h3>Viajes</h3>
                <p>
                  Cada arranque y parada del motor delimita un viaje, con distancia, consumo
                  medio y ruta.
                </p>
              </div>
              <div className="card">
                <h3>Sin encuestas</h3>
                <p>
                  Todo llega por WebSocket en el momento en que ocurre. Nada de preguntar cada
                  segundo.
                </p>
              </div>
              <div className="card">
                <h3>Sin cobertura</h3>
                <p>
                  Si te quedas sin red, la telemetría se guarda en el móvil y se envía sola al
                  volver.
                </p>
              </div>
              <div className="card">
                <h3>Simulador</h3>
                <p>
                  Once escenarios, del arranque en frío al modo emergencia, para probarlo sin
                  coche.
                </p>
              </div>
            </div>
          </section>

          {/* ── Arquitectura ─────────────────────────────── */}
          <section>
            <span className="eyebrow">Arquitectura</span>
            <h2>
              La pantalla nunca toca
              <br />
              el hardware
            </h2>
            <p className="lede" style={{ marginBlockStart: 22 }}>
              Un servicio Android sin interfaz es el único proceso con acceso al Bluetooth, al
              USB y al adaptador. La aplicación solo habla con él a través del SDK, por un canal
              local que no sale del dispositivo.
            </p>
            <div className="chain">
              <span>Aplicación</span>
              <i>→</i>
              <span>SDK</span>
              <i>→</i>
              <span className="hw">Servicio Android</span>
              <i>→</i>
              <span className="hw">Adaptador OBD</span>
              <i>→</i>
              <span className="hw">Coche</span>
            </div>
            <dl className="spec">
              <div>
                <dt>Frontal</dt>
                <dd>Next.js · PWA instalable · 60 FPS reales</dd>
              </div>
              <div>
                <dt>Servidor</dt>
                <dd>NestJS · PostgreSQL · WebSocket · JWT</dd>
              </div>
              <div>
                <dt>Puente</dt>
                <dd>Kotlin · Bluetooth, BLE, USB y WiFi</dd>
              </div>
              <div>
                <dt>Protocolo</dt>
                <dd>OBD-II · ELM327 · fórmulas SAE J1979</dd>
              </div>
            </dl>
          </section>

          {/* ── Honestidad ───────────────────────────────── */}
          <section id="limites">
            <span className="eyebrow">Antes de que preguntes</span>
            <h2>
              Lo que hace falta
              <br />y lo que no promete
            </h2>
            <div className="honest">
              <div className="stack-tight">
                <h3 style={{ fontSize: 16, color: "var(--muted)" }}>Necesitas</h3>
                <ul>
                  <li>
                    <em>·</em>
                    <span>Un adaptador OBD-II corriente, de los de veinte euros.</span>
                  </li>
                  <li>
                    <em>·</em>
                    <span>
                      Un coche de 2001 en adelante, que es cuando el OBD-II se hizo obligatorio.
                    </span>
                  </li>
                  <li>
                    <em>·</em>
                    <span>Una pantalla Android, una tableta o un móvil. Vale cualquiera.</span>
                  </li>
                </ul>
              </div>
              <div className="stack-tight">
                <h3 style={{ fontSize: 16, color: "var(--muted)" }}>No te va a dar</h3>
                <ul>
                  <li className="no">
                    <em>·</em>
                    <span>
                      Presión de neumáticos, si tu coche no lleva sensores TPMS. Ningún programa
                      se los inventa.
                    </span>
                  </li>
                  <li className="no">
                    <em>·</em>
                    <span>
                      Códigos de ABS o airbag con un adaptador genérico: viven en centralitas
                      que hablan el protocolo del fabricante.
                    </span>
                  </li>
                  <li className="no">
                    <em>·</em>
                    <span>
                      Cámara ni sensores de aparcamiento. Eso es hardware que hay que montar.
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          </section>

          <section>
            <span className="eyebrow">Código abierto</span>
            <h2>Móntalo esta tarde</h2>
            <p className="lede" style={{ marginBlockStart: 22 }}>
              Arranca con el simulador incluido y tendrás el cuadro funcionando sin tocar el
              coche ni levantar un servidor. Cuando quieras datos reales, enchufas el adaptador.
            </p>
            <a className="cta" href="#averia">
              Volver arriba
            </a>
          </section>

          <footer>
            VehicleOS · Instrumentación, diagnóstico y telemetría para coches con puerto OBD-II.
            Proyecto independiente, sin relación con ningún fabricante de automóviles.
          </footer>
        </div>
      </main>
    </>
  );
}

/** Captura del producto con su marco y texto alternativo. */
function Shot({ shot }: { shot: { src: string; alt: string } }) {
  return (
    <Image
      className="shot"
      src={shot.src}
      alt={shot.alt}
      width={1200}
      height={800}
      sizes="(max-width: 900px) 100vw, 60vw"
    />
  );
}
