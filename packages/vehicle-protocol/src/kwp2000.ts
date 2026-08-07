/**
 * KWP2000 (ISO 14230) — el protocolo con el que se habla a las centralitas
 * que el OBD-II genérico no expone.
 *
 * Por qué hace falta: el modo 03 del OBD-II estándar solo devuelve códigos
 * del grupo motopropulsor (P). En un Mercedes W209 los códigos de ABS, ESP
 * y airbag viven en centralitas independientes a las que se llega por la
 * línea K del conector de diagnosis, hablando KWP2000 y direccionando cada
 * módulo por separado. Un ELM327 puede hacerlo: soporta los protocolos
 * ISO 14230-4 y permite fijar la cabecera con `AT SH`.
 *
 * ALCANCE DE ESTE MÓDULO. Aquí está la mecánica del protocolo, que es
 * norma pública y está cubierta por tests: construcción de peticiones,
 * parseo de respuestas, respuestas negativas y decodificación de códigos.
 * Lo que NO está aquí, porque no es público y no me lo puedo inventar, es
 * qué dirección tiene cada centralita de un W209 concreto ni qué significa
 * cada código propietario. Para eso está `escanearModulos()`: se pregunta
 * al coche en lugar de suponerlo.
 */

/** Servicios KWP2000 que usa VehicleOS. */
export const KWP_SERVICE = {
  /** Inicia sesión de diagnóstico. */
  START_DIAGNOSTIC_SESSION: 0x10,
  /** Borra la información de diagnóstico (equivale al modo 04 de OBD-II). */
  CLEAR_DIAGNOSTIC_INFORMATION: 0x14,
  /** Lee los códigos de avería filtrando por estado. */
  READ_DTC_BY_STATUS: 0x18,
  /** Lee un identificador local de datos. */
  READ_DATA_BY_LOCAL_ID: 0x21,
  /** Identificación de la centralita. */
  READ_ECU_IDENTIFICATION: 0x1a,
  /** Mantiene viva la sesión. */
  TESTER_PRESENT: 0x3e,
  /** Inicio de comunicación. */
  START_COMMUNICATION: 0x81,
} as const;

/** Desplazamiento de una respuesta positiva respecto al servicio pedido. */
const RESPUESTA_POSITIVA = 0x40;
/** Primer byte de una respuesta negativa. */
const RESPUESTA_NEGATIVA = 0x7f;

/** Códigos de respuesta negativa (NRC) más habituales de ISO 14230. */
export const KWP_NRC: Record<number, string> = {
  0x10: "Rechazo general",
  0x11: "Servicio no soportado por esta centralita",
  0x12: "Subfunción no soportada",
  0x21: "Centralita ocupada, repetir la petición",
  0x22: "Condiciones incorrectas (¿motor en marcha? ¿contacto dado?)",
  0x23: "Petición fuera de secuencia",
  0x31: "Petición fuera de rango",
  0x33: "Acceso denegado: requiere desbloqueo de seguridad",
  0x35: "Clave inválida",
  0x78: "Recibida correctamente, respuesta pendiente",
};

/** Error de protocolo con el detalle que devolvió la centralita. */
export class KwpNegativeResponse extends Error {
  constructor(
    readonly service: number,
    readonly nrc: number,
  ) {
    super(
      `La centralita rechazó el servicio 0x${service.toString(16).padStart(2, "0")}: ` +
        `${KWP_NRC[nrc] ?? `código 0x${nrc.toString(16).padStart(2, "0")}`}`,
    );
    this.name = "KwpNegativeResponse";
  }
}

/** ¿Es un "respuesta pendiente"? Hay que esperar y volver a leer, no fallar. */
export function esRespuestaPendiente(bytes: number[]): boolean {
  return bytes[0] === RESPUESTA_NEGATIVA && bytes[2] === 0x78;
}

/** Convierte bytes a la cadena hexadecimal que espera un ELM327. */
export function aHex(bytes: number[]): string {
  return bytes.map((b) => b.toString(16).padStart(2, "0").toUpperCase()).join("");
}

/** Convierte la respuesta cruda de un ELM327 en bytes. */
export function desdeHex(raw: string): number[] {
  const limpio = raw.replace(/[\s\r\n>]/g, "").toUpperCase();
  const bytes: number[] = [];
  for (let i = 0; i + 1 < limpio.length; i += 2) {
    const b = parseInt(limpio.slice(i, i + 2), 16);
    if (Number.isNaN(b)) return bytes;
    bytes.push(b);
  }
  return bytes;
}

/**
 * Comando `AT SH` para dirigirse a una centralita concreta.
 *
 * En ISO 14230 la cabecera son tres bytes: formato, destino y origen. El
 * origen 0xF1 es el convenio para "equipo de diagnosis".
 */
export function comandoCabecera(destino: number, formato = 0x81, origen = 0xf1): string {
  return `ATSH${aHex([formato, destino, origen])}`;
}

/** Secuencia para poner el ELM327 en ISO 14230-4 con inicialización rápida. */
export const ELM_INIT_KWP_RAPIDA = [
  "ATZ",
  "ATE0",
  "ATL0",
  "ATS0",
  "ATH1", // cabeceras SÍ: hacen falta para saber quién responde
  "ATSP5", // ISO 14230-4 KWP, inicialización rápida
] as const;

