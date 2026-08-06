/**
 * Tests de explainDtc.
 */
import { describe, expect, it } from "vitest";
import { DTC_KNOWLEDGE } from "./knowledge";
import { explainDtc } from "./explain";

describe("explainDtc", () => {
  it("devuelve la entrada de la base para un código conocido", () => {
    const e = explainDtc("P0401");
    expect(e.generic).toBe(false);
    expect(e.title).toContain("EGR");
    expect(e.probableCause).toContain("EGR");
    expect(e.probability).toBe(80);
    expect(e.causes.length).toBeGreaterThan(0);
    expect(e.solutions.length).toBeGreaterThan(0);
    expect(e.canDrive.length).toBeGreaterThan(10);
    expect(e.category).toBe("powertrain");
  });

  it("normaliza el código (minúsculas y espacios)", () => {
    const e = explainDtc("  p0217 ");
    expect(e.generic).toBe(false);
    expect(e.code).toBe("P0217");
    expect(e.severity).toBe("critical");
  });

  it("genera explicación genérica powertrain para P desconocido", () => {
    const e = explainDtc("P1999");
    expect(e.generic).toBe(true);
    expect(e.category).toBe("powertrain");
    expect(e.code).toBe("P1999");
    expect(e.causes.length).toBeGreaterThan(0);
  });

  it("genera explicación genérica por categoría C/B/U", () => {
    expect(explainDtc("C0999").category).toBe("chassis");
    expect(explainDtc("B1999").category).toBe("body");
    expect(explainDtc("U0999").category).toBe("network");
    expect(explainDtc("U0999").generic).toBe(true);
  });

  it("la base tiene al menos 15 códigos completos y coherentes", () => {
    const entries = Object.values(DTC_KNOWLEDGE);
    expect(entries.length).toBeGreaterThanOrEqual(15);
    for (const e of entries) {
      expect(e.code).toMatch(/^[PCBU]\d[0-9A-F]{3}$/);
      expect(e.probability).toBeGreaterThan(0);
      expect(e.probability).toBeLessThanOrEqual(100);
      expect(e.causes.length).toBeGreaterThan(0);
      expect(e.solutions.length).toBeGreaterThan(0);
      expect(e.canDrive.length).toBeGreaterThan(10);
      // La clave del mapa coincide con el código de la entrada.
      expect(DTC_KNOWLEDGE[e.code]).toBe(e);
    }
  });
});
