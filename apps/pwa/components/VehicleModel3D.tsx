"use client";

/**
 * VehicleModel3D — vista tridimensional del vehículo con three.js puro,
 * alternativa conmutable a la cenital en SVG (`VehicleModel` de @vehicleos/ui).
 *
 * Replica el mismo contrato de datos que la cenital (`VehiclePartId`,
 * `PartSeverity`, `engineHeat`, `onPartClick`) para que el cuadro pueda
 * intercambiar una vista por otra sin tocar la lógica de diagnóstico.
 *
 * Decisiones que importan en un coche:
 *
 * - **three puro, sin react-three-fiber ni drei**: la escena se monta una sola
 *   vez en un `useEffect` y los cambios de props se empujan por refs, así que
 *   ni el calor del motor ni el parpadeo de una avería provocan re-render de
 *   React. Al desmontar se liberan geometrías, materiales, texturas y el
 *   propio contexto WebGL.
 * - **Batería**: el bucle de render se detiene cuando el lienzo sale de
 *   pantalla (IntersectionObserver) o la pestaña se oculta
 *   (`visibilitychange`), y `prefers-reduced-motion` desactiva el giro
 *   automático.
 * - **Arte original**: el cupé es geometría procedural (perfil lateral
 *   extruido y esculpido) sin logotipos ni referencias a ningún fabricante.
 *
 * El coche se construye extruyendo la silueta lateral y deformando después
 * los vértices (`esculpir`) para dar estrechamiento en planta, tumblehome
 * (el invernadero se cierra hacia el techo) y abombado de capó y techo. Es lo
 * que separa "unas cajas sueltas" de algo que se lee como una carrocería.
 */
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { toCreasedNormals } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { MBUX, type PartSeverity, type VehiclePartId } from "@vehicleos/ui";

export interface VehicleModel3DProps {
  /** Estado por pieza; las ausentes se consideran "ok". */
  parts?: Partial<Record<VehiclePartId, PartSeverity>>;
  /** 0-100: intensidad del calor del vano motor (tiñe el capó). */
  engineHeat?: number;
  /** Alto del lienzo en píxeles. */
  height?: number;
  /** Callback al tocar una pieza (para abrir el detalle de la avería). */
  onPartClick?: (part: VehiclePartId) => void;
}

/* -------------------------------------------------------------------------- */
/* Proporciones del cupé (unidades ≈ metros)                                   */
/* -------------------------------------------------------------------------- */

/** Semianchura nominal de la carrocería antes del esculpido. */
const SEMI_ANCHO = 1.02;
/** Semianchura nominal del invernadero acristalado. */
const SEMI_CABINA = 0.9;
/** Semianchura nominal del panel del capó. */
const SEMI_CAPO = 0.955;
/** Semianchura nominal del panel del techo. */
const SEMI_TECHO = 0.945;
/** Posición longitudinal de los ejes (batalla larga, típica de cupé). */
const EJE_DEL = 1.34;
const EJE_TRA = -1.52;
/** Radio del neumático y semianchura de la banda de rodadura. */
const R_RUEDA = 0.35;
const SEMI_RUEDA = 0.135;
/** Radio del paso de rueda recortado en la silueta. */
const R_PASO = 0.44;
/** Semilongitud del vehículo (referencia del afilado en planta). */
const SEMI_LARGO = 2.34;

/* -------------------------------------------------------------------------- */
/* Esculpido: de una extrusión plana a una carrocería                          */
/* -------------------------------------------------------------------------- */

/** Interpolación suave (smoothstep) de `a` a `b`. */
function suavizar(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/**
 * Estrechamiento en planta: la parte central mantiene el ancho pleno y el
 * morro y la cola se afilan (el morro algo más, como en un cupé real).
 */
function factorPlanta(x: number): number {
  const xn = Math.min(1, Math.abs(x) / SEMI_LARGO);
  const inicio = 0.63;
  if (xn <= inicio) return 1;
  const t = (xn - inicio) / (1 - inicio);
  return x > 0 ? 1 - 0.36 * t * t : 1 - 0.22 * t * t;
}

/**
 * Tumblehome: perfil de anchura según la altura. Máximo en las caderas
 * (y ≈ 0.58), ligera entrada en los bajos y cierre pronunciado hacia el techo.
 */
const TUMBLEHOME = [
  [0.18, 0.9],
  [0.36, 0.972],
  [0.58, 1.0],
  [0.82, 0.995],
  [0.99, 0.955],
  [1.16, 0.9],
  [1.32, 0.835],
  [1.46, 0.775],
] as const;

function factorAltura(y: number): number {
  const t = TUMBLEHOME;
  if (y <= t[0][0]) return t[0][1];
  for (let i = 1; i < t.length; i += 1) {
    const a = t[i - 1];
    const b = t[i];
    if (!a || !b) break;
    if (y <= b[0]) {
      const k = (y - a[0]) / (b[0] - a[0]);
      return a[1] + (b[1] - a[1]) * k;
    }
  }
  return t[t.length - 1]?.[1] ?? 1;
}

/** Abombado de capó y techo: la superficie cae hacia los flancos. */
function coronacion(y: number): number {
  return 0.05 * suavizar(0.78, 1.15, y);
}

/**
 * Deforma una geometría extruida (plana en Z) para darle volumen de coche.
 * Todas las piezas comparten esta función, así que los paneles añadidos
 * (capó, puertas, marcos) se pegan exactamente a la superficie resultante.
 */
function esculpir(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  const pos = geo.getAttribute("position") as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const zn = z / SEMI_ANCHO;
    pos.setXYZ(i, x, y - coronacion(y) * zn * zn, z * factorPlanta(x) * factorAltura(y));
  }
  pos.needsUpdate = true;
  geo.computeBoundingSphere();
  return geo;
}

