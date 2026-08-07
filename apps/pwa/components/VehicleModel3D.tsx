"use client";

/**
 * VehicleModel3D — vista 3D del vehículo real, alternativa a la cenital SVG.
 *
 * Carga `public/models/clk-w209.glb` (Mercedes CLK 55 AMG, W209) con three.js
 * puro y GLTFLoader. Nada de react-three-fiber: el bucle de render vive fuera
 * de React y no provoca ni un re-render por frame, igual que hacen los gauges
 * de @vehicleos/ui.
 *
 * LICENCIA DEL MODELO (importante, ver `public/models/ATRIBUCION.md`): el .glb
 * es obra de Ddiaz Design bajo CC BY-NC-SA. El fichero se usa TAL CUAL, sin
 * editar: las piezas que no interesan se ocultan en tiempo de ejecución con
 * `mesh.visible = false`. Recortar el asset generaría una obra derivada.
 *
 * ---------------------------------------------------------------------------
 * CONVENIO DE EJES DEL MODELO (medido, no supuesto)
 * ---------------------------------------------------------------------------
 * El nodo raíz `Sketchfab_model` lleva una matriz que gira -90° sobre X para
 * pasar el original Z-up a Y-up. Tras aplicarla, midiendo los centros de las
 * mallas en coordenadas de mundo (bbox global: X ±0,0094 · Y -0,0018..0,0124 ·
 * Z ±0,0232; el coche mide 0,046 unidades de largo, o sea 1 unidad ≈ 100 m):
 *
 *   +Z = MORRO           bumperFa z=+0,020 · faros z=+0,021 · rejilla z=+0,022
 *   -Z = COLA            bumperRa z=-0,019 · maletero z=-0,019 · escape z=-0,022
 *   +Y = ARRIBA          techo (glassT) y=+0,012 · bajos y=-0,002
 *   +X = LADO IZQUIERDO DEL CONDUCTOR
 *   -X = LADO DERECHO DEL CONDUCTOR
 *
 * El signo de X NO se toma de los nombres del autor, porque un mapa de averías
 * que señala la rueda equivocada manda al mecánico a la pieza que no es. Se
 * apoya en tres comprobaciones independientes que coinciden:
 *
 *   1. Geometría: con el morro en +Z y el techo en +Y, en un sistema dextrógiro
 *      la izquierda del conductor es Y × Z = +X.
 *   2. Puesto de conducción: el volante (`steering_wheel_*`) y el cuadro de
 *      relojes (`interior_gauge_needle`) están en x=+0,0034, igual que el
 *      asiento `seatL`. Un CLK 55 AMG de 2003 es de volante a la izquierda,
 *      luego +X es el lado izquierdo.
 *   3. Nombres del autor, como confirmación: headlightL en x=+0,006 frente a
 *      headlightR en x=-0,006, y mirrorL en x=+0,008.
 *
 * Ruedas (comparten malla `wheel` e instancian por nodos, hay que separarlas
 * por posición). Centros medidos:
 *
 *   x=+0,0074  z=+0,0147  →  delantera IZQUIERDA   (wheel-fl)
 *   x=-0,0074  z=+0,0147  →  delantera DERECHA     (wheel-fr)
 *   x=+0,0074  z=-0,0124  →  trasera  IZQUIERDA    (wheel-rl)
 *   x=-0,0074  z=-0,0124  →  trasera  DERECHA      (wheel-rr)
 *
 * Salvedad: `caliperLF`, `caliperLR`, `rotorLF` y `rotorLR` son mallas ÚNICAS
 * que contienen la geometría de los dos lados a la vez (su bbox va de x=-0,008
 * a x=+0,008, con el centro en x≈0). Asignarlas a una esquina por el signo de
 * X sería una moneda al aire, así que se excluyen del resalte: quedan visibles
 * pero sin teñir. Lo que se ilumina es la llanta y el neumático de la esquina,
 * que es lo que el mecánico ve.
 * ---------------------------------------------------------------------------
 */

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { PartSeverity, VehiclePartId } from "@vehicleos/ui";

export interface VehicleModel3DProps {
  /** Estado por pieza; las ausentes se consideran "ok". */
  parts?: Partial<Record<VehiclePartId, PartSeverity>>;
  /** 0-100: calor del vano motor (tiñe el capó de cian → ámbar → rojo). */
  engineHeat?: number;
  /** Alto del lienzo en píxeles. */
  height?: number;
  /** Callback al tocar una pieza (para abrir el detalle de la avería). */
  onPartClick?: (part: VehiclePartId) => void;
  /** Qué dibujar si el dispositivo no puede con WebGL. */
  fallback?: React.ReactNode;
}

/* -------------------------------------------------------------------------- */
/* Constantes                                                                  */
/* -------------------------------------------------------------------------- */

const MODEL_URL = "/models/clk-w209.glb";

/** Largo al que se normaliza el coche; el .glb viene a escala 1/100. */
const LARGO_OBJETIVO = 4;

/** Encuadre: campo de visión y elevación de la cámara sobre el suelo. */
const FOV = 26;
const ELEVACION = THREE.MathUtils.degToRad(14);
/** Margen alrededor del coche al calcular la distancia de cámara. */
const MARGEN_ENCUADRE = 1.1;

/** Vista inicial: tres cuartos delantero por el lado del conductor. */
const GIRO_INICIAL = -0.62;
/** Velocidad de la rotación automática (rad/s). */
const VELOCIDAD_GIRO = 0.18;

/** Nombre legible de cada pieza (para el `aria-label`). */
const ETIQUETAS: Record<VehiclePartId, string> = {
  engine: "motor",
  body: "carrocería",
  "wheel-fl": "rueda delantera izquierda",
  "wheel-fr": "rueda delantera derecha",
  "wheel-rl": "rueda trasera izquierda",
  "wheel-rr": "rueda trasera derecha",
  "door-fl": "puerta delantera izquierda",
  "door-fr": "puerta delantera derecha",
  "door-rl": "puerta trasera izquierda",
  "door-rr": "puerta trasera derecha",
};

/* -------------------------------------------------------------------------- */
/* Paleta                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Colores del cockpit que necesita la escena.
 *
 * OJO: no se pueden leer de `MBUX` (@vehicleos/ui). Desde que el cockpit tiene
 * tema diurno y nocturno, esas constantes son cadenas CSS del tipo
 * `rgb(var(--c-danger))`, que `THREE.Color` no sabe interpretar: se queda en
 * blanco sin avisar, y un resalte blanco no dice si la pieza está en aviso o
 * en avería. Se resuelven contra el DOM, que es donde vive el valor de verdad,
 * y se refrescan cuando cambia el tema.
 */
