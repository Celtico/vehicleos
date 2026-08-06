/**
 * AssistantClient — cliente del asistente de diagnóstico del backend.
 *
 * Envía la pregunta del usuario junto con la telemetría y los DTC
 * actuales a `POST ${apiUrl}/ai/ask` y devuelve la respuesta.
 *
 * `buildLocalAnswer` genera una respuesta local degradada desde
 * DTC_KNOWLEDGE cuando el backend no responde.
 */
import type { DiagnosticTroubleCode, VehicleTelemetry } from "@vehicleos/shared";
import { explainDtc } from "./explain";

/** Petición al asistente. */
export interface AssistantRequest {
  question: string;
  telemetry?: VehicleTelemetry | null;
  dtc?: DiagnosticTroubleCode[];
}

/** Respuesta del asistente. */
export interface AssistantAnswer {
  answer: string;
  /** true si la respuesta se generó localmente (backend caído). */
  local?: boolean;
}

export interface AssistantClientOptions {
  /** URL base del backend, p. ej. "http://localhost:3001". */
  apiUrl: string;
  /** Token JWT opcional (cabecera Authorization). */
  token?: string;
  /** fetch inyectable para tests. */
  fetchImpl?: typeof fetch;
  /** Tiempo máximo de espera en ms (por defecto 8000). */
  timeoutMs?: number;
}

export class AssistantClient {
  private readonly apiUrl: string;
  private readonly token?: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(options: AssistantClientOptions) {
    this.apiUrl = options.apiUrl.replace(/\/$/, "");
    this.token = options.token;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 8000;
  }

  /** Pregunta al backend. Lanza si no responde o devuelve error. */
  async ask(request: AssistantRequest): Promise<AssistantAnswer> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await this.fetchImpl(`${this.apiUrl}/ai/ask`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
        },
        body: JSON.stringify({
          question: request.question,
          telemetry: request.telemetry ?? null,
          dtc: request.dtc ?? [],
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        throw new Error(`El asistente respondió ${res.status}`);
      }
      const data = (await res.json()) as { answer?: string };
      if (typeof data.answer !== "string") {
        throw new Error("Respuesta del asistente sin campo 'answer'");
      }
      return { answer: data.answer, local: false };
    } finally {
      clearTimeout(timer);
    }
  }
}

/**
 * Respuesta local degradada construida desde DTC_KNOWLEDGE cuando el
 * backend no está disponible. Es heurística: prioriza la parte de la
 * entrada que mejor responde a la pregunta.
 */
export function buildLocalAnswer(request: AssistantRequest): AssistantAnswer {
  const { question, telemetry, dtc = [] } = request;
  const q = question.toLowerCase();
  const parts: string[] = [];

  if (dtc.length === 0) {
    parts.push("No hay códigos de avería activos.");
  } else {
    const asksHowLong = /cu[aá]nto|conducir|circular|seguir|llegar/.test(q);
    const asksFirst = /primero|prioridad|revisar|empezar|importante/.test(q);
    const asksWhy = /por qu[eé]|testigo|luz|significa|qu[eé] es/.test(q);

    const explained = dtc.map((d) => explainDtc(d.code));
    // Ordena por severidad para priorizar lo importante.
    const rank = { critical: 0, high: 1, medium: 2, low: 3 } as const;
    explained.sort((a, b) => rank[a.severity] - rank[b.severity]);

    if (asksWhy || (!asksHowLong && !asksFirst)) {
      for (const e of explained) {
        parts.push(
          `${e.code} — ${e.title}. Causa más probable (${e.probability}%): ${e.probableCause}.`,
        );
      }
    }
    if (asksHowLong) {
      for (const e of explained) {
        parts.push(`${e.code}: ${e.canDrive}`);
      }
    }
    if (asksFirst) {
      const first = explained[0];
      if (first) {
        parts.push(
          `Empieza por ${first.code} (${first.title}), es lo más severo. ` +
            `Primer paso recomendado: ${first.solutions[0] ?? "diagnosis en taller"}.`,
        );
      }
    }
  }

  // Observaciones de telemetría relevantes.
  if (telemetry) {
    if (telemetry.coolantTemp >= 110) {
      parts.push(
        `Atención: el refrigerante está a ${Math.round(telemetry.coolantTemp)} °C. Detén el motor en cuanto sea seguro.`,
      );
    }
    if (telemetry.engineRunning && telemetry.batteryVoltage < 12.8) {
      parts.push(
        `La tensión con motor en marcha es ${telemetry.batteryVoltage.toFixed(1)} V: el alternador podría no estar cargando.`,
      );
    }
    if (telemetry.fuelLevel < 10) {
      parts.push(`Nivel de combustible bajo (${Math.round(telemetry.fuelLevel)} %).`);
    }
  }

  parts.push("(Respuesta generada localmente: el asistente en línea no está disponible.)");
  return { answer: parts.join("\n\n"), local: true };
}