/* -------------------------------------------------------------------------- */
/* Ayudas de extrusión                                                         */
/* -------------------------------------------------------------------------- */

interface OpcionesExtrusion {
  /** Anchura total en Z (incluido el bisel). */
  ancho: number;
  /** Radio del bisel que redondea los cantos. */
  bisel?: number;
  /** Desplazamiento del centro en Z (para paneles laterales). */
  centroZ?: number;
  /** Segmentos por curva del perfil. */
  curvas?: number;
  /** Ángulo (grados) a partir del cual una arista se considera cresta. */
  cresta?: number;
}

/** Extruye un `Shape` en Z, lo centra, lo esculpe y suaviza sus normales. */
function extruir(shape: THREE.Shape, o: OpcionesExtrusion): THREE.BufferGeometry {
  const bisel = o.bisel ?? 0;
  const fondo = Math.max(0.004, o.ancho - 2 * bisel);
  let geo: THREE.BufferGeometry = new THREE.ExtrudeGeometry(shape, {
    depth: fondo,
    bevelEnabled: bisel > 0,
    bevelThickness: bisel,
    bevelSize: bisel,
    bevelOffset: 0,
    bevelSegments: 3,
    curveSegments: o.curvas ?? 20,
    steps: 1,
  });
  geo.translate(0, 0, -fondo / 2 + (o.centroZ ?? 0));
  esculpir(geo);
  geo = toCreasedNormals(geo, THREE.MathUtils.degToRad(o.cresta ?? 46));
  return geo;
}

/** Rectángulo redondeado centrado en el origen, en el plano XY. */
function rectRedondeado(ancho: number, alto: number, radio: number): THREE.Shape {
  const w = ancho / 2;
  const h = alto / 2;
  const r = Math.min(radio, w, h);
  const s = new THREE.Shape();
  s.moveTo(-w + r, -h);
  s.lineTo(w - r, -h);
  s.quadraticCurveTo(w, -h, w, -h + r);
  s.lineTo(w, h - r);
  s.quadraticCurveTo(w, h, w - r, h);
  s.lineTo(-w + r, h);
  s.quadraticCurveTo(-w, h, -w, h - r);
  s.lineTo(-w, -h + r);
  s.quadraticCurveTo(-w, -h, -w + r, -h);
  return s;
}

/**
 * Caja redondeada orientada a lo largo de X (para ópticas y embellecedores):
 * `largoZ` es la dimensión transversal, `alto` la vertical y `fondo` la
 * profundidad en X.
 */
function barraRedondeada(
  largoZ: number,
  alto: number,
  fondo: number,
  radio: number,
): THREE.BufferGeometry {
  const geo = new THREE.ExtrudeGeometry(rectRedondeado(largoZ, alto, radio), {
    depth: fondo,
    bevelEnabled: true,
    bevelThickness: 0.012,
    bevelSize: 0.012,
    bevelSegments: 2,
    curveSegments: 8,
    steps: 1,
  });
  geo.translate(0, 0, -fondo / 2);
  geo.rotateY(Math.PI / 2);
  return geo;
}

/* -------------------------------------------------------------------------- */
/* Siluetas del cupé                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Silueta lateral de la carrocería inferior: morro, capó, línea de cintura,
 * tapa del maletero, cola y bajos con los dos pasos de rueda recortados.
 */
function siluetaCarroceria(): THREE.Shape {
  const s = new THREE.Shape();
  // Paragolpes y morro, bajo y afilado
  s.moveTo(2.14, 0.29);
  s.quadraticCurveTo(2.322, 0.325, 2.334, 0.55);
  s.lineTo(2.305, 0.69);
  s.quadraticCurveTo(2.258, 0.8, 2.08, 0.828);
  // Capó, largo y descendente
  s.bezierCurveTo(1.7, 0.878, 1.22, 0.928, 0.78, 0.975);
  // Línea de cintura, con ligera subida hacia la cola
  s.lineTo(0.1, 0.996);
  s.lineTo(-0.9, 1.006);
  s.lineTo(-1.58, 0.99);
  // Tapa del maletero y cola corta
  s.quadraticCurveTo(-1.99, 0.968, -2.185, 0.902);
  s.lineTo(-2.272, 0.788);
  s.lineTo(-2.302, 0.61);
  s.quadraticCurveTo(-2.318, 0.375, -2.17, 0.29);
  // Bajos, de la cola al morro, con los pasos de rueda
  s.lineTo(-1.995, 0.272);
  s.lineTo(-1.96, R_RUEDA);
  s.absarc(EJE_TRA, R_RUEDA, R_PASO, Math.PI, 0, true);
  s.lineTo(-1.08, 0.26);
  s.lineTo(0.9, 0.246);
  s.lineTo(0.9, R_RUEDA);
  s.absarc(EJE_DEL, R_RUEDA, R_PASO, Math.PI, 0, true);
  s.lineTo(1.78, 0.276);
  s.closePath();
  return s;
}

/**
 * Invernadero: cuña acristalada que aporta parabrisas, cristales laterales y
 * luneta de una sola pieza. Su borde inferior queda embebido en la carrocería.
 */
function siluetaInvernadero(): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(0.755, 0.968);
  s.quadraticCurveTo(0.42, 1.185, 0.05, 1.402);
  s.quadraticCurveTo(-0.17, 1.432, -0.46, 1.418);
  s.bezierCurveTo(-0.95, 1.384, -1.42, 1.19, -1.93, 0.962);
  s.lineTo(-1.6, 0.912);
  s.lineTo(-0.9, 0.94);
  s.lineTo(0.1, 0.93);
  s.closePath();
  return s;
}

/** Hueco del cristal lateral (DLO), usado como agujero del marco. */
function huecoLateral(): THREE.Path {
  const p = new THREE.Path();
  p.moveTo(0.565, 1.028);
  p.lineTo(0.135, 1.325);
  p.lineTo(-0.5, 1.342);
  p.bezierCurveTo(-0.81, 1.324, -1.08, 1.19, -1.3, 1.05);
  p.closePath();
  return p;
}