type ClaveTema = "accent" | "warning" | "danger" | "ok";

/** Valor de respaldo si la variable CSS no está disponible. */
const RESPALDO_TEMA: Record<ClaveTema, number> = {
  accent: 0x00d2be,
  warning: 0xffb020,
  danger: 0xff4d5a,
  ok: 0x38e07d,
};

/** Color de resalte por gravedad. */
const TOKEN_GRAVEDAD: Record<PartSeverity, ClaveTema> = {
  ok: "ok",
  info: "accent",
  warning: "warning",
  error: "danger",
};

/**
 * Lee `--c-<token>` del documento. El formato de `globals.css` son los tres
 * canales sueltos ("0 210 190"), para poder componer alfas en CSS.
 */
function resolverColorTema(token: ClaveTema, destino: THREE.Color): THREE.Color {
  if (typeof document === "undefined") return destino.setHex(RESPALDO_TEMA[token]);
  const bruto = getComputedStyle(document.documentElement)
    .getPropertyValue(`--c-${token}`)
    .trim();
  const canales = bruto.split(/[\s,/]+/).map(Number);
  const [r, g, b] = canales;
  if (
    r === undefined ||
    g === undefined ||
    b === undefined ||
    canales.slice(0, 3).some(Number.isNaN)
  ) {
    return destino.setHex(RESPALDO_TEMA[token]);
  }
  return destino.setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace);
}

/**
 * Cuánto se "repinta" la pieza del color de la gravedad (0-1): color base,
 * metalness, rugosidad y textura. Ver `resaltar()`.
 */
const FUERZA_GRAVEDAD: Record<PartSeverity, number> = {
  ok: 0,
  info: 0.6,
  warning: 0.8,
  error: 0.92,
};

/** Intensidad del halo emissive que se suma al repintado. */
const INTENSIDAD_GRAVEDAD: Record<PartSeverity, number> = {
  ok: 0,
  info: 0.15,
  warning: 0.28,
  error: 0.42,
};

/**
 * Corrector por pieza. El mismo resalte se lee de forma muy distinta según el
 * tamaño de la superficie: en una llanta hace falta a fondo para que el aviso
 * sea inequívoco, mientras que teñir el capó o el lateral entero al máximo
 * tapa la forma del coche y deja de verse qué pieza es.
 */
const FACTOR_PIEZA: Record<VehiclePartId, number> = {
  engine: 0.8,
  body: 0.68,
  "wheel-fl": 1,
  "wheel-fr": 1,
  "wheel-rl": 1,
  "wheel-rr": 1,
  "door-fl": 0.9,
  "door-fr": 0.9,
  "door-rl": 0.9,
  "door-rr": 0.9,
};

/**
 * Piezas del grupo `_cockpit` que SÍ se ven desde fuera.
 *
 * El autor metió en el mismo grupo el habitáculo (asientos, salpicadero,
 * volante, relojes) y varias piezas exteriores: el capó, los retrovisores y
 * los cristales delanteros. Ocultar el grupo entero dejaría el coche sin
 * parabrisas ni espejos y con un agujero donde va el capó, así que se filtra
 * por pieza en lugar de por grupo.
 */
const EXTERIORES_DEL_COCKPIT = [
  "hooda_", // capó (hace falta además para el tinte de calor)
  "mirrorl_",
  "mirrorr_",
  "glassf_", // parabrisas
  "glasslf_", // ventanilla delantera izquierda
  "glassrf_", // ventanilla delantera derecha
];

/** Tokens de pieza que forman la carrocería pintada. */
const TOKENS_CARROCERIA = [
  "_body_",
  "_bumperfa_",
  "_bumperra_",
  "_bumperframef_",
  "_bumperframer_",
  "_trunk_",
];

/* -------------------------------------------------------------------------- */
/* Utilidades geométricas                                                      */
/* -------------------------------------------------------------------------- */

/** ¿La malla se ve desde el exterior del coche? */
function esVisibleDesdeFuera(nombre: string): boolean {
  if (!nombre.includes("_cockpit")) return true;
  return EXTERIORES_DEL_COCKPIT.some((token) => nombre.includes(token));
}

/** ¿Es una pieza del tren de rodaje (llanta, neumático, disco o pinza)? */
function esTrenDeRodaje(nombre: string): boolean {
  if (nombre.includes("steering")) return false; // el volante también es "wheel"
  return nombre.includes("_wheel_") || nombre.includes("rotor") || nombre.includes("caliper");
}

/**
 * Genera por código un HDRI equirectangular de estudio (Float32, valores por
 * encima de 1) para alimentar el PMREMGenerator. Sin fichero externo: son
 * cuatro focos gaussianos sobre un degradado frío, que es justo lo que hace
 * falta para que la pintura metalizada tenga reflejos largos.
 */
function crearEntornoEstudio(): THREE.DataTexture {
  const ANCHO = 256;
  const ALTO = 128;

  interface Foco {
    phi: number;
    theta: number;
    anchoPhi: number;
    anchoTheta: number;
    intensidad: number;
    color: readonly [number, number, number];
  }

  const focos: Foco[] = [
    // Softbox cenital muy ancho: el reflejo largo del capó y del techo.
    { phi: 0, theta: 0.32, anchoPhi: 2.4, anchoTheta: 0.24, intensidad: 11, color: [1, 1, 1] },
    // Luz principal por el lado izquierdo, ligeramente cálida.
    {
      phi: 2.1,
      theta: 0.9,
      anchoPhi: 0.55,
      anchoTheta: 0.38,
      intensidad: 7,
      color: [1, 0.96, 0.9],
    },
    // Relleno por el lado derecho, frío (acento MBUX).
    {
      phi: 4.4,
      theta: 1,
      anchoPhi: 0.65,
      anchoTheta: 0.45,
      intensidad: 3.4,
      color: [0.55, 0.95, 1],
    },
    // Contraluz trasero: recorta la silueta contra el negro del cockpit.
    {
      phi: 3.25,
      theta: 0.6,
      anchoPhi: 0.5,
      anchoTheta: 0.32,
      intensidad: 5,
      color: [0.85, 0.96, 1],
    },
  ];

  const datos = new Float32Array(ANCHO * ALTO * 4);
  for (let y = 0; y < ALTO; y++) {
    const theta = ((y + 0.5) / ALTO) * Math.PI; // 0 arriba, π abajo
    const alto = Math.cos(theta); // +1 cenit, -1 nadir
    // Degradado base: cielo frío arriba, suelo casi negro abajo.
    const base =
      alto > 0 ? 0.09 + 0.3 * Math.pow(alto, 0.75) : 0.09 * Math.pow(1 + alto, 1.5) + 0.012;
    const baseR = base * 0.82;
    const baseG = base * 0.94;
    const baseB = base * 1.1;

    for (let x = 0; x < ANCHO; x++) {
      const phi = ((x + 0.5) / ANCHO) * Math.PI * 2;
      let r = baseR;
      let g = baseG;
      let b = baseB;

      for (const foco of focos) {
        let dPhi = phi - foco.phi;
        while (dPhi > Math.PI) dPhi -= Math.PI * 2;
        while (dPhi < -Math.PI) dPhi += Math.PI * 2;
        const dTheta = theta - foco.theta;
        const caida = Math.exp(
          -((dPhi * dPhi) / (2 * foco.anchoPhi * foco.anchoPhi)) -
            (dTheta * dTheta) / (2 * foco.anchoTheta * foco.anchoTheta),
        );
        const aporte = caida * foco.intensidad;
        r += aporte * foco.color[0];
        g += aporte * foco.color[1];
        b += aporte * foco.color[2];
      }

      const i = (y * ANCHO + x) * 4;
      datos[i] = r;
      datos[i + 1] = g;
      datos[i + 2] = b;
      datos[i + 3] = 1;
    }
  }

  const textura = new THREE.DataTexture(datos, ANCHO, ALTO, THREE.RGBAFormat, THREE.FloatType);
  textura.mapping = THREE.EquirectangularReflectionMapping;
  textura.minFilter = THREE.LinearFilter;
  textura.magFilter = THREE.LinearFilter;
  textura.generateMipmaps = false;
  textura.needsUpdate = true;
  return textura;
}

