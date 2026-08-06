/** Tests del asistente IA en modo degradado (sin ANTHROPIC_API_KEY). */
import type { ConfigService } from "@nestjs/config";
import { AiService } from "./ai.service";

/** ConfigService falso sin ANTHROPIC_API_KEY definida. */
function configWithoutKey(): ConfigService {
  return { get: jest.fn().mockReturnValue(undefined) } as unknown as ConfigService;
}

describe("AiService (modo degradado sin API key)", () => {
  let service: AiService;

  beforeEach(() => {
    service = new AiService(configWithoutKey());
  });

  it("explica un DTC conocido con la base de conocimiento compartida", async () => {
    const result = await service.explainDtc({ code: "P0401" });
    expect(result.source).toBe("local");
    expect(result.answer).toContain("P0401");
    // Debe coincidir con lo que muestra la PWA: EGR con 80 % de probabilidad.
    expect(result.answer).toContain("EGR");
    expect(result.answer).toContain("80 %");
    expect(result.answer).toContain("¿Puedo seguir conduciendo?");
  });

  it("normaliza el código a mayúsculas", async () => {
    const result = await service.explainDtc({ code: "c1234" });
    expect(result.answer).toContain("C1234");
    expect(result.answer).toContain("estabilidad");
  });

  it("marca como orientativo un código que no está en la base", async () => {
    const result = await service.explainDtc({ code: "P0999" });
    expect(result.answer).toContain("P0999");
    expect(result.answer).toContain("no está en la base de conocimiento");
  });

  it("usa la telemetría real recibida sin inventar valores", async () => {
    const result = await service.explainDtc({
      code: "P0217",
      telemetry: { coolantTemp: 112, batteryVoltage: 12.4, fuelLevel: 55, rpm: 2500 },
    });
    expect(result.source).toBe("local");
    // Los valores citados provienen exactamente de la telemetría enviada.
    expect(result.answer).toContain("112");
    expect(result.answer).toContain("12.4");
    expect(result.answer).toContain("55");
    // 112 °C > 105 → debe marcarse como temperatura alta.
    expect(result.answer).toContain("ALTA");
  });

  it("es determinista: la misma entrada produce la misma salida", async () => {
    const input = {
      code: "P0300",
      telemetry: { coolantTemp: 90, rpm: 800 },
    };
    const a = await service.explainDtc(input);
    const b = await service.explainDtc(input);
    expect(a).toEqual(b);
  });

  it("responde a /ai/ask en local citando telemetría y DTCs recibidos", async () => {
    const result = await service.ask({
      question: "¿Puedo seguir circulando?",
      telemetry: { coolantTemp: 90, batteryVoltage: 11.2, rpm: 2000, fuelLevel: 8 },
      dtc: [{ code: "P0562" }],
    });
    expect(result.source).toBe("local");
    expect(result.answer).toContain("¿Puedo seguir circulando?");
    // Batería baja con motor en marcha y combustible bajo, según los umbrales.
    expect(result.answer).toContain("11.2");
    expect(result.answer).toContain("BAJA");
    expect(result.answer).toContain("P0562");
  });

  it("indica cuándo no hay telemetría en lugar de inventarla", async () => {
    const result = await service.ask({ question: "¿Está todo bien?" });
    expect(result.answer).toContain("No se han recibido datos de telemetría");
  });
});