/** Panel del capó, ligeramente elevado sobre la carrocería (marca la junta). */
function siluetaCapo(): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(2.03, 0.848);
  s.bezierCurveTo(1.7, 0.894, 1.22, 0.944, 0.795, 0.991);
  s.lineTo(0.795, 0.949);
  s.bezierCurveTo(1.22, 0.902, 1.7, 0.852, 2.03, 0.806);
  s.closePath();
  return s;
}

/** Panel metálico del techo, que tapa la parte alta de la cuña acristalada. */
function siluetaTecho(): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(0.115, 1.415);
  s.quadraticCurveTo(-0.17, 1.45, -0.47, 1.436);
  s.lineTo(-0.66, 1.358);
  s.quadraticCurveTo(-0.17, 1.383, 0.175, 1.338);
  s.closePath();
  return s;
}

/**
 * Óptica delantera vista de perfil: una lengüeta fina que sobresale unos
 * centímetros del morro. Se extruye con el mismo `esculpir` que la
 * carrocería, así que se curva con el frontal en lugar de atravesarlo.
 */
function siluetaFaro(): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(2.332, 0.7);
  s.lineTo(2.31, 0.762);
  s.lineTo(2.148, 0.812);
  s.lineTo(2.158, 0.742);
  s.closePath();
  return s;
}

/** Piloto trasero: barra continua que recorre la cola de lado a lado. */
function siluetaPiloto(): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(-2.336, 0.7);
  s.lineTo(-2.34, 0.768);
  s.lineTo(-2.17, 0.812);
  s.lineTo(-2.165, 0.742);
  s.closePath();
  return s;
}

/** Panel de puerta sobre el flanco (aporta las juntas y el área táctil). */
function siluetaPuerta(xDelante: number, xDetras: number): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(xDelante, 0.942);
  s.lineTo(xDetras, 0.951);
  s.lineTo(xDetras, 0.44);
  s.quadraticCurveTo(xDetras + 0.01, 0.4, xDetras + 0.07, 0.396);
  s.lineTo(xDelante - 0.07, 0.386);
  s.quadraticCurveTo(xDelante - 0.01, 0.39, xDelante, 0.44);
  s.closePath();
  return s;
}

/* -------------------------------------------------------------------------- */
/* Entorno de estudio (mapa de reflejos generado en un canvas)                 */
/* -------------------------------------------------------------------------- */

/**
 * Genera una equirrectangular oscura con dos "softbox" y un halo cian bajo el
 * horizonte. Sin este mapa, una chapa metálica en `MeshStandardMaterial`
 * quedaría prácticamente negra: es lo que da los reflejos alargados que hacen
 * que el coche se lea como chapa pintada.
 */
function crearEntornoEstudio(renderer: THREE.WebGLRenderer): {
  textura: THREE.Texture;
  liberar: () => void;
} {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const cielo = ctx.createLinearGradient(0, 0, 0, 256);
    cielo.addColorStop(0, "#171b1e");
    cielo.addColorStop(0.32, "#2f373c");
    cielo.addColorStop(0.5, "#12171a");
    cielo.addColorStop(0.62, "#080c0e");
    cielo.addColorStop(1, "#030506");
    ctx.fillStyle = cielo;
    ctx.fillRect(0, 0, 512, 256);

    // Focos suaves: producen los reflejos alargados que recorren el flanco y
    // son, más que las luces directas, lo que hace que la chapa parezca chapa.
    const softbox = (cx: number, cy: number, rx: number, ry: number, alfa: number) => {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(rx, ry);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
      g.addColorStop(0, `rgba(255,255,255,${alfa})`);
      g.addColorStop(0.4, `rgba(238,245,248,${alfa * 0.55})`);
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, 1, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };
    softbox(110, 46, 140, 42, 1);
    softbox(372, 54, 118, 36, 0.92);
    softbox(248, 10, 230, 30, 0.6);
    softbox(20, 90, 60, 18, 0.5);

    // Halo cian rasante justo por encima del horizonte.
    const halo = ctx.createLinearGradient(0, 100, 0, 150);
    halo.addColorStop(0, "rgba(0,210,190,0)");
    halo.addColorStop(0.55, "rgba(0,210,190,0.06)");
    halo.addColorStop(1, "rgba(0,210,190,0)");
    ctx.fillStyle = halo;
    ctx.fillRect(0, 100, 512, 50);
  }

  const fuente = new THREE.CanvasTexture(canvas);
  fuente.mapping = THREE.EquirectangularReflectionMapping;
  fuente.colorSpace = THREE.SRGBColorSpace;

  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const objetivo = pmrem.fromEquirectangular(fuente);
  fuente.dispose();
  pmrem.dispose();

  return {
    textura: objetivo.texture,
    liberar: () => objetivo.dispose(),
  };
}

/** Textura de degradado radial para la sombra de contacto y el halo del suelo. */
function texturaRadial(color: string, dureza: number): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, color);
    g.addColorStop(dureza, color);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Máscara radial blanco→negro para el `alphaMap` del suelo: sin ella se ve
 * una línea de horizonte que rompe la sensación de coche flotando en negro.
 */
function texturaDesvanecido(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, 256, 256);
    const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, "#ffffff");
    g.addColorStop(0.1, "#ffffff");
    g.addColorStop(0.3, "#000000");
    g.addColorStop(1, "#000000");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;
  return tex;
}

/* -------------------------------------------------------------------------- */
/* Estado y colores                                                            */
/* -------------------------------------------------------------------------- */

/** Nombre en español de cada pieza (para el `aria-label`). */
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