/** Mancha suave de sombra de contacto, dibujada en un canvas. */
function crearTexturaSombra(): THREE.CanvasTexture {
  const LADO = 256;
  const canvas = document.createElement("canvas");
  canvas.width = LADO;
  canvas.height = LADO;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const grad = ctx.createRadialGradient(LADO / 2, LADO / 2, 0, LADO / 2, LADO / 2, LADO / 2);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.42, "rgba(255,255,255,0.72)");
    grad.addColorStop(0.72, "rgba(255,255,255,0.22)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, LADO, LADO);
  }
  const textura = new THREE.CanvasTexture(canvas);
  textura.colorSpace = THREE.SRGBColorSpace;
  return textura;
}

/**
 * Distancia mínima de cámara para que el coche quepa entero en CUALQUIER
 * posición de la rotación automática.
 *
 * Para cada punto `p` de la silueta (relativo al punto al que mira la cámara)
 * y cada giro, la condición de que entre en el frustum es
 * `|p·derecha| ≤ (D - p·dir)·tanH`, de donde sale
 * `D ≥ |p·derecha|/tanH + p·dir`. Se toma el máximo sobre puntos y giros.
 *
 * Se encuadra sobre una MUESTRA DE VÉRTICES reales, no sobre las esquinas de
 * la caja envolvente: un coche tiene las esquinas muy redondeadas y la caja
 * obliga a alejar la cámara por un volumen que está vacío. La diferencia son
 * unos 15 puntos porcentuales de tamaño en pantalla, que en un cuadro de
 * 1280×672 se notan.
 */
function distanciaDeEncuadre(
  puntos: Float32Array,
  alturaObjetivo: number,
  dir: THREE.Vector3,
  aspecto: number,
): number {
  const vFov = THREE.MathUtils.degToRad(FOV);
  const tanV = Math.tan(vFov / 2);
  const tanH = tanV * Math.max(aspecto, 0.2);

  // Con la cámara sobre el plano YZ (dir.x = 0), `derecha` es ±X puro y
  // `arriba` tiene x = 0: por eso el bucle puede saltarse los términos nulos.
  const derecha = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), dir).normalize();
  const arriba = new THREE.Vector3().crossVectors(dir, derecha).normalize();

  let distancia = 0;
  const PASOS = 32;
  for (let k = 0; k < PASOS; k++) {
    const a = (k / PASOS) * Math.PI * 2;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    for (let i = 0; i < puntos.length; i += 3) {
      const x0 = puntos[i] ?? 0;
      const y0 = (puntos[i + 1] ?? 0) - alturaObjetivo;
      const z0 = puntos[i + 2] ?? 0;
      const px = x0 * cos + z0 * sin;
      const pz = -x0 * sin + z0 * cos;
      const sobreEje = y0 * dir.y + pz * dir.z;
      const lateral = Math.abs(px * derecha.x) / tanH + sobreEje;
      const vertical = Math.abs(y0 * arriba.y + pz * arriba.z) / tanV + sobreEje;
      if (lateral > distancia) distancia = lateral;
      if (vertical > distancia) distancia = vertical;
    }
  }
  return distancia * MARGEN_ENCUADRE;
}

/**
 * Muestra de vértices del coche en el espacio ya normalizado (apoyado en y=0,
 * centrado en x/z). Se submuestrea para que el encuadre cueste milisegundos.
 */
function muestrearSilueta(
  mallas: THREE.Mesh[],
  escala: number,
  offset: THREE.Vector3,
): Float32Array {
  const MAXIMO = 2500;
  let total = 0;
  for (const mesh of mallas) total += mesh.geometry.getAttribute("position")?.count ?? 0;
  const paso = Math.max(1, Math.ceil(total / MAXIMO));

  const salida: number[] = [];
  const v = new THREE.Vector3();
  for (const mesh of mallas) {
    const pos = mesh.geometry.getAttribute("position");
    if (!pos) continue;
    for (let i = 0; i < pos.count; i += paso) {
      v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
      salida.push(v.x * escala + offset.x, v.y * escala + offset.y, v.z * escala + offset.z);
    }
  }
  return new Float32Array(salida);
}

/** Materiales de una malla, normalizados a lista. */
function materialesDe(mesh: THREE.Mesh): THREE.Material[] {
  return Array.isArray(mesh.material) ? mesh.material : [mesh.material];
}

/** Material con color base y emissive (Standard, Physical, Phong, Lambert…). */
type MaterialTenible = THREE.Material & {
  color: THREE.Color;
  emissive: THREE.Color;
  emissiveIntensity: number;
  /** Presentes en Standard/Physical; ausentes en Basic/Phong. */
  metalness?: number;
  roughness?: number;
  envMapIntensity?: number;
  map?: THREE.Texture | null;
};

/** ¿El material se puede teñir? */
function esTenible(m: THREE.Material): m is MaterialTenible {
  const candidato = m as { emissive?: unknown; color?: unknown };
  return candidato.emissive instanceof THREE.Color && candidato.color instanceof THREE.Color;
}

