/**
 * Asistente de diagnóstico.
 *
 * Si ANTHROPIC_API_KEY está definida se consulta a Claude (claude-sonnet-5)
 * con un prompt de mecánico experto en español; si no, se responde con un
 * diagnóstico local determinista construido EXCLUSIVAMENTE a partir de los
 * datos recibidos (nunca se inventa información). El campo `source` indica
 * de dónde salió la respuesta.
 */
import Anthropic from "@anthropic-ai/sdk";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { explainDtc, type DtcExplanation } from "@vehicleos/ai";
import {
  RPM_MOTOR_EN_MARCHA,
  UMBRAL_BATERIA_BAJA,
  UMBRAL_COMBUSTIBLE_BAJO,
  UMBRAL_SOBRECALENTAMIENTO,
} from "../alerts/alert-rules.service";
import { AskDto } from "./dto/ask.dto";
import { ExplainDtcDto } from "./dto/explain-dtc.dto";

/** Respuesta del asistente. */
export interface AiAnswer {
  /** "claude" si respondió el modelo, "local" si es el modo degradado. */
  source: "claude" | "local";
  answer: string;
}

const MODEL = "claude-sonnet-5";

const SYSTEM_PROMPT = `Eres un mecánico experto de automóviles con años de experiencia en diagnosis OBD-II.
Respondes SIEMPRE en español, de forma clara y ordenada, a propietarios sin conocimientos técnicos profundos.
Usa únicamente los datos reales del coche incluidos en el mensaje (telemetría, códigos de avería); no inventes valores que no te hayan dado.
Estructura tus respuestas: qué significa, causas probables ordenadas por frecuencia, gravedad y si se puede seguir circulando, y próximos pasos recomendados.
Si los datos son insuficientes para afirmar algo, dilo explícitamente.`;

/**
 * Resume una entrada de la base de conocimiento como texto.
 *
 * Se usa en dos sitios: como respuesta local cuando no hay IA, y como
 * contexto factual en el prompt de Claude, para que el modelo parta del
 * mismo conocimiento verificado que ve la PWA en lugar de improvisar.
 */
