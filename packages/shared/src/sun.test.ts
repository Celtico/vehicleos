import { describe, expect, it } from "vitest";
import { daylightAt, daylightFactor, solarTimes } from "./sun";

/** Barcelona, para tener una referencia comprobable. */
const BCN = { lat: 41.3874, lon: 2.1686 };
/** Tromsø, dentro del círculo polar ártico. */
const POLAR = { lat: 69.6496, lon: 18.956 };

/** Hora local (UTC+2 en verano peninsular) expresada en UTC. */
function utc(iso: string): Date {
  return new Date(iso);
}

describe("cálculo solar", () => {
  it("sitúa el amanecer y el anochecer de un día de verano en Barcelona", () => {
    const { sunrise, sunset, polar } = solarTimes(BCN, utc("2026-06-21T12:00:00Z"));
    expect(polar).toBe(false);
    const orto = new Date(sunrise!);
    const ocaso = new Date(sunset!);
    // En el solsticio de verano amanece hacia las 06:17 y anochece hacia
    // las 21:28 hora local (04:17 y 19:28 UTC).
    expect(orto.getUTCHours()).toBe(4);
    expect(ocaso.getUTCHours()).toBe(19);
    // Y el día dura unas 15 horas.
    const horas = (sunset! - sunrise!) / 3_600_000;
    expect(horas).toBeGreaterThan(15);
    expect(horas).toBeLessThan(15.5);
  });

  it("en invierno el día es mucho más corto", () => {
    const { sunrise, sunset } = solarTimes(BCN, utc("2026-12-21T12:00:00Z"));
    const horas = (sunset! - sunrise!) / 3_600_000;
    expect(horas).toBeGreaterThan(9);
    expect(horas).toBeLessThan(9.5);
  });

  it("detecta el sol de medianoche en latitudes polares", () => {
    expect(solarTimes(POLAR, utc("2026-06-21T12:00:00Z")).polar).toBe(true);
  });
});

describe("día o noche", () => {
  it("mediodía es día y medianoche es noche", () => {
    expect(daylightAt(BCN, utc("2026-06-21T12:00:00Z"))).toBe("day");
    expect(daylightAt(BCN, utc("2026-06-21T23:30:00Z"))).toBe("night");
  });

  it("sin posición recurre a la hora local en vez de fallar", () => {
    expect(daylightAt(undefined, new Date(2026, 5, 21, 13, 0))).toBe("day");
    expect(daylightAt(undefined, new Date(2026, 5, 21, 3, 0))).toBe("night");
  });

  it("en verano polar es de día aunque sea de madrugada", () => {
    expect(daylightAt(POLAR, utc("2026-06-21T01:00:00Z"))).toBe("day");
  });
});

describe("transición de crepúsculo", () => {
  it("vale 1 en pleno día y 0 en noche cerrada", () => {
    expect(daylightFactor(BCN, utc("2026-06-21T12:00:00Z"))).toBe(1);
    expect(daylightFactor(BCN, utc("2026-06-21T23:30:00Z"))).toBe(0);
  });

  it("atenúa progresivamente en el ocaso en lugar de dar un salto", () => {
    const { sunset } = solarTimes(BCN, utc("2026-06-21T12:00:00Z"));
    const justoAlOcaso = daylightFactor(BCN, new Date(sunset!));
    // A mitad de la ventana debe estar a medio camino.
    expect(justoAlOcaso).toBeGreaterThan(0.4);
    expect(justoAlOcaso).toBeLessThan(0.6);
    // Y avanzar monótonamente hacia 0.
    const despues = daylightFactor(BCN, new Date(sunset! + 10 * 60_000));
    expect(despues).toBeLessThan(justoAlOcaso);
  });

  it("nunca se sale del rango 0-1", () => {
    for (const h of [0, 3, 6, 9, 12, 15, 18, 21, 23]) {
      const f = daylightFactor(BCN, utc(`2026-06-21T${String(h).padStart(2, "0")}:00:00Z`));
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThanOrEqual(1);
    }
  });
});