/** Color del calor del vano motor: cian (frío) → ámbar → rojo. */
function colorDeCalor(
  destino: THREE.Color,
  calor: number,
  paleta: Record<ClaveTema, THREE.Color>,
): void {
  const t = THREE.MathUtils.clamp(calor, 0, 100) / 100;
  if (t <= 0.55) destino.copy(paleta.accent).lerp(paleta.warning, t / 0.55);
  else destino.copy(paleta.warning).lerp(paleta.danger, (t - 0.55) / 0.45);
}

/* -------------------------------------------------------------------------- */
/* Escena (vive fuera de React)                                                */
/* -------------------------------------------------------------------------- */

/** Aspecto original de un material, para poder deshacer el resalte. */
interface Aspecto {
  base: THREE.Color;
  emisivo: THREE.Color;
  intensidad: number;
  metalness: number | undefined;
  roughness: number | undefined;
  envMapIntensity: number | undefined;
  map: THREE.Texture | null | undefined;
}

interface Api {
  aplicarPiezas(parts: Partial<Record<VehiclePartId, PartSeverity>> | undefined): void;
  fijarCalor(calor: number): void;
}

/* -------------------------------------------------------------------------- */
/* Componente                                                                  */
/* -------------------------------------------------------------------------- */

export function VehicleModel3D({
  parts,
  engineHeat = 0,
  height = 300,
  onPartClick,
  fallback,
}: VehicleModel3DProps) {
  const contenedorRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const apiRef = useRef<Api | null>(null);
  const onPartClickRef = useRef(onPartClick);
  onPartClickRef.current = onPartClick;

  const [progreso, setProgreso] = useState(0);
  const [listo, setListo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Descripción hablada del estado, en español. */
  const etiqueta = useMemo(() => {
    const activas = (Object.keys(ETIQUETAS) as VehiclePartId[]).filter((p) => {
      const s = parts?.[p];
      return s === "warning" || s === "error";
    });
    if (activas.length === 0) return "Vista 3D del vehículo. Ninguna pieza señalada.";
    const nombres = activas.map((p) => ETIQUETAS[p]).join(", ");
    return `Vista 3D del vehículo. ${activas.length === 1 ? "Avería en" : "Averías en"} ${nombres}.`;
  }, [parts]);

  /* ---------------------------------------------------------------------- */
  /* Montaje: escena, carga del modelo y bucle de render                     */
  /* ---------------------------------------------------------------------- */
  useEffect(() => {
    const contenedor = contenedorRef.current;
    if (!contenedor) return;

    // El <canvas> se crea aquí y no en el JSX a propósito. Un canvas solo
    // admite UN contexto WebGL en toda su vida: si React reutiliza el mismo
    // elemento entre montajes (StrictMode lo hace en desarrollo), el segundo
    // getContext devuelve null y three revienta por dentro con un
    // "Cannot read properties of null". Creando uno nuevo por efecto, cada
    // montaje empieza limpio.
    const canvas = document.createElement("canvas");
    canvas.setAttribute("role", "img");
    canvas.className = "block h-full w-full";
    canvas.style.touchAction = "none";
    canvas.style.cursor = onPartClickRef.current ? "grab" : "default";
    canvasRef.current = canvas;
    contenedor.appendChild(canvas);

    const sinMovimiento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    /* --- Renderer ------------------------------------------------------- */
    // Se intenta de más a menos exigente. Pedir "high-performance" o
    // antialias no es gratis: hay GPU (y la de una tablet Android barata es
    // justo de esas) donde esa combinación devuelve un contexto nulo y three
    // revienta dentro, así que se degrada en vez de rendirse a la primera.
    const INTENTOS: THREE.WebGLRendererParameters[] = [
      { antialias: true, powerPreference: "high-performance" },
      { antialias: true },
      { antialias: false },
    ];
    let renderer: THREE.WebGLRenderer | null = null;
    let ultimoFallo: unknown = null;
    for (const opciones of INTENTOS) {
      try {
        renderer = new THREE.WebGLRenderer({
          canvas,
          alpha: true, // fondo transparente: se integra con el negro del cockpit
          ...opciones,
        });
        break;
      } catch (e) {
        ultimoFallo = e;
      }
    }
    if (!renderer) {
      canvas.remove();
      const e = ultimoFallo;
      // El motivo importa: "no hay WebGL" y "el driver ha fallado al crear el
      // contexto" se arreglan de forma distinta, y sin el mensaje real no hay
      // manera de saber cuál de los dos es desde una tablet en el coche.
      console.error("[VehicleModel3D] no se pudo crear el renderer:", e);
      setError("Este dispositivo no puede mostrar la vista 3D.");
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearAlpha(0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.45;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100);

    /* --- Paleta viva (cambia con el tema diurno/nocturno) --------------- */
    const paleta: Record<ClaveTema, THREE.Color> = {
      accent: new THREE.Color(),
      warning: new THREE.Color(),
      danger: new THREE.Color(),
      ok: new THREE.Color(),
    };
    /** ¿Manda el tema claro? Lo dice el atributo que pone DaylightMode. */
    const esDeDia = (): boolean => document.documentElement.dataset.tema === "dia";

    /**
     * Ajusta suelo y halo al tema.
     *
     * Sobre fondo claro un halo cian aditivo no ilumina nada y la sombra al
     * 62 % se convierte en una mancha gris que, al recortarse contra el borde
     * del lienzo, se ve como un rectángulo pegado en mitad del cuadro. De día
     * el halo se apaga y la sombra se aprieta y se aclara.
     */
    const ajustarSueloAlTema = (): void => {
      const dia = esDeDia();
      materialHalo.visible = !dia;
      materialSombra.opacity = dia ? 0.3 : 0.62;
    };

    const refrescarPaleta = (): void => {
      for (const clave of Object.keys(paleta) as ClaveTema[]) {
        resolverColorTema(clave, paleta[clave]);
      }
    };
    refrescarPaleta();

    /* --- Entorno de estudio (PMREM) ------------------------------------- */
    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    const hdri = crearEntornoEstudio();
    const entorno = pmrem.fromEquirectangular(hdri).texture;
    scene.environment = entorno;
    scene.environmentIntensity = 1.5;
    hdri.dispose();

    /* --- Luces ---------------------------------------------------------- */
    const ambiental = new THREE.AmbientLight(0xdfeff2, 0.35);
    scene.add(ambiental);

    const principal = new THREE.DirectionalLight(0xffffff, 2.2);
    principal.position.set(4, 6, 5);
    scene.add(principal);

    const relleno = new THREE.DirectionalLight(paleta.accent.clone(), 0.85);
    relleno.position.set(-5, 2.5, 3);
    scene.add(relleno);

    const contra = new THREE.DirectionalLight(0xbfe6ff, 1.1);
    contra.position.set(-1.5, 3, -6);
    scene.add(contra);

    /* --- Pivote (gira el coche, la cámara se queda quieta) -------------- */
    const pivote = new THREE.Group();
    pivote.rotation.y = GIRO_INICIAL;
    scene.add(pivote);

    /* --- Estado mutable del bucle --------------------------------------- */
    const meshesPorPieza = new Map<VehiclePartId, THREE.Mesh[]>();
    const piezaDeMesh = new Map<THREE.Object3D, VehiclePartId>();
    const meshesSeleccionables: THREE.Mesh[] = [];
    const meshesCapo: THREE.Mesh[] = [];
    const aspectoOriginal = new Map<THREE.Material, Aspecto>();
    const geometrias = new Set<THREE.BufferGeometry>();
    const materiales = new Set<THREE.Material>();
    const texturas = new Set<THREE.Texture>();

    /** Piezas resaltadas ahora mismo y su gravedad. */
    let resaltadas: [VehiclePartId, PartSeverity][] = [];
    let calorObjetivo = 0;
    let calorActual = 0;
    let hayPulso = false;
    let necesitaRender = true;
    let visible = true;
    let girando = !sinMovimiento;
    let arrastrando = false;
    let arrastroDe = 0;
    let desplazado = 0;
    let rafId = 0;
    let destruido = false;

    const colorTemporal = new THREE.Color();
    const reloj = new THREE.Clock();

    const pedirRender = () => {
      necesitaRender = true;
    };

    /** Guarda geometría, material y texturas para liberarlos al desmontar. */
    const registrarRecursos = (mesh: THREE.Mesh): void => {
      geometrias.add(mesh.geometry);
      for (const m of materialesDe(mesh)) {
        materiales.add(m);
        for (const valor of Object.values(m)) {
          if (valor instanceof THREE.Texture) texturas.add(valor);
        }
      }
    };

    /**
     * Clona los materiales de la malla. Las cuatro ruedas comparten la misma
     * instancia de material: sin clonar, teñir una las tiñe las cuatro.
     */
    const clonarMateriales = (mesh: THREE.Mesh): void => {
      const original = mesh.material;
      const clon = Array.isArray(original)
        ? original.map((m) => m.clone())
        : (original as THREE.Material).clone();
      mesh.material = clon;
      for (const m of materialesDe(mesh)) {
        materiales.add(m);
        if (esTenible(m)) {
          aspectoOriginal.set(m, {
            base: m.color.clone(),
            emisivo: m.emissive.clone(),
            intensidad: m.emissiveIntensity,
            metalness: m.metalness,
            roughness: m.roughness,
            envMapIntensity: m.envMapIntensity,
            map: m.map,
          });
        }
      }
    };

    /** Devuelve el material al aspecto con el que vino del .glb. */
    const restaurar = (mesh: THREE.Mesh): void => {
      for (const m of materialesDe(mesh)) {
        const original = aspectoOriginal.get(m);
        if (!original || !esTenible(m)) continue;
        m.color.copy(original.base);
        m.emissive.copy(original.emisivo);
        m.emissiveIntensity = original.intensidad;
        if (original.metalness !== undefined) m.metalness = original.metalness;
        if (original.roughness !== undefined) m.roughness = original.roughness;
        if (original.envMapIntensity !== undefined)
          m.envMapIntensity = original.envMapIntensity;
        if (m.map !== original.map) {
          m.map = original.map ?? null;
          m.needsUpdate = true;
        }
      }
    };

    /**
     * Aplica el aspecto de avería a una malla: la "repinta" del color de la
     * gravedad.
     *
     * Con `emissive` solo no basta. Una llanta cromada bajo iluminación de
     * estudio ya llega casi a blanco, así que sumarle rojo satura el canal R y
     * el resultado es blanco rosado, no rojo: se ve que "algo pasa" pero no de
     * qué color, y el color ES la información (ámbar aviso, rojo avería). Para
     * que se lea igual sobre chapa negra que sobre cromo hay que bajar además
     * el reflejo especular (metalness, envMapIntensity) y quitar la textura
     * base, que multiplica el color.
     *
     * Es un cambio estructural del material (recompila el shader), así que se
     * hace SOLO al cambiar el estado de las piezas, nunca por frame.
     */
    const resaltar = (mesh: THREE.Mesh, color: THREE.Color, fuerza: number): void => {
      for (const m of materialesDe(mesh)) {
        const original = aspectoOriginal.get(m);
        if (!original || !esTenible(m)) continue;
        m.color.copy(original.base).lerp(color, fuerza);
        if (original.metalness !== undefined)
          m.metalness = original.metalness * (1 - fuerza * 0.9);
        if (original.roughness !== undefined) {
          m.roughness = THREE.MathUtils.lerp(original.roughness, 0.5, fuerza);
        }
        if (original.envMapIntensity !== undefined) {
          m.envMapIntensity = original.envMapIntensity * (1 - fuerza * 0.75);
        }
        const mapaDeseado = fuerza > 0.5 ? null : (original.map ?? null);
        if (m.map !== mapaDeseado) {
          m.map = mapaDeseado;
          m.needsUpdate = true;
        }
      }
    };

    /** Fija el halo emissive. Es barato: se puede llamar por frame. */
    const tenir = (mesh: THREE.Mesh, color: THREE.Color, intensidad: number): void => {
      for (const m of materialesDe(mesh)) {
        if (!esTenible(m)) continue;
        m.emissive.copy(color);
        m.emissiveIntensity = intensidad;
      }
    };

    /* --- Sombra de contacto --------------------------------------------- */
    const texturaSombra = crearTexturaSombra();
    texturas.add(texturaSombra);
    const materialSombra = new THREE.MeshBasicMaterial({
      map: texturaSombra,
      color: 0x000000,
      transparent: true,
      opacity: 0.62,
      depthWrite: false,
    });
    materiales.add(materialSombra);
    const geometriaSombra = new THREE.PlaneGeometry(1, 1);
    geometrias.add(geometriaSombra);
    const sombra = new THREE.Mesh(geometriaSombra, materialSombra);
    sombra.rotation.x = -Math.PI / 2;
    sombra.renderOrder = -1;
    sombra.visible = false;
    pivote.add(sombra);

    // Halo cian en el suelo, el mismo recurso que usa la vista cenital para
    // que el coche no quede flotando sobre un negro absoluto. Va debajo de la
    // sombra: donde el coche apoya, la sombra se lo come.
    const materialHalo = new THREE.MeshBasicMaterial({
      map: texturaSombra,
      color: paleta.accent.clone(),
      transparent: true,
      opacity: 0.13,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    materiales.add(materialHalo);
    const halo = new THREE.Mesh(geometriaSombra, materialHalo);
    halo.rotation.x = -Math.PI / 2;
    halo.position.y = 0.002;
    halo.renderOrder = -2;
    halo.visible = false;
    pivote.add(halo);

    /* --- Encuadre -------------------------------------------------------- */
    // Antes de cargar el modelo se encuadra sobre una caja aproximada; al
    // terminar la carga se sustituye por la silueta real del coche.
    let puntosEncuadre: Float32Array = new Float32Array([
      -0.81, 0, -2, 0.81, 0, -2, -0.81, 0, 2, 0.81, 0, 2, -0.81, 1.22, -2, 0.81, 1.22, -2,
      -0.81, 1.22, 2, 0.81, 1.22, 2,
    ]);
    let alturaObjetivo = 0.5;
    const dirCamara = new THREE.Vector3(
      0,
      Math.sin(ELEVACION),
      Math.cos(ELEVACION),
    ).normalize();

    const encuadrar = (): void => {
      const ancho = contenedor.clientWidth || 1;
      const alto = contenedor.clientHeight || 1;
      renderer.setSize(ancho, alto, false);
      camera.aspect = ancho / alto;
      const d = distanciaDeEncuadre(puntosEncuadre, alturaObjetivo, dirCamara, camera.aspect);
      // La cámara se planta a distancia `d` del punto al que mira.
      camera.position.copy(dirCamara).multiplyScalar(d);
      camera.position.y += alturaObjetivo;
      camera.lookAt(0, alturaObjetivo, 0);
      camera.updateProjectionMatrix();
      pedirRender();
    };

    /**
     * Altura del punto de mira que hace el coche lo más grande posible: con
     * la cámara baja, mirar demasiado alto o demasiado bajo obliga a alejarse
     * para no cortar el morro o los bajos. Se busca por barrido, que es más
     * barato que razonarlo.
     */
    const buscarAlturaObjetivo = (altoCoche: number, aspecto: number): number => {
      let mejor = altoCoche * 0.44;
      let mejorD = Infinity;
      for (let i = 0; i <= 10; i++) {
        const altura = altoCoche * (0.15 + (i / 10) * 0.7);
        const d = distanciaDeEncuadre(puntosEncuadre, altura, dirCamara, aspecto);
        if (d < mejorD) {
          mejorD = d;
          mejor = altura;
        }
      }
      return mejor;
    };

    /* --- Carga del modelo ------------------------------------------------ */
    const loader = new GLTFLoader();
    loader.load(
      MODEL_URL,
      (gltf) => {
        if (destruido) return;
        const modelo = gltf.scene;

        // 1) Oculta lo que no se ve desde fuera y recoge las mallas visibles.
        const visibles: THREE.Mesh[] = [];
        modelo.traverse((obj) => {
          if (!(obj instanceof THREE.Mesh)) return;
          registrarRecursos(obj);
          const nombre = obj.name.toLowerCase();
          if (!esVisibleDesdeFuera(nombre)) {
            obj.visible = false;
            return;
          }
          obj.frustumCulled = true;
          visibles.push(obj);
        });

        // 2) Se mide TODO antes de meter el modelo en el pivote: mientras
        //    `modelo` no tiene padre, su matriz de mundo es su propio espacio
        //    y los signos de X/Z son los del convenio de la cabecera. Medirlo
        //    ya rotado por el pivote intercambiaría los ejes y la rueda
        //    delantera izquierda dejaría de serlo.
        modelo.updateWorldMatrix(false, true);
        const caja = new THREE.Box3().setFromObject(modelo);
        const tam = caja.getSize(new THREE.Vector3());
        const centro = caja.getCenter(new THREE.Vector3());

        const cajaMalla = new THREE.Box3();
        const centroMalla = new THREE.Vector3();
        const centros = new Map<THREE.Mesh, THREE.Vector3>();
        const rodaje: THREE.Mesh[] = [];
        for (const mesh of visibles) {
          cajaMalla.setFromObject(mesh);
          cajaMalla.getCenter(centroMalla);
          centros.set(mesh, centroMalla.clone());
          if (esTrenDeRodaje(mesh.name.toLowerCase())) rodaje.push(mesh);
        }

        // 3) Normaliza escala y posición: el coche mide LARGO_OBJETIVO de
        //    largo, apoyado en y=0 y centrado en x/z.
        const escala = LARGO_OBJETIVO / Math.max(tam.z, 1e-6);
        const desplazamiento = new THREE.Vector3(
          -centro.x * escala,
          -caja.min.y * escala,
          -centro.z * escala,
        );
        // La silueta para el encuadre se toma ANTES de reparentar, en el
        // mismo espacio en el que se han medido las piezas.
        puntosEncuadre = muestrearSilueta(visibles, escala, desplazamiento);

        modelo.scale.setScalar(escala);
        modelo.position.copy(desplazamiento);
        pivote.add(modelo);
        // La carga tarda segundos y el pivote ya llevaba girando: se recoloca
        // para que la primera imagen sea el tres cuartos delantero previsto.
        pivote.rotation.y = GIRO_INICIAL;

        const tamCoche = tam.clone().multiplyScalar(escala);
        const anchoInicial = contenedor.clientWidth || 1;
        const altoInicial = contenedor.clientHeight || 1;
        alturaObjetivo = buscarAlturaObjetivo(tamCoche.y, anchoInicial / altoInicial);

        // Sombra de contacto y halo ambiental, ajustados a la huella.
        sombra.scale.set(tamCoche.x * 2.1, tamCoche.z * 1.14, 1);
        sombra.position.y = 0.004;
        sombra.visible = true;
        halo.scale.set(tamCoche.x * 3, tamCoche.z * 1.25, 1);
        ajustarSueloAlTema();
        halo.visible = true;

        // 4) Clasificación de las ruedas POR POSICIÓN (ver cabecera).

        // Umbrales empíricos: eje transversal y eje longitudinal medidos
        // sobre las propias piezas, sin dar por hecho dónde está el cero.
        let xMin = Infinity;
        let xMax = -Infinity;
        let zMin = Infinity;
        let zMax = -Infinity;
        for (const mesh of rodaje) {
          const c = centros.get(mesh);
          if (!c) continue;
          xMin = Math.min(xMin, c.x);
          xMax = Math.max(xMax, c.x);
          zMin = Math.min(zMin, c.z);
          zMax = Math.max(zMax, c.z);
        }
        const xMedio = (xMin + xMax) / 2;
        const zMedio = (zMin + zMax) / 2;
        // Las pinzas y los discos son una sola malla con geometría a ambos
        // lados: su centro cae sobre el eje y quedan fuera del resalte.
        const umbralX = ((xMax - xMin) / 2) * 0.35;

        const asignar = (mesh: THREE.Mesh, pieza: VehiclePartId): void => {
          const lista = meshesPorPieza.get(pieza);
          if (lista) lista.push(mesh);
          else meshesPorPieza.set(pieza, [mesh]);
          piezaDeMesh.set(mesh, pieza);
          meshesSeleccionables.push(mesh);
          clonarMateriales(mesh);
        };

        for (const mesh of visibles) {
          const nombre = mesh.name.toLowerCase();
          const c = centros.get(mesh);
          if (!c) continue;

          if (nombre.includes("hooda_")) {
            asignar(mesh, "engine");
            meshesCapo.push(mesh);
            continue;
          }

          if (esTrenDeRodaje(nombre)) {
            if (Math.abs(c.x - xMedio) < umbralX) continue; // pinza/disco: ambos lados
            const izquierda = c.x > xMedio; // +X = izquierda del conductor
            const delantera = c.z > zMedio; // +Z = morro
            asignar(
              mesh,
              delantera
                ? izquierda
                  ? "wheel-fl"
                  : "wheel-fr"
                : izquierda
                  ? "wheel-rl"
                  : "wheel-rr",
            );
            continue;
          }

          // El .glb NO tiene puertas como mallas separadas (van dentro de la
          // carrocería). Como sustituto se usa la ventanilla de cada hueco,
          // que está justo sobre la puerta.
          if (nombre.includes("glassl") || nombre.includes("glassr")) {
            if (nombre.includes("tl_")) continue; // pilotos traseros, no ventanillas
            const izquierda = c.x > centro.x;
            const delantera = c.z > centro.z;
            asignar(
              mesh,
              delantera
                ? izquierda
                  ? "door-fl"
                  : "door-fr"
                : izquierda
                  ? "door-rl"
                  : "door-rr",
            );
            continue;
          }

          if (TOKENS_CARROCERIA.some((token) => nombre.includes(token))) {
            asignar(mesh, "body");
          }
        }

        // Comprobación del convenio de ejes: con `?debug3d=1` en la URL se
        // vuelca la posición de cada pieza del tren de rodaje y la esquina
        // que se le ha asignado. Así se verifica sobre el modelo real, no
        // sobre una suposición.
        if (new URLSearchParams(window.location.search).has("debug3d")) {
          const filas = rodaje.map((mesh) => {
            const c = centros.get(mesh) ?? new THREE.Vector3();
            return {
              nodo: mesh.name.slice(-46),
              x: Number(c.x.toFixed(5)),
              z: Number(c.z.toFixed(5)),
              esquina: piezaDeMesh.get(mesh) ?? "(sin asignar: cruza el eje)",
            };
          });
          // eslint-disable-next-line no-console
          console.table(filas);
        }

        encuadrar();
        setListo(true);
        setProgreso(100);
        pedirRender();
      },
      (evento) => {
        if (destruido) return;
        if (evento.lengthComputable && evento.total > 0) {
          setProgreso(Math.round((evento.loaded / evento.total) * 100));
        } else if (evento.loaded > 0) {
          // Sin Content-Length (respuesta comprimida): estimación sobre 9,6 MB.
          setProgreso(Math.min(99, Math.round((evento.loaded / 9_600_000) * 100)));
        }
      },
      () => {
        if (destruido) return;
        setError("No se ha podido cargar el modelo 3D.");
      },
    );

    /* --- API para los efectos de props ---------------------------------- */
    apiRef.current = {
      aplicarPiezas(nuevas) {
        // Apaga lo que ya no está resaltado.
        for (const [pieza] of resaltadas) {
          const siguiente = nuevas?.[pieza];
          if (siguiente === "warning" || siguiente === "error" || siguiente === "info")
            continue;
          for (const mesh of meshesPorPieza.get(pieza) ?? []) restaurar(mesh);
        }

        resaltadas = [];
        hayPulso = false;
        for (const pieza of Object.keys(ETIQUETAS) as VehiclePartId[]) {
          const gravedad = nuevas?.[pieza];
          if (!gravedad || gravedad === "ok") continue;
          resaltadas.push([pieza, gravedad]);
          if (gravedad === "error" && !sinMovimiento) hayPulso = true;
          colorTemporal.copy(paleta[TOKEN_GRAVEDAD[gravedad]]);
          for (const mesh of meshesPorPieza.get(pieza) ?? []) {
            resaltar(mesh, colorTemporal, FUERZA_GRAVEDAD[gravedad] * FACTOR_PIEZA[pieza]);
            tenir(mesh, colorTemporal, INTENSIDAD_GRAVEDAD[gravedad] * FACTOR_PIEZA[pieza]);
          }
        }
        pedirRender();
      },

      fijarCalor(calor) {
        calorObjetivo = THREE.MathUtils.clamp(calor, 0, 100);
        pedirRender();
      },
    };

    /* --- Interacción: arrastre y clic ----------------------------------- */
    const raycaster = new THREE.Raycaster();
    const puntero = new THREE.Vector2();

    const alPulsar = (e: PointerEvent) => {
      arrastrando = true;
      arrastroDe = e.clientX;
      desplazado = 0;
      canvas.setPointerCapture(e.pointerId);
    };

    const alMover = (e: PointerEvent) => {
      if (!arrastrando) return;
      const dx = e.clientX - arrastroDe;
      arrastroDe = e.clientX;
      desplazado += Math.abs(dx);
      pivote.rotation.y += dx * 0.008;
      pedirRender();
    };

    const alSoltar = (e: PointerEvent) => {
      if (!arrastrando) return;
      arrastrando = false;
      if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
      // Un arrastre corto se interpreta como toque sobre una pieza.
      if (desplazado > 6 || !onPartClickRef.current || meshesSeleccionables.length === 0)
        return;
      const rect = canvas.getBoundingClientRect();
      puntero.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      puntero.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(puntero, camera);
      const impactos = raycaster.intersectObjects(meshesSeleccionables, false);
      const primero = impactos[0];
      if (!primero) return;
      const pieza = piezaDeMesh.get(primero.object);
      if (pieza) onPartClickRef.current(pieza);
    };

    canvas.addEventListener("pointerdown", alPulsar);
    canvas.addEventListener("pointermove", alMover);
    canvas.addEventListener("pointerup", alSoltar);
    canvas.addEventListener("pointercancel", alSoltar);

    /* --- Bucle ----------------------------------------------------------- */
    const bucle = () => {
      rafId = requestAnimationFrame(bucle);
      const dt = Math.min(reloj.getDelta(), 0.1);

      if (girando && !arrastrando) {
        pivote.rotation.y += dt * VELOCIDAD_GIRO;
        necesitaRender = true;
      }

      // Calor del vano motor: interpolación suave hacia el objetivo.
      if (Math.abs(calorActual - calorObjetivo) > 0.05) {
        calorActual += (calorObjetivo - calorActual) * Math.min(1, dt * 3.5);
        necesitaRender = true;
      }

      // El capó lleva el tinte de calor salvo que el motor esté en avería:
      // entonces manda la gravedad (rojo/ámbar), que es la información seria.
      const gravedadMotor = resaltadas.find(([p]) => p === "engine")?.[1];
      if (!gravedadMotor && meshesCapo.length > 0) {
        colorDeCalor(colorTemporal, calorActual, paleta);
        // Curva con exponente < 1: sobre chapa oscura un tinte lineal no se
        // percibe hasta muy arriba, y el calor tiene que leerse antes de que
        // el motor esté al rojo.
        const t = Math.pow(THREE.MathUtils.clamp(calorActual, 0, 100) / 100, 0.7);
        for (const mesh of meshesCapo) tenir(mesh, colorTemporal, 0.02 + t * 0.62);
      }

      // Pulso de las piezas en avería.
      if (hayPulso) {
        const fase = 0.55 + 0.45 * Math.sin(reloj.elapsedTime * 5.5);
        for (const [pieza, gravedad] of resaltadas) {
          if (gravedad !== "error") continue;
          colorTemporal.copy(paleta[TOKEN_GRAVEDAD[gravedad]]);
          const intensidad = INTENSIDAD_GRAVEDAD[gravedad] * FACTOR_PIEZA[pieza] * fase;
          for (const mesh of meshesPorPieza.get(pieza) ?? []) {
            if (pieza === "engine") continue; // ya tratado arriba
            tenir(mesh, colorTemporal, intensidad);
          }
          if (pieza === "engine") {
            for (const mesh of meshesCapo) tenir(mesh, colorTemporal, intensidad);
          }
        }
        necesitaRender = true;
      }

      if (necesitaRender) {
        necesitaRender = false;
        renderer.render(scene, camera);
      }
    };

    /* --- Pausa: fuera de pantalla o pestaña oculta ----------------------- */
    const arrancar = () => {
      if (rafId !== 0 || destruido) return;
      reloj.getDelta(); // descarta el salto acumulado
      rafId = requestAnimationFrame(bucle);
    };
    const parar = () => {
      if (rafId === 0) return;
      cancelAnimationFrame(rafId);
      rafId = 0;
    };
    const revisarActividad = () => {
      if (visible && document.visibilityState === "visible") arrancar();
      else parar();
    };

    const observadorVisibilidad = new IntersectionObserver(
      (entradas) => {
        const entrada = entradas[0];
        visible = entrada ? entrada.isIntersecting : true;
        revisarActividad();
      },
      { threshold: 0.01 },
    );
    observadorVisibilidad.observe(contenedor);
    document.addEventListener("visibilitychange", revisarActividad);

    const observadorTamano = new ResizeObserver(() => encuadrar());
    observadorTamano.observe(contenedor);

    // `prefers-reduced-motion` puede cambiar en caliente.
    const consulta = window.matchMedia("(prefers-reduced-motion: reduce)");
    const alCambiarMovimiento = () => {
      girando = !consulta.matches;
      if (consulta.matches) hayPulso = false;
      pedirRender();
    };
    consulta.addEventListener("change", alCambiarMovimiento);

    // El cockpit alterna tema diurno y nocturno (`data-tema` sobre <html>) y
    // con él cambian los colores del aviso: hay que releerlos y repintar.
    const observadorTema = new MutationObserver(() => {
      refrescarPaleta();
      relleno.color.copy(paleta.accent);
      materialHalo.color.copy(paleta.accent);
      ajustarSueloAlTema();
      const actuales = new Map(resaltadas);
      apiRef.current?.aplicarPiezas(Object.fromEntries(actuales));
      pedirRender();
    });
    observadorTema.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-tema", "class", "style"],
    });

    encuadrar();
    revisarActividad();

    /* --- Limpieza -------------------------------------------------------- */
    return () => {
      destruido = true;
      parar();
      apiRef.current = null;
      observadorVisibilidad.disconnect();
      observadorTamano.disconnect();
      observadorTema.disconnect();
      document.removeEventListener("visibilitychange", revisarActividad);
      consulta.removeEventListener("change", alCambiarMovimiento);
      canvas.removeEventListener("pointerdown", alPulsar);
      canvas.removeEventListener("pointermove", alMover);
      canvas.removeEventListener("pointerup", alSoltar);
      canvas.removeEventListener("pointercancel", alSoltar);

      for (const g of geometrias) g.dispose();
      for (const m of materiales) m.dispose();
      for (const t of texturas) t.dispose();
      entorno.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
      if (canvasRef.current === canvas) canvasRef.current = null;
    };
  }, []);

  // El nombre accesible vive en un atributo del lienzo, que ya no lo pone
  // React: hay que refrescarlo a mano cuando cambia el estado del coche.
  useEffect(() => {
    canvasRef.current?.setAttribute("aria-label", etiqueta);
  }, [etiqueta, listo]);

  /* ---------------------------------------------------------------------- */
  /* Props → escena                                                          */
  /* ---------------------------------------------------------------------- */
  useEffect(() => {
    apiRef.current?.aplicarPiezas(parts);
  }, [parts, listo]);

  useEffect(() => {
    apiRef.current?.fijarCalor(engineHeat);
  }, [engineHeat, listo]);

  const cargando = !listo && !error;

  return (
    <div
      ref={contenedorRef}
      className="relative w-full"
      style={{ height }}
      data-testid="vehicle-3d"
      data-listo={listo ? "si" : "no"}
    >
      {cargando ? (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2">
          <span className="text-[10px] uppercase tracking-[0.25em] text-muted">
            Cargando modelo 3D
          </span>
          <div className="h-[3px] w-40 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-200"
              style={{ width: `${progreso}%` }}
            />
          </div>
          <span className="text-[10px] tabular-nums text-muted">{progreso}%</span>
        </div>
      ) : null}

      {error ? (
        <div className="flex h-full flex-col items-center justify-center gap-2">
          {fallback}
          <span className="px-6 text-center text-[11px] text-muted">{error}</span>
        </div>
      ) : null}
    </div>
  );
}