/** Color de resalte por gravedad (paleta MBUX). */
const COLOR_GRAVEDAD: Record<PartSeverity, string> = {
  ok: MBUX.ok,
  info: MBUX.accent,
  warning: MBUX.warning,
  error: MBUX.danger,
};

/** Intensidad emisiva base por gravedad. */
const INTENSIDAD_GRAVEDAD: Record<PartSeverity, number> = {
  ok: 0,
  info: 0.3,
  warning: 0.55,
  error: 0.82,
};

/** Color del calor del vano motor: cian (frío) → ámbar → rojo. */
function colorCalor(destino: THREE.Color, calor: number): THREE.Color {
  const t = Math.min(1, Math.max(0, calor / 100));
  const frio = new THREE.Color(MBUX.accent);
  const medio = new THREE.Color(MBUX.warning);
  const caliente = new THREE.Color(MBUX.danger);
  return t <= 0.55
    ? destino.copy(frio).lerp(medio, t / 0.55)
    : destino.copy(medio).lerp(caliente, (t - 0.55) / 0.45);
}

/** Frase en español que describe el estado para lectores de pantalla. */
function describirEstado(parts: VehicleModel3DProps["parts"]): string {
  const avisos: string[] = [];
  const averias: string[] = [];
  for (const clave of Object.keys(ETIQUETAS) as VehiclePartId[]) {
    const sev = parts?.[clave];
    if (sev === "error") averias.push(ETIQUETAS[clave]);
    else if (sev === "warning") avisos.push(ETIQUETAS[clave]);
  }
  const partes = ["Vista 3D del vehículo."];
  if (averias.length > 0) partes.push(`Avería en ${averias.join(", ")}.`);
  if (avisos.length > 0) partes.push(`Aviso en ${avisos.join(", ")}.`);
  if (averias.length === 0 && avisos.length === 0) partes.push("Todas las piezas correctas.");
  return partes.join(" ");
}

/* -------------------------------------------------------------------------- */
/* Componente                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Cupé en 3D con las piezas resaltables del diagnóstico.
 *
 * @example
 * <VehicleModel3D
 *   height={340}
 *   engineHeat={72}
 *   parts={{ "wheel-fr": "error", engine: "warning" }}
 *   onPartClick={(p) => abrirDetalle(p)}
 * />
 */
