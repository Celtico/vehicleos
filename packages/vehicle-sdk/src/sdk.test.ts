import { describe, expect, it } from "vitest";
import { createVehicleProvider } from "./factory";
import { NotConnectedError } from "./provider";
import { SimulatorProvider } from "./providers/simulator-provider";

describe("SimulatorProvider", () => {
  it("cumple el ciclo connect → lecturas → disconnect", async () => {
    const provider = new SimulatorProvider({ scenario: "idle" });
    await provider.connect();
    expect(provider.state()).toBe("connected");

    expect(typeof (await provider.speed())).toBe("number");
    expect(typeof (await provider.rpm())).toBe("number");
    expect(typeof (await provider.battery())).toBe("number");
    expect(typeof (await provider.coolant())).toBe("number");
    expect(typeof (await provider.turbo())).toBe("number");
    expect(typeof (await provider.fuel())).toBe("number");
    expect(Array.isArray(await provider.dtc())).toBe(true);

    await provider.disconnect();
    expect(provider.state()).toBe("disconnected");
  });

  it("rechaza lecturas sin conectar", async () => {
    const provider = new SimulatorProvider();
    await expect(provider.speed()).rejects.toBeInstanceOf(NotConnectedError);
  });

  it("emite telemetría por live() sin polling", async () => {
    const provider = new SimulatorProvider({ scenario: "city", tickHz: 50 });
    await provider.connect();

    const received = await new Promise<number>((resolve) => {
      let count = 0;
      const unsubscribe = provider.live(() => {
        count++;
        if (count >= 3) {
          unsubscribe();
          resolve(count);
        }
      });
    });

    expect(received).toBeGreaterThanOrEqual(3);
    await provider.disconnect();
  });
});

describe("createVehicleProvider", () => {
  it("crea el provider pedido", () => {
    expect(createVehicleProvider("simulator").id).toBe("simulator");
    expect(createVehicleProvider("android-bridge").id).toBe("android-bridge");
  });

  it("los providers futuros existen pero avisan de que no están implementados", async () => {
    const can = createVehicleProvider("can");
    await expect(can.connect()).rejects.toThrow(/no está implementado/);
  });
});