/** Igual pero con inicialización a 5 baudios, que usan algunas centralitas. */
export const ELM_INIT_KWP_LENTA = [
  "ATZ",
  "ATE0",
  "ATL0",
  "ATS0",
  "ATH1",
  "ATSP4", // ISO 14230-4 KWP, inicialización a 5 baudios
] as const;

/**
 * Petición de lectura de códigos de avería.
 *
 * @param estado Filtro de estado. 0x00 pide todos los códigos.
 * @param grupo  Grupo de códigos. 0xFF00 es "todos los grupos".
 */
export function peticionLeerDtc(estado = 0x00, grupo = 0xff00): number[] {
  return [KWP_SERVICE.READ_DTC_BY_STATUS, estado, (grupo >> 8) & 0xff, grupo & 0xff];
}

/** Petición de borrado de códigos. `grupo` 0xFF00 borra todos. */
export function peticionBorrarDtc(grupo = 0xff00): number[] {
  return [KWP_SERVICE.CLEAR_DIAGNOSTIC_INFORMATION, (grupo >> 8) & 0xff, grupo & 0xff];
}

/** Petición de arranque de sesión de diagnóstico. */
export function peticionSesion(modo = 0x81): number[] {
  return [KWP_SERVICE.START_DIAGNOSTIC_SESSION, modo];
}

/** Petición de identificación de la centralita. */
export function peticionIdentificacion(opcion = 0x80): number[] {
  return [KWP_SERVICE.READ_ECU_IDENTIFICATION, opcion];
}

/**
 * Extrae los datos útiles de una respuesta, validando que corresponde al
 * servicio pedido. Lanza `KwpNegativeResponse` si la centralita lo rechazó.
 *
 * `bytes` debe venir ya sin la cabecera del bus (ver `quitarCabecera`).
 */
export function parsearRespuesta(bytes: number[], servicio: number): number[] {
  if (bytes.length === 0) throw new Error("Respuesta vacía de la centralita");

  if (bytes[0] === RESPUESTA_NEGATIVA) {
    throw new KwpNegativeResponse(bytes[1] ?? servicio, bytes[2] ?? 0);
  }

  const esperado = servicio + RESPUESTA_POSITIVA;
  if (bytes[0] !== esperado) {
    throw new Error(
      `Respuesta inesperada: se esperaba 0x${esperado.toString(16)} y llegó 0x${(
        bytes[0] ?? 0
      ).toString(16)}`,
    );
  }
  return bytes.slice(1);
}

/**
 * Quita la cabecera del bus de una respuesta ISO 14230.
 *
 * Con `ATH1` el ELM327 antepone la cabecera. En ISO 14230 el primer byte
 * lleva la longitud en sus 6 bits bajos; si es 0 la longitud va en un byte
 * adicional. Después vienen destino y origen.
 */
export function quitarCabecera(bytes: number[]): number[] {
  if (bytes.length < 4) return bytes;
  const formato = bytes[0] ?? 0;
  const longitudEnFormato = formato & 0x3f;
  // formato, destino, origen [, longitud]
  const inicio = longitudEnFormato === 0 ? 4 : 3;
  // El último byte es la suma de comprobación.
  return bytes.slice(inicio, bytes.length - 1);
}

/** Código de avería tal como lo entrega una centralita KWP2000. */
export interface KwpDtc {
  /** Los dos bytes del código, en hexadecimal ("C1234" no aplica aquí). */
  raw: string;
  /** Valor numérico de 16 bits, útil para buscar en tablas del fabricante. */
  numero: number;
  /** Byte de estado tal cual lo devolvió la centralita. */
  estado: number;
  /** ¿Está el código activo en este momento? (bit 5 del estado) */
  activo: boolean;
  /** ¿Está almacenado de forma permanente? (bit 6 del estado) */
  almacenado: boolean;
}

/**
 * Parsea la respuesta del servicio 0x18.
 *
 * Formato: [nº de códigos][alto, bajo, estado] × n. A diferencia de UDS,
 * en KWP2000 el código son 2 bytes y no 3.
 */
export function parsearDtc(datos: number[]): KwpDtc[] {
  if (datos.length === 0) return [];
  const cuantos = datos[0] ?? 0;
  const codigos: KwpDtc[] = [];

  for (let i = 0; i < cuantos; i++) {
    const base = 1 + i * 3;
    const alto = datos[base];
    const bajo = datos[base + 1];
    const estado = datos[base + 2];
    if (alto === undefined || bajo === undefined || estado === undefined) break;

    const numero = (alto << 8) | bajo;
    if (numero === 0) continue; // relleno

    codigos.push({
      raw: aHex([alto, bajo]),
      numero,
      estado,
      activo: (estado & 0x20) !== 0,
      almacenado: (estado & 0x40) !== 0,
    });
  }
  return codigos;
}

/**
 * ¿La respuesta indica que en esa dirección no hay nadie?
 *
 * Un ELM327 responde "NO DATA", "UNABLE TO CONNECT" o similar cuando la
 * centralita no existe o no contesta. Se usa en el escaneo de módulos.
 */
export function sinRespuesta(raw: string): boolean {
  const limpio = raw.toUpperCase();
  return (
    limpio.includes("NO DATA") ||
    limpio.includes("UNABLE") ||
    limpio.includes("ERROR") ||
    limpio.includes("BUS INIT") ||
    limpio.includes("CAN ERROR") ||
    limpio.includes("STOPPED") ||
    limpio.trim().length === 0
  );
}
