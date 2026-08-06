/** Tests de las reglas automáticas de alertas (con Prisma mockeado). */
import type { TelemetrySample } from "@vehicleos/shared";
import type { PrismaService } from "../prisma/prisma.service";
import {
  AlertRulesService,
  evaluateSample,
  UMBRAL_BATERIA_BAJA,
  UMBRAL_SOBRECALENTAMIENTO,
} from "./alert-rules.service";

/** Muestra sana por defecto; se sobrescriben campos según el caso. */
function sample(overrides: Partial<TelemetrySample> = {}): TelemetrySample {
  return {
    timestamp: 1_700_000_000_000,
    speed: 80,
    rpm: 2200,
    coolantTemp: 90,
    batteryVoltage: 14.1,
    fuelLevel: 60,
    ...overrides,
  };
}

describe("evaluateSample (reglas puras)", () => {
  it("no genera alertas con una muestra sana", () => {
    expect(evaluateSample(sample())).toEqual([]);
  });

  it("genera alerta critical overheat si coolantTemp > 105", () => {
    const alerts = evaluateSample(sample({ coolantTemp: 111.4 }));
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({ severity: "critical", kind: "overheat" });
    expect(alerts[0]?.message).toContain("111.4");
  });

  it("no genera overheat justo en el umbral (105 no es > 105)", () => {
    expect(evaluateSample(sample({ coolantTemp: UMBRAL_SOBRECALENTAMIENTO }))).toEqual([]);
  });

  it("genera warning low-battery solo con el motor en marcha", () => {
    const conMotor = evaluateSample(sample({ batteryVoltage: 11.2, rpm: 2000 }));
    expect(conMotor).toHaveLength(1);
    expect(conMotor[0]).toMatchObject({ severity: "warning", kind: "low-battery" });

    // Motor parado (rpm 0): la batería baja NO debe alertar.
    const sinMotor = evaluateSample(sample({ batteryVoltage: 11.2, rpm: 0 }));
    expect(sinMotor).toEqual([]);
  });

  it("no genera low-battery justo en el umbral", () => {
    expect(evaluateSample(sample({ batteryVoltage: UMBRAL_BATERIA_BAJA, rpm: 2000 }))).toEqual(
      [],
    );
  });

  it("genera info low-fuel si fuelLevel < 10", () => {
    const alerts = evaluateSample(sample({ fuelLevel: 6 }));
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({ severity: "info", kind: "low-fuel" });
  });

  it("acumula varias reglas en la misma muestra", () => {
    const alerts = evaluateSample(
      sample({ coolantTemp: 120, batteryVoltage: 11.0, rpm: 3000, fuelLevel: 4 }),
    );
    expect(alerts.map((a) => a.kind).sort()).toEqual(["low-battery", "low-fuel", "overheat"]);
  });
});

describe("AlertRulesService.applyRules (con Prisma mockeado)", () => {
  function buildPrismaMock(existingAlert: unknown = null) {
    return {
      alert: {
        findFirst: jest.fn().mockResolvedValue(existingAlert),
        create: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve({
            id: "alert-1",
            createdAt: new Date(),
            acknowledged: false,
            ...data,
          }),
        ),
      },
    };
  }

  it("persiste una única alerta por tipo aunque varias muestras la disparen", async () => {
    const prisma = buildPrismaMock();
    const service = new AlertRulesService(prisma as unknown as PrismaService);

    const created = await service.applyRules("veh-1", [
      sample({ coolantTemp: 110 }),
      sample({ coolantTemp: 115 }),
      sample({ coolantTemp: 120 }),
    ]);

    expect(created).toHaveLength(1);
    expect(prisma.alert.create).toHaveBeenCalledTimes(1);
    expect(prisma.alert.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        vehicleId: "veh-1",
        kind: "overheat",
        severity: "critical",
      }),
    });
  });

  it("no duplica una alerta si ya hay otra igual sin reconocer", async () => {
    const prisma = buildPrismaMock({ id: "ya-existe", kind: "overheat" });
    const service = new AlertRulesService(prisma as unknown as PrismaService);

    const created = await service.applyRules("veh-1", [sample({ coolantTemp: 110 })]);

    expect(created).toEqual([]);
    expect(prisma.alert.create).not.toHaveBeenCalled();
  });

  it("crea la alerta 'dtc' como warning para un código nuevo", async () => {
    const prisma = buildPrismaMock();
    const service = new AlertRulesService(prisma as unknown as PrismaService);

    const alert = await service.createDtcAlert("veh-1", "P0401");

    expect(alert).not.toBeNull();
    expect(prisma.alert.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        vehicleId: "veh-1",
        kind: "dtc",
        severity: "warning",
        message: expect.stringContaining("P0401"),
      }),
    });
  });
});
