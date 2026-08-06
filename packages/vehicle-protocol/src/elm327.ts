/**
 * Códec ELM327: construcción de comandos y parseo de respuestas.
 *
 * Es agnóstico del transporte: el bridge Android (Bluetooth/BLE/USB/WiFi)
 * y cualquier provider futuro envían/reciben strings y usan este módulo
 * para no reimplementar el protocolo.
 */
import type { PidDefinition } from "./pids";

/** Secuencia de inicialización recomendada para un adaptador ELM327. */
export const ELM327_INIT_SEQUENCE = [
  "ATZ", // reset
  "ATE0", // echo off
  "ATL0", // linefeeds off
  "ATS0", // espacios off
  "ATH0", // cabeceras off
  "ATSP0", // autodetección de protocolo
] as const;

/** Construye el comando hex para solicitar un PID ("010C" para RPM). */
export function buildPidCommand(def: Pick<PidDefinition, "mode" | "pid">): string {
  const hex = (n: number) => n.toString(16).padStart(2, "0").toUpperCase();
  return `${hex(def.mode)}${hex(def.pid)}`;
}

/** Comando del modo 03 (leer DTC) y modo 04 (borrar DTC). */
export const CMD_READ_DTC = "03";
export const CMD_CLEAR_DTC = "04";

/**
 * Limpia una respuesta cruda del ELM327 y devuelve los bytes de datos.
 *
 * Ejemplo: para "41 0C 1A F8" con modo 0x01 y pid 0x0C devuelve [0x1A, 0xF8].
 * Devuelve null si la respuesta es "NO DATA", un error o no corresponde
 * al PID solicitado.
 */
export function parsePidResponse(
  raw: string,
  def: Pick<PidDefinition, "mode" | "pid" | "bytes">,
): number[] | null {
  const clean = raw.replace(/[\s\r\n>]/g, "").toUpperCase();
  if (!clean || clean.includes("NODATA") || clean.includes("ERROR")) return null;

  const expectedPrefix =
    (def.mode + 0x40).toString(16).padStart(2, "0").toUpperCase() +
    def.pid.toString(16).padStart(2, "0").toUpperCase();

  const idx = clean.indexOf(expectedPrefix);
  if (idx === -1) return null;

  const dataHex = clean.slice(idx + 4, idx + 4 + def.bytes * 2);
  if (dataHex.length < def.bytes * 2) return null;

  const bytes: number[] = [];
  for (let i = 0; i < dataHex.length; i += 2) {
    bytes.push(parseInt(dataHex.slice(i, i + 2), 16));
  }
  return bytes;
}

/** Extrae los bytes de datos de una respuesta al modo 03 (tras el 0x43). */
export function parseDtcRawResponse(raw: string): number[] | null {
  const clean = raw.replace(/[\s\r\n>]/g, "").toUpperCase();
  const idx = clean.indexOf("43");
  if (idx === -1) return null;
  const dataHex = clean.slice(idx + 2);
  const bytes: number[] = [];
  for (let i = 0; i + 1 < dataHex.length; i += 2) {
    bytes.push(parseInt(dataHex.slice(i, i + 2), 16));
  }
  return bytes;
}
