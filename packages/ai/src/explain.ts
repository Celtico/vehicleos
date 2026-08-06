/**
 * explainDtc — explica un código de avería.
 *
 * Busca en la base local DTC_KNOWLEDGE; si el código no está, genera una
 * explicación genérica según su categoría (P/C/B/U) usando `dtcCategory`
 * de @vehicleos/vehicle-protocol.
 */
import type { DtcCategory } from "@vehicleos/shared";
import { dtcCategory } from "@vehicleos/vehicle-protocol";
import { DTC_KNOWLEDGE, type DtcKnowledgeEntry } from "./knowledge";

/** Explicación devuelta: entrada de conocimiento + si es genérica. */
export interface DtcExplanation extends DtcKnowledgeEntry {
  /** true si no estaba en la base y se generó por categoría. */
  generic: boolean;
  /** Categoría del código (powertrain/chassis/body/network). */
  category: DtcCategory;
}

/** Plantillas genéricas por categoría para códigos desconocidos. */
const GENERIC_BY_CATEGORY: Record<DtcCategory, Omit<DtcKnowledgeEntry, "code">> = {
  powertrain: {
    title: "Avería del grupo motopropulsor",
    system: "Motor / transmisión",
    probableCause: "Fallo en motor, transmisión o sus sensores",
    probability: 40,
    causes: [
      "Sensor o actuador del motor fuera de rango",
      "Fallo de gestión de combustible o encendido",
      "Problema en la transmisión",
    ],
    solutions: [
      "Leer datos en vivo con una diagnosis OBD-II",
      "Inspección en taller del sistema señalado por el código",
    ],
    severity: "medium",
    canDrive:
      "Con prudencia y vigilando temperatura y ruidos, puedes circular trayectos cortos. Diagnostícalo cuanto antes para conocer el alcance real.",
  },
  chassis: {
    title: "Avería de chasis (frenos, dirección o suspensión)",
    system: "Chasis",
    probableCause: "Fallo en ABS/ESP, dirección o suspensión",
    probability: 40,
    causes: [
      "Sensor de rueda o de dinámica del vehículo defectuoso",
      "Cableado o conector deteriorado",
      "Módulo de chasis con fallo interno",
    ],
    solutions: [
      "Diagnosis del módulo de chasis correspondiente",
      "Revisión de sensores y cableado de las ruedas",
    ],
    severity: "high",
    canDrive:
      "Afecta a sistemas de seguridad activa: conduce con mucha precaución, aumenta la distancia de seguridad y acude al taller en pocos días.",
  },
  body: {
    title: "Avería de carrocería (confort o seguridad pasiva)",
    system: "Carrocería",
    probableCause: "Fallo en airbag, cierre, iluminación o confort",
    probability: 40,
    causes: [
      "Conector o cableado de carrocería con mal contacto",
      "Sensor o actuador de confort defectuoso",
      "Módulo de carrocería con fallo",
    ],
    solutions: [
      "Diagnosis del módulo de carrocería",
      "Revisión de conectores del elemento afectado",
    ],
    severity: "medium",
    canDrive:
      "El vehículo puede circular, pero si el código afecta al airbag trátalo como urgente: la seguridad pasiva podría no actuar en un accidente.",
  },
  network: {
    title: "Avería de comunicación entre centralitas",
    system: "Red CAN",
    probableCause: "Fallo de bus CAN o de alimentación de una centralita",
    probability: 40,
    causes: [
      "Bus CAN interrumpido o con interferencias",
      "Fusible o alimentación de una centralita caído",
      "Masas oxidadas",
      "Centralita defectuosa",
    ],
    solutions: ["Comprobar fusibles y masas", "Medir el bus CAN con diagnosis avanzada"],
    severity: "high",
    canDrive:
      "Comportamiento imprevisible: pueden caer varios sistemas a la vez. Circula solo lo imprescindible hasta diagnosticarlo.",
  },
};

/**
 * Devuelve la explicación de un DTC. Nunca lanza: para códigos
 * desconocidos responde con la plantilla genérica de su categoría.
 */
export function explainDtc(code: string): DtcExplanation {
  const normalized = code.trim().toUpperCase();
  const category = dtcCategory(normalized);
  const known = DTC_KNOWLEDGE[normalized];
  if (known) {
    return { ...known, generic: false, category };
  }
  return { ...GENERIC_BY_CATEGORY[category], code: normalized, generic: true, category };
}