function knowledgeToText(k: DtcExplanation): string {
  const lineas = [
    `${k.code} — ${k.title} (${k.system}).`,
    `Causa más probable (${k.probability} %): ${k.probableCause}.`,
    "",
    "Causas ordenadas de más a menos probable:",
    ...k.causes.map((c, i) => `${i + 1}. ${c}`),
    "",
    "Soluciones posibles:",
    ...k.solutions.map((s) => `- ${s}`),
    "",
    `¿Puedo seguir conduciendo? ${k.canDrive}`,
  ];
  if (k.generic) {
    lineas.push(
      "",
      "Este código no está en la base de conocimiento: lo anterior es una " +
        "orientación por categoría, no un diagnóstico del código concreto.",
    );
  }
  return lineas.join("\n");
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly client: Anthropic | null;

  constructor(config: ConfigService) {
    const apiKey = config.get<string>("ANTHROPIC_API_KEY");
    this.client = apiKey ? new Anthropic({ apiKey }) : null;
    if (!this.client) {
      this.logger.log(
        "ANTHROPIC_API_KEY no definida: el asistente usará respuestas locales deterministas",
      );
    }
  }

  /** POST /ai/dtc — explica un código de avería con el contexto del coche. */
  async explainDtc(dto: ExplainDtcDto): Promise<AiAnswer> {
    const code = dto.code.toUpperCase();
    const conocimiento = explainDtc(code);

    if (this.client) {
      const prompt = [
        `Código de avería detectado en mi coche: ${code}.`,
        "",
        "Ficha técnica verificada de este código (úsala como base):",
        knowledgeToText(conocimiento),
        "",
        dto.telemetry
          ? `Telemetría actual del coche (datos reales): ${JSON.stringify(dto.telemetry)}`
          : "No dispongo de telemetría en este momento.",
        "Explícame qué significa este código, sus causas probables, su gravedad y qué debería hacer.",
      ].join("\n");
      const remote = await this.callClaude(prompt);
      if (remote !== null) {
        return { source: "claude", answer: remote };
      }
    }
    return { source: "local", answer: this.localDtcAnswer(conocimiento, dto.telemetry) };
  }

  /** POST /ai/ask — pregunta libre con contexto de telemetría y DTCs. */
  async ask(dto: AskDto): Promise<AiAnswer> {
    if (this.client) {
      const prompt = [
        `Pregunta del propietario: ${dto.question}`,
        dto.telemetry
          ? `Telemetría actual del coche (datos reales): ${JSON.stringify(dto.telemetry)}`
          : "Sin telemetría disponible.",
        dto.dtc && dto.dtc.length > 0
          ? [
              `Códigos de avería activos: ${JSON.stringify(dto.dtc)}`,
              "",
              "Fichas técnicas verificadas de esos códigos (úsalas como base):",
              ...this.activeCodes(dto).map((c) => knowledgeToText(explainDtc(c))),
            ].join("\n")
          : "Sin códigos de avería activos conocidos.",
      ].join("\n");
      const remote = await this.callClaude(prompt);
      if (remote !== null) {
        return { source: "claude", answer: remote };
      }
    }
    return { source: "local", answer: this.localAskAnswer(dto) };
  }

  /** Llama a Claude; devuelve null si falla o rehúsa (se degrada a local). */
  private async callClaude(userContent: string): Promise<string | null> {
    if (!this.client) return null;
    try {
      const response = await this.client.messages.create({
        model: MODEL,
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userContent }],
      });
      if (response.stop_reason === "refusal") {
        this.logger.warn("Claude rehusó responder; se usa la respuesta local");
        return null;
      }
      const text = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === "text")
        .map((block) => block.text)
        .join("\n")
        .trim();
      return text.length > 0 ? text : null;
    } catch (error) {
      this.logger.error(`Error llamando a Claude: ${String(error)}`);
      return null;
    }
  }

  /**
   * Respuesta local determinista para un DTC.
   *
   * Se apoya en la base de conocimiento de @vehicleos/ai (la misma que usa
   * la PWA), de modo que sin API key la respuesta sigue siendo útil y
   * coherente con lo que muestra la pantalla de diagnóstico.
   */
  private localDtcAnswer(
    conocimiento: DtcExplanation,
    telemetry?: Record<string, unknown>,
  ): string {
    const lineas: string[] = [knowledgeToText(conocimiento)];

    const observaciones = this.telemetryObservations(telemetry);
    if (observaciones.length > 0) {
      lineas.push("", "Observaciones según la telemetría actual de tu coche:");
      lineas.push(...observaciones.map((o) => `- ${o}`));
    }

    lineas.push(
      "",
      "(Respuesta generada localmente sin IA: configura ANTHROPIC_API_KEY para un diagnóstico detallado.)",
    );
    return lineas.join("\n");
  }

  /** Respuesta local determinista para una pregunta libre. */
  private localAskAnswer(dto: AskDto): string {
    const lineas: string[] = [
      `Sobre tu pregunta: "${dto.question}"`,
      "",
      "No hay conexión con el asistente de IA, así que te resumo lo que dicen los datos reales de tu coche:",
    ];

    const observaciones = this.telemetryObservations(dto.telemetry);
    if (observaciones.length > 0) {
      lineas.push(...observaciones.map((o) => `- ${o}`));
    } else {
      lineas.push("- No se han recibido datos de telemetría con la pregunta.");
    }

    const codigos = this.activeCodes(dto);
    if (codigos.length > 0) {
      lineas.push(`- Códigos de avería activos: ${codigos.join(", ")}.`);
      // Ficha de cada código: sin IA, esto es lo más útil que se puede dar.
      for (const code of codigos) {
        lineas.push("", knowledgeToText(explainDtc(code)));
      }
    } else {
      lineas.push("- Sin códigos de avería activos conocidos.");
    }

    lineas.push("", "Para una respuesta elaborada, configura ANTHROPIC_API_KEY en el backend.");
    return lineas.join("\n");
  }

  /** Códigos válidos presentes en la petición, normalizados. */
  private activeCodes(dto: AskDto): string[] {
    return (dto.dtc ?? [])
      .map((d) => (typeof d.code === "string" ? d.code.trim().toUpperCase() : null))
      .filter((c): c is string => c !== null && c.length > 0);
  }

  /**
   * Observaciones deterministas derivadas de la telemetría recibida,
   * usando los mismos umbrales que las reglas de alertas.
   */
  private telemetryObservations(telemetry?: Record<string, unknown>): string[] {
    if (!telemetry) return [];
    const obs: string[] = [];
    const num = (key: string): number | null => {
      const value = telemetry[key];
      return typeof value === "number" && Number.isFinite(value) ? value : null;
    };

    const coolant = num("coolantTemp");
    if (coolant !== null) {
      obs.push(
        coolant > UMBRAL_SOBRECALENTAMIENTO
          ? `Temperatura del refrigerante ALTA: ${coolant} °C (por encima de ${UMBRAL_SOBRECALENTAMIENTO} °C).`
          : `Temperatura del refrigerante: ${coolant} °C (dentro del rango normal).`,
      );
    }

    const rpm = num("rpm");
    const voltage = num("batteryVoltage");
    if (voltage !== null) {
      const motorEnMarcha = rpm !== null && rpm > RPM_MOTOR_EN_MARCHA;
      if (motorEnMarcha && voltage < UMBRAL_BATERIA_BAJA) {
        obs.push(
          `Tensión de batería BAJA con el motor en marcha: ${voltage} V (posible fallo de carga).`,
        );
      } else {
        obs.push(`Tensión de batería: ${voltage} V.`);
      }
    }

    const fuel = num("fuelLevel");
    if (fuel !== null) {
      obs.push(
        fuel < UMBRAL_COMBUSTIBLE_BAJO
          ? `Nivel de combustible BAJO: ${fuel} %.`
          : `Nivel de combustible: ${fuel} %.`,
      );
    }

    const speed = num("speed");
    if (speed !== null) {
      obs.push(`Velocidad actual: ${speed} km/h.`);
    }
    if (rpm !== null) {
      obs.push(`Régimen del motor: ${rpm} rpm.`);
    }

    return obs;
  }
}
