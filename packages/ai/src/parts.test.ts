import { describe, expect, it } from "vitest";
import { partsForCode, partsFromDtc } from "./parts";

describe("mapeo de averías a piezas", () => {
  it("identifica la esquina exacta en los códigos de sensor de rueda", () => {
    expect(partsForCode("C0035")).toEqual(["wheel-fl"]);
    expect(partsForCode("C0040")).toEqual(["wheel-fr"]);
    expect(partsForCode("C0045")).toEqual(["wheel-rl"]);
    expect(partsForCode("C0050")).toEqual(["wheel-rr"]);
  });

  it("lleva las averías de motor al vano motor", () => {
    expect(partsForCode("P0401")).toEqual(["engine"]);
    expect(partsForCode("P0217")).toEqual(["engine"]);
  });

  it("un fallo de ESP afecta a las cuatro ruedas", () => {
    expect(partsForCode("C1234")).toHaveLength(4);
  });

  it("cae a la categoría del código cuando no hay mapeo concreto", () => {
    expect(partsForCode("P0999")).toEqual(["engine"]);
    expect(partsForCode("B9999")).toEqual(["body"]);
  });

  it("normaliza minúsculas y espacios", () => {
    expect(partsForCode(" c0035 ")).toEqual(["wheel-fl"]);
  });

  it("gana la severidad más alta cuando varias averías tocan la misma pieza", () => {
    const parts = partsFromDtc([
      { code: "P0401", status: "pending" },
      { code: "P0217", status: "stored" },
    ]);
    expect(parts.engine).toBe("error"); // stored pesa más que pending
  });

  it("una avería pendiente se marca como aviso, no como error", () => {
    expect(partsFromDtc([{ code: "C0035", status: "pending" }])["wheel-fl"]).toBe("warning");
  });
});
