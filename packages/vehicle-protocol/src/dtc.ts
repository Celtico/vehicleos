/**
 * Decodificación de códigos de avería (DTC) según SAE J2012.
 *
 * Un DTC ocupa 2 bytes. Los dos bits altos del primer byte codifican
 * la letra (P/C/B/U); el resto son dígitos hexadecimales.
 */
import type { DiagnosticTroubleCode, DtcCategory } from "@vehicleos/shared";

const LETTERS = ["P", "C", "B", "U"] as const;

const CATEGORY_BY_LETTER: Record<string, DtcCategory> = {
  P: "powertrain",
  C: "chassis",
  B: "body",
  U: "network",
};

/** Decodifica un par de bytes a su código, p. ej. (0x04, 0x01) → "P0401". */
export function decodeDtcBytes(b1: number, b2: number): string {
  const letter = LETTERS[(b1 & 0xc0) >> 6];
  const d1 = (b1 & 0x30) >> 4;
  const d2 = (b1 & 0x0f).toString(16).toUpperCase();
  const d3 = ((b2 & 0xf0) >> 4).toString(16).toUpperCase();
  const d4 = (b2 & 0x0f).toString(16).toUpperCase();
  return `${letter}${d1}${d2}${d3}${d4}`;
}

/** Categoría de un código a partir de su primera letra. */
export function dtcCategory(code: string): DtcCategory {
  return CATEGORY_BY_LETTER[code.charAt(0).toUpperCase()] ?? "powertrain";
}

/**
 * Parsea la respuesta cruda del modo 03 (lista de DTC almacenados).
 * `payload` son los bytes de datos tras el byte de servicio (0x43)
 * y el contador de códigos.
 */
export function parseDtcResponse(
  payload: number[],
  status: DiagnosticTroubleCode["status"] = "stored",
): DiagnosticTroubleCode[] {
  const codes: DiagnosticTroubleCode[] = [];
  for (let i = 0; i + 1 < payload.length; i += 2) {
    const b1 = payload[i] ?? 0;
    const b2 = payload[i + 1] ?? 0;
    if (b1 === 0 && b2 === 0) continue; // relleno
    codes.push({ code: decodeDtcBytes(b1, b2), status });
  }
  return codes;
}

/** Valida el formato de un código escrito a mano ("P0401", "c1234"…). */
export function isValidDtcCode(code: string): boolean {
  return /^[PCBUpcbu][0-3][0-9A-Fa-f]{3}$/.test(code);
}