export default function VehicleModel3D({
  parts,
  engineHeat = 0,
  height = 320,
  onPartClick,
}: VehicleModel3DProps) {
  const contenedorRef = useRef<HTMLDivElement | null>(null);
  const lienzoRef = useRef<HTMLCanvasElement | null>(null);

  // Las props se leen desde el bucle de render: nunca provocan re-montaje.
  const partsRef = useRef(parts);
  const calorRef = useRef(engineHeat);
  const clickRef = useRef(onPartClick);
  partsRef.current = parts;
  calorRef.current = engineHeat;
  clickRef.current = onPartClick;

  const etiqueta = useMemo(() => describirEstado(parts), [parts]);

  useEffect(() => {
    const contenedor = contenedorRef.current;
    const lienzo = lienzoRef.current;
    if (!contenedor || !lienzo) return;

    /* ---------------------------------------------------------------- */
    /* Render, escena y cámara                                           */
    /* ---------------------------------------------------------------- */
    const renderer = new THREE.WebGLRenderer({
      canvas: lienzo,
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.5;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const escena = new THREE.Scene();
    const entorno = crearEntornoEstudio(renderer);
    escena.environment = entorno.textura;

    const camara = new THREE.PerspectiveCamera(32, 1, 0.1, 60);
    const objetivo = new THREE.Vector3(0, 0.52, 0);

    /* ---------------------------------------------------------------- */
    /* Materiales                                                        */
    /* ---------------------------------------------------------------- */
    const materiales: THREE.Material[] = [];
    const registrar = <T extends THREE.Material>(m: T): T => {
      materiales.push(m);
      return m;
    };

    /** Chapa pintada en grafito con barniz (clearcoat). */
    const nuevaPintura = () =>
      registrar(
        new THREE.MeshPhysicalMaterial({
          color: 0x474d53,
          metalness: 0.7,
          roughness: 0.3,
          clearcoat: 1,
          clearcoatRoughness: 0.06,
          envMapIntensity: 1.9,
          emissive: 0x000000,
          emissiveIntensity: 0,
        }),
      );

    const matCarroceria = nuevaPintura();
    const matCapo = nuevaPintura();
    const matPuerta: Record<"fl" | "fr" | "rl" | "rr", THREE.MeshPhysicalMaterial> = {
      fl: nuevaPintura(),
      fr: nuevaPintura(),
      rl: nuevaPintura(),
      rr: nuevaPintura(),
    };
    const matEstructura = nuevaPintura();

    const matCristal = registrar(
      new THREE.MeshPhysicalMaterial({
        color: 0x03080b,
        metalness: 0.55,
        roughness: 0.035,
        transparent: true,
        opacity: 0.92,
        envMapIntensity: 3.4,
        clearcoat: 1,
        clearcoatRoughness: 0.02,
      }),
    );

    const matNegroMate = registrar(
      new THREE.MeshStandardMaterial({
        color: 0x070b0d,
        metalness: 0.25,
        roughness: 0.72,
        envMapIntensity: 0.35,
      }),
    );

    const matCromo = registrar(
      new THREE.MeshStandardMaterial({
        color: 0xc3d2d8,
        metalness: 1,
        roughness: 0.16,
        envMapIntensity: 1.8,
      }),
    );

    const matLlanta = registrar(
      new THREE.MeshStandardMaterial({
        color: 0xb2c3ca,
        metalness: 0.96,
        roughness: 0.23,
        envMapIntensity: 1.6,
      }),
    );

    const matPinza = registrar(
      new THREE.MeshStandardMaterial({
        color: 0x1e2a30,
        metalness: 0.7,
        roughness: 0.45,
      }),
    );

    const nuevoNeumatico = () =>
      registrar(
        new THREE.MeshStandardMaterial({
          color: 0x14191c,
          metalness: 0.02,
          roughness: 0.95,
          envMapIntensity: 0.35,
        }),
      );
    const matNeumatico: Record<"fl" | "fr" | "rl" | "rr", THREE.MeshStandardMaterial> = {
      fl: nuevoNeumatico(),
      fr: nuevoNeumatico(),
      rl: nuevoNeumatico(),
      rr: nuevoNeumatico(),
    };

    const matFaro = registrar(
      new THREE.MeshStandardMaterial({
        color: 0x0e181c,
        metalness: 0.6,
        roughness: 0.12,
        emissive: 0xcdeef2,
        emissiveIntensity: 0.62,
      }),
    );

    const matPiloto = registrar(
      new THREE.MeshStandardMaterial({
        color: 0x1a0508,
        metalness: 0.5,
        roughness: 0.2,
        emissive: 0xff2f42,
        emissiveIntensity: 0.85,
      }),
    );

    const texSuelo = texturaDesvanecido();
    const matSuelo = registrar(
      new THREE.MeshStandardMaterial({
        color: 0x05080a,
        metalness: 0.5,
        roughness: 0.36,
        envMapIntensity: 0.22,
        alphaMap: texSuelo,
        transparent: true,
      }),
    );

    /* ---------------------------------------------------------------- */
    /* Geometría del coche                                               */
    /* ---------------------------------------------------------------- */
    const grupo = new THREE.Group();
    escena.add(grupo);

    /** Registra la pieza a la que pertenece una malla (raycaster + tinte). */
    const porPieza = new Map<VehiclePartId, THREE.Material[]>();
    const seleccionables: THREE.Object3D[] = [];
    const asignar = (obj: THREE.Object3D, pieza: VehiclePartId, mats: THREE.Material[]) => {
      obj.userData.pieza = pieza;
      seleccionables.push(obj);
      const previos = porPieza.get(pieza) ?? [];
      porPieza.set(pieza, [...previos, ...mats]);
    };

    const anadir = (
      geo: THREE.BufferGeometry,
      mat: THREE.Material,
      padre: THREE.Object3D = grupo,
      sombra = true,
    ): THREE.Mesh => {
      const malla = new THREE.Mesh(geo, mat);
      malla.castShadow = sombra;
      malla.receiveShadow = false;
      padre.add(malla);
      return malla;
    };

    // Carrocería inferior.
    const carroceria = anadir(
      extruir(siluetaCarroceria(), { ancho: 2 * SEMI_ANCHO, bisel: 0.035, curvas: 22 }),
      matCarroceria,
    );
    asignar(carroceria, "body", [matCarroceria]);

    // Invernadero acristalado (parabrisas + laterales + luneta de una pieza).
    const invernadero = anadir(
      extruir(siluetaInvernadero(), { ancho: 2 * SEMI_CABINA, bisel: 0.022, curvas: 24 }),
      matCristal,
      grupo,
      false,
    );
    invernadero.renderOrder = 2;
    asignar(invernadero, "body", []);

    // Marcos laterales: montantes A y C, riel de techo y embellecedor de cintura.
    const marco = siluetaInvernadero();
    marco.holes.push(huecoLateral());
    for (const lado of [1, -1]) {
      const geo = extruir(marco, {
        ancho: 0.03,
        bisel: 0.008,
        centroZ: lado * (SEMI_CABINA + 0.013),
        curvas: 20,
      });
      anadir(geo, matEstructura);
    }

    // Techo metálico que corona la cuña acristalada.
    anadir(extruir(siluetaTecho(), { ancho: 2 * SEMI_TECHO, bisel: 0.02 }), matEstructura);

    // Capó: panel independiente para poder teñirlo con el calor del motor.
    const capo = anadir(
      extruir(siluetaCapo(), { ancho: 2 * SEMI_CAPO, bisel: 0.016, curvas: 22 }),
      matCapo,
    );
    asignar(capo, "engine", [matCapo]);

    // Puertas: paneles sobre el flanco, con junta visible y zona táctil.
    const PUERTAS = [
      { pieza: "door-fl" as VehiclePartId, clave: "fl" as const, lado: 1, x: [0.6, -0.42] },
      { pieza: "door-fr" as VehiclePartId, clave: "fr" as const, lado: -1, x: [0.6, -0.42] },
      { pieza: "door-rl" as VehiclePartId, clave: "rl" as const, lado: 1, x: [-0.45, -1.02] },
      { pieza: "door-rr" as VehiclePartId, clave: "rr" as const, lado: -1, x: [-0.45, -1.02] },
    ];
    for (const p of PUERTAS) {
      const geo = extruir(siluetaPuerta(p.x[0] ?? 0, p.x[1] ?? 0), {
        ancho: 0.02,
        bisel: 0.006,
        centroZ: p.lado * (SEMI_ANCHO - 0.0015),
        curvas: 8,
      });
      const malla = anadir(geo, matPuerta[p.clave]);
      asignar(malla, p.pieza, [matPuerta[p.clave]]);
    }

    // Manetas de puerta (largas en X, apenas salientes en Z).
    for (const lado of [1, -1]) {
      for (const x of [0.1, -0.72]) {
        const m = anadir(barraRedondeada(0.032, 0.034, 0.16, 0.013), matCromo);
        m.position.set(x, 0.86, lado * 1.025);
      }
    }

    // Retrovisores: pie corto y carcasa pintada.
    for (const lado of [1, -1]) {
      const pie = anadir(new THREE.BoxGeometry(0.05, 0.04, 0.08), matNegroMate);
      pie.position.set(0.62, 0.955, lado * 0.97);
      const carcasa = anadir(barraRedondeada(0.075, 0.08, 0.185, 0.032), matEstructura);
      carcasa.position.set(0.59, 0.985, lado * 1.055);
      carcasa.rotation.y = lado * 0.12;
    }

    // Pasos de rueda: cilindro oscuro que cierra el hueco del recorte.
    for (const [x, z] of [
      [EJE_DEL, 0],
      [EJE_TRA, 0],
    ] as const) {
      const geo = new THREE.CylinderGeometry(0.415, 0.415, 1.9, 22, 1, true, 0, Math.PI);
      geo.rotateZ(Math.PI / 2);
      geo.rotateY(Math.PI / 2);
      const m = new THREE.Mesh(
        geo,
        registrar(
          new THREE.MeshStandardMaterial({
            color: 0x05090b,
            roughness: 1,
            metalness: 0,
            side: THREE.DoubleSide,
          }),
        ),
      );
      m.position.set(x, R_RUEDA, z);
      grupo.add(m);
    }

    // Óptica delantera: barra continua extruida y esculpida como la chapa,
    // así se curva con el morro en lugar de atravesarlo.
    anadir(extruir(siluetaFaro(), { ancho: 1.52, bisel: 0.014 }), matFaro, grupo, false);

    // Piloto trasero: barra continua de lado a lado (firma nocturna).
    anadir(
      extruir(siluetaPiloto(), { ancho: 1.5, bisel: 0.014, curvas: 8 }),
      matPiloto,
      grupo,
      false,
    );

    // Toma de aire y difusor: recortes oscuros que rompen el frontal y la cola.
    const admision = anadir(barraRedondeada(1.3, 0.2, 0.09, 0.055), matNegroMate, grupo, false);
    admision.position.set(2.29, 0.42, 0);
    const difusor = anadir(barraRedondeada(1.24, 0.15, 0.09, 0.05), matNegroMate, grupo, false);
    difusor.position.set(-2.26, 0.38, 0);

    /* ---------------------------------------------------------------- */
    /* Ruedas                                                            */
    /* ---------------------------------------------------------------- */
    /** Perfil del neumático (hombros redondeados) para el torneado. */
    const perfilNeumatico = [
      new THREE.Vector2(0.21, -SEMI_RUEDA),
      new THREE.Vector2(0.3, -SEMI_RUEDA),
      new THREE.Vector2(0.338, -SEMI_RUEDA * 0.82),
      new THREE.Vector2(R_RUEDA, -SEMI_RUEDA * 0.5),
      new THREE.Vector2(R_RUEDA, SEMI_RUEDA * 0.5),
      new THREE.Vector2(0.338, SEMI_RUEDA * 0.82),
      new THREE.Vector2(0.3, SEMI_RUEDA),
      new THREE.Vector2(0.21, SEMI_RUEDA),
    ];
    const geoNeumatico = new THREE.LatheGeometry(perfilNeumatico, 34);
    geoNeumatico.rotateX(Math.PI / 2);
    geoNeumatico.computeVertexNormals();

    // Llanta de aleación: barril oscuro, labio brillante, cinco radios y buje.
    const geoBarril = new THREE.CylinderGeometry(0.232, 0.232, 0.225, 30, 1, true);
    geoBarril.rotateX(Math.PI / 2);
    const geoLabio = new THREE.TorusGeometry(0.226, 0.024, 8, 32);
    const geoBuje = new THREE.CylinderGeometry(0.058, 0.058, 0.05, 18);
    geoBuje.rotateX(Math.PI / 2);
    const geoRadio = new THREE.BoxGeometry(0.055, 0.16, 0.034);
    const geoFreno = new THREE.CylinderGeometry(0.168, 0.168, 0.02, 24);
    geoFreno.rotateX(Math.PI / 2);

    const RUEDAS = [
      { pieza: "wheel-fl" as VehiclePartId, clave: "fl" as const, x: EJE_DEL, lado: 1 },
      { pieza: "wheel-fr" as VehiclePartId, clave: "fr" as const, x: EJE_DEL, lado: -1 },
      { pieza: "wheel-rl" as VehiclePartId, clave: "rl" as const, x: EJE_TRA, lado: 1 },
      { pieza: "wheel-rr" as VehiclePartId, clave: "rr" as const, x: EJE_TRA, lado: -1 },
    ];

    // Vía: el neumático queda justo bajo el paso de rueda.
    const semiVia = SEMI_ANCHO * factorAltura(R_RUEDA) - SEMI_RUEDA - 0.008;

    for (const r of RUEDAS) {
      const rueda = new THREE.Group();
      rueda.position.set(r.x, R_RUEDA, r.lado * semiVia);
      grupo.add(rueda);

      const neumatico = new THREE.Mesh(geoNeumatico, matNeumatico[r.clave]);
      neumatico.castShadow = true;
      rueda.add(neumatico);

      // Disco de freno: fondo oscuro que se ve entre los radios.
      const freno = new THREE.Mesh(geoFreno, matPinza);
      freno.position.z = r.lado * -0.01;
      rueda.add(freno);

      const barril = new THREE.Mesh(geoBarril, matNegroMate);
      rueda.add(barril);

      const labio = new THREE.Mesh(geoLabio, matLlanta);
      labio.position.z = r.lado * 0.1;
      rueda.add(labio);

      const buje = new THREE.Mesh(geoBuje, matCromo);
      buje.position.z = r.lado * 0.107;
      rueda.add(buje);

      // Radios: cinco brazos del buje al labio, en el plano de la llanta.
      for (let i = 0; i < 5; i += 1) {
        const radio = new THREE.Mesh(geoRadio, matLlanta);
        radio.position.z = r.lado * 0.095;
        radio.rotation.z = (i * Math.PI * 2) / 5;
        radio.position.x = Math.sin(radio.rotation.z) * -0.138;
        radio.position.y = Math.cos(radio.rotation.z) * 0.138;
        rueda.add(radio);
      }

      asignar(rueda, r.pieza, [matNeumatico[r.clave]]);
    }

    /* ---------------------------------------------------------------- */
    /* Suelo, sombra de contacto y halo                                  */
    /* ---------------------------------------------------------------- */
    const geoSuelo = new THREE.CircleGeometry(7, 56);
    geoSuelo.rotateX(-Math.PI / 2);
    const suelo = new THREE.Mesh(geoSuelo, matSuelo);
    suelo.receiveShadow = true;
    suelo.renderOrder = -3;
    escena.add(suelo);

    const texSombra = texturaRadial("rgba(0,0,0,0.9)", 0.24);
    const matSombra = registrar(
      new THREE.MeshBasicMaterial({
        map: texSombra,
        transparent: true,
        depthWrite: false,
        opacity: 0.85,
      }),
    );
    const geoSombra = new THREE.PlaneGeometry(6.2, 3.1);
    geoSombra.rotateX(-Math.PI / 2);
    const sombra = new THREE.Mesh(geoSombra, matSombra);
    sombra.position.y = 0.006;
    sombra.renderOrder = -1;
    grupo.add(sombra);

    const texHalo = texturaRadial("rgba(0,210,190,0.12)", 0.05);
    const matHalo = registrar(
      new THREE.MeshBasicMaterial({
        map: texHalo,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    const geoHalo = new THREE.PlaneGeometry(7, 7);
    geoHalo.rotateX(-Math.PI / 2);
    const halo = new THREE.Mesh(geoHalo, matHalo);
    halo.position.y = 0.004;
    halo.renderOrder = -2;
    escena.add(halo);

    /* ---------------------------------------------------------------- */
    /* Iluminación de estudio                                            */
    /* ---------------------------------------------------------------- */
    const ambiente = new THREE.HemisphereLight(0x424b52, 0x06090b, 0.5);
    escena.add(ambiente);

    const principal = new THREE.DirectionalLight(0xf4fcff, 3.4);
    principal.position.set(3.4, 5.6, 4.1);
    principal.castShadow = true;
    principal.shadow.mapSize.set(1024, 1024);
    principal.shadow.camera.near = 1;
    principal.shadow.camera.far = 16;
    principal.shadow.camera.left = -3.6;
    principal.shadow.camera.right = 3.6;
    principal.shadow.camera.top = 3.6;
    principal.shadow.camera.bottom = -3.6;
    principal.shadow.bias = -0.0012;
    principal.shadow.normalBias = 0.02;
    escena.add(principal);

    const relleno = new THREE.DirectionalLight(0xbcd2dd, 0.95);
    relleno.position.set(-4.6, 2.9, -3.4);
    escena.add(relleno);

    // Contraluz frío: dibuja el filo del hombro y del techo sobre el negro.
    const contraluz = new THREE.DirectionalLight(0xe8f3fa, 2.9);
    contraluz.position.set(-2.8, 3.4, -5.2);
    escena.add(contraluz);

    // Acento cian rasante, deliberadamente contenido: marca los bajos y el
    // paragolpes sin teñir de verde toda la carrocería.
    const acento = new THREE.SpotLight(0x00d2be, 5.5, 24, 0.45, 1, 1.05);
    acento.position.set(-6, 0.5, 5.2);
    acento.target.position.set(1.4, 0.3, 0);
    escena.add(acento);
    escena.add(acento.target);

    /* ---------------------------------------------------------------- */
    /* Encuadre y redimensionado                                         */
    /* ---------------------------------------------------------------- */
    let elevacion = 0.26;
    let giro = -0.72;
    let velocidadGiro = 0;
    let distancia = 8;

    const recolocarCamara = () => {
      camara.position.set(
        0,
        objetivo.y + distancia * Math.sin(elevacion),
        distancia * Math.cos(elevacion),
      );
      camara.lookAt(objetivo);
    };

    const redimensionar = () => {
      const ancho = Math.max(1, contenedor.clientWidth);
      const alto = Math.max(1, contenedor.clientHeight);
      renderer.setSize(ancho, alto, false);
      camara.aspect = ancho / alto;
      camara.updateProjectionMatrix();

      // Encaje del coche: se ajusta al eje más restrictivo del lienzo.
      const vfov = (camara.fov * Math.PI) / 180;
      const hfov = 2 * Math.atan(Math.tan(vfov / 2) * camara.aspect);
      const distH = 2.5 / Math.tan(hfov / 2);
      const distV = 1.05 / Math.tan(vfov / 2);
      distancia = Math.min(15, Math.max(5.6, Math.max(distH, distV) * 1.04));
      recolocarCamara();
    };

    redimensionar();
    const observadorTamano = new ResizeObserver(redimensionar);
    observadorTamano.observe(contenedor);

    /* ---------------------------------------------------------------- */
    /* Interacción: arrastre para girar y toque para seleccionar pieza   */
    /* ---------------------------------------------------------------- */
    const raycaster = new THREE.Raycaster();
    const puntero = new THREE.Vector2();
    let arrastrando = false;
    let recorrido = 0;
    let ultimoX = 0;
    let ultimoY = 0;

    const alPulsar = (e: PointerEvent) => {
      arrastrando = true;
      recorrido = 0;
      ultimoX = e.clientX;
      ultimoY = e.clientY;
      velocidadGiro = 0;
      lienzo.setPointerCapture(e.pointerId);
    };

    const alMover = (e: PointerEvent) => {
      if (!arrastrando) return;
      const dx = e.clientX - ultimoX;
      const dy = e.clientY - ultimoY;
      ultimoX = e.clientX;
      ultimoY = e.clientY;
      recorrido += Math.abs(dx) + Math.abs(dy);
      giro += dx * 0.008;
      velocidadGiro = dx * 0.008;
      elevacion = Math.min(0.72, Math.max(0.05, elevacion + dy * 0.004));
      recolocarCamara();
    };

    const alSoltar = (e: PointerEvent) => {
      if (!arrastrando) return;
      arrastrando = false;
      if (lienzo.hasPointerCapture(e.pointerId)) lienzo.releasePointerCapture(e.pointerId);
      if (recorrido > 6 || !clickRef.current) return;

      const caja = lienzo.getBoundingClientRect();
      puntero.x = ((e.clientX - caja.left) / caja.width) * 2 - 1;
      puntero.y = -((e.clientY - caja.top) / caja.height) * 2 + 1;
      raycaster.setFromCamera(puntero, camara);
      const impactos = raycaster.intersectObjects(seleccionables, true);
      const primero = impactos[0];
      if (!primero) return;
      let nodo: THREE.Object3D | null = primero.object;
      while (nodo && !nodo.userData.pieza) nodo = nodo.parent;
      const pieza = nodo?.userData.pieza as VehiclePartId | undefined;
      if (pieza) clickRef.current(pieza);
    };

    lienzo.addEventListener("pointerdown", alPulsar);
    lienzo.addEventListener("pointermove", alMover);
    lienzo.addEventListener("pointerup", alSoltar);
    lienzo.addEventListener("pointercancel", alSoltar);

    /* ---------------------------------------------------------------- */
    /* Bucle de render (con pausa por visibilidad)                       */
    /* ---------------------------------------------------------------- */
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let movimientoReducido = motion.matches;
    const alCambiarMotion = (e: MediaQueryListEvent) => {
      movimientoReducido = e.matches;
    };
    motion.addEventListener("change", alCambiarMotion);

    const colorAux = new THREE.Color();
    const colorCal = new THREE.Color();

    /** Aplica el tinte de estado (y el calor, en el capó) a cada material. */
    const actualizarTintes = (t: number) => {
      const pulso = 0.42 + 0.58 * (0.5 + 0.5 * Math.sin(t * 5.6));
      const calor = Math.min(100, Math.max(0, calorRef.current ?? 0));
      const intensidadCalor = Math.pow(calor / 100, 1.4) * 0.62;

      porPieza.forEach((mats, pieza) => {
        if (mats.length === 0) return;
        const sev = partsRef.current?.[pieza] ?? "ok";
        let intensidad = INTENSIDAD_GRAVEDAD[sev];
        if (sev === "error") intensidad *= pulso;
        let usarCalor = false;
        if (pieza === "engine" && intensidadCalor > intensidad) {
          intensidad = intensidadCalor;
          usarCalor = true;
        }
        for (const m of mats) {
          const mat = m as THREE.MeshStandardMaterial;
          if (intensidad <= 0.001) {
            mat.emissiveIntensity = 0;
            mat.emissive.setRGB(0, 0, 0);
            continue;
          }
          if (usarCalor) mat.emissive.copy(colorCalor(colorCal, calor));
          else mat.emissive.copy(colorAux.set(COLOR_GRAVEDAD[sev]));
          mat.emissiveIntensity = intensidad;
        }
      });
    };

    const reloj = new THREE.Clock();
    let bucle = 0;
    let visible = true;
    let enPantalla = true;

    const dibujar = () => {
      bucle = requestAnimationFrame(dibujar);
      const dt = Math.min(0.05, reloj.getDelta());
      const t = reloj.getElapsedTime();

      if (!arrastrando) {
        if (Math.abs(velocidadGiro) > 0.0002) {
          giro += velocidadGiro;
          velocidadGiro *= 0.94;
        } else if (!movimientoReducido) {
          giro += dt * 0.16;
        }
      }
      grupo.rotation.y = giro;
      actualizarTintes(t);
      renderer.render(escena, camara);
    };

    const evaluarActividad = () => {
      const debeCorrer = visible && enPantalla;
      if (debeCorrer && bucle === 0) {
        reloj.getDelta();
        bucle = requestAnimationFrame(dibujar);
      } else if (!debeCorrer && bucle !== 0) {
        cancelAnimationFrame(bucle);
        bucle = 0;
      }
    };

    const alCambiarVisibilidad = () => {
      visible = document.visibilityState !== "hidden";
      evaluarActividad();
    };
    document.addEventListener("visibilitychange", alCambiarVisibilidad);

    const observadorPantalla = new IntersectionObserver(
      (entradas) => {
        const e = entradas[0];
        enPantalla = e ? e.isIntersecting : true;
        evaluarActividad();
      },
      { threshold: 0.01 },
    );
    observadorPantalla.observe(contenedor);

    evaluarActividad();

    /* ---------------------------------------------------------------- */
    /* Limpieza                                                          */
    /* ---------------------------------------------------------------- */
    return () => {
      if (bucle !== 0) cancelAnimationFrame(bucle);
      observadorPantalla.disconnect();
      observadorTamano.disconnect();
      document.removeEventListener("visibilitychange", alCambiarVisibilidad);
      motion.removeEventListener("change", alCambiarMotion);
      lienzo.removeEventListener("pointerdown", alPulsar);
      lienzo.removeEventListener("pointermove", alMover);
      lienzo.removeEventListener("pointerup", alSoltar);
      lienzo.removeEventListener("pointercancel", alSoltar);

      escena.traverse((obj) => {
        if (obj instanceof THREE.Mesh) obj.geometry.dispose();
      });
      for (const m of materiales) m.dispose();
      texSombra.dispose();
      texHalo.dispose();
      texSuelo.dispose();
      entorno.liberar();
      escena.clear();
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={contenedorRef}
      style={{ position: "relative", width: "100%", height }}
      className="select-none"
    >
      <canvas
        ref={lienzoRef}
        role="img"
        aria-label={etiqueta}
        style={{
          display: "block",
          width: "100%",
          height: "100%",
          touchAction: "none",
          cursor: onPartClick ? "grab" : "default",
        }}
      />
    </div>
  );
}
