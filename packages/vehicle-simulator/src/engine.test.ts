import { describe, expect, it } from "vitest";
import { VehicleSimulator } from "./engine";

/** Avanza la simulación `seconds` segundos en pasos de 50 ms sin timers. */
function advance(sim: VehicleSimulator, seconds: number): void {
  const dt = 0.05;
  for (let t = 0; t < seconds; t += dt) sim.tick(dt);
}

describe("VehicleSimulator", () => {
  it("arranca con caída de tensión y luego estabiliza a ~14 V", () => {
    const sim = new VehicleSimulator();
    sim.start("idle");
    sim.stop(); // paramos el timer real; conducimos los ticks a mano
    sim.start("idle");
    advance(sim, 0.5);
    expect(sim.getTelemetry().batteryVoltage).toBeLessThan(11.5); // arrancando
    advance(sim, 20);
    expect(sim.getTelemetry().batteryVoltage).toBeGreaterThan(13.5);
    sim.stop();
  });

  it("en autopista alcanza ~120 km/h con rpm en zona de crucero", () => {
    const sim = new VehicleSimulator();
    sim.start("highway");
    sim.stop();
    sim.start("highway");
    advance(sim, 90);
    const t = sim.getTelemetry();
    expect(t.speed).toBeGreaterThan(110);
    expect(t.speed).toBeLessThanOrEqual(125);
    expect(t.rpm).toBeGreaterThan(1500);
    expect(t.rpm).toBeLessThan(4000);
    sim.stop();
  });

  it("el escenario overheat sube la temperatura y marca el motor en error", () => {
    const sim = new VehicleSimulator();
    sim.start("overheat");
    sim.stop();
    sim.start("overheat");
    advance(sim, 300);
    const t = sim.getTelemetry();
    expect(t.coolantTemp).toBeGreaterThan(105);
    expect(t.systems.engine).toBe("error");
    expect(sim.getDtc().map((d) => d.code)).toContain("P0217");
    sim.stop();
  });

  it("el modo emergencia limita velocidad y rpm", () => {
    const sim = new VehicleSimulator();
    sim.start("emergency");
    sim.stop();
    sim.start("emergency");
    advance(sim, 120);
    const t = sim.getTelemetry();
    expect(t.speed).toBeLessThanOrEqual(61);
    expect(t.rpm).toBeLessThanOrEqual(2500);
    sim.stop();
  });

  it("clearDtc borra los códigos", () => {
    const sim = new VehicleSimulator();
    sim.start("abs-fault");
    sim.stop();
    expect(sim.getDtc().length).toBeGreaterThan(0);
    sim.clearDtc();
    expect(sim.getDtc()).toHaveLength(0);
  });

  it("avisa a los suscriptores del apagado del motor", () => {
    const sim = new VehicleSimulator();
    const vistos: boolean[] = [];
    sim.start("idle");
    sim.stop();
    // Nos suscribimos con el motor ya en marcha y comprobamos el apagado.
    sim.start("idle");
    const baja = sim.subscribe((t) => vistos.push(t.engineRunning));
    advance(sim, 3);
    expect(vistos.at(-1)).toBe(true);
    sim.stop();
    // La última emisión debe declarar el motor parado.
    expect(vistos.at(-1)).toBe(false);
    baja();
  });

  it("consume combustible al conducir", () => {
    const sim = new VehicleSimulator({ initialFuel: 50 });
    sim.start("highway");
    sim.stop();
    sim.start("highway");
    advance(sim, 300);
    expect(sim.getTelemetry().fuelLevel).toBeLessThan(50);
    sim.stop();
  });
});
